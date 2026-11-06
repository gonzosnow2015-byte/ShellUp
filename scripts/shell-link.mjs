import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, formatUnits, http } from "viem";

const SHELLS = "0x91A2bEA66F1B6E33C0B7e8A8fa6Ac25D96A89e55";
const NATIVE = "0x0000000000000000000000000000000000000000";
const shellAbi = [
  {
    type: "function",
    name: "getShell",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
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
];
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
];

const client = createPublicClient({
  transport: http("https://rpc.monad.xyz", { timeout: 4_000 }),
});

let alley;

export function alleyJpeg() {
  if (alley) return alley;
  const here = dirname(fileURLToPath(import.meta.url));
  for (const path of [join(process.cwd(), "public/share.jpg"), join(here, "../public/share.jpg")]) {
    try {
      alley = readFileSync(path);
      return alley;
    } catch {
      // The deployed function may not have public/. The caller can pass bytes.
    }
  }
  return null;
}

export function shellIdFromUrl(url) {
  const query = String(url ?? "").split("?")[1] ?? "";
  const raw = new URLSearchParams(query).get("s");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function shellImagePath(id) {
  return `/s/${id}.jpg`;
}

function shellName(note) {
  const text = String(note ?? "").startsWith("BOARD:") ? note.slice("BOARD:".length) : String(note ?? "");
  const dash = text.indexOf("—");
  let title = (dash === -1 ? text : text.slice(0, dash)).trim();
  if (title.startsWith("Inherit:")) title = title.slice("Inherit:".length).trim();
  else if (title.startsWith("Vest:")) title = title.slice("Vest:".length).trim();
  return title || "Shell";
}

function amountText(value, decimals) {
  if (value === 0n) return "0";
  const raw = formatUnits(value, decimals);
  if (!raw.includes(".")) return raw;
  const [whole, frac] = raw.split(".");
  const cut = frac.slice(0, 8).replace(/0+$/, "");
  return cut ? `${whole}.${cut}` : whole;
}

function whenText(unix) {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function shellLinkPreview(url) {
  const id = shellIdFromUrl(url);
  if (id == null) return null;
  try {
    const row = await client.readContract({
      address: SHELLS,
      abi: shellAbi,
      functionName: "getShell",
      args: [BigInt(id)],
    });
    if (!row || (row.amount === 0n && !String(row.note ?? "").trim() && row.unlockTime === 0n)) return null;
    const native = String(row.token).toLowerCase() === NATIVE;
    let symbol = "MON";
    let decimals = 18;
    if (!native) {
      const [dec, sym] = await Promise.all([
        client.readContract({ address: row.token, abi: erc20Abi, functionName: "decimals" }),
        client.readContract({ address: row.token, abi: erc20Abi, functionName: "symbol" }),
      ]);
      decimals = Number(dec);
      symbol = String(sym || "TOKEN");
    }
    const title = shellName(row.note);
    const description = `${amountText(row.amount, decimals)} ${symbol} · ${whenText(Number(row.unlockTime))}`;
    return { id, title, description, imagePath: shellImagePath(id) };
  } catch {
    return null;
  }
}
