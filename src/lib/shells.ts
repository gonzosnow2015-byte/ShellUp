import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
  encodeAbiParameters,
  type Address,
  type EIP1193Provider,
} from "viem";

export const MONAD_ID = 143;
export const MONCHEL: Address = "0xB6842737e2a6d5a92aBA03eD0CCA578303E87777";
export const STAMP = 25n * 10n ** 18n;
export const NATIVE: Address = "0x0000000000000000000000000000000000000000";
export const QUIET: Address = "0x6387b6298eAc0f50464daC5171Dd565def9e4bED";
export const QUIET_INTERVAL = {
  "1": 3_600n,
  "2": 7_200n,
  "3": 10_800n,
} as const;
export const DRIP: Address = "0xF5c414AE04Ebd24c83C7DDA37F1936404D9eA214";
export const DRIP_NEXT: Address = "0x7Bb139Fe25139108a7e14342c554Bb123ef807E0";
export const DRIP_DURATION = {
  "1": 2_592_000n,
  "6": 15_724_800n,
  "12": 31_536_000n,
} as const;
const NOTE_MAX = 140;
const LIST_CAP = 400;
const READ_CHUNK = 20;

function newestIds(total: number): number[] {
  const start = Math.max(0, total - LIST_CAP);
  const ids = Array.from({ length: total - start }, (_, i) => start + i);
  ids.reverse();
  return ids;
}

export const monad = defineChain({
  id: MONAD_ID,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monadscan", url: "https://monadscan.com" } },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

const shellsAbi = [
  {
    type: "function",
    name: "STAMP",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "shellCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getShell",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "shell",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "sender", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "unlockTime", type: "uint256" },
          { name: "claimed", type: "bool" },
          { name: "note", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "createNative",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "unlockTime", type: "uint256" },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "createERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "unlockTime", type: "uint256" },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const publicClient = createPublicClient({
  chain: monad,
  transport: http("https://rpc.monad.xyz", { timeout: 12_000 }),
});

export type ShellRow = {
  id: number;
  token: Address;
  sender: Address;
  recipient: Address;
  amount: bigint;
  unlockTime: number;
  claimed: boolean;
  claimedAt: number | null;
  createdAt: number | null;
  note: string;
  symbol: string;
  decimals: number;
};

const metaCache = new Map<string, { symbol: string; decimals: number }>();

export function asAddress(value: string): Address | null {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) return null;
  return getAddress(trimmed);
}

export function shortAddr(value: string): string {
  if (value.length < 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function noteBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function clampNote(value: string, max = NOTE_MAX): string {
  if (noteBytes(value) <= max) return value;
  let out = "";
  for (const ch of value) {
    if (noteBytes(out + ch) > max) break;
    out += ch;
  }
  return out;
}

export function formatAmount(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const raw = formatUnits(value, decimals);
  if (!raw.includes(".")) return raw;
  const [whole, frac] = raw.split(".");
  const cut = frac.slice(0, 8).replace(/0+$/, "");
  if (cut) return `${whole}.${cut}`;
  return `<0.${"0".repeat(7)}1`;
}

export function formatWhen(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function errorText(err: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  const queue: unknown[] = [err];
  while (queue.length && seen.size < 12) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (typeof current === "string") {
      parts.push(current);
      continue;
    }
    if (typeof current !== "object") {
      parts.push(String(current));
      continue;
    }
    const extra = current as {
      message?: unknown;
      shortMessage?: unknown;
      details?: unknown;
      reason?: unknown;
      metaMessages?: unknown;
      cause?: unknown;
      data?: { args?: unknown };
    };
    for (const value of [extra.reason, extra.shortMessage, extra.message, extra.details]) {
      if (typeof value === "string" && value) parts.push(value);
    }
    if (Array.isArray(extra.metaMessages)) {
      for (const line of extra.metaMessages) {
        if (typeof line === "string" && line) parts.push(line);
      }
    }
    const arg = extra.data?.args;
    if (Array.isArray(arg) && typeof arg[0] === "string") parts.push(arg[0]);
    if (extra.cause) queue.push(extra.cause);
  }
  return parts.join("\n");
}

export function isRawRevertText(message: string): boolean {
  return /reverted with the following reason|^The contract function /i.test(message);
}

export function isClaimTooEarly(err: unknown, unlockTime?: number): boolean {
  const text = errorText(err);
  if (/user rejected|user denied|denied transaction/i.test(text)) return false;
  if (/\bwho\b/i.test(text) && !/\bearly\b/i.test(text)) return false;
  if (/\bclaimed\b/i.test(text) && !/\bearly\b/i.test(text)) return false;
  if (/\bearly\b|too soon|too early|unlock not reached/i.test(text)) return true;
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const header = lines.findIndex((line) => /reverted with the following reason/i.test(line));
  const reason = header >= 0 ? (lines[header + 1] ?? "") : "";
  if (/^early\b|too soon|too early|unlock not reached/i.test(reason)) return true;
  return unlockTime != null && unlockTime * 1000 > Date.now() && /revert/i.test(text);
}

export function explain(err: unknown): string {
  const msg = errorText(err);
  if (/user rejected|user denied|denied transaction/i.test(msg)) return "Wallet request cancelled.";
  if (msg.includes("$MONCHEL")) {
    const monchelLine = msg.split("\n")[0] ?? msg;
    if (monchelLine.length <= 160) return monchelLine;
  }
  if (/\bearly\b/i.test(msg)) return "Too early.";
  if (/\bunlock\b/i.test(msg)) return "Unlock has to be at least 1 hour from now.";
  if (/\bfee\b/i.test(msg)) return "That token takes a fee on transfer. Shells only locks the exact amount.";
  if (/\bstamp\b/i.test(msg)) return "Stamp failed. You need 25 $MONCHEL approved.";
  if (/\bnote\b/i.test(msg)) return "Note is too long.";
  if (/\bwho\b/i.test(msg)) return "Only the recipient can claim.";
  if (/\bclaimed\b/i.test(msg)) return "Already claimed.";
  if (/\bsettled\b/i.test(msg)) return "Already settled.";
  if (/\blate\b/i.test(msg)) return "Too late.";
  if (/\bsender\b/i.test(msg)) return "Only the sender can do that.";
  if (/\brecipient\b/i.test(msg)) return "Only the recipient can claim.";
  if (/\binterval\b/i.test(msg)) return "Pick 1, 2, or 3 hours.";
  if (/\bbalance\b/i.test(msg)) return "That token takes a fee on transfer. Shells only locks the exact amount.";
  if (/insufficient funds/i.test(msg)) return "Not enough MON for this.";
  const line = msg.split("\n")[0] ?? "";
  if (!line || isRawRevertText(line) || line.length > 160) return "";
  return line;
}

function provider(): EIP1193Provider | null {
  if (activeProvider) return activeProvider;
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  return eth ?? null;
}

let activeProvider: EIP1193Provider | null = null;

export function setActiveProvider(next: EIP1193Provider | null) {
  activeProvider = next;
}

export function connectedProvider(): EIP1193Provider | null {
  return provider();
}

export function clearActiveProvider() {
  activeProvider = null;
}

export type WalletChoice = {
  id: string;
  name: string;
  provider: EIP1193Provider;
};

const discovered = new Map<string, WalletChoice>();
let listening = false;

function allowedWallet(id: string, name: string): "OKX" | "MetaMask" | null {
  const blob = `${id} ${name}`.toLowerCase();
  if (blob.includes("phantom") || blob.includes("magic")) return null;
  if (blob.includes("okx") || blob.includes("okex")) return "OKX";
  if (blob.includes("metamask")) return "MetaMask";
  return null;
}

function rememberWallet(id: string, name: string, next: EIP1193Provider) {
  const label = allowedWallet(id, name);
  if (!label || !next) return;
  discovered.set(label, { id: label, name: label, provider: next });
}

function ensureWalletListener() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = (
      event as CustomEvent<{ info?: { uuid?: string; rdns?: string; name?: string }; provider?: EIP1193Provider }>
    ).detail;
    if (!detail?.provider) return;
    const id = detail.info?.rdns || detail.info?.uuid || detail.info?.name || "";
    rememberWallet(id, detail.info?.name || "Wallet", detail.provider);
  });
}

function readInjectedWallets() {
  const win = window as Window & {
    okxwallet?: EIP1193Provider;
    ethereum?: EIP1193Provider & {
      providers?: EIP1193Provider[];
      isMetaMask?: boolean;
      isOkxWallet?: boolean;
      isOKExWallet?: boolean;
    };
  };
  if (win.okxwallet) rememberWallet("com.okex.wallet", "OKX", win.okxwallet);
  const eth = win.ethereum;
  if (!eth) return;
  const list = eth.providers?.length ? eth.providers : [eth];
  for (const item of list) {
    const marked = item as EIP1193Provider & {
      isMetaMask?: boolean;
      isOkxWallet?: boolean;
      isOKExWallet?: boolean;
      isPhantom?: boolean;
      isMagicEden?: boolean;
    };
    if (marked.isPhantom || marked.isMagicEden) continue;
    if (marked.isOkxWallet || marked.isOKExWallet) rememberWallet("com.okex.wallet", "OKX", item);
    else if (marked.isMetaMask) rememberWallet("io.metamask", "MetaMask", item);
  }
}

function walletRank(choice: WalletChoice): number {
  if (choice.name === "OKX") return 0;
  if (choice.name === "MetaMask") return 1;
  return 2;
}

export function loadWalletChoices(): Promise<WalletChoice[]> {
  ensureWalletListener();
  if (typeof window === "undefined") return Promise.resolve([]);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  readInjectedWallets();
  return new Promise((resolve) => {
    window.setTimeout(() => {
      readInjectedWallets();
      resolve(
        [...discovered.values()]
          .filter((choice) => choice.name === "OKX" || choice.name === "MetaMask")
          .sort((a, b) => walletRank(a) - walletRank(b)),
      );
    }, 250);
  });
}

export function watchWallet(
  onAccounts: (account: string) => void,
  onChain: (chainId: number | null) => void,
  target?: EIP1193Provider | null,
): () => void {
  const eth = (target ?? provider()) as (EIP1193Provider & {
    on?: (event: string, listener: (value: unknown) => void) => void;
    removeListener?: (event: string, listener: (value: unknown) => void) => void;
  }) | null;
  if (!eth?.on) return () => {};
  const accountsListener = (value: unknown) => {
    const list = Array.isArray(value) ? value : [];
    onAccounts(typeof list[0] === "string" ? list[0] : "");
  };
  const chainListener = (value: unknown) => {
    onChain(typeof value === "string" ? Number.parseInt(value, 16) : null);
  };
  eth.on("accountsChanged", accountsListener);
  eth.on("chainChanged", chainListener);
  return () => {
    eth.removeListener?.("accountsChanged", accountsListener);
    eth.removeListener?.("chainChanged", chainListener);
  };
}

export async function requestAccounts(): Promise<Address> {
  const eth = provider();
  if (!eth) throw new Error("No wallet found.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const first = accounts[0];
  if (!first || !isAddress(first)) throw new Error("No wallet found.");
  return getAddress(first);
}

export async function currentAccount(): Promise<Address | ""> {
  const eth = provider();
  if (!eth) return "";
  const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  const first = accounts[0];
  if (!first || !isAddress(first)) return "";
  return getAddress(first);
}

export async function currentChainId(): Promise<number | null> {
  const eth = provider();
  if (!eth) return null;
  const hex = (await eth.request({ method: "eth_chainId" })) as string;
  const id = Number.parseInt(hex, 16);
  return Number.isFinite(id) ? id : null;
}

export async function switchToMonad(): Promise<void> {
  const eth = provider();
  if (!eth) throw new Error("No wallet found.");
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x8f" }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 4902) throw err;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x8f",
          chainName: "Monad",
          nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
          rpcUrls: ["https://rpc.monad.xyz"],
          blockExplorerUrls: ["https://monadscan.com"],
        },
      ],
    });
  }
}

function wallet(account: Address) {
  const eth = provider();
  if (!eth) throw new Error("No wallet found.");
  return createWalletClient({ account, chain: monad, transport: custom(eth) });
}

async function tokenMeta(token: Address): Promise<{ symbol: string; decimals: number }> {
  const key = token.toLowerCase();
  const cached = metaCache.get(key);
  if (cached) return cached;
  if (token.toLowerCase() === NATIVE) {
    const meta = { symbol: "MON", decimals: 18 };
    metaCache.set(key, meta);
    return meta;
  }
  if (token.toLowerCase() === MONCHEL.toLowerCase()) {
    const meta = { symbol: "$MONCHEL", decimals: 18 };
    metaCache.set(key, meta);
    return meta;
  }
  let decimals = 18;
  let symbol = shortAddr(token);
  try {
    decimals = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    });
  } catch {
    decimals = 18;
  }
  try {
    const read = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    });
    if (read) symbol = read;
  } catch {
    symbol = shortAddr(token);
  }
  const meta = { symbol, decimals };
  metaCache.set(key, meta);
  return meta;
}

export async function readPastedToken(token: Address): Promise<{ symbol: string; decimals: number }> {
  let decimals: number;
  let symbol: string;
  try {
    const [dec, sym] = await Promise.all([
      publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      }),
      publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "symbol",
      }),
    ]);
    decimals = typeof dec === "bigint" ? Number(dec) : dec;
    symbol = typeof sym === "string" ? sym.trim() : "";
  } catch {
    throw new Error("unreadable");
  }
  if (!symbol || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error("unreadable");
  }
  const meta = { symbol, decimals };
  metaCache.set(token.toLowerCase(), meta);
  return meta;
}

export async function readShellCount(shells: Address): Promise<number> {
  const count = await publicClient.readContract({
    address: shells,
    abi: shellsAbi,
    functionName: "shellCount",
  });
  const total = Number(count);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

export async function readShells(shells: Address, onBatch?: (rows: ShellRow[]) => void): Promise<ShellRow[]> {
  const count = await publicClient.readContract({
    address: shells,
    abi: shellsAbi,
    functionName: "shellCount",
  });
  const total = Number(count);
  if (!Number.isFinite(total) || total <= 0) return [];
  const ids = newestIds(total);
  const claimsP = claimTimes(shells, SHELL_CLAIMED_TOPIC);
  const createdP = claimTimes(shells, SHELL_CREATED_TOPIC);
  const acc: ShellRow[] = [];
  for (let i = 0; i < ids.length; i += READ_CHUNK) {
    const chunk = ids.slice(i, i + READ_CHUNK);
    const rows = await publicClient.multicall({
      allowFailure: false,
      contracts: chunk.map((id) => ({
        address: shells,
        abi: shellsAbi,
        functionName: "getShell" as const,
        args: [BigInt(id)] as const,
      })),
    });
    const unique = new Set<string>();
    for (const row of rows) unique.add(row.token.toLowerCase());
    await Promise.all([...unique].map((token) => tokenMeta(getAddress(token))));
    chunk.forEach((id, index) => {
      const row = rows[index];
      const meta = metaCache.get(row.token.toLowerCase()) ?? {
        symbol: shortAddr(row.token),
        decimals: 18,
      };
      acc.push({
        id,
        token: row.token,
        sender: row.sender,
        recipient: row.recipient,
        amount: row.amount,
        unlockTime: Number(row.unlockTime),
        claimed: row.claimed,
        claimedAt: null,
        createdAt: null,
        note: row.note,
        symbol: meta.symbol,
        decimals: meta.decimals,
      });
    });
    onBatch?.(acc.slice());
  }
  const [claims, created] = await Promise.all([claimsP, createdP]);
  for (const row of acc) {
    row.claimedAt = claims.get(row.id) ?? null;
    row.createdAt = created.get(row.id) ?? null;
  }
  onBatch?.(acc.slice());
  return acc;
}

export async function readShell(shells: Address, id: number): Promise<ShellRow | null> {
  try {
    const row = await publicClient.readContract({
      address: shells,
      abi: shellsAbi,
      functionName: "getShell",
      args: [BigInt(id)],
    });
    if (row.sender === NATIVE && row.amount === 0n) return null;
    const meta = await tokenMeta(row.token);
    return {
      id,
      token: row.token,
      sender: row.sender,
      recipient: row.recipient,
      amount: row.amount,
      unlockTime: Number(row.unlockTime),
      claimed: row.claimed,
      claimedAt: null,
      createdAt: Math.floor(Date.now() / 1000),
      note: row.note,
      symbol: meta.symbol,
      decimals: meta.decimals,
    };
  } catch {
    return null;
  }
}

async function stampOf(shells: Address): Promise<bigint> {
  try {
    return await publicClient.readContract({
      address: shells,
      abi: shellsAbi,
      functionName: "STAMP",
    });
  } catch {
    return STAMP;
  }
}

async function ensureAllowance(
  token: Address,
  owner: Address,
  spender: Address,
  needed: bigint,
  onStatus: (message: string) => void,
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  if (allowance >= needed) return;
  const client = wallet(owner);
  const approve = (amount: bigint) =>
    client.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount],
    });
  onStatus(token.toLowerCase() === MONCHEL.toLowerCase() ? "Approve the 25 $MONCHEL stamp." : "Approve the token.");
  let hash: `0x${string}`;
  try {
    hash = await approve(needed);
  } catch (err) {
    if (allowance === 0n) throw err;
    hash = await approve(0n);
    await publicClient.waitForTransactionReceipt({ hash });
    hash = await approve(needed);
  }
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function createShell(args: {
  shells: Address;
  account: Address;
  recipient: Address;
  token: "native" | Address;
  amountText: string;
  unlockTime: bigint;
  note: string;
  onStatus: (message: string) => void;
}): Promise<void> {
  if (noteBytes(args.note) > NOTE_MAX) throw new Error("note");
  const chainId = await currentChainId();
  if (chainId !== MONAD_ID) {
    args.onStatus("Switch to Monad.");
    await switchToMonad();
    if ((await currentChainId()) !== MONAD_ID) throw new Error("Switch to Monad.");
  }
  const stamp = await stampOf(args.shells);
  const native = args.token === "native";
  let tokenAddress: Address;
  if (args.token === "native") tokenAddress = NATIVE;
  else tokenAddress = args.token;
  const decimals = native ? 18 : (await tokenMeta(tokenAddress)).decimals;
  let amount: bigint;
  try {
    amount = parseUnits(args.amountText.trim(), decimals);
  } catch {
    throw new Error("Enter an amount.");
  }
  if (amount <= 0n) throw new Error("Enter an amount.");

  const lockingMonchel = !native && tokenAddress.toLowerCase() === MONCHEL.toLowerCase();
  const monchelNeed = lockingMonchel ? stamp + amount : stamp;
  const monchelBal = await publicClient.readContract({
    address: MONCHEL,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [args.account],
  });
  if (monchelBal < monchelNeed) {
    throw new Error(lockingMonchel ? "You need the amount plus 25 $MONCHEL." : "You need 25 $MONCHEL for the stamp.");
  }
  if (native) {
    const monBal = await publicClient.getBalance({ address: args.account });
    if (monBal <= amount) throw new Error("Keep a little MON for gas.");
  } else if (!lockingMonchel) {
    const bal = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [args.account],
    });
    if (bal < amount) throw new Error("Not enough of that token.");
  }

  await ensureAllowance(MONCHEL, args.account, args.shells, monchelNeed, args.onStatus);
  if (!native && !lockingMonchel) {
    await ensureAllowance(tokenAddress, args.account, args.shells, amount, args.onStatus);
  }

  args.onStatus("Confirm Shell up.");
  const client = wallet(args.account);
  const hash = native
    ? await client.writeContract({
        address: args.shells,
        abi: shellsAbi,
        functionName: "createNative",
        args: [args.recipient, args.unlockTime, args.note],
        value: amount,
      })
    : await client.writeContract({
        address: args.shells,
        abi: shellsAbi,
        functionName: "createERC20",
        args: [tokenAddress, amount, args.recipient, args.unlockTime, args.note],
      });
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function claimShell(args: {
  shells: Address;
  account: Address;
  id: number;
  onStatus: (message: string) => void;
}): Promise<void> {
  const chainId = await currentChainId();
  if (chainId !== MONAD_ID) {
    args.onStatus("Switch to Monad.");
    await switchToMonad();
    if ((await currentChainId()) !== MONAD_ID) throw new Error("Switch to Monad.");
  }
  args.onStatus("Confirm Claim.");
  const hash = await wallet(args.account).writeContract({
    address: args.shells,
    abi: shellsAbi,
    functionName: "claim",
    args: [BigInt(args.id)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

const quietAbi = [
  {
    type: "function",
    name: "boxCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getBox",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interval", type: "uint256" },
      { name: "lastCheck", type: "uint256" },
      { name: "claimableAt", type: "uint256" },
      { name: "settled", type: "bool" },
      { name: "note", type: "string" },
    ],
  },
  {
    type: "function",
    name: "createNative",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "interval", type: "uint256" },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "createERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "interval", type: "uint256" },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "STAMP",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type QuietBox = {
  id: number;
  token: Address;
  sender: Address;
  recipient: Address;
  amount: bigint;
  interval: number;
  lastCheck: number;
  claimableAt: number;
  settled: boolean;
  cancelled: boolean;
  claimedAt: number | null;
  createdAt: number | null;
  note: string;
  symbol: string;
  decimals: number;
};

export async function readQuietBoxes(onBatch?: (rows: QuietBox[]) => void): Promise<QuietBox[]> {
  const count = await publicClient.readContract({
    address: QUIET,
    abi: quietAbi,
    functionName: "boxCount",
  });
  const total = Number(count);
  if (!Number.isFinite(total) || total <= 0) return [];
  const ids = newestIds(total);
  const extraP = Promise.all([cancelledQuietIds(), claimTimes(QUIET, QUIET_CLAIMED_TOPIC), claimTimes(QUIET, BOX_CREATED_TOPIC)]);
  const acc: QuietBox[] = [];
  for (let i = 0; i < ids.length; i += READ_CHUNK) {
    const chunk = ids.slice(i, i + READ_CHUNK);
    const rows = await publicClient.multicall({
      allowFailure: false,
      contracts: chunk.map((id) => ({
        address: QUIET,
        abi: quietAbi,
        functionName: "getBox" as const,
        args: [BigInt(id)] as const,
      })),
    });
    const unique = new Set<string>();
    for (const row of rows) {
      if (row[0] !== NATIVE) unique.add(row[0].toLowerCase());
    }
    await Promise.all([...unique].map((token) => tokenMeta(getAddress(token))));
    chunk.forEach((id, index) => {
      const row = rows[index];
      const token = row[0];
      const native = token === NATIVE;
      const meta = native
        ? { symbol: "MON", decimals: 18 }
        : (metaCache.get(token.toLowerCase()) ?? { symbol: shortAddr(token), decimals: 18 });
      acc.push({
        id,
        token,
        sender: row[1],
        recipient: row[2],
        amount: row[3],
        interval: Number(row[4]),
        lastCheck: Number(row[5]),
        claimableAt: Number(row[6]),
        settled: row[7],
        cancelled: false,
        claimedAt: null,
        createdAt: null,
        note: row[8],
        symbol: meta.symbol,
        decimals: meta.decimals,
      });
    });
    onBatch?.(acc.slice());
  }
  const [cancelled, claims, created] = await extraP;
  for (const row of acc) {
    row.cancelled = cancelled.has(row.id);
    row.claimedAt = claims.get(row.id) ?? null;
    row.createdAt = created.get(row.id) ?? null;
  }
  onBatch?.(acc.slice());
  return acc;
}

const SHELL_CREATED_TOPIC =
  "0x47401e646a52b70c01993058b2a1e49912e5cc0efcbee75284c95fb53ce9d7f5" as const;
const BOX_CREATED_TOPIC =
  "0xd690d0c375c270ca78c1b39f10ed32ea8f55443d13a693f66b3d1eb3e2d4e0e2" as const;
const CANCELLED_TOPIC =
  "0x26deca31ff8139a06c52453ce8985d34f7648a6d9af1d283c4063d052c355a0f" as const;
const SHELL_CLAIMED_TOPIC =
  "0x65d3ac189b9e78a363783f5b81d30b1a45851ee52ca0bac7f4f7d7f571f12e7a" as const;
const QUIET_CLAIMED_TOPIC =
  "0x6aa3eac93d079e5e100b1029be716caa33586c96aa4baac390669fb5c2a21212" as const;
const DRIP_CLAIMED_TOPIC =
  "0x4ec90e965519d92681267467f775ada5bd214aa92c0dc93d90a5e880ce9ed026" as const;
const blockClaimedAt = new Map<string, number>();

async function claimTimes(address: Address, topic: `0x${string}`): Promise<Map<number, number>> {
  const times = new Map<number, number>();
  const client = createPublicClient({ chain: monad, transport: http("https://rpc1.monad.xyz", { timeout: 20_000 }) });
  let latest: bigint;
  try {
    latest = await client.getBlockNumber();
  } catch {
    return times;
  }
  const from = latest > 5_000_000n ? latest - 5_000_000n : 0n;
  let logs: { topics: readonly `0x${string}`[]; blockNumber: `0x${string}` | null }[] = [];
  try {
    logs = await client.request({
      method: "eth_getLogs",
      params: [
        {
          address,
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${latest.toString(16)}`,
          topics: [topic],
        },
      ],
    });
  } catch {
    return times;
  }
  const missing = [...new Set(logs.map((log) => log.blockNumber).filter((bn): bn is `0x${string}` => !!bn && !blockClaimedAt.has(bn)))];
  await Promise.all(
    missing.map(async (bn) => {
      try {
        const block = await client.getBlock({ blockNumber: BigInt(bn) });
        blockClaimedAt.set(bn, Number(block.timestamp));
      } catch {
        // No time for this block. Those cards stay at the bottom of Claimed.
      }
    }),
  );
  for (const log of logs) {
    const idTopic = log.topics[1];
    if (!idTopic || !log.blockNumber) continue;
    const at = blockClaimedAt.get(log.blockNumber);
    if (at == null) continue;
    const id = Number(BigInt(idTopic));
    if (!Number.isInteger(id)) continue;
    const prev = times.get(id);
    if (prev == null || at > prev) times.set(id, at);
  }
  return times;
}

async function cancelledQuietIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > 400_000n ? latest - 400_000n : 0n;
  const read = async (url?: string) => {
    const client = url ? createPublicClient({ chain: monad, transport: http(url) }) : publicClient;
    const result = await client.request({
      method: "eth_getLogs",
      params: [
        {
          address: QUIET,
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${latest.toString(16)}`,
          topics: [CANCELLED_TOPIC],
        },
      ],
    });
    return result;
  };
  let logs: Awaited<ReturnType<typeof read>> = [];
  try {
    logs = await read();
  } catch {
    try {
      logs = await read("https://rpc1.monad.xyz");
    } catch {
      logs = [];
    }
  }
  for (const log of logs) {
    if (log.topics[0]?.toLowerCase() !== CANCELLED_TOPIC) continue;
    const topic = log.topics[1];
    if (!topic) continue;
    const id = Number(BigInt(topic));
    if (Number.isInteger(id)) ids.add(id);
  }
  return ids;
}

async function onMonad(onStatus: (message: string) => void): Promise<void> {
  const chainId = await currentChainId();
  if (chainId === MONAD_ID) return;
  onStatus("Switch to Monad.");
  await switchToMonad();
  if ((await currentChainId()) !== MONAD_ID) throw new Error("Switch to Monad.");
}

export async function createQuiet(args: {
  account: Address;
  recipient: Address;
  token: "native" | Address;
  amountText: string;
  interval: bigint;
  note: string;
  onStatus: (message: string) => void;
}): Promise<void> {
  if (noteBytes(args.note) > NOTE_MAX) throw new Error("note");
  await onMonad(args.onStatus);
  const stamp = await stampOf(QUIET);
  const native = args.token === "native";
  const tokenAddress: Address = args.token === "native" ? NATIVE : args.token;
  const decimals = native ? 18 : (await tokenMeta(tokenAddress)).decimals;
  let amount: bigint;
  try {
    amount = parseUnits(args.amountText.trim(), decimals);
  } catch {
    throw new Error("Enter an amount.");
  }
  if (amount <= 0n) throw new Error("Enter an amount.");
  const lockingMonchel = !native && tokenAddress.toLowerCase() === MONCHEL.toLowerCase();
  const monchelNeed = lockingMonchel ? stamp + amount : stamp;
  const monchelBal = await publicClient.readContract({
    address: MONCHEL,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [args.account],
  });
  if (monchelBal < monchelNeed) {
    throw new Error(lockingMonchel ? "You need the amount plus 25 $MONCHEL." : "You need 25 $MONCHEL for the stamp.");
  }
  if (native) {
    const monBal = await publicClient.getBalance({ address: args.account });
    if (monBal <= amount) throw new Error("Keep a little MON for gas.");
  } else if (!lockingMonchel) {
    const bal = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [args.account],
    });
    if (bal < amount) throw new Error("Not enough of that token.");
  }
  await ensureAllowance(MONCHEL, args.account, QUIET, monchelNeed, args.onStatus);
  if (!native && !lockingMonchel) {
    await ensureAllowance(tokenAddress, args.account, QUIET, amount, args.onStatus);
  }
  args.onStatus("Confirm Shell up.");
  const client = wallet(args.account);
  const hash = native
    ? await client.writeContract({
        address: QUIET,
        abi: quietAbi,
        functionName: "createNative",
        args: [args.recipient, args.interval, args.note],
        value: amount,
      })
    : await client.writeContract({
        address: QUIET,
        abi: quietAbi,
        functionName: "createERC20",
        args: [tokenAddress, amount, args.recipient, args.interval, args.note],
      });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function quietAct(
  account: Address,
  id: number,
  fn: "checkIn" | "cancel" | "claim",
  status: string,
  onStatus: (message: string) => void,
): Promise<void> {
  await onMonad(onStatus);
  onStatus(status);
  const hash = await wallet(account).writeContract({
    address: QUIET,
    abi: quietAbi,
    functionName: fn,
    args: [BigInt(id)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

export function quietCheckIn(account: Address, id: number, onStatus: (message: string) => void) {
  return quietAct(account, id, "checkIn", "Confirm Check in.", onStatus);
}

export function quietCancel(account: Address, id: number, onStatus: (message: string) => void) {
  return quietAct(account, id, "cancel", "Confirm Cancel.", onStatus);
}

export function quietClaim(account: Address, id: number, onStatus: (message: string) => void) {
  return quietAct(account, id, "claim", "Confirm Claim.", onStatus);
}

const dripAbi = [
  {
    type: "function",
    name: "boxCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getBox",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "duration", type: "uint256" },
      { name: "start", type: "uint256" },
      { name: "claimed", type: "uint256" },
      { name: "vested", type: "uint256" },
      { name: "ends", type: "uint256" },
      { name: "note", type: "string" },
    ],
  },
  {
    type: "function",
    name: "createNative",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "duration", type: "uint256" },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "createERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "duration", type: "uint256" },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "STAMP",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type DripBox = {
  id: number;
  home: Address;
  token: Address;
  sender: Address;
  recipient: Address;
  amount: bigint;
  claimed: bigint;
  claimedAt: number | null;
  createdAt: number | null;
  ends: number;
  note: string;
  symbol: string;
  decimals: number;
};

async function readDripContract(home: Address, onBatch?: (rows: DripBox[]) => void, prior: DripBox[] = []): Promise<DripBox[]> {
  const count = await publicClient.readContract({
    address: home,
    abi: dripAbi,
    functionName: "boxCount",
  });
  const total = Number(count);
  if (!Number.isFinite(total) || total <= 0) return prior;
  const ids = newestIds(total);
  const claimsP = claimTimes(home, DRIP_CLAIMED_TOPIC);
  const createdP = claimTimes(home, BOX_CREATED_TOPIC);
  const acc = prior.slice();
  const mine: DripBox[] = [];
  for (let i = 0; i < ids.length; i += READ_CHUNK) {
    const chunk = ids.slice(i, i + READ_CHUNK);
    const rows = await publicClient.multicall({
      allowFailure: false,
      contracts: chunk.map((id) => ({
        address: home,
        abi: dripAbi,
        functionName: "getBox" as const,
        args: [BigInt(id)] as const,
      })),
    });
    const unique = new Set<string>();
    for (const row of rows) {
      if (row[0] !== NATIVE) unique.add(row[0].toLowerCase());
    }
    await Promise.all([...unique].map((token) => tokenMeta(getAddress(token))));
    chunk.forEach((id, index) => {
      const row = rows[index];
      const token = row[0];
      const native = token === NATIVE;
      const meta = native
        ? { symbol: "MON", decimals: 18 }
        : (metaCache.get(token.toLowerCase()) ?? { symbol: shortAddr(token), decimals: 18 });
      const nums = [row[3], row[4], row[5], row[6], row[7], row[8]];
      const started = nums.find((n) => n > 1_000_000_000n && n < 10_000_000_000n);
      const duration = nums.find(
        (n) => n === 3_600n || n === 7_200n || n === 10_800n || n === 2_592_000n || n === 15_724_800n || n === 31_536_000n,
      );
      const ends = started && duration ? Number(started + duration) : Number(row[8]);
      mine.push({
        id,
        home,
        token,
        sender: row[1],
        recipient: row[2],
        amount: row[3],
        claimed: row[6],
        claimedAt: null,
        createdAt: null,
        ends,
        note: row[9],
        symbol: meta.symbol,
        decimals: meta.decimals,
      });
    });
    onBatch?.(acc.concat(mine));
  }
  const [claims, created] = await Promise.all([claimsP, createdP]);
  for (const row of mine) {
    row.claimedAt = claims.get(row.id) ?? null;
    row.createdAt = created.get(row.id) ?? null;
  }
  const rows = acc.concat(mine);
  onBatch?.(rows.slice());
  return rows;
}

export async function readDripBoxes(onBatch?: (rows: DripBox[]) => void): Promise<DripBox[]> {
  let acc: DripBox[] = [];
  try {
    acc = await readDripContract(DRIP, onBatch);
  } catch {
    acc = [];
  }
  try {
    acc = await readDripContract(DRIP_NEXT, onBatch, acc);
  } catch {
    onBatch?.(acc.slice());
  }
  return acc;
}

export async function createDrip(args: {
  account: Address;
  recipient: Address;
  token: "native" | Address;
  amountText: string;
  duration: bigint;
  note: string;
  onStatus: (message: string) => void;
}): Promise<void> {
  if (noteBytes(args.note) > NOTE_MAX) throw new Error("note");
  await onMonad(args.onStatus);
  const stamp = await stampOf(DRIP_NEXT);
  const native = args.token === "native";
  const tokenAddress: Address = args.token === "native" ? NATIVE : args.token;
  const decimals = native ? 18 : (await tokenMeta(tokenAddress)).decimals;
  let amount: bigint;
  try {
    amount = parseUnits(args.amountText.trim(), decimals);
  } catch {
    throw new Error("Enter an amount.");
  }
  if (amount <= 0n) throw new Error("Enter an amount.");
  const lockingMonchel = !native && tokenAddress.toLowerCase() === MONCHEL.toLowerCase();
  const monchelNeed = lockingMonchel ? stamp + amount : stamp;
  const monchelBal = await publicClient.readContract({
    address: MONCHEL,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [args.account],
  });
  if (monchelBal < monchelNeed) {
    throw new Error(lockingMonchel ? "You need the amount plus 25 $MONCHEL." : "You need 25 $MONCHEL for the stamp.");
  }
  if (native) {
    const monBal = await publicClient.getBalance({ address: args.account });
    if (monBal <= amount) throw new Error("Keep a little MON for gas.");
  } else if (!lockingMonchel) {
    const bal = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [args.account],
    });
    if (bal < amount) throw new Error("Not enough of that token.");
  }
  await ensureAllowance(MONCHEL, args.account, DRIP_NEXT, monchelNeed, args.onStatus);
  if (!native && !lockingMonchel) {
    await ensureAllowance(tokenAddress, args.account, DRIP_NEXT, amount, args.onStatus);
  }
  args.onStatus("Confirm Shell up.");
  const client = wallet(args.account);
  const hash = native
    ? await client.writeContract({
        address: DRIP_NEXT,
        abi: dripAbi,
        functionName: "createNative",
        args: [args.recipient, args.duration, args.note],
        value: amount,
      })
    : await client.writeContract({
        address: DRIP_NEXT,
        abi: dripAbi,
        functionName: "createERC20",
        args: [tokenAddress, amount, args.recipient, args.duration, args.note],
      });
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function dripClaim(account: Address, id: number, home: Address, onStatus: (message: string) => void): Promise<void> {
  await onMonad(onStatus);
  onStatus("Confirm Claim.");
  const hash = await wallet(account).writeContract({
    address: home,
    abi: dripAbi,
    functionName: "claim",
    args: [BigInt(id)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

export const POT: Address = "0xeD34d584BD168Fd62a72E8a6A4aC9aC94cDFc6ec";
export const POT_NEXT: Address = "0x8d4E7454DF0Ccd78Cb633c408676F0574c041cb1";

const potAbi = [
  {
    type: "function",
    name: "potCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getPot",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "pot",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "sender", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "claimed", type: "uint256" },
          { name: "start", type: "uint256" },
          { name: "end", type: "uint256" },
          { name: "title", type: "string" },
          { name: "note", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createNative",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "duration", type: "uint8" },
      { name: "title", type: "string" },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "createERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "duration", type: "uint8" },
      { name: "title", type: "string" },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "STAMP",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type PotBox = {
  id: number;
  home: Address;
  token: Address;
  sender: Address;
  recipient: Address;
  amount: bigint;
  claimed: bigint;
  claimable: bigint;
  start: number;
  end: number;
  title: string;
  note: string;
  symbol: string;
  decimals: number;
};

async function readPotContract(home: Address, onBatch?: (rows: PotBox[]) => void, prior: PotBox[] = []): Promise<PotBox[]> {
  const count = await publicClient.readContract({
    address: home,
    abi: potAbi,
    functionName: "potCount",
  });
  const total = Number(count);
  if (!Number.isFinite(total) || total <= 0) return prior;
  const ids = newestIds(total);
  const acc = prior.slice();
  for (let i = 0; i < ids.length; i += READ_CHUNK) {
    const chunk = ids.slice(i, i + READ_CHUNK);
    const rows = await publicClient.multicall({
      allowFailure: false,
      contracts: chunk.flatMap((id) => [
        {
          address: home,
          abi: potAbi,
          functionName: "getPot" as const,
          args: [BigInt(id)] as const,
        },
        {
          address: home,
          abi: potAbi,
          functionName: "claimable" as const,
          args: [BigInt(id)] as const,
        },
      ]),
    });
    const unique = new Set<string>();
    for (let n = 0; n < chunk.length; n++) {
      const token = (rows[n * 2] as { token: Address }).token;
      if (token !== NATIVE) unique.add(token.toLowerCase());
    }
    await Promise.all([...unique].map((token) => tokenMeta(getAddress(token))));
    chunk.forEach((id, index) => {
      const row = rows[index * 2] as {
        token: Address;
        sender: Address;
        recipient: Address;
        amount: bigint;
        claimed: bigint;
        start: bigint;
        end: bigint;
        title: string;
        note: string;
      };
      const claimable = rows[index * 2 + 1] as bigint;
      const token = row.token;
      const native = token === NATIVE;
      const meta = native
        ? { symbol: "MON", decimals: 18 }
        : (metaCache.get(token.toLowerCase()) ?? { symbol: shortAddr(token), decimals: 18 });
      acc.push({
        id,
        home,
        token,
        sender: row.sender,
        recipient: row.recipient,
        amount: row.amount,
        claimed: row.claimed,
        claimable,
        start: Number(row.start),
        end: Number(row.end),
        title: row.title,
        note: row.note,
        symbol: meta.symbol,
        decimals: meta.decimals,
      });
    });
    onBatch?.(acc.slice());
  }
  return acc;
}

export async function readPots(onBatch?: (rows: PotBox[]) => void): Promise<PotBox[]> {
  let acc: PotBox[] = [];
  try {
    acc = await readPotContract(POT, onBatch);
  } catch {
    acc = [];
  }
  try {
    acc = await readPotContract(POT_NEXT, onBatch, acc);
  } catch {
    onBatch?.(acc.slice());
  }
  return acc;
}

export async function createPot(args: {
  account: Address;
  recipient: Address;
  token: "native" | Address;
  amountText: string;
  duration: number;
  title: string;
  note: string;
  onStatus: (message: string) => void;
}): Promise<void> {
  if (noteBytes(args.note) > NOTE_MAX) throw new Error("note");
  await onMonad(args.onStatus);
  const stamp = await publicClient.readContract({
    address: POT_NEXT,
    abi: potAbi,
    functionName: "STAMP",
  });
  const native = args.token === "native";
  const tokenAddress: Address = args.token === "native" ? NATIVE : args.token;
  const decimals = native ? 18 : (await tokenMeta(tokenAddress)).decimals;
  let amount: bigint;
  try {
    amount = parseUnits(args.amountText.trim(), decimals);
  } catch {
    throw new Error("Enter an amount.");
  }
  if (amount <= 0n) throw new Error("Enter an amount.");
  const lockingMonchel = !native && tokenAddress.toLowerCase() === MONCHEL.toLowerCase();
  const monchelNeed = lockingMonchel ? stamp + amount : stamp;
  const monchelBal = await publicClient.readContract({
    address: MONCHEL,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [args.account],
  });
  if (monchelBal < monchelNeed) {
    throw new Error(lockingMonchel ? "You need the amount plus 25 $MONCHEL." : "You need 25 $MONCHEL for the stamp.");
  }
  if (native) {
    const monBal = await publicClient.getBalance({ address: args.account });
    if (monBal <= amount) throw new Error("Keep a little MON for gas.");
  } else if (!lockingMonchel) {
    const bal = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [args.account],
    });
    if (bal < amount) throw new Error("Not enough of that token.");
  }
  await ensureAllowance(MONCHEL, args.account, POT_NEXT, monchelNeed, args.onStatus);
  if (!native && !lockingMonchel) {
    await ensureAllowance(tokenAddress, args.account, POT_NEXT, amount, args.onStatus);
  }
  args.onStatus("Confirm Shell up.");
  const hash = native
    ? await wallet(args.account).writeContract({
        address: POT_NEXT,
        abi: potAbi,
        functionName: "createNative",
        args: [args.recipient, args.duration, args.title, args.note],
        value: amount,
      })
    : await wallet(args.account).writeContract({
        address: POT_NEXT,
        abi: potAbi,
        functionName: "createERC20",
        args: [tokenAddress, amount, args.recipient, args.duration, args.title, args.note],
      });
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function potClaim(account: Address, id: number, home: Address, onStatus: (message: string) => void): Promise<void> {
  await onMonad(onStatus);
  onStatus("Confirm Claim.");
  const hash = await wallet(account).writeContract({
    address: home,
    abi: potAbi,
    functionName: "claim",
    args: [BigInt(id)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

export const NFT_TEST: Address = "0x0c13D51f3d52Bb74E4EB131a2ED6978A99a417cf";
export const NFT_COLLECTION: Address = "0x200723A706de0013316E5cd8EBa2b3f53DD90c29";

const nftAbi = [
  {
    type: "function",
    name: "nextId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "deals",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "collection", type: "address" },
      { name: "sealId", type: "uint256" },
      { name: "owner", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "buyer", type: "address" },
      { name: "deadline", type: "uint64" },
      { name: "sold", type: "bool" },
      { name: "collected", type: "bool" },
      { name: "cancelled", type: "bool" },
      { name: "note", type: "string" },
    ],
  },
  {
    type: "function",
    name: "createNative",
    stateMutability: "payable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "sealId", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "note", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "createERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "payment", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "note", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "collect",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "BadCollection", inputs: [] },
  { type: "error", name: "DeadlineTooSoon", inputs: [] },
  { type: "error", name: "NotOpen", inputs: [] },
  { type: "error", name: "Expired", inputs: [] },
  { type: "error", name: "NotSeller", inputs: [] },
  { type: "error", name: "NotBuyer", inputs: [] },
] as const;

export type NftDeal = {
  id: number;
  buyer: Address;
  collection: Address;
  sealId: bigint;
  payment: Address;
  amount: bigint;
  decimals: number;
  symbol: string;
  deadline: number;
  sold: boolean;
  collected: boolean;
  cancelled: boolean;
  note: string;
};

export async function readNftDeals(): Promise<NftDeal[]> {
  const next = await publicClient.readContract({
    address: NFT_TEST,
    abi: nftAbi,
    functionName: "nextId",
  });
  const total = Number(next);
  if (!Number.isFinite(total) || total <= 0) return [];
  const start = Math.max(0, total - LIST_CAP);
  const ids = Array.from({ length: total - start }, (_, i) => start + i);
  const rows = await publicClient.multicall({
    contracts: ids.map((id) => ({
      address: NFT_TEST,
      abi: nftAbi,
      functionName: "deals" as const,
      args: [BigInt(id)] as const,
    })),
    allowFailure: true,
  });
  const deals: NftDeal[] = [];
  rows.forEach((row, index) => {
    if (row.status !== "success") return;
    const [collection, sealId, payment, amount, buyer, deadline, sold, collected, cancelled, note] = row.result;
    if (buyer === NATIVE && amount === 0n && sealId === 0n) return;
    const token = payment.toLowerCase() === NATIVE ? null : payment;
    deals.push({
      id: ids[index],
      buyer,
      collection,
      sealId,
      payment,
      amount,
      decimals: token ? 18 : 18,
      symbol: token ? "" : "MON",
      deadline: Number(deadline),
      sold,
      collected,
      cancelled,
      note,
    });
  });
  const tokens = [...new Set(deals.map((deal) => deal.payment.toLowerCase()).filter((token) => token !== NATIVE))];
  const meta = new Map<string, { symbol: string; decimals: number }>();
  await Promise.all(
    tokens.map(async (token) => {
      try {
        meta.set(token, await readPastedToken(token as Address));
      } catch {
        meta.set(token, { symbol: shortAddr(token as Address), decimals: 18 });
      }
    }),
  );
  for (const deal of deals) {
    const found = meta.get(deal.payment.toLowerCase());
    if (!found) continue;
    deal.symbol = found.symbol;
    deal.decimals = found.decimals;
  }
  deals.reverse();
  return deals;
}

const erc721Abi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export async function readSealHolders(deals: Pick<NftDeal, "collection" | "sealId">[]): Promise<(Address | null)[]> {
  if (!deals.length) return [];
  const rows = await publicClient.multicall({
    contracts: deals.map((deal) => ({
      address: deal.collection,
      abi: erc721Abi,
      functionName: "ownerOf" as const,
      args: [deal.sealId] as const,
    })),
    allowFailure: true,
  });
  return rows.map((row) => (row.status === "success" ? row.result : null));
}

export async function readSealApproval(owner: Address, collections: Address[]): Promise<Record<string, boolean>> {
  const unique: Address[] = [];
  const seen = new Set<string>();
  for (const collection of collections) {
    const key = collection.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(collection);
  }
  if (!unique.length) return {};
  const rows = await publicClient.multicall({
    contracts: unique.map((collection) => ({
      address: collection,
      abi: erc721Abi,
      functionName: "isApprovedForAll" as const,
      args: [owner, NFT_TEST] as const,
    })),
    allowFailure: true,
  });
  const out: Record<string, boolean> = {};
  rows.forEach((row, index) => {
    out[unique[index].toLowerCase()] = row.status === "success" && row.result === true;
  });
  return out;
}

export function nftReason(err: unknown): string {
  try {
    nftRevert(err);
  } catch (next) {
    if (next !== err) {
      const message = next instanceof Error ? next.message.trim() : "";
      if (message && !isRawRevertText(message)) return message;
    }
  }
  return explain(err) || "The call reverted.";
}

function nftRevert(err: unknown): never {
  const text = errorText(err);
  if (/user rejected|user denied|denied transaction/i.test(text)) throw err;
  const seen = new Set<unknown>();
  const queue: unknown[] = [err];
  while (queue.length && seen.size < 12) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const extra = current as { errorName?: unknown; cause?: unknown; data?: { errorName?: unknown } };
    const named = extra.errorName ?? extra.data?.errorName;
    if (typeof named === "string" && named) throw new Error(named);
    if (extra.cause) queue.push(extra.cause);
  }
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const custom = line.match(/\b([A-Z][A-Za-z0-9_]{2,})\(\)/);
    if (custom) throw new Error(custom[1]);
  }
  const reasonAt = lines.findIndex((line) => /following reason/i.test(line));
  const reason = reasonAt >= 0 ? (lines[reasonAt + 1] ?? "") : "";
  if (reason && !isRawRevertText(reason) && reason.length <= 160) throw new Error(reason);
  throw err;
}

export async function createNftDeal(args: {
  account: Address;
  sealId: bigint;
  amountText: string;
  deadline: bigint;
  note: string;
  payment?: Address;
  onStatus: (message: string) => void;
}): Promise<void> {
  const chainId = await currentChainId();
  if (chainId !== MONAD_ID) {
    args.onStatus("Switch to Monad.");
    await switchToMonad();
    if ((await currentChainId()) !== MONAD_ID) throw new Error("Switch to Monad.");
  }
  let decimals = 18;
  if (args.payment) {
    try {
      const read = await publicClient.readContract({
        address: args.payment,
        abi: erc20Abi,
        functionName: "decimals",
      });
      const parsed = Number(read);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 36) decimals = parsed;
    } catch {
      decimals = 18;
    }
  }
  let amount: bigint;
  try {
    amount = parseUnits(args.amountText.trim(), decimals);
  } catch {
    throw new Error("Enter an amount.");
  }
  if (amount <= 0n) throw new Error("Enter an amount.");
  const client = wallet(args.account);
  let hash: `0x${string}`;
  if (args.payment) {
    await ensureAllowance(args.payment, args.account, NFT_TEST, amount, args.onStatus);
    args.onStatus("Confirm Lock.");
    try {
      hash = await client.writeContract({
        address: NFT_TEST,
        abi: nftAbi,
        functionName: "createERC20",
        args: ["0x200723A706de0013316E5cd8EBa2b3f53DD90c29", args.sealId, args.payment, amount, args.deadline, args.note],
        gas: 500000n,
      });
    } catch (err) {
      nftRevert(err);
    }
  } else {
    args.onStatus("Confirm Lock.");
    try {
      hash = await client.writeContract({
        address: NFT_TEST,
        abi: nftAbi,
        functionName: "createNative",
        args: ["0x200723A706de0013316E5cd8EBa2b3f53DD90c29", args.sealId, args.deadline, args.note],
        value: amount,
        gas: 500000n,
      });
    } catch (err) {
      nftRevert(err);
    }
  }
  try {
    await publicClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    nftRevert(err);
  }
}

export async function transferNftSeal(
  account: Address,
  collection: Address,
  sealId: bigint,
  id: number,
  onStatus: (message: string) => void,
): Promise<void> {
  await onMonad(onStatus);
  onStatus("Confirm Sell.");
  const data = encodeAbiParameters([{ type: "uint256" }], [BigInt(id)]);
  let hash: `0x${string}`;
  try {
    hash = await wallet(account).writeContract({
      address: "0x200723A706de0013316E5cd8EBa2b3f53DD90c29",
      abi: erc721Abi,
      functionName: "safeTransferFrom",
      args: [account, NFT_TEST, sealId, data],
      gas: 500000n,
    });
  } catch (err) {
    nftRevert(err);
  }
  try {
    await publicClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    nftRevert(err);
  }
}

export async function cancelNftDeal(account: Address, id: number, onStatus: (message: string) => void): Promise<void> {
  await onMonad(onStatus);
  onStatus("Confirm Cancel.");
  const hash = await wallet(account).writeContract({
    address: NFT_TEST,
    abi: nftAbi,
    functionName: "cancel",
    args: [BigInt(id)],
    gas: 500000n,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function collectNftDeal(account: Address, id: number, onStatus: (message: string) => void): Promise<void> {
  await onMonad(onStatus);
  onStatus("Confirm Collect.");
  let hash: `0x${string}`;
  try {
    hash = await wallet(account).writeContract({
      address: NFT_TEST,
      abi: nftAbi,
      functionName: "collect",
      args: [BigInt(id)],
      gas: 500000n,
    });
  } catch (err) {
    nftRevert(err);
  }
  try {
    await publicClient.waitForTransactionReceipt({ hash });
  } catch (err) {
    nftRevert(err);
  }
}
