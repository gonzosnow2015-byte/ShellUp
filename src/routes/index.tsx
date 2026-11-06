import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  asAddress,
  claimShell,
  clampNote,
  createShell,
  createQuiet,
  createDrip,
  currentAccount,
  currentChainId,
  dripClaim,
  DRIP_DURATION,
  createPot,
  readPots,
  potClaim,
  createNftDeal,
  readNftDeals,
  readSealHolders,
  transferNftSeal,
  collectNftDeal,
  cancelNftDeal,
  nftReason,
  NFT_COLLECTION,
  explain,
  formatAmount,
  formatWhen,
  isClaimTooEarly,
  isRawRevertText,
  MONAD_ID,
  MONCHEL,
  noteBytes,
  quietCancel,
  quietCheckIn,
  quietClaim,
  QUIET,
  QUIET_INTERVAL,
  readQuietBoxes,
  readDripBoxes,
  readShells,
  readShell,
  readShellCount,
  readPastedToken,
  requestAccounts,
  shortAddr,
  switchToMonad,
  toLocalInput,
  watchWallet,
  type QuietBox,
  type DripBox,
  type PotBox,
  type ShellRow,
  type NftDeal,
} from "@/lib/shells";

export const Route = createFileRoute("/")({ component: Home });

const SHELLS_ADDRESS = "0x91A2bEA66F1B6E33C0B7e8A8fa6Ac25D96A89e55";
const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";
const TOKEN_UNREADABLE = "Can’t read this token — do not send Shell Up.";
const EARLY_KEY = "shells-early";
const SHARE_MARK = "BOARD:";
const VEST_MARK = "Vest:";
const INHERIT_MARK = "Inherit:";
const TITLE_ME = "My Shell";
const TITLE_FREN = "Frens Shell";
const TITLE_SEP = " — ";
const PLATE_SRC = "/share-plate.png";
const PLATE_W = 1500;
const PLATE_H = 1009;

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  return lines;
}

function loadPlate(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = PLATE_SRC;
  });
}

async function paintSharePlate(kind: string, title: string, amount: string, when: string, claimed: boolean, id: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = PLATE_W;
  canvas.height = PLATE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  try {
    await document.fonts.load('600 40px "DM Sans"');
    await document.fonts.load('600 68px "Outfit"');
    await document.fonts.load('600 88px "Outfit"');
    await document.fonts.load('600 54px "Manrope"');
    await document.fonts.load('400 39px "DM Sans"');
    await document.fonts.load('400 76px "DM Sans"');
    await document.fonts.load('400 26px "DM Sans"');
    await document.fonts.load('400 32px "DM Sans"');
  } catch {
    // Generic families in the font strings still draw.
  }
  const img = await loadPlate();
  if (img) {
    ctx.drawImage(img, 0, 0, PLATE_W, PLATE_H);
    const x0 = 20;
    const y0 = 900;
    const bw = 280;
    const bh = 100;
    try {
      const band = ctx.getImageData(x0, y0, bw, bh);
      const above = ctx.getImageData(x0, y0 - 88, bw, bh);
      const d = band.data;
      const s = above.data;
      for (let i = 0; i < d.length; i += 4) {
        const sum = d[i] + d[i + 1] + d[i + 2];
        if (sum > 55 && d[i] > 40) {
          d[i] = s[i];
          d[i + 1] = s[i + 1];
          d[i + 2] = s[i + 2];
        }
      }
      ctx.putImageData(band, x0, y0);
    } catch {
      // Keep the baked line if the pixels cannot be read.
    }
  } else {
    ctx.fillStyle = "#0E091C";
    ctx.fillRect(0, 0, PLATE_W, PLATE_H);
  }
  const x = 72;
  const max = 660;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = '600 68px "Outfit", ui-sans-serif, system-ui, sans-serif';
  const titles = wrapCanvasLines(ctx, title || "Shell", max).slice(0, 3);
  ctx.font = '600 88px "Outfit", ui-sans-serif, system-ui, sans-serif';
  const amounts = wrapCanvasLines(ctx, amount, max).slice(0, 2);
  ctx.font = '400 39px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  const unlocks = wrapCanvasLines(ctx, `${claimed ? "Unlocked" : "Unlocks"} ${when}`, max).slice(0, 2);
  let y = 160;
  ctx.fillStyle = "#F4F0EA";
  ctx.font = '600 68px "Outfit", ui-sans-serif, system-ui, sans-serif';
  for (const line of titles) {
    ctx.fillText(line, x, y);
    y += 96;
  }
  y += 36;
  const fillGold = (line: string, at: number) => {
    ctx.save();
    ctx.shadowColor = "rgba(232, 213, 163, 0.5)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#E8D5A3";
    ctx.fillText(line, x, at);
    ctx.restore();
    ctx.fillStyle = "#E8D5A3";
    ctx.fillText(line, x, at);
  };
  ctx.font = '600 40px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  fillGold(kind, 92);
  ctx.font = '600 88px "Outfit", ui-sans-serif, system-ui, sans-serif';
  for (const line of amounts) {
    fillGold(line, y);
    y += 118;
  }
  y -= 28;
  ctx.font = '600 54px "Manrope", ui-sans-serif, system-ui, sans-serif';
  fillGold("has been shelled up", y);
  y += 104;
  ctx.fillStyle = "#9B93B0";
  ctx.font = '400 39px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  for (const line of unlocks) {
    ctx.fillText(line, x, y);
    y += 56;
  }
  ctx.fillStyle = "#847C96";
  ctx.font = '400 32px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`#${id}`, x, y);
  ctx.fillStyle = "#888693";
  ctx.font = '400 76px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.fillText("shellup.io", 57, 856);
  ctx.fillStyle = "#6A589E";
  ctx.font = '400 26px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.fillText("by Monchel & Frens", 57, 932);
  return canvas;
}

function shellBody(title: string, note: string): string {
  const t = title.trim();
  const n = note.trim();
  if (t && n) return `${t}${TITLE_SEP}${n}`;
  return t || n;
}

function shellStored(title: string, note: string, share: boolean): string {
  const body = shellBody(title, note);
  return share ? `${SHARE_MARK}${body}` : body;
}

function vestStoredTitle(title: string, _pub: boolean): string {
  const t = title.trim();
  return t ? `${VEST_MARK} ${t}` : VEST_MARK;
}

function vestStored(title: string, note: string, pub: boolean): string {
  return shellStored(vestStoredTitle(title, pub), note, pub);
}

function vestTitleBudget(note: string, pub: boolean): number {
  return Math.max(0, titleBudget(note, pub) - noteBytes("Vest: "));
}

function vestNoteBudget(title: string, pub: boolean): number {
  return noteBudget(vestStoredTitle(title, pub), pub);
}

type NftRecord = { id: number; seal: string; amount: string; symbol: string; seller: string; buyer: string; deadline: number };

function readNftRecords(): NftRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem("nft-sale-records");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NftRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        row &&
        Number.isInteger(row.id) &&
        typeof row.seal === "string" &&
        typeof row.amount === "string" &&
        (row.symbol === undefined || typeof row.symbol === "string") &&
        typeof row.seller === "string" &&
        typeof row.buyer === "string" &&
        typeof row.deadline === "number",
    );
  } catch {
    return [];
  }
}

function rememberNftSale(seller: string, deal: NftDeal) {
  if (typeof localStorage === "undefined") return;
  const saved = readNftRecords();
  const who = seller.toLowerCase();
  if (saved.some((row) => row.id === deal.id && row.seller === who)) return;
  saved.push({
    id: deal.id,
    seal: deal.sealId.toString(),
    amount: formatAmount(deal.amount, deal.decimals),
    symbol: deal.symbol || "MON",
    seller: who,
    buyer: deal.buyer,
    deadline: deal.deadline,
  });
  localStorage.setItem("nft-sale-records", JSON.stringify(saved));
}

function readDripTitles(): Record<number, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem("drip-titles");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const next: Record<number, string> = {};
    for (const [id, title] of Object.entries(parsed)) {
      if (typeof title !== "string") continue;
      const trimmed = title.trim();
      if (!trimmed) continue;
      const num = Number(id);
      if (!Number.isInteger(num)) continue;
      next[num] = trimmed;
    }
    return next;
  } catch {
    return {};
  }
}

function plateLock(shell: ShellRow, all: ShellRow[]): string {
  const shared = shell.note.startsWith(SHARE_MARK);
  const noteText = shared ? shell.note.slice(SHARE_MARK.length) : shell.note;
  const dash = noteText.indexOf("—");
  const rawTitle = (dash === -1 ? noteText : noteText.slice(0, dash)).trim();
  if (rawTitle.startsWith(VEST_MARK) || noteText.startsWith(VEST_MARK)) {
    const sender = shell.sender.toLowerCase();
    const team = all.some((row) => row.id !== shell.id && row.note === shell.note && row.sender.toLowerCase() === sender);
    return team ? "Team Vesting" : "Solo Vesting";
  }
  return shell.sender.toLowerCase() === shell.recipient.toLowerCase() ? "Hold" : "Hold - For a fren";
}

function bagToken(token: string): string {
  return token.toLowerCase() === "0x0000000000000000000000000000000000000000" ? WMON.toLowerCase() : token.toLowerCase();
}

function bagUsd(amount: bigint, decimals: number, price: number): number {
  const base = 10n ** BigInt(decimals);
  return (Number(amount / base) + Number(amount % base) / Number(base)) * price;
}

function cardBagValue(
  row: { token: string; amount: bigint; decimals: number },
  prices: Record<string, number | null>,
): number | null {
  const price = prices[bagToken(row.token)];
  if (price == null) return null;
  return bagUsd(row.amount, row.decimals, price);
}

function shellTitle(note: string): string {
  const text = note.startsWith(SHARE_MARK) ? note.slice(SHARE_MARK.length) : note;
  const dash = text.indexOf("—");
  return (dash === -1 ? text : text.slice(0, dash)).trim();
}

function isDateInherit(note: string): boolean {
  const text = note.startsWith(SHARE_MARK) ? note.slice(SHARE_MARK.length) : note;
  return text.startsWith(INHERIT_MARK) || shellTitle(note).startsWith(INHERIT_MARK);
}

function mergeFresh(prev: ShellRow[], rows: ShellRow[]): ShellRow[] {
  const prior = new Map(prev.map((row) => [row.id, row]));
  const merged = rows.map((row) => {
    if (row.createdAt != null) return row;
    const old = prior.get(row.id);
    return old?.createdAt != null ? { ...row, createdAt: old.createdAt } : row;
  });
  const ids = new Set(merged.map((row) => row.id));
  const maxId = merged.reduce((max, row) => (row.id > max ? row.id : max), -1);
  const kept = prev.filter((row) => row.id > maxId && !ids.has(row.id));
  return kept.length ? [...kept, ...merged] : merged;
}

function byShellAge(dir: "new" | "old") {
  const newest = dir === "new";
  return (a: { at: number | null; id: number }, b: { at: number | null; id: number }) => {
    if (a.at == null && b.at == null) return newest ? b.id - a.id : a.id - b.id;
    if (a.at == null) return 1;
    if (b.at == null) return -1;
    if (a.at !== b.at) return newest ? b.at - a.at : a.at - b.at;
    return newest ? b.id - a.id : a.id - b.id;
  };
}

function noteBudget(title: string, share: boolean): number {
  const prefix = share ? noteBytes(SHARE_MARK) : 0;
  const t = title.trim();
  const sep = t ? noteBytes(TITLE_SEP) : 0;
  return Math.max(0, 140 - prefix - noteBytes(t) - sep);
}

function titleBudget(note: string, share: boolean): number {
  const prefix = share ? noteBytes(SHARE_MARK) : 0;
  const n = note.trim();
  const sep = n ? noteBytes(TITLE_SEP) : 0;
  return Math.max(0, 140 - prefix - noteBytes(n) - sep);
}

function burnedStamps(count: number): string {
  const tenths = count * 125;
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  const body = whole.toLocaleString("en-US");
  return frac ? `${body}.${frac}` : body;
}

function readEarly(): number[] {
  try {
    const raw = localStorage.getItem(EARLY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => Number.isInteger(id));
  } catch {
    return [];
  }
}

function writeEarly(ids: number[]) {
  try {
    localStorage.setItem(EARLY_KEY, JSON.stringify(ids));
  } catch {
    // The card still shows for this visit.
  }
}

const STEADY_DAYS = [7, 30, 182, 365] as const;

function steadyDaily(amount: string, days: number): string | null {
  const raw = amount.trim();
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  const scale = 10n ** BigInt(frac.length);
  const value = BigInt(whole || "0") * scale + BigInt(frac || "0");
  if (value === 0n) return null;
  const precision = 2;
  const unit = 10n ** BigInt(precision);
  const denom = scale * BigInt(days);
  const numer = value * unit;
  const quot = numer / denom;
  const rem = numer % denom;
  const scaled = rem * 2n >= denom ? quot + 1n : quot;
  const text = scaled.toString().padStart(precision + 1, "0");
  const head = text.slice(0, -precision);
  const tail = text.slice(-precision);
  return `${head}.${tail} MON per day`;
}

function Home() {
  const [who, setWho] = useState<"me" | "fren">("me");
  const [recipient, setRecipient] = useState("");
  const [tokenKind, setTokenKind] = useState<"mon" | "monchel" | "paste">("paste");
  const [tokenPaste, setTokenPaste] = useState("");
  const [tokenPreview, setTokenPreview] = useState<{ address: `0x${string}`; symbol: string } | null>(null);
  const [tokenFault, setTokenFault] = useState("");
  const [tokenReading, setTokenReading] = useState(false);
  const [amount, setAmount] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [share, setShare] = useState(false);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [shells, setShells] = useState<ShellRow[]>([]);
  const [quietBoxes, setQuietBoxes] = useState<QuietBox[]>([]);
  const [drips, setDrips] = useState<DripBox[]>([]);
  const [pots, setPots] = useState<PotBox[]>([]);
  const [board, setBoard] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [quietListReading, setQuietListReading] = useState(true);
  const [dripListReading, setDripListReading] = useState(true);
  const [potListReading, setPotListReading] = useState(true);
  const [shellCount, setShellCount] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [, setEarlyIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [sharePic, setSharePic] = useState<{ id: number; url: string } | null>(null);
  const [communityTab, setCommunityTab] = useState<"all" | "active" | "claimed">("active");
  const [boardTab, setBoardTab] = useState<"all" | "active" | "claimed">("active");
  const [boardKind, setBoardKind] = useState<"all" | "hold" | "vest" | "drip" | "inherit">("all");
  const [communityKind, setCommunityKind] = useState<"all" | "holders" | "vest">("all");
  const [boardKindOpen, setBoardKindOpen] = useState(false);
  const [communityKindOpen, setCommunityKindOpen] = useState(false);
  const [boardSort, setBoardSort] = useState<"new" | "old" | "claim" | "bag" | "lock">("new");
  const [boardBagPrices, setBoardBagPrices] = useState<Record<string, number | null>>({});
  const [boardBagReady, setBoardBagReady] = useState(false);
  const [communitySort, setCommunitySort] = useState<"new" | "old" | "claim" | "bag" | "lock">("new");
  const [bagPrices, setBagPrices] = useState<Record<string, number | null>>({});
  const [bagReady, setBagReady] = useState(false);
  const [boardSortOpen, setBoardSortOpen] = useState(false);
  const [communitySortOpen, setCommunitySortOpen] = useState(false);
  const [boardView, setBoardView] = useState<"list" | "grid">("list");
  const [communityView, setCommunityView] = useState<"list" | "grid">("list");
  const [formMode, setFormMode] = useState<"hold" | "vest" | "drip" | "inherit" | "nft">("hold");
  const [inheritTrigger, setInheritTrigger] = useState<"date" | "quiet">("date");
  const [inheritQuiet, setInheritQuiet] = useState<"1" | "2" | "3">("1");
  const [inheritName, setInheritName] = useState("");
  const [inheritTo, setInheritTo] = useState("");
  const [inheritUnlock, setInheritUnlock] = useState("");
  const [inheritKind, setInheritKind] = useState<"mon" | "monchel" | "paste">("paste");
  const [inheritPaste, setInheritPaste] = useState("");
  const [inheritPreview, setInheritPreview] = useState<{ address: `0x${string}`; symbol: string } | null>(null);
  const [inheritFault, setInheritFault] = useState("");
  const [inheritReading, setInheritReading] = useState(false);
  const [dateKind, setDateKind] = useState<"mon" | "monchel" | "paste">("paste");
  const [datePaste, setDatePaste] = useState("");
  const [datePreview, setDatePreview] = useState<{ address: `0x${string}`; symbol: string } | null>(null);
  const [dateFault, setDateFault] = useState("");
  const [dateReading, setDateReading] = useState(false);
  const [inheritAmount, setInheritAmount] = useState("");
  const [inheritNote, setInheritNote] = useState("");
  const [nftCollection, setNftCollection] = useState<string>(NFT_COLLECTION);
  const [nftSeal, setNftSeal] = useState("");
  const [nftAmount, setNftAmount] = useState("");
  const [nftMon, setNftMon] = useState(true);
  const [nftPaste, setNftPaste] = useState("");
  const [nftPreview, setNftPreview] = useState<{ address: `0x${string}`; symbol: string } | null>(null);
  const [nftTokenFault, setNftTokenFault] = useState("");
  const [nftTokenReading, setNftTokenReading] = useState(false);
  const [nftDeadline, setNftDeadline] = useState("");
  const [nftNote, setNftNote] = useState("");
  const [nftDeals, setNftDeals] = useState<NftDeal[]>([]);
  const [sealOwners, setSealOwners] = useState<Record<number, string>>({});
  const [nftRecords, setNftRecords] = useState<NftRecord[]>(() => readNftRecords());
  const [nftFault, setNftFault] = useState<{ id: number; text: string } | null>(null);
  const [nftLockFault, setNftLockFault] = useState("");
  const [vestMode, setVestMode] = useState<"one" | "split">("one");
  const [vestTo, setVestTo] = useState("");
  const [vestAmount, setVestAmount] = useState("");
  const [vestUnlock, setVestUnlock] = useState("");
  const [vestTitle, setVestTitle] = useState("");
  const [vestNote, setVestNote] = useState("");
  const [dripKind, setDripKind] = useState<"slow" | "steady">("steady");
  const [dripTo, setDripTo] = useState("");
  const [dripAmount, setDripAmount] = useState("");
  const [dripHours, setDripHours] = useState<"1" | "6" | "12">("1");
  const [dripNote, setDripNote] = useState("");
  const [dripTitle, setDripTitle] = useState("");
  const [dripTitles, setDripTitles] = useState<Record<number, string>>(readDripTitles);
  const [dripToken, setDripToken] = useState<"mon" | "monchel" | "paste">("paste");
  const [dripPaste, setDripPaste] = useState("");
  const [dripPreview, setDripPreview] = useState<{ address: `0x${string}`; symbol: string } | null>(null);
  const [dripFault, setDripFault] = useState("");
  const [dripReading, setDripReading] = useState(false);
  const [steadyPot, setSteadyPot] = useState("");
  const [steadySpan, setSteadySpan] = useState<0 | 1 | 2 | 3>(0);
  const [steadyTitle, setSteadyTitle] = useState("");
  const [steadyToken, setSteadyToken] = useState<"mon" | "monchel" | "paste">("paste");
  const [steadyPaste, setSteadyPaste] = useState("");
  const [steadyPreview, setSteadyPreview] = useState<{ address: `0x${string}`; symbol: string } | null>(null);
  const [steadyFault, setSteadyFault] = useState("");
  const [steadyReading, setSteadyReading] = useState(false);
  const [steadyNote, setSteadyNote] = useState("");
  const [vestPaste, setVestPaste] = useState("");
  const [vestMon, setVestMon] = useState(false);
  const [vestPreview, setVestPreview] = useState<{ address: `0x${string}`; symbol: string } | null>(null);
  const [vestFault, setVestFault] = useState("");
  const [vestReading, setVestReading] = useState(false);
  const [vestPublic, setVestPublic] = useState(false);
  const [splitRows, setSplitRows] = useState([
    { address: "", amount: "", date: "" },
    { address: "", amount: "", date: "" },
    { address: "", amount: "", date: "" },
  ]);
  const dropped = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const titleTouched = useRef(false);
  const shellsGen = useRef(0);
  const idNoteTimer = useRef<number | null>(null);
  const [idNote, setIdNote] = useState<string | null>(null);
  const stopWatch = useRef<(() => void) | null>(null);

  function showIdNote(key: string) {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    setIdNote(key);
    if (idNoteTimer.current) window.clearTimeout(idNoteTimer.current);
    idNoteTimer.current = window.setTimeout(() => {
      setIdNote((current) => (current === key ? null : current));
      idNoteTimer.current = null;
    }, 5000);
  }

  function attachWatch() {
    stopWatch.current?.();
    stopWatch.current = watchWallet(
      (next) => {
        if (!dropped.current) setAccount(next);
      },
      (next) => {
        if (!dropped.current) setChainId(next);
      },
    );
  }

  useEffect(() => {
    setUnlockAt(toLocalInput(new Date(Date.now() + 65 * 60 * 1000)));
    setVestUnlock(toLocalInput(new Date(Date.now() + 65 * 60 * 1000)));
    setInheritUnlock(toLocalInput(new Date(Date.now() + 65 * 60 * 1000)));
    void currentAccount().then((next) => {
      if (!dropped.current) setAccount(next);
    });
    void currentChainId().then(setChainId);
    attachWatch();
    return () => {
      stopWatch.current?.();
    };
  }, []);

  useEffect(() => {
    setBoardKind("all");
    setBoardTab("active");
  }, []);

  useEffect(() => {
    const stored = readDripTitles();
    setDripTitles((prev) => ({ ...stored, ...prev }));
  }, []);

  useEffect(() => {
    setEarlyIds(readEarly());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tokenKind !== "paste") return;
    const addr = asAddress(tokenPaste);
    if (!addr) {
      setTokenPreview(null);
      setTokenFault("");
      setTokenReading(false);
      return;
    }
    let cancel = false;
    setTokenReading(true);
    void readPastedToken(addr)
      .then((meta) => {
        if (cancel) return;
        setTokenPreview({ address: addr, symbol: meta.symbol });
        setTokenFault("");
        setTokenReading(false);
      })
      .catch(() => {
        if (cancel) return;
        setTokenPreview(null);
        setTokenFault(TOKEN_UNREADABLE);
        setTokenReading(false);
      });
    return () => {
      cancel = true;
    };
  }, [tokenKind, tokenPaste]);

  useEffect(() => {
    const pasted = vestPaste.trim();
    if (!pasted) {
      setVestPreview(null);
      setVestFault("");
      setVestReading(false);
      return;
    }
    const addr = asAddress(pasted);
    if (!addr) {
      setVestPreview(null);
      setVestFault("");
      setVestReading(false);
      return;
    }
    let cancel = false;
    setVestReading(true);
    void readPastedToken(addr)
      .then((meta) => {
        if (cancel) return;
        setVestPreview({ address: addr, symbol: meta.symbol });
        setVestFault("");
        setVestReading(false);
      })
      .catch(() => {
        if (cancel) return;
        setVestPreview(null);
        setVestFault(TOKEN_UNREADABLE);
        setVestReading(false);
      });
    return () => {
      cancel = true;
    };
  }, [vestPaste]);

  useEffect(() => {
    const pasted = nftPaste.trim();
    if (!pasted) {
      setNftPreview(null);
      setNftTokenFault("");
      setNftTokenReading(false);
      return;
    }
    const addr = asAddress(pasted);
    if (!addr) {
      setNftPreview(null);
      setNftTokenFault("");
      setNftTokenReading(false);
      return;
    }
    let cancel = false;
    setNftTokenReading(true);
    void readPastedToken(addr)
      .then((meta) => {
        if (cancel) return;
        setNftPreview({ address: addr, symbol: meta.symbol });
        setNftTokenFault("");
        setNftTokenReading(false);
      })
      .catch(() => {
        if (cancel) return;
        setNftPreview(null);
        setNftTokenFault(TOKEN_UNREADABLE);
        setNftTokenReading(false);
      });
    return () => {
      cancel = true;
    };
  }, [nftPaste]);

  useEffect(() => {
    const pasted = dripPaste.trim();
    if (!pasted) {
      setDripPreview(null);
      setDripFault("");
      setDripReading(false);
      return;
    }
    const addr = asAddress(pasted);
    if (!addr) {
      setDripPreview(null);
      setDripFault("");
      setDripReading(false);
      return;
    }
    let cancel = false;
    setDripReading(true);
    void readPastedToken(addr)
      .then((meta) => {
        if (cancel) return;
        setDripPreview({ address: addr, symbol: meta.symbol });
        setDripFault("");
        setDripReading(false);
      })
      .catch(() => {
        if (cancel) return;
        setDripPreview(null);
        setDripFault(TOKEN_UNREADABLE);
        setDripReading(false);
      });
    return () => {
      cancel = true;
    };
  }, [dripPaste]);

  useEffect(() => {
    const pasted = steadyPaste.trim();
    if (!pasted) {
      setSteadyPreview(null);
      setSteadyFault("");
      setSteadyReading(false);
      return;
    }
    const addr = asAddress(pasted);
    if (!addr) {
      setSteadyPreview(null);
      setSteadyFault("");
      setSteadyReading(false);
      return;
    }
    let cancel = false;
    setSteadyReading(true);
    void readPastedToken(addr)
      .then((meta) => {
        if (cancel) return;
        setSteadyPreview({ address: addr, symbol: meta.symbol });
        setSteadyFault("");
        setSteadyReading(false);
      })
      .catch(() => {
        if (cancel) return;
        setSteadyPreview(null);
        setSteadyFault(TOKEN_UNREADABLE);
        setSteadyReading(false);
      });
    return () => {
      cancel = true;
    };
  }, [steadyPaste]);

  useEffect(() => {
    if (inheritKind !== "paste") return;
    const addr = asAddress(inheritPaste);
    if (!addr) {
      setInheritPreview(null);
      setInheritFault("");
      setInheritReading(false);
      return;
    }
    let cancel = false;
    setInheritReading(true);
    void readPastedToken(addr)
      .then((meta) => {
        if (cancel) return;
        setInheritPreview({ address: addr, symbol: meta.symbol });
        setInheritFault("");
        setInheritReading(false);
      })
      .catch(() => {
        if (cancel) return;
        setInheritPreview(null);
        setInheritFault(TOKEN_UNREADABLE);
        setInheritReading(false);
      });
    return () => {
      cancel = true;
    };
  }, [inheritKind, inheritPaste]);

  useEffect(() => {
    if (dateKind !== "paste") return;
    const addr = asAddress(datePaste);
    if (!addr) {
      setDatePreview(null);
      setDateFault("");
      setDateReading(false);
      return;
    }
    let cancel = false;
    setDateReading(true);
    void readPastedToken(addr)
      .then((meta) => {
        if (cancel) return;
        setDatePreview({ address: addr, symbol: meta.symbol });
        setDateFault("");
        setDateReading(false);
      })
      .catch(() => {
        if (cancel) return;
        setDatePreview(null);
        setDateFault(TOKEN_UNREADABLE);
        setDateReading(false);
      });
    return () => {
      cancel = true;
    };
  }, [dateKind, datePaste]);

  useEffect(() => {
    if (formMode !== "nft") return;
    let cancel = false;
    const run = () => {
      void readNftDeals()
        .then(async (rows) => {
          const holders = await readSealHolders(rows);
          if (cancel) return;
          const owners: Record<number, string> = {};
          rows.forEach((deal, index) => {
            const holder = holders[index];
            if (holder) owners[deal.id] = holder.toLowerCase();
          });
          setNftDeals(rows);
          setSealOwners(owners);
        })
        .catch(() => {
          if (cancel) return;
          setNftDeals([]);
          setSealOwners({});
        });
    };
    run();
    const timer = window.setInterval(run, 20_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [formMode, account]);

  useEffect(() => {
    if (communitySort !== "bag") return;
    const wanted = new Set<string>();
    for (const shell of shells) {
      if (!shell.note.startsWith(SHARE_MARK)) continue;
      wanted.add(bagToken(shell.token));
    }
    const list = [...wanted];
    if (!list.length) {
      setBagPrices({});
      setBagReady(true);
      return;
    }
    let cancel = false;
    void (async () => {
      const next: Record<string, number | null> = {};
      for (let i = 0; i < list.length; i += 30) {
        const batch = list.slice(i, i + 30);
        try {
          const res = await fetch(`https://api.dexscreener.com/tokens/v1/monad/${batch.join(",")}`);
          const pairs = res.ok ? ((await res.json()) as { baseToken?: { address?: string }; priceUsd?: string; liquidity?: { usd?: number } }[]) : [];
          const best = new Map<string, { price: number; liq: number }>();
          if (Array.isArray(pairs)) {
            for (const pair of pairs) {
              const base = pair.baseToken?.address?.toLowerCase();
              const price = Number(pair.priceUsd);
              if (!base || !batch.includes(base) || !Number.isFinite(price) || price < 0) continue;
              const liq = pair.liquidity?.usd ?? 0;
              const prev = best.get(base);
              if (!prev || liq > prev.liq) best.set(base, { price, liq });
            }
          }
          for (const addr of batch) next[addr] = best.get(addr)?.price ?? null;
        } catch {
          for (const addr of batch) next[addr] = null;
        }
      }
      if (cancel) return;
      setBagPrices(next);
      setBagReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, [communitySort, shells]);

  useEffect(() => {
    if (boardSort !== "bag") return;
    const wanted = new Set<string>();
    for (const row of [...shells, ...quietBoxes, ...drips, ...pots]) wanted.add(bagToken(row.token));
    const list = [...wanted];
    if (!list.length) {
      setBoardBagPrices({});
      setBoardBagReady(true);
      return;
    }
    let cancel = false;
    void (async () => {
      const next: Record<string, number | null> = {};
      for (let i = 0; i < list.length; i += 30) {
        const batch = list.slice(i, i + 30);
        try {
          const res = await fetch(`https://api.dexscreener.com/tokens/v1/monad/${batch.join(",")}`);
          const pairs = res.ok ? ((await res.json()) as { baseToken?: { address?: string }; priceUsd?: string; liquidity?: { usd?: number } }[]) : [];
          const best = new Map<string, { price: number; liq: number }>();
          if (Array.isArray(pairs)) {
            for (const pair of pairs) {
              const base = pair.baseToken?.address?.toLowerCase();
              const price = Number(pair.priceUsd);
              if (!base || !batch.includes(base) || !Number.isFinite(price) || price < 0) continue;
              const liq = pair.liquidity?.usd ?? 0;
              const prev = best.get(base);
              if (!prev || liq > prev.liq) best.set(base, { price, liq });
            }
          }
          for (const addr of batch) next[addr] = best.get(addr)?.price ?? null;
        } catch {
          for (const addr of batch) next[addr] = null;
        }
      }
      if (cancel) return;
      setBoardBagPrices(next);
      setBoardBagReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, [boardSort, shells, quietBoxes, drips, pots]);

  useEffect(() => {
    const claimed = new Set(shells.filter((shell) => shell.claimed).map((shell) => shell.id));
    setEarlyIds((ids) => {
      const next = ids.filter((id) => !claimed.has(id));
      if (next.length === ids.length) return ids;
      writeEarly(next);
      return next;
    });
  }, [shells]);

  useEffect(() => {
    const addr = asAddress(SHELLS_ADDRESS);
    if (!addr) {
      setShells([]);
      setBoard("empty");
      return;
    }
    let cancel = false;
    let first = true;
    const run = async () => {
      const gen = shellsGen.current;
      try {
        setBoard((prev) => (prev === "ready" || prev === "empty" ? prev : "loading"));
        const rows = await readShells(addr, (batch) => {
          if (!cancel && first && gen === shellsGen.current) setShells(batch);
        });
        if (cancel || gen !== shellsGen.current) return;
        setShells((prev) => mergeFresh(prev, rows));
        setBoard(rows.length ? "ready" : "empty");
        first = false;
      } catch {
        if (!cancel) setBoard("error");
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 20000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    let first = true;
    const run = async () => {
      try {
        const rows = await readQuietBoxes((batch) => {
          if (!cancel && first) setQuietBoxes(batch);
        });
        if (!cancel) setQuietBoxes(rows);
      } catch {
        // Shells still load if the quiet contract cannot be read.
      } finally {
        if (!cancel) {
          setQuietListReading(false);
          first = false;
        }
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 20000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    let first = true;
    const run = async () => {
      try {
        const rows = await readDripBoxes((batch) => {
          if (!cancel && first) setDrips(batch);
        });
        if (!cancel) setDrips(rows);
      } catch {
        // Shells still load if the drip contract cannot be read.
      } finally {
        if (!cancel) {
          setDripListReading(false);
          first = false;
        }
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 20000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    let first = true;
    const run = async () => {
      try {
        const rows = await readPots((batch) => {
          if (!cancel && first) setPots(batch);
        });
        if (!cancel) setPots(rows);
      } catch {
        // Shells still load if the pot contract cannot be read.
      } finally {
        if (!cancel) {
          setPotListReading(false);
          first = false;
        }
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 20000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const addr = asAddress(SHELLS_ADDRESS);
    if (!addr) return;
    let cancel = false;
    void readShellCount(addr)
      .then((total) => {
        if (!cancel) setShellCount(total);
      })
      .catch(() => {
        // Keep the last count. This is not the burn-wallet balance.
      });
    return () => {
      cancel = true;
    };
  }, [shells]);

  async function connect() {
    dropped.current = false;
    const next = await requestAccounts();
    setAccount(next);
    setChainId(await currentChainId());
    attachWatch();
    return next;
  }

  async function disconnect() {
    dropped.current = true;
    setAccount("");
    const eth = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    try {
      await eth?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Wallet stayed connected there. The page still drops it.
    }
  }

  async function showNewShells(shellsAddress: `0x${string}`, signer: `0x${string}`, before: number) {
    try {
      const after = await readShellCount(shellsAddress);
      if (after <= before) return;
      const mine = signer.toLowerCase();
      const found: ShellRow[] = [];
      for (let id = before; id < after; id++) {
        const row = await readShell(shellsAddress, id);
        if (!row) continue;
        if (row.sender.toLowerCase() !== mine && row.recipient.toLowerCase() !== mine) continue;
        found.push(row);
      }
      if (!found.length) return;
      shellsGen.current += 1;
      setShells((prev) => {
        const known = new Set(prev.map((row) => row.id));
        const extra = found.filter((row) => !known.has(row.id));
        return extra.length ? [...extra, ...prev] : prev;
      });
      setBoard("ready");
    } catch {
      // The full read still adds it.
    }
  }

  async function refreshShells(shellsAddress: `0x${string}`) {
    const gen = shellsGen.current;
    const rows = await readShells(shellsAddress);
    if (gen !== shellsGen.current) return;
    setShells((prev) => mergeFresh(prev, rows));
    setBoard(rows.length ? "ready" : "empty");
  }

  async function onShellUp() {
    setStatus("");
    setBusy(true);
    try {
      const shellsAddress = asAddress(SHELLS_ADDRESS);
      if (!shellsAddress) {
        setStatus("No Shells contract.");
        return;
      }
      let to = who === "fren" ? asAddress(recipient) : null;
      if (who === "fren" && !to) {
        setStatus(recipient.trim() ? "Recipient has to be an address." : "Enter a recipient address");
        return;
      }
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      if (!to) to = signer;
      let token: "native" | `0x${string}` = "native";
      if (tokenKind === "monchel") token = MONCHEL;
      if (tokenKind === "paste") {
        const pasted = asAddress(tokenPaste);
        if (!pasted || tokenReading || !tokenPreview || tokenPreview.address !== pasted) {
          setStatus(
            tokenReading ? "Reading this token." : tokenFault || (tokenPaste.trim() ? TOKEN_UNREADABLE : "Paste a token contract."),
          );
          return;
        }
        token = pasted;
      }
      if (!amount.trim()) {
        setStatus("Enter an amount.");
        return;
      }
      const unlockMs = new Date(unlockAt).getTime();
      if (!Number.isFinite(unlockMs) || unlockMs < Date.now() + 60 * 60 * 1000) {
        setStatus("Unlock has to be at least 1 hour from now.");
        return;
      }
      const trimmed = shellStored(title.trim() || (who === "fren" ? TITLE_FREN : TITLE_ME), note, share);
      if (noteBytes(trimmed) > 140) {
        setStatus("Note is too long.");
        return;
      }
      const before = await readShellCount(shellsAddress);
      await createShell({
        shells: shellsAddress,
        account: signer,
        recipient: to,
        token,
        amountText: amount,
        unlockTime: BigInt(Math.floor(unlockMs / 1000)),
        note: trimmed,
        onStatus: setStatus,
      });
      await showNewShells(shellsAddress, signer, before);
      setAmount("");
      setNote("");
      setTitle("");
      titleTouched.current = false;
      setStatus("");
      await refreshShells(shellsAddress);
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  function vestingToken(): "native" | `0x${string}` | null {
    if (vestMon) return "native";
    const pasted = asAddress(vestPaste);
    if (!pasted || vestReading || !vestPreview || vestPreview.address !== pasted) {
      setStatus(vestReading ? "Reading this token." : vestFault || (vestPaste.trim() ? TOKEN_UNREADABLE : "Paste a token contract."));
      return null;
    }
    return pasted;
  }

  async function onVestOne() {
    setStatus("");
    setBusy(true);
    try {
      const shellsAddress = asAddress(SHELLS_ADDRESS);
      if (!shellsAddress) {
        setStatus("No Shells contract.");
        return;
      }
      const to = asAddress(vestTo);
      if (!to) {
        setStatus(vestTo.trim() ? "Recipient has to be an address." : "Enter a recipient address");
        return;
      }
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      if (!vestAmount.trim()) {
        setStatus("Enter an amount.");
        return;
      }
      const vestToken = vestingToken();
      if (!vestToken) return;
      const unlockMs = new Date(vestUnlock).getTime();
      if (!Number.isFinite(unlockMs) || unlockMs < Date.now() + 60 * 60 * 1000) {
        setStatus("Unlock has to be at least 1 hour from now.");
        return;
      }
      const trimmed = vestStored(vestTitle, vestNote, vestPublic);
      if (noteBytes(trimmed) > 140) {
        setStatus("Note is too long.");
        return;
      }
      const before = await readShellCount(shellsAddress);
      await createShell({
        shells: shellsAddress,
        account: signer,
        recipient: to,
        token: vestToken,
        amountText: vestAmount,
        unlockTime: BigInt(Math.floor(unlockMs / 1000)),
        note: trimmed,
        onStatus: setStatus,
      });
      await showNewShells(shellsAddress, signer, before);
      setVestAmount("");
      setVestNote("");
      setStatus("");
      await refreshShells(shellsAddress);
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function onVestSplit() {
    setStatus("");
    setBusy(true);
    const done: number[] = [];
    try {
      const shellsAddress = asAddress(SHELLS_ADDRESS);
      if (!shellsAddress) {
        setStatus("No Shells contract.");
        return;
      }
      const pending = splitRows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.address.trim() || row.amount.trim() || row.date.trim());
      if (pending.length === 0) {
        setStatus("Enter a recipient address");
        return;
      }
      const planned: { index: number; recipient: `0x${string}`; amountText: string; unlockTime: bigint }[] = [];
      for (const { row, index } of pending) {
        const to = asAddress(row.address);
        if (!to) {
          setStatus(
            row.address.trim() ? `Row ${index + 1}: Recipient has to be an address.` : `Row ${index + 1}: Enter a recipient address`,
          );
          return;
        }
        if (!row.amount.trim() || !(Number(row.amount) > 0)) {
          setStatus(`Row ${index + 1}: Enter an amount.`);
          return;
        }
        const unlockMs = new Date(row.date).getTime();
        if (!Number.isFinite(unlockMs) || unlockMs < Date.now() + 60 * 60 * 1000) {
          setStatus(`Row ${index + 1}: Unlock has to be at least 1 hour from now.`);
          return;
        }
        planned.push({
          index,
          recipient: to,
          amountText: row.amount,
          unlockTime: BigInt(Math.floor(unlockMs / 1000)),
        });
      }
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      const vestToken = vestingToken();
      if (!vestToken) return;
      const trimmed = vestStored(vestTitle, vestNote, vestPublic);
      if (noteBytes(trimmed) > 140) {
        setStatus("Note is too long.");
        return;
      }
      for (const item of planned) {
        const before = await readShellCount(shellsAddress);
        await createShell({
          shells: shellsAddress,
          account: signer,
          recipient: item.recipient,
          token: vestToken,
          amountText: item.amountText,
          unlockTime: item.unlockTime,
          note: trimmed,
          onStatus: setStatus,
        });
        done.push(item.index);
        await showNewShells(shellsAddress, signer, before);
      }
      setSplitRows((rows) => rows.map((row, index) => (done.includes(index) ? { address: "", amount: "", date: "" } : row)));
      setVestNote("");
      setStatus("");
      await refreshShells(shellsAddress);
    } catch (err) {
      if (done.length) {
        setSplitRows((rows) => rows.map((row, index) => (done.includes(index) ? { address: "", amount: "", date: "" } : row)));
        const shellsAddress = asAddress(SHELLS_ADDRESS);
        if (shellsAddress) await refreshShells(shellsAddress);
      }
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function onInherit() {
    setStatus("");
    setBusy(true);
    try {
      const shellsAddress = asAddress(SHELLS_ADDRESS);
      if (!shellsAddress) {
        setStatus("No Shells contract.");
        return;
      }
      const to = asAddress(inheritTo);
      if (!to) {
        setStatus(inheritTo.trim() ? "Recipient has to be an address." : "Enter a recipient address");
        return;
      }
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      if (!inheritAmount.trim()) {
        setStatus("Enter an amount.");
        return;
      }
      let token: "native" | `0x${string}` = "native";
      if (inheritTrigger === "date") {
        if (dateKind === "monchel") token = MONCHEL;
        if (dateKind === "paste") {
          const pasted = asAddress(datePaste);
          if (!pasted || dateReading || !datePreview || datePreview.address !== pasted) {
            setStatus(
              dateReading ? "Reading this token." : dateFault || (datePaste.trim() ? TOKEN_UNREADABLE : "Paste a token contract."),
            );
            return;
          }
          token = pasted;
        }
      } else {
        if (inheritKind === "monchel") token = MONCHEL;
        if (inheritKind === "paste") {
          const pasted = asAddress(inheritPaste);
          if (!pasted || inheritReading || !inheritPreview || inheritPreview.address !== pasted) {
            setStatus(
              inheritReading ? "Reading this token." : inheritFault || (inheritPaste.trim() ? TOKEN_UNREADABLE : "Paste a token contract."),
            );
            return;
          }
          token = pasted;
        }
      }
      const named = inheritName.trim();
      const extra = inheritNote.trim();
      const stored = named && extra ? `${named}${TITLE_SEP}${extra}` : named || extra;
      if (noteBytes(stored) > 140) {
        setStatus("Note is too long.");
        return;
      }
      if (inheritTrigger === "date") {
        const unlockMs = new Date(inheritUnlock).getTime();
        if (!Number.isFinite(unlockMs) || unlockMs < Date.now() + 60 * 60 * 1000) {
          setStatus("Unlock has to be at least 1 hour from now.");
          return;
        }
        const marked = stored ? `${INHERIT_MARK} ${stored}` : INHERIT_MARK;
        if (noteBytes(marked) > 140) {
          setStatus("Note is too long.");
          return;
        }
        const before = await readShellCount(shellsAddress);
        await createShell({
          shells: shellsAddress,
          account: signer,
          recipient: to,
          token,
          amountText: inheritAmount,
          unlockTime: BigInt(Math.floor(unlockMs / 1000)),
          note: marked,
          onStatus: setStatus,
        });
        await showNewShells(shellsAddress, signer, before);
        await refreshShells(shellsAddress);
      } else {
        await createQuiet({
          account: signer,
          recipient: to,
          token,
          amountText: inheritAmount,
          interval: QUIET_INTERVAL[inheritQuiet],
          note: stored,
          onStatus: setStatus,
        });
        setQuietBoxes(await readQuietBoxes());
      }
      setInheritAmount("");
      setInheritNote("");
      setStatus("");
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDrip() {
    setStatus("");
    setBusy(true);
    try {
      const to = asAddress(dripTo);
      if (!to) {
        setStatus(dripTo.trim() ? "Recipient has to be an address." : "Enter an address");
        return;
      }
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      if (!dripAmount.trim()) {
        setStatus("Enter an amount.");
        return;
      }
      let token: "native" | `0x${string}` = "native";
      if (dripToken === "monchel") token = MONCHEL;
      if (dripToken === "paste") {
        const pasted = asAddress(dripPaste);
        if (!pasted || dripReading || !dripPreview || dripPreview.address !== pasted) {
          setStatus(
            dripReading ? "Reading this token." : dripFault || (dripPaste.trim() ? TOKEN_UNREADABLE : "Paste a token contract."),
          );
          return;
        }
        token = pasted;
      }
      const message = dripNote.trim();
      if (noteBytes(message) > 140) {
        setStatus("Message is too long.");
        return;
      }
      const title = dripTitle.trim();
      const known = new Set(drips.map((box) => box.id));
      await createDrip({
        account: signer,
        recipient: to,
        token,
        amountText: dripAmount,
        duration: DRIP_DURATION[dripHours],
        note: message,
        onStatus: setStatus,
      });
      const rows = await readDripBoxes();
      setDrips(rows);
      if (title) {
        const created = rows
          .filter((box) => !known.has(box.id) && box.sender.toLowerCase() === signer.toLowerCase())
          .sort((a, b) => b.id - a.id)[0];
        if (created) {
          setDripTitles((prev) => {
            const next = { ...readDripTitles(), ...prev };
            if (!next[created.id]) next[created.id] = title;
            try {
              localStorage.setItem("drip-titles", JSON.stringify(next));
            } catch {
              // Keep the title in memory if storage is blocked.
            }
            return next;
          });
        }
      }
      setDripAmount("");
      setDripNote("");
      setDripTitle("");
      setStatus("");
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSteady() {
    setStatus("");
    setBusy(true);
    try {
      const to = asAddress(dripTo);
      if (!to) {
        setStatus(dripTo.trim() ? "Pot address has to be an address." : "Enter a pot address");
        return;
      }
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      if (!steadyPot.trim()) {
        setStatus("Enter an amount.");
        return;
      }
      let token: "native" | `0x${string}` = "native";
      if (steadyToken === "monchel") token = MONCHEL;
      if (steadyToken === "paste") {
        const pasted = asAddress(steadyPaste);
        if (!pasted || steadyReading || !steadyPreview || steadyPreview.address !== pasted) {
          setStatus(
            steadyReading ? "Reading this token." : steadyFault || (steadyPaste.trim() ? TOKEN_UNREADABLE : "Paste a token contract."),
          );
          return;
        }
        token = pasted;
      }
      const message = steadyNote.trim();
      if (noteBytes(message) > 140) {
        setStatus("Message is too long.");
        return;
      }
      await createPot({
        account: signer,
        recipient: to,
        amountText: steadyPot,
        token,
        duration: steadySpan,
        title: steadyTitle.trim(),
        note: message,
        onStatus: setStatus,
      });
      setPots(await readPots());
      setSteadyPot("");
      setSteadyNote("");
      setSteadyTitle("");
      setStatus("");
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDripClaim(id: number, home: DripBox["home"]) {
    setStatus("");
    setBusy(true);
    try {
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      await dripClaim(signer, id, home, setStatus);
      setStatus("");
      setDrips(await readDripBoxes());
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPotClaim(id: number, home: PotBox["home"]) {
    setStatus("");
    setBusy(true);
    try {
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      await potClaim(signer, id, home, setStatus);
      setStatus("");
      setPots(await readPots());
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function onQuiet(id: number, kind: "checkIn" | "cancel" | "claim") {
    setStatus("");
    setBusy(true);
    try {
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      const act = kind === "checkIn" ? quietCheckIn : kind === "cancel" ? quietCancel : quietClaim;
      await act(signer, id, setStatus);
      setStatus("");
      setQuietBoxes(await readQuietBoxes());
    } catch (err) {
      setStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function refreshNftDeals() {
    try {
      const rows = await readNftDeals();
      const holders = await readSealHolders(rows);
      const owners: Record<number, string> = {};
      rows.forEach((deal, index) => {
        const holder = holders[index];
        if (holder) owners[deal.id] = holder.toLowerCase();
      });
      setNftDeals(rows);
      setSealOwners(owners);
    } catch {
      setNftDeals([]);
      setSealOwners({});
    }
  }

  async function onNftLock() {
    setNftLockFault("");
    setStatus("");
    setBusy(true);
    try {
      if (!/^\d+$/.test(nftSeal.trim())) {
        setNftLockFault("Enter a seal id.");
        return;
      }
      if (!nftAmount.trim() || !(Number(nftAmount.trim()) > 0)) {
        setNftLockFault("Enter an amount.");
        return;
      }
      let payment: `0x${string}` | undefined;
      if (!nftMon) {
        const pasted = asAddress(nftPaste);
        if (!pasted || nftTokenReading || !nftPreview || nftPreview.address !== pasted) {
          setNftLockFault(
            nftTokenReading ? "Reading this token." : nftTokenFault || (nftPaste.trim() ? TOKEN_UNREADABLE : "Paste a token contract."),
          );
          return;
        }
        payment = pasted;
      }
      const deadlineMs = new Date(nftDeadline).getTime();
      if (!Number.isFinite(deadlineMs)) {
        setNftLockFault("Enter a deadline.");
        return;
      }
      const deadline = BigInt(Math.floor(deadlineMs / 1000));
      if (deadline < BigInt(Math.floor(Date.now() / 1000)) + 60n) {
        setNftLockFault("Deadline must be at least 1 minute ahead.");
        return;
      }
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setNftLockFault("Connect a wallet.");
        return;
      }
      await createNftDeal({
        account: signer,
        sealId: BigInt(nftSeal.trim()),
        amountText: nftAmount,
        deadline,
        note: nftNote,
        payment,
        onStatus: setStatus,
      });
      setNftSeal("");
      setNftAmount("");
      setNftMon(true);
      setNftPaste("");
      setNftPreview(null);
      setNftTokenFault("");
      setNftNote("");
      setNftLockFault("");
      setStatus("");
      await refreshNftDeals();
    } catch (err) {
      setStatus("");
      setNftLockFault(nftReason(err).trim() || "The call reverted.");
    } finally {
      setBusy(false);
    }
  }

  async function onNftSell(deal: NftDeal) {
    setNftFault(null);
    setStatus("");
    setBusy(true);
    try {
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setNftFault({ id: deal.id, text: "Connect a wallet." });
        return;
      }
      await transferNftSeal(signer, deal.collection, deal.sealId, deal.id, setStatus);
      rememberNftSale(signer, deal);
      setNftRecords(readNftRecords());
      setStatus("");
      setNftFault(null);
      await refreshNftDeals();
    } catch (err) {
      setStatus("");
      const text = nftReason(err).trim();
      setNftFault({ id: deal.id, text: text || "The call reverted." });
    } finally {
      setBusy(false);
    }
  }

  async function onNftCollect(id: number) {
    setNftFault(null);
    setStatus("");
    setBusy(true);
    try {
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setNftFault({ id, text: "Connect a wallet." });
        return;
      }
      await collectNftDeal(signer, id, setStatus);
      setStatus("");
      setNftFault(null);
      await refreshNftDeals();
    } catch (err) {
      setStatus("");
      const text = nftReason(err).trim();
      setNftFault({ id, text: text || "The call reverted." });
    } finally {
      setBusy(false);
    }
  }

  async function onNftCancel(id: number) {
    setNftFault(null);
    setStatus("");
    setBusy(true);
    try {
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setNftFault({ id, text: "Connect a wallet." });
        return;
      }
      await cancelNftDeal(signer, id, setStatus);
      setStatus("");
      setNftFault(null);
      await refreshNftDeals();
    } catch (err) {
      setStatus("");
      const text = nftReason(err).trim();
      setNftFault({ id, text: text || "The call reverted." });
    } finally {
      setBusy(false);
    }
  }

  async function onClaim(id: number) {
    setStatus("");
    setBusy(true);
    try {
      const shellsAddress = asAddress(SHELLS_ADDRESS);
      if (!shellsAddress) {
        setStatus("No Shells contract.");
        return;
      }
      const signer = account ? asAddress(account) : await connect();
      if (!signer) {
        setStatus("Connect a wallet.");
        return;
      }
      await claimShell({
        shells: shellsAddress,
        account: signer,
        id,
        onStatus: setStatus,
      });
      setStatus("");
      setEarlyIds((ids) => {
        const next = ids.filter((early) => early !== id);
        writeEarly(next);
        return next;
      });
      const rows = await readShells(shellsAddress);
      setShells(rows);
      setBoard(rows.length ? "ready" : "empty");
    } catch (err) {
      const shell = shells.find((row) => row.id === id);
      if (isClaimTooEarly(err, shell?.unlockTime) || explain(err) === "Too early.") {
        setEarlyIds((ids) => {
          const next = ids.includes(id) ? ids : [...ids, id];
          writeEarly(next);
          return next;
        });
        setStatus("");
        return;
      }
      const message = explain(err);
      if (message === "Already claimed." || isRawRevertText(message) || message === "") {
        setEarlyIds((ids) => {
          if (message !== "Already claimed.") return ids;
          const next = ids.filter((early) => early !== id);
          writeEarly(next);
          return next;
        });
        setStatus("");
        if (message === "Already claimed.") {
          const again = asAddress(SHELLS_ADDRESS);
          if (again) {
            const rows = await readShells(again);
            setShells(rows);
            setBoard(rows.length ? "ready" : "empty");
          }
        }
        return;
      }
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  const me = asAddress(account)?.toLowerCase() ?? "";
  const shownStatus =
    isRawRevertText(status) || /^shelled up\b/i.test(status.trim()) ? "" : status;
  const visible = me
    ? shells.filter((shell) => shell.sender.toLowerCase() === me || shell.recipient.toLowerCase() === me)
    : [];
  const boardShown = visible.filter((shell) => {
    if (boardTab === "active") return !shell.claimed;
    if (boardTab === "claimed") return shell.claimed;
    return true;
  });
  const quietShown = me
    ? quietBoxes.filter((box) => {
        const mine = box.sender.toLowerCase() === me || box.recipient.toLowerCase() === me;
        if (!mine) return false;
        if (boardTab === "active") return !box.settled;
        if (boardTab === "claimed") return box.settled;
        return true;
      })
    : [];
  const dripShown = me
    ? drips.filter((box) => {
        const mine = box.sender.toLowerCase() === me || box.recipient.toLowerCase() === me;
        if (!mine) return false;
        const done = box.claimed >= box.amount;
        if (boardTab === "active") return !done;
        if (boardTab === "claimed") return done;
        return true;
      })
    : [];
  const potShown = me
    ? pots.filter((box) => {
        const mine = box.sender.toLowerCase() === me || box.recipient.toLowerCase() === me;
        if (!mine) return false;
        const done = box.claimed >= box.amount;
        if (boardTab === "active") return !done;
        if (boardTab === "claimed") return done;
        return true;
      })
    : [];
  const boardShells = boardShown.filter((shell) => {
    const dated = isDateInherit(shell.note);
    if (boardKind === "hold") return !shellTitle(shell.note).startsWith(VEST_MARK) && !dated;
    if (boardKind === "vest") return shellTitle(shell.note).startsWith(VEST_MARK);
    if (boardKind === "drip") return false;
    if (boardKind === "inherit") return dated;
    return true;
  });
  const boardQuiet = boardKind === "all" || boardKind === "inherit" ? quietShown : [];
  const boardDrip = boardKind === "all" || boardKind === "drip" ? dripShown : [];
  const boardPots = boardKind === "all" || boardKind === "drip" ? potShown : [];
  const boardCards = [
    ...(boardSort === "claim"
      ? []
      : boardPots.map((box) => ({
          at: boardTab === "all" ? box.start || null : box.start || null,
          when: box.end,
          id: box.id,
          card: "pot" as const,
          box,
        }))),
    ...(boardSort === "claim"
      ? []
      : boardDrip.map((box) => ({
          at: boardTab === "all" ? (box.createdAt == null && box.claimedAt == null ? null : Math.max(box.createdAt ?? 0, box.claimedAt ?? 0)) : box.createdAt,
          when: box.ends,
          id: box.id,
          card: "drip" as const,
          box,
        }))),
    ...boardQuiet.map((box) => ({
      at: boardTab === "all" ? (box.createdAt == null && box.claimedAt == null ? null : Math.max(box.createdAt ?? 0, box.claimedAt ?? 0)) : box.createdAt,
      when: box.claimableAt,
      id: box.id,
      card: "quiet" as const,
      box,
    })),
    ...boardShells.map((shell) => ({
      at: boardTab === "all" ? (shell.createdAt == null && shell.claimedAt == null ? null : Math.max(shell.createdAt ?? 0, shell.claimedAt ?? 0)) : shell.createdAt,
      when: shell.unlockTime,
      id: shell.id,
      card: "shell" as const,
      shell,
    })),
  ].sort(
    boardSort === "claim"
      ? (a, b) => a.when - b.when || a.id - b.id
      : boardSort === "lock"
        ? (a, b) => b.when - a.when || b.id - a.id
        : boardSort === "bag" && boardBagReady
        ? (a, b) => {
            const valueA = cardBagValue(a.card === "shell" ? a.shell : a.box, boardBagPrices);
            const valueB = cardBagValue(b.card === "shell" ? b.shell : b.box, boardBagPrices);
            if (valueA == null && valueB == null) return b.id - a.id;
            if (valueA == null) return 1;
            if (valueB == null) return -1;
            if (valueA !== valueB) return valueB - valueA;
            return b.id - a.id;
          }
        : byShellAge(boardTab === "all" || boardSort === "bag" ? "new" : boardSort),
  );
  const community = shells.filter((shell) => shell.note.startsWith(SHARE_MARK));
  const communityShown = community
    .filter((shell) => {
      if (communityTab === "active") return !shell.claimed;
      if (communityTab === "claimed") return shell.claimed;
      return true;
    })
    .filter((shell) => {
      if (communityKind === "holders") return !shellTitle(shell.note).startsWith(VEST_MARK);
      if (communityKind === "vest") return shellTitle(shell.note).startsWith(VEST_MARK);
      return true;
    });
  const communityCards = communityShown
    .map((shell) => ({ at: shell.createdAt, when: shell.unlockTime, id: shell.id, card: "shell" as const, shell }))
    .sort(
      communitySort === "claim"
        ? (a, b) => a.when - b.when || a.id - b.id
        : communitySort === "lock"
          ? (a, b) => b.when - a.when || b.id - a.id
          : communitySort === "bag" && bagReady
          ? (a, b) => {
              const priceA = bagPrices[bagToken(a.shell.token)];
              const priceB = bagPrices[bagToken(b.shell.token)];
              const valueA = priceA == null ? null : bagUsd(a.shell.amount, a.shell.decimals, priceA);
              const valueB = priceB == null ? null : bagUsd(b.shell.amount, b.shell.decimals, priceB);
              if (valueA == null && valueB == null) return b.id - a.id;
              if (valueA == null) return 1;
              if (valueB == null) return -1;
              if (valueA !== valueB) return valueB - valueA;
              return b.id - a.id;
            }
          : byShellAge(communitySort === "bag" ? "new" : communitySort),
    );
  const amountValue = Number(amount.trim());
  const shellReady = Number.isFinite(amountValue) && amountValue > 0;
  const vestAmountValue = Number(vestAmount.trim());
  const vestReady = Number.isFinite(vestAmountValue) && vestAmountValue > 0;
  const inheritAmountValue = Number(inheritAmount.trim());
  const inheritReady = Number.isFinite(inheritAmountValue) && inheritAmountValue > 0;

  function toggleVestPublic() {
    setVestPublic((on) => {
      if (!on) {
        const nextNote = clampNote(vestNote, vestNoteBudget(vestTitle, true));
        setVestNote(nextNote);
        setVestTitle(clampNote(vestTitle, vestTitleBudget(nextNote, true)));
      }
      return !on;
    });
  }

  function shellCard(shell: ShellRow) {
    const shared = shell.note.startsWith(SHARE_MARK);
    const noteText = shared ? shell.note.slice(SHARE_MARK.length) : shell.note;
    const dash = noteText.indexOf("—");
    const rawTitle = (dash === -1 ? noteText : noteText.slice(0, dash)).trim();
    const dated = rawTitle.startsWith(INHERIT_MARK) || noteText.startsWith(INHERIT_MARK);
    const cardTitle = dated
      ? rawTitle.slice(INHERIT_MARK.length).trim()
      : rawTitle.startsWith(VEST_MARK)
        ? rawTitle.slice(VEST_MARK.length).trim()
        : rawTitle;
    const cardNote = dash === -1 ? "" : noteText.slice(dash + 1).trim();
    const vesting = rawTitle.startsWith(VEST_MARK);
    const teamVest =
      vesting &&
      shells.some(
        (row) => row.id !== shell.id && row.note === shell.note && row.sender.toLowerCase() === shell.sender.toLowerCase(),
      );
    const isRecipient = me !== "" && shell.recipient.toLowerCase() === me;
    const locked = isRecipient && !shell.claimed && now < shell.unlockTime * 1000;
    const canClaim = isRecipient && !shell.claimed && !locked;
    const amountLabel = `${formatAmount(shell.amount, shell.decimals)} ${shell.symbol}`;
    const lockLine = `${amountLabel} locked until ${formatWhen(shell.unlockTime)}.`;
    const shellUrl = `https://www.shellup.io/?s=${shell.id}`;
    const shareText = [cardTitle, cardNote, lockLine, shellUrl]
      .filter((line) => line.trim())
      .join("\n");
    const telegramText = [cardTitle, cardNote, lockLine].filter((line) => line.trim()).join("\n");
    return (
      <article className="shell" key={shell.id}>
        {shell.claimed ? <p className="claimed-stamp">CLAIMED</p> : null}
        <p className="uncrackable text-sm">
          {dated ? "Inheritance - On a date" : vesting ? (teamVest ? "Team Vesting" : "Solo Vesting") : shell.sender.toLowerCase() === shell.recipient.toLowerCase() ? "Hold 💎" : "Fren hold 💎"}
        </p>
        <div className="shell-top">
          <div className="shell-heading">
            {cardTitle ? <p className="note shell-title text-lg font-medium">{cardTitle}</p> : null}
            {cardNote ? <p className="shell-note">{cardNote}</p> : null}
          </div>
          <p className="shell-id">
            <a
              className="tx-dot"
              href={`https://monadvision.com/address/${SHELLS_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Check tx"
            >
              <span className="id-tip">Check tx</span>
            </a>
            <span className="shell-id-num" onClick={() => showIdNote(`shell-${shell.id}`)}>
              #{shell.id}
              <span className="id-tip">This ID is important if you want to claim on Monadscan</span>
              {idNote === `shell-${shell.id}` ? (
                <span className="id-note">Use this number for claiming on Monadscan.</span>
              ) : null}
            </span>
          </p>
        </div>
        <p className={noteText ? "mt-1 text-base text-fg tabular-nums" : "text-lg text-fg tabular-nums"}>{amountLabel}</p>
        <p className="addr mt-1 text-sm text-muted">From {shortAddr(shell.sender)}</p>
        <p className="addr mt-1 text-sm text-muted">to {shortAddr(shell.recipient)}</p>
        <p className={shell.claimed ? "unlocked-line" : "unlocks-line"}>
          {shell.claimed ? "Unlocked" : dated ? "Claimable" : "Unlocks"} - {formatWhen(shell.unlockTime)}
        </p>
        {rawTitle.startsWith(VEST_MARK) && shared ? (
          <p className="community-mark">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M3.2 8.4 6.3 11.5 12.8 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Public
          </p>
        ) : shared ? (
          <p className="community-mark">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M3.2 8.4 6.3 11.5 12.8 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Community
          </p>
        ) : null}
        {!dated && now < shell.unlockTime * 1000 ? (
          <div className="locked-row">
            <button
              type="button"
              className="btn-locked"
              onClick={() => {
                setToast("Uncrackable until timer ends");
                if (toastTimer.current) window.clearTimeout(toastTimer.current);
                toastTimer.current = window.setTimeout(() => setToast(""), 2400);
              }}
            >
              Locked
            </button>
            {rawTitle.startsWith(VEST_MARK) ? null : <p className="uncrackable text-sm">Uncrackable until timer ends</p>}
          </div>
        ) : null}
        {canClaim ? (
          <button
            type="button"
            className={busy ? "btn btn-primary btn-block mt-3" : "btn btn-primary btn-block mt-3 btn-claim-ready"}
            disabled={busy}
            onClick={() => void onClaim(shell.id)}
          >
            Claim
          </button>
        ) : null}
        {dated ? null : (
        <div className="shell-share-row">
          <button
            type="button"
            className="shell-share"
            onClick={() => {
              void navigator.clipboard?.writeText(shareText).catch(() => {
                // Copy can fail. Still try the sheet. Do not post anywhere else.
              });
              const nav = navigator as Navigator & { share?: (data: { text: string }) => Promise<void> };
              if (typeof nav.share === "function") {
                void nav.share({ text: shareText }).catch(() => {
                  // Closed the sheet. Do not post anywhere else.
                });
                return;
              }
              setToast("Copied");
              if (toastTimer.current) window.clearTimeout(toastTimer.current);
              toastTimer.current = window.setTimeout(() => setToast(""), 1000);
            }}
          >
            Share
          </button>
          <a
            className="shell-share shell-share-wide"
            href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>
          <a
            className="shell-share shell-share-wide"
            href={`https://t.me/share/url?url=${encodeURIComponent(shellUrl)}&text=${encodeURIComponent(telegramText)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegram
          </a>
          <button
            type="button"
            className="shell-share"
            onClick={() => {
              void paintSharePlate(plateLock(shell, shells), cardTitle.trim() || "Shell", amountLabel, formatWhen(shell.unlockTime), shell.claimed, shell.id).then((canvas) => {
                setSharePic({ id: shell.id, url: canvas.toDataURL("image/png") });
              });
            }}
          >
            Save image
          </button>
        </div>
        )}
      </article>
    );
  }

  function quietCard(box: QuietBox) {
    const dash = box.note.indexOf("—");
    const cardTitle = (dash === -1 ? box.note : box.note.slice(0, dash)).trim();
    const cardNote = dash === -1 ? "" : box.note.slice(dash + 1).trim();
    const isSender = me !== "" && box.sender.toLowerCase() === me;
    const isRecipient = me !== "" && box.recipient.toLowerCase() === me;
    const silenceEnd = box.claimableAt - 3600;
    const openAt = box.claimableAt;
    const shownAt = isRecipient ? openAt : silenceEnd;
    const inGrace = !box.settled && now >= silenceEnd * 1000 && now < openAt * 1000;
    const amountLabel = `${formatAmount(box.amount, box.decimals)} ${box.symbol}`;
    return (
      <article className="shell" key={`quiet-${box.id}`}>
        {box.settled ? <p className="claimed-stamp">CLAIMED</p> : null}
        <p className="uncrackable text-sm">Inheritance - If I go quiet</p>
        <div className="shell-top">
          <div className="shell-heading">
            {cardTitle ? <p className="note shell-title text-lg font-medium">{cardTitle}</p> : null}
            {cardNote ? <p className="shell-note">{cardNote}</p> : null}
          </div>
          <p className="shell-id">
            <a
              className="tx-dot"
              href={`https://monadvision.com/address/${QUIET}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Check tx"
            >
              <span className="id-tip">Check tx</span>
            </a>
            <span className="shell-id-num" onClick={() => showIdNote(`quiet-${box.id}`)}>
              #{box.id}
              <span className="id-tip">This ID is important if you want to claim on Monadscan</span>
              {idNote === `quiet-${box.id}` ? (
                <span className="id-note">Use this number for claiming on Monadscan.</span>
              ) : null}
            </span>
          </p>
        </div>
        <p className={box.note ? "mt-1 text-base text-fg tabular-nums" : "text-lg text-fg tabular-nums"}>{amountLabel}</p>
        <p className="addr mt-1 text-sm text-muted">From {shortAddr(box.sender)}</p>
        <p className="addr mt-1 text-sm text-muted">to {shortAddr(box.recipient)}</p>
        <p className={box.settled ? "unlocked-line" : "unlocks-line"}>
          {box.cancelled ? "Denied" : box.settled ? "Claimed" : "Claimable"} - {formatWhen(shownAt)}
        </p>
        {!box.settled && isSender && now < openAt * 1000 ? (
          <div className="quiet-actions">
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void onQuiet(box.id, "checkIn")}>
              Check in
            </button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void onQuiet(box.id, "cancel")}>
              Cancel
            </button>
          </div>
        ) : null}
        {!box.settled && isRecipient && inGrace ? (
          <button type="button" className="btn btn-primary btn-block mt-3">
            Grace Period Begins
          </button>
        ) : null}
        {!box.settled && isRecipient && now >= openAt * 1000 ? (
          <button
            type="button"
            className={busy ? "btn btn-primary btn-block mt-3" : "btn btn-primary btn-block mt-3 btn-claim-ready"}
            disabled={busy}
            onClick={() => void onQuiet(box.id, "claim")}
          >
            Claim
          </button>
        ) : null}
      </article>
    );
  }

  function dripCard(box: DripBox) {
    const isRecipient = me !== "" && box.recipient.toLowerCase() === me;
    const open = box.claimed < box.amount;
    const amountLabel = `${formatAmount(box.amount, box.decimals)} ${box.symbol}`;
    const cardTitle = box.note.trim() || "Drip";
    return (
      <article className="shell" key={`drip-${box.home}-${box.id}`}>
        <p className="uncrackable text-sm">Drip - Slowly...then all at once</p>
        <p className="note shell-title text-lg font-medium">{cardTitle}</p>
        <p className="mt-1 text-base text-fg tabular-nums">{amountLabel}</p>
        <p className="addr mt-1 text-sm text-muted">Fren {shortAddr(box.recipient)}</p>
        <p className="unlocks-line">{open ? "Ends" : "Ended"} - {formatWhen(box.ends)}</p>
        {open && isRecipient ? (
          <button
            type="button"
            className={busy ? "btn btn-primary btn-block mt-3" : "btn btn-primary btn-block mt-3 btn-claim-ready"}
            disabled={busy}
            onClick={() => void onDripClaim(box.id, box.home)}
          >
            Claim
          </button>
        ) : null}
      </article>
    );
  }

  function potCard(box: PotBox) {
    const isRecipient = me !== "" && box.recipient.toLowerCase() === me;
    const open = box.claimed < box.amount;
    const amountLabel = `${formatAmount(box.amount, box.decimals)} ${box.symbol}`;
    const left = box.claimed >= box.amount ? 0n : box.amount - box.claimed;
    const leftBase = 10n ** BigInt(box.decimals);
    const leftRounded = (left * 100n + leftBase / 2n) / leftBase;
    const leftText = `${leftRounded / 100n}.${String(leftRounded % 100n).padStart(2, "0")}`;
    const cardTitle = box.title.trim() || "Shell";
    const span = box.end - box.start;
    const dripLen =
      span === 7 * 86400
        ? "1 week drip"
        : span === 30 * 86400
          ? "1 month drip"
          : span === 182 * 86400
            ? "6 month drip"
            : span === 365 * 86400
              ? "1 year drip"
              : "";
    return (
      <article className="shell" key={`pot-${box.home}-${box.id}`}>
        <p className="uncrackable text-sm">Drip - Constant</p>
        <p className="note shell-title text-lg font-medium">{cardTitle}</p>
        <p className="mt-1 text-base text-fg tabular-nums">
          {amountLabel} <span className="text-sm text-muted">({leftText} mon left)</span>
        </p>
        <p className="addr mt-1 text-sm text-muted">From {shortAddr(box.sender)}</p>
        <p className="addr mt-1 text-sm text-muted">Pot {shortAddr(box.recipient)}</p>
        {dripLen ? <p className="mt-1 text-base font-medium text-fg">{dripLen}</p> : null}
        <p className="unlocks-line">{open ? "Ends" : "Ended"} - {formatWhen(box.end)}</p>
        {isRecipient && box.claimable > 0n ? (
          <button
            type="button"
            className={busy ? "btn btn-primary btn-block mt-3" : "btn btn-primary btn-block mt-3 btn-claim-ready"}
            disabled={busy}
            onClick={() => void onPotClaim(box.id, box.home)}
          >
            Claim
          </button>
        ) : null}
      </article>
    );
  }

  return (
    <main className="page">
      <header>
        <div className="head-row">
          <a
            className="monad-chip text-muted"
            href="https://monad.xyz/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="monad-powered">Powered by</span>
            <span className="monad-mark font-medium tracking-wide uppercase">
              <img src="/monad-logomark.png" alt="" />
              Monad
            </span>
          </a>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {account ? (
              <>
                <span className="addr text-sm text-muted">{shortAddr(account)}</span>
                <button type="button" className="btn" onClick={() => void disconnect()}>
                  Disconnect
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => void connect().catch((err) => setStatus(explain(err)))}>
                Connect
              </button>
            )}
            {account && chainId !== null && chainId !== MONAD_ID ? (
              <button
                type="button"
                className="btn"
                onClick={() => void switchToMonad().then(() => currentChainId().then(setChainId)).catch((err) => setStatus(explain(err)))}
              >
                Switch to Monad
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className={account ? "columns columns-split" : "columns"}>
        <div className="lead">
        <div className="brand-lockup">
          <img className="monchel" src="/monchel.png" alt="" />
          <h1 className="brand-title">ShellUp</h1>
        </div>
        <p className="slogan mt-3 max-w-xl text-lg">Slowly…..then all at once</p>
        <section className="panel" aria-labelledby="shell-up-title">
          <div className="file-tabs form-tabs" role="group" aria-label="Form">
            <button type="button" aria-pressed={formMode === "hold"} onClick={() => setFormMode("hold")}>
              Hold
            </button>
            <button type="button" aria-pressed={formMode === "vest"} onClick={() => {
              setVestMon(false);
              setFormMode("vest");
            }}>
              Vesting
            </button>
            <button type="button" aria-pressed={formMode === "drip"} onClick={() => { setFormMode("drip"); setDripKind("steady"); }}>
              Drip
            </button>
            <button type="button" aria-pressed={formMode === "inherit"} onClick={() => setFormMode("inherit")}>
              Inheritance
            </button>
            <button type="button" aria-pressed={formMode === "nft"} onClick={() => setFormMode("nft")}>
              Test NFT
            </button>
          </div>
          <h2 id="shell-up-title" className="text-lg font-medium text-fg">
            Shell Up Funds
          </h2>
          {formMode === "inherit" ? (
            <p className="funds-lead">If I go quiet, this goes to them. Not before.</p>
          ) : formMode === "vest" ? (
            <p className="funds-lead">Each share stays locked until its date. One shell per person. Nobody gets in early.</p>
          ) : formMode === "drip" ? (
            <p className="funds-lead">Slowly drip funds to yourself or a fren</p>
          ) : formMode === "hold" ? (
            <p className="funds-lead">Lock MON or tokens until a date. Nobody can take them out early. Not even you.</p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (formMode === "nft") void onNftLock();
              else if (formMode === "hold") void onShellUp();
              else if (formMode === "vest") {
                if (vestMode === "one") void onVestOne();
                else void onVestSplit();
              } else if (formMode === "drip") {
                if (dripKind === "slow") void onDrip();
                else void onSteady();
              } else void onInherit();
            }}
          >
            {formMode === "hold" ? (
            <div key="hold">
            <div className="seg mt-4" role="group" aria-label="Who receives this Shell">
              <button type="button" aria-pressed={who === "me"} onClick={() => setWho("me")}>
                Me
              </button>
              <button
                type="button"
                aria-pressed={who === "fren"}
                onClick={() => {
                  setWho("fren");
                  setRecipient("");
                }}
              >
                A Fren
              </button>
            </div>

            {who === "fren" ? (
              <label className="field">
                <span className="text-sm text-muted">Recipient</span>
                <input
                  className="control addr"
                  value={recipient}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="0x…"
                  onChange={(event) => setRecipient(event.target.value.trim())}
                />
              </label>
            ) : null}

            <div className="field">
              <span className="text-sm text-muted">Token</span>
              <div className="seg" role="group" aria-label="Token">
                <button
                  type="button"
                  aria-pressed={tokenKind === "mon"}
                  onClick={() => {
                    if (tokenKind === "mon") {
                      setTokenKind("paste");
                      return;
                    }
                    setTokenKind("mon");
                    setTokenPaste("");
                    setTokenPreview(null);
                    setTokenFault("");
                    setTokenReading(false);
                  }}
                >
                  MON
                </button>
                <button
                  type="button"
                  aria-pressed={tokenKind === "monchel"}
                  onClick={() => {
                    if (tokenKind === "monchel") {
                      setTokenKind("paste");
                      return;
                    }
                    setTokenKind("monchel");
                    setTokenPaste("");
                    setTokenPreview(null);
                    setTokenFault("");
                    setTokenReading(false);
                  }}
                >
                  $MONCHEL
                </button>
              </div>
            </div>

            {tokenKind === "paste" ? (
            <label className="field">
              <span className="text-sm text-muted">or token address</span>
              <span className="token-box">
                <input
                  className={tokenPaste ? "control addr token-pad" : "control addr"}
                  value={tokenPaste}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder=""
                  onChange={(event) => {
                    setTokenPaste(event.target.value.trim());
                    setTokenKind("paste");
                    setTokenPreview(null);
                    setTokenFault("");
                  }}
                />
                {tokenPaste ? (
                  <button
                    type="button"
                    className="token-clear"
                    aria-label="Clear token contract"
                    onClick={() => {
                      setTokenPaste("");
                      setTokenPreview(null);
                      setTokenFault("");
                      setTokenReading(false);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </span>
              <span className="token-hint text-sm text-muted">Paste any Monad token contract.</span>
              {tokenPreview ? (
                <span className="token-chip">
                  {tokenPreview.symbol} · {shortAddr(tokenPreview.address)}
                </span>
              ) : null}
              {tokenFault ? <span className="text-sm text-fg">{tokenFault}</span> : null}
            </label>
            ) : null}

            <label className="field">
              <span className="text-sm text-muted">Amount</span>
              <input
                className="control tabular-nums"
                inputMode="decimal"
                value={amount}
                autoComplete="off"
                placeholder="0.0"
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <label className="field">
              <span className="text-sm text-muted">Unlock</span>
              <input
                className="control"
                type="datetime-local"
                value={unlockAt}
                onChange={(event) => setUnlockAt(event.target.value)}
              />
            </label>

            <label className="field">
              <span className="text-sm text-muted">Title</span>
              <input
                className="control"
                value={title}
                autoComplete="off"
                placeholder={who === "fren" ? TITLE_FREN : TITLE_ME}
                onChange={(event) => {
                  titleTouched.current = true;
                  setTitle(clampNote(event.target.value, titleBudget(note, share)));
                }}
              />
            </label>

            <label className="field">
              <span className="text-sm text-muted">Note</span>
              <textarea
                className="control"
                value={note}
                placeholder="Optional extra note."
                onChange={(event) => setNote(clampNote(event.target.value, noteBudget(title.trim() || (who === "fren" ? TITLE_FREN : TITLE_ME), share)))}
              />
              <span className="text-sm text-muted tabular-nums">
                {noteBytes(shellStored(title.trim() || (who === "fren" ? TITLE_FREN : TITLE_ME), note, share))}/140
              </span>
            </label>

            <div className="shell-actions">
              <button className={shellReady ? "btn btn-primary shell-ready" : "btn btn-primary"} type="submit" disabled={busy}>
                Shell Up
              </button>
              <button
                className="btn btn-quiet"
                type="button"
                aria-pressed={share}
                onClick={() => {
                  setShare((on) => {
                    if (!on) {
                      const held = title.trim() || (who === "fren" ? TITLE_FREN : TITLE_ME);
                      const nextNote = clampNote(note, noteBudget(held, true));
                      setNote(nextNote);
                      setTitle(clampNote(title, titleBudget(nextNote, true)));
                    }
                    return !on;
                  });
                }}
              >
                Add to Community Board
              </button>
            </div>
            </div>
            ) : formMode === "drip" ? (
            <div key="drip">
                  <div className="field">
                    <div className="seg" role="group" aria-label="Drip">
                    <button type="button" aria-pressed={dripKind === "steady"} onClick={() => setDripKind("steady")}>
                      Constant drip
                    </button>
                    <button type="button" aria-pressed={dripKind === "slow"} onClick={() => setDripKind("slow")}>
                      Slowly.....then all at once
                    </button>
                  </div>
                  </div>
                  <p className="funds-lead">
                    {dripKind === "slow"
                      ? "50% dripped over a period of time and 50% at the end"
                      : "A constant drip over a set time"}
                  </p>
                  <label className="field">
                    <span className="text-sm text-muted">Recipients address</span>
                    <input
                      className="control addr"
                      value={dripTo}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="0x…"
                      onChange={(event) => setDripTo(event.target.value.trim())}
                    />
                  </label>
                  {dripKind === "slow" ? (
                    <>
                      <div className="field">
                        <span className="text-sm text-muted">Token</span>
                        <div className="seg" role="group" aria-label="Token">
                          <button
                            type="button"
                            aria-pressed={dripToken === "mon"}
                            onClick={() => {
                              if (dripToken === "mon") {
                                setDripToken("paste");
                                return;
                              }
                              setDripToken("mon");
                              setDripPaste("");
                              setDripPreview(null);
                              setDripFault("");
                              setDripReading(false);
                            }}
                          >
                            MON
                          </button>
                          <button
                            type="button"
                            aria-pressed={dripToken === "monchel"}
                            onClick={() => {
                              if (dripToken === "monchel") {
                                setDripToken("paste");
                                return;
                              }
                              setDripToken("monchel");
                              setDripPaste("");
                              setDripPreview(null);
                              setDripFault("");
                              setDripReading(false);
                            }}
                          >
                            $MONCHEL
                          </button>
                        </div>
                      </div>
                      {dripToken === "paste" ? (
                      <label className="field">
                        <span className="text-sm text-muted">or token address</span>
                        <span className="token-box">
                          <input
                            className={dripPaste ? "control addr token-pad" : "control addr"}
                            value={dripPaste}
                            spellCheck={false}
                            autoComplete="off"
                            placeholder=""
                            onChange={(event) => {
                              setDripPaste(event.target.value.trim());
                              setDripToken("paste");
                              setDripPreview(null);
                              setDripFault("");
                            }}
                          />
                          {dripPaste ? (
                            <button
                              type="button"
                              className="token-clear"
                              aria-label="Clear token contract"
                              onClick={() => {
                                setDripPaste("");
                                setDripPreview(null);
                                setDripFault("");
                                setDripReading(false);
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                        <span className="token-hint text-sm text-muted">Paste any Monad token contract.</span>
                        {dripPreview ? (
                          <span className="token-chip">
                            {dripPreview.symbol} · {shortAddr(dripPreview.address)}
                          </span>
                        ) : null}
                        {dripFault ? <span className="text-sm text-fg">{dripFault}</span> : null}
                      </label>
                      ) : null}
                      <label className="field">
                        <span className="text-sm text-muted">Amount</span>
                        <input
                          className="control tabular-nums"
                          inputMode="decimal"
                          value={dripAmount}
                          autoComplete="off"
                          placeholder="0.0"
                          onChange={(event) => setDripAmount(event.target.value)}
                        />
                      </label>
                      <div className="field">
                        <div className="seg" role="group" aria-label="Duration">
                          <button type="button" aria-pressed={dripHours === "1"} onClick={() => setDripHours("1")}>
                            1 month
                          </button>
                          <button type="button" aria-pressed={dripHours === "6"} onClick={() => setDripHours("6")}>
                            6 months
                          </button>
                          <button type="button" aria-pressed={dripHours === "12"} onClick={() => setDripHours("12")}>
                            1 year
                          </button>
                        </div>
                      </div>
                      <label className="field">
                        <span className="text-sm text-muted">Title</span>
                        <input
                          className="control"
                          value={dripTitle}
                          autoComplete="off"
                          onChange={(event) => setDripTitle(event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="text-sm text-muted">Message</span>
                        <textarea className="control" value={dripNote} onChange={(event) => setDripNote(event.target.value)} />
                      </label>
                      <div className="shell-actions">
                        <button className={dripAmount.trim() ? "btn btn-primary shell-ready" : "btn btn-primary"} type="submit" disabled={busy}>
                          Shell Up
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <span className="text-sm text-muted">Token</span>
                        <div className="seg" role="group" aria-label="Token">
                          <button
                            type="button"
                            aria-pressed={steadyToken === "mon"}
                            onClick={() => {
                              if (steadyToken === "mon") {
                                setSteadyToken("paste");
                                return;
                              }
                              setSteadyToken("mon");
                              setSteadyPaste("");
                              setSteadyPreview(null);
                              setSteadyFault("");
                              setSteadyReading(false);
                            }}
                          >
                            MON
                          </button>
                          <button
                            type="button"
                            aria-pressed={steadyToken === "monchel"}
                            onClick={() => {
                              if (steadyToken === "monchel") {
                                setSteadyToken("paste");
                                return;
                              }
                              setSteadyToken("monchel");
                              setSteadyPaste("");
                              setSteadyPreview(null);
                              setSteadyFault("");
                              setSteadyReading(false);
                            }}
                          >
                            $MONCHEL
                          </button>
                        </div>
                      </div>
                      {steadyToken === "paste" ? (
                      <label className="field">
                        <span className="text-sm text-muted">or token address</span>
                        <span className="token-box">
                          <input
                            className={steadyPaste ? "control addr token-pad" : "control addr"}
                            value={steadyPaste}
                            spellCheck={false}
                            autoComplete="off"
                            placeholder=""
                            onChange={(event) => {
                              setSteadyPaste(event.target.value.trim());
                              setSteadyToken("paste");
                              setSteadyPreview(null);
                              setSteadyFault("");
                            }}
                          />
                          {steadyPaste ? (
                            <button
                              type="button"
                              className="token-clear"
                              aria-label="Clear token contract"
                              onClick={() => {
                                setSteadyPaste("");
                                setSteadyToken("mon");
                                setSteadyPreview(null);
                                setSteadyFault("");
                                setSteadyReading(false);
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                        <span className="token-hint text-sm text-muted">Paste any Monad token contract.</span>
                        {steadyPreview ? (
                          <span className="token-chip">
                            {steadyPreview.symbol} · {shortAddr(steadyPreview.address)}
                          </span>
                        ) : null}
                        {steadyFault ? <span className="text-sm text-fg">{steadyFault}</span> : null}
                      </label>
                      ) : null}
                      <label className="field">
                        <span className="text-sm text-muted">Pot amount</span>
                        <input
                          className="control tabular-nums"
                          inputMode="decimal"
                          value={steadyPot}
                          autoComplete="off"
                          placeholder="0.0"
                          onChange={(event) => setSteadyPot(event.target.value)}
                        />
                      </label>
                      <div className="field">
                        <div className="seg" role="group" aria-label="Rate">
                          {(
                            [
                              [0, "1 week"],
                              [1, "1 month"],
                              [2, "6 months"],
                              [3, "1 year"],
                            ] as const
                          ).map(([id, label]) => (
                            <button type="button" key={id} aria-pressed={steadySpan === id} onClick={() => setSteadySpan(id)}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="funds-lead">
                          {`${steadyPot.trim() || "0"} MON over ${steadySpan === 0 ? "1 week" : steadySpan === 1 ? "1 month" : steadySpan === 2 ? "6 months" : "1 year"}`}
                          {steadyDaily(steadyPot, STEADY_DAYS[steadySpan]) ? (
                            <>
                              <br />
                              {steadyDaily(steadyPot, STEADY_DAYS[steadySpan])}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <label className="field">
                        <span className="text-sm text-muted">Title</span>
                        <input
                          className="control"
                          value={steadyTitle}
                          autoComplete="off"
                          onChange={(event) => setSteadyTitle(event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="text-sm text-muted">Message</span>
                        <textarea className="control" value={steadyNote} onChange={(event) => setSteadyNote(event.target.value)} />
                      </label>
                      <div className="shell-actions">
                        <button className={steadyPot.trim() ? "btn btn-primary shell-ready" : "btn btn-primary"} type="submit" disabled={busy}>
                          Shell Up
                        </button>
                      </div>
                    </>
                  )}
            </div>
            ) : formMode === "vest" ? (
            <div key="vest">
              <div className="file-tabs vest-tabs" role="tablist" aria-label="Vesting">
                <button type="button" role="tab" aria-pressed={vestMode === "one"} onClick={() => setVestMode("one")}>
                  Solo Dev
                </button>
                <button type="button" role="tab" aria-pressed={vestMode === "split"} onClick={() => setVestMode("split")}>
                  Team
                </button>
              </div>
              <div className="field">
                <span className="text-sm text-muted">Token</span>
                <div className="seg" role="group" aria-label="Token">
                  <button type="button" aria-pressed={vestMon} onClick={() => setVestMon((on) => !on)}>
                    MON
                  </button>
                </div>
              </div>
              {vestMon ? null : (
              <label className="field">
                <span className="text-sm text-muted">or token address</span>
                <span className="token-box">
                  <input
                    className={vestPaste ? "control addr token-pad" : "control addr"}
                    value={vestPaste}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder=""
                    onChange={(event) => {
                      setVestPaste(event.target.value.trim());
                      setVestPreview(null);
                      setVestFault("");
                    }}
                  />
                  {vestPaste ? (
                    <button
                      type="button"
                      className="token-clear"
                      aria-label="Clear token contract"
                      onClick={() => {
                        setVestPaste("");
                        setVestPreview(null);
                        setVestFault("");
                        setVestReading(false);
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
                <span className="token-hint text-sm text-muted">Paste any Monad token contract.</span>
                {vestPreview ? (
                  <span className="token-chip">
                    {vestPreview.symbol} · {shortAddr(vestPreview.address)}
                  </span>
                ) : null}
                {vestFault ? <span className="text-sm text-fg">{vestFault}</span> : null}
              </label>
              )}
              <label className="field">
                <span className="text-sm text-muted">Project</span>
                <input
                  className="control"
                  value={vestTitle}
                  autoComplete="off"
                  onChange={(event) => setVestTitle(clampNote(event.target.value, vestTitleBudget(vestNote, vestPublic)))}
                />
              </label>
              <label className="field">
                <span className="text-sm text-muted">Details</span>
                <textarea
                  className="control"
                  value={vestNote}
                  onChange={(event) => setVestNote(clampNote(event.target.value, vestNoteBudget(vestTitle, vestPublic)))}
                />
                <span className="text-sm text-muted tabular-nums">{noteBytes(vestStored(vestTitle, vestNote, vestPublic))}/140</span>
              </label>
              {vestMode === "one" ? (
                <>
                  <label className="field">
                    <span className="text-sm text-muted">Address</span>
                    <input
                      className="control addr"
                      value={vestTo}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="0x…"
                      onChange={(event) => setVestTo(event.target.value.trim())}
                    />
                  </label>
                  <label className="field">
                    <span className="text-sm text-muted">Amount</span>
                    <input
                      className="control tabular-nums"
                      inputMode="decimal"
                      value={vestAmount}
                      autoComplete="off"
                      placeholder="0.0"
                      onChange={(event) => setVestAmount(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="text-sm text-muted">Unlock</span>
                    <input
                      className="control"
                      type="datetime-local"
                      value={vestUnlock}
                      onChange={(event) => setVestUnlock(event.target.value)}
                    />
                  </label>
                  <div className="shell-actions">
                    <button className={vestReady ? "btn btn-primary shell-ready" : "btn btn-primary"} type="submit" disabled={busy}>
                      Shell Up
                    </button>
                    <button type="button" className="btn btn-quiet" aria-pressed={vestPublic} onClick={() => toggleVestPublic()}>
                      Go public
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {splitRows.map((row, index) => (
                    <div className="split-row" key={index}>
                      <div className="split-row-head">
                        <span className="split-recipient text-sm">Recipient {index + 1}</span>
                        {index >= 3 ? (
                          <button
                            type="button"
                            className="split-remove"
                            onClick={() => setSplitRows((rows) => rows.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <label className="field">
                        <span className="text-sm text-muted">Address</span>
                        <input
                          className="control addr"
                          value={row.address}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder="0x…"
                          onChange={(event) => {
                            const value = event.target.value.trim();
                            setSplitRows((rows) => rows.map((item, i) => (i === index ? { ...item, address: value } : item)));
                          }}
                        />
                      </label>
                      <label className="field">
                        <span className="text-sm text-muted">Amount</span>
                        <input
                          className="control tabular-nums"
                          inputMode="decimal"
                          value={row.amount}
                          autoComplete="off"
                          placeholder="0.0"
                          onChange={(event) => {
                            const value = event.target.value;
                            setSplitRows((rows) => rows.map((item, i) => (i === index ? { ...item, amount: value } : item)));
                          }}
                        />
                      </label>
                      <label className="field">
                        <span className="text-sm text-muted">Unlock</span>
                        <input
                          className="control"
                          type="datetime-local"
                          value={row.date}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSplitRows((rows) => rows.map((item, i) => (i === index ? { ...item, date: value } : item)));
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-quiet split-add"
                    disabled={splitRows.length >= 5}
                    onClick={() => setSplitRows((rows) => (rows.length >= 5 ? rows : [...rows, { address: "", amount: "", date: "" }]))}
                  >
                    Add row
                  </button>
                  <div className="shell-actions">
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                      Shell these
                    </button>
                    <button type="button" className="btn btn-quiet" aria-pressed={vestPublic} onClick={() => toggleVestPublic()}>
                      Go public
                    </button>
                  </div>
                </>
              )}
            </div>
            ) : formMode === "inherit" ? (
            <div key="inherit">
              <label className="field">
                <span className="text-sm text-muted">Recipient</span>
                <input className="control" value={inheritName} autoComplete="off" onChange={(event) => setInheritName(event.target.value)} />
              </label>
              <label className="field">
                <span className="text-sm text-muted">Address</span>
                <input
                  className="control addr"
                  value={inheritTo}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="0x…"
                  onChange={(event) => setInheritTo(event.target.value.trim())}
                />
              </label>
              <div className="field">
                <span className="text-sm text-muted">Trigger</span>
                <div className="seg" role="group" aria-label="Trigger">
                  <button type="button" aria-pressed={inheritTrigger === "date"} onClick={() => setInheritTrigger("date")}>
                    On a date
                  </button>
                  <button type="button" className="quiet-pill" aria-pressed={inheritTrigger === "quiet"} onClick={() => setInheritTrigger("quiet")}>
                    <span>If I go quiet</span>
                    <span className="quiet-pill-note">(Low time test mode)</span>
                  </button>
                </div>
                {inheritTrigger === "date" ? (
                  <>
                    <p className="inherit-grace">Choose a specific date to unlock for a loved one</p>
                    <p className="inherit-grace">This cannot be canceled</p>
                  </>
                ) : null}
              </div>
              {inheritTrigger === "date" ? (
                <label className="field">
                  <span className="text-sm text-muted">Unlock</span>
                  <input
                    className="control"
                    type="datetime-local"
                    value={inheritUnlock}
                    onChange={(event) => setInheritUnlock(event.target.value)}
                  />
                </label>
              ) : (
                <div className="field">
                  <span className="text-sm text-muted">Time</span>
                  <div className="seg" role="group" aria-label="Quiet period">
                    <button type="button" aria-pressed={inheritQuiet === "1"} onClick={() => setInheritQuiet("1")}>
                      1 hour
                    </button>
                    <button type="button" aria-pressed={inheritQuiet === "2"} onClick={() => setInheritQuiet("2")}>
                      2 hours
                    </button>
                    <button type="button" aria-pressed={inheritQuiet === "3"} onClick={() => setInheritQuiet("3")}>
                      3 hours
                    </button>
                  </div>
                  <p className="inherit-grace">Sender can check-in to reset/cancel timer at any point</p>
                  <p className="inherit-grace">Timer ends - 1 hour grace period begins. Sender can connect during this time and check in or cancel (this is a test mode to show you how the mechanism works)</p>
                </div>
              )}
              <div className="field">
                <span className="text-sm text-muted">Token</span>
                <div className="seg" role="group" aria-label="Token">
                  {inheritTrigger === "date" ? (
                    <>
                      <button
                        type="button"
                        aria-pressed={dateKind === "mon"}
                        onClick={() => {
                          if (dateKind === "mon") {
                            setDateKind("paste");
                            return;
                          }
                          setDateKind("mon");
                          setDatePaste("");
                          setDatePreview(null);
                          setDateFault("");
                          setDateReading(false);
                        }}
                      >
                        MON
                      </button>
                      <button
                        type="button"
                        aria-pressed={dateKind === "monchel"}
                        onClick={() => {
                          if (dateKind === "monchel") {
                            setDateKind("paste");
                            return;
                          }
                          setDateKind("monchel");
                          setDatePaste("");
                          setDatePreview(null);
                          setDateFault("");
                          setDateReading(false);
                        }}
                      >
                        $MONCHEL
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-pressed={inheritKind === "mon"}
                        onClick={() => {
                          if (inheritKind === "mon") {
                            setInheritKind("paste");
                            return;
                          }
                          setInheritKind("mon");
                          setInheritPaste("");
                          setInheritPreview(null);
                          setInheritFault("");
                          setInheritReading(false);
                        }}
                      >
                        MON
                      </button>
                      <button
                        type="button"
                        aria-pressed={inheritKind === "monchel"}
                        onClick={() => {
                          if (inheritKind === "monchel") {
                            setInheritKind("paste");
                            return;
                          }
                          setInheritKind("monchel");
                          setInheritPaste("");
                          setInheritPreview(null);
                          setInheritFault("");
                          setInheritReading(false);
                        }}
                      >
                        $MONCHEL
                      </button>
                    </>
                  )}
                </div>
              </div>
              {inheritTrigger === "date" ? (
                dateKind === "paste" ? (
                  <label className="field">
                    <span className="text-sm text-muted">or token address</span>
                    <span className="token-box">
                      <input
                        className={datePaste ? "control addr token-pad" : "control addr"}
                        value={datePaste}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder=""
                        onChange={(event) => {
                          setDatePaste(event.target.value.trim());
                          setDateKind("paste");
                          setDatePreview(null);
                          setDateFault("");
                        }}
                      />
                      {datePaste ? (
                        <button
                          type="button"
                          className="token-clear"
                          aria-label="Clear token contract"
                          onClick={() => {
                            setDatePaste("");
                            setDatePreview(null);
                            setDateFault("");
                            setDateReading(false);
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                    </span>
                    <span className="token-hint text-sm text-muted">Paste any Monad token contract.</span>
                    {datePreview ? (
                      <span className="token-chip">
                        {datePreview.symbol} · {shortAddr(datePreview.address)}
                      </span>
                    ) : null}
                    {dateFault ? <span className="text-sm text-fg">{dateFault}</span> : null}
                  </label>
                ) : null
              ) : inheritKind === "paste" ? (
              <label className="field">
                <span className="text-sm text-muted">or token address</span>
                <span className="token-box">
                  <input
                    className={inheritPaste ? "control addr token-pad" : "control addr"}
                    value={inheritPaste}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder=""
                    onChange={(event) => {
                      setInheritPaste(event.target.value.trim());
                      setInheritKind("paste");
                      setInheritPreview(null);
                      setInheritFault("");
                    }}
                  />
                  {inheritPaste ? (
                    <button
                      type="button"
                      className="token-clear"
                      aria-label="Clear token contract"
                      onClick={() => {
                        setInheritPaste("");
                        setInheritPreview(null);
                        setInheritFault("");
                        setInheritReading(false);
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
                <span className="token-hint text-sm text-muted">Paste any Monad token contract.</span>
                {inheritPreview ? (
                  <span className="token-chip">
                    {inheritPreview.symbol} · {shortAddr(inheritPreview.address)}
                  </span>
                ) : null}
                {inheritFault ? <span className="text-sm text-fg">{inheritFault}</span> : null}
              </label>
              ) : null}
              <label className="field">
                <span className="text-sm text-muted">Amount</span>
                <input
                  className="control tabular-nums"
                  inputMode="decimal"
                  value={inheritAmount}
                  autoComplete="off"
                  placeholder="0.0"
                  onChange={(event) => setInheritAmount(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="text-sm text-muted">Message</span>
                <textarea
                  className="control"
                  value={inheritNote}
                  onChange={(event) => setInheritNote(event.target.value)}
                />
              </label>
              <div className="shell-actions">
                <button className={inheritReady ? "btn btn-primary shell-ready" : "btn btn-primary"} type="submit" disabled={busy}>
                  Shell Up
                </button>
              </div>
              <p className="inherit-cancel">You can cancel while you are still here.</p>
            </div>
            ) : formMode === "nft" ? (
            <div key="nft">
              <label className="field">
                <span className="text-sm text-muted">Collection</span>
                <input
                  className="control addr"
                  value={nftCollection}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => setNftCollection(event.target.value.trim())}
                />
              </label>
              <label className="field">
                <span className="text-sm text-muted">Seal id</span>
                <input
                  className="control tabular-nums"
                  inputMode="numeric"
                  value={nftSeal}
                  autoComplete="off"
                  onChange={(event) => setNftSeal(event.target.value.trim())}
                />
              </label>
              <label className="field">
                <span className="text-sm text-muted">MON amount</span>
                <input
                  className="control tabular-nums"
                  inputMode="decimal"
                  value={nftAmount}
                  autoComplete="off"
                  placeholder="0.0"
                  onChange={(event) => setNftAmount(event.target.value)}
                />
              </label>
              <div className="field">
                <span className="text-sm text-muted">Token</span>
                <div className="seg" role="group" aria-label="Token">
                  <button type="button" aria-pressed={nftMon} onClick={() => setNftMon((on) => !on)}>
                    MON
                  </button>
                </div>
              </div>
              {nftMon ? null : (
              <label className="field">
                <span className="text-sm text-muted">or token address</span>
                <span className="token-box">
                  <input
                    className={nftPaste ? "control addr token-pad" : "control addr"}
                    value={nftPaste}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder=""
                    onChange={(event) => {
                      setNftPaste(event.target.value.trim());
                      setNftPreview(null);
                      setNftTokenFault("");
                    }}
                  />
                  {nftPaste ? (
                    <button
                      type="button"
                      className="token-clear"
                      aria-label="Clear token contract"
                      onClick={() => {
                        setNftPaste("");
                        setNftPreview(null);
                        setNftTokenFault("");
                        setNftTokenReading(false);
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
                <span className="token-hint text-sm text-muted">Paste any Monad token contract.</span>
                {nftPreview ? (
                  <span className="token-chip">
                    {nftPreview.symbol} · {shortAddr(nftPreview.address)}
                  </span>
                ) : null}
                {nftTokenFault ? <span className="text-sm text-fg">{nftTokenFault}</span> : null}
              </label>
              )}
              <label className="field">
                <span className="text-sm text-muted">Deadline</span>
                <input
                  className="control"
                  type="datetime-local"
                  value={nftDeadline}
                  onChange={(event) => setNftDeadline(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="text-sm text-muted">Note</span>
                <textarea className="control" value={nftNote} onChange={(event) => setNftNote(event.target.value)} />
              </label>
              <div className="shell-actions">
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  Lock
                </button>
              </div>
              {nftLockFault ? <p className="mt-2 text-sm text-fg">{nftLockFault}</p> : null}
              {nftDeals.some((deal) => {
                if (!me) return false;
                const owner = sealOwners[deal.id] ?? "";
                const isBuyer = deal.buyer.toLowerCase() === me;
                const isHolder = owner === me;
                return isBuyer || (isHolder && !deal.sold && !deal.cancelled);
              }) ? (
                <div className="board-scroll">
                  {nftDeals.map((deal) => {
                    if (!me) return null;
                    const owner = sealOwners[deal.id] ?? "";
                    const isBuyer = deal.buyer.toLowerCase() === me;
                    const isHolder = owner === me;
                    const sent = nftRecords.some((record) => record.id === deal.id && record.seller === me);
                    if (sent && !isBuyer) return null;
                    if (!(isBuyer || (isHolder && !deal.sold && !deal.cancelled))) return null;
                    const open = !deal.sold && !deal.cancelled;
                    return (
                      <article className="shell" key={deal.id}>
                        {deal.collected && isBuyer ? <p className="claimed-stamp">CLAIMED</p> : null}
                        <p className="shell-id">
                          <span className="shell-id-num">#{deal.id}</span>
                        </p>
                        <p className="note shell-title text-lg font-medium">{deal.sealId.toString()}</p>
                        <p className="mt-1 text-base text-fg tabular-nums">{formatAmount(deal.amount, deal.decimals)} {deal.symbol}</p>
                        <p className="unlocks-line">Deadline - {formatWhen(deal.deadline)}</p>
                        <p className="addr mt-1 text-sm text-muted">Buyer {shortAddr(deal.buyer)}</p>
                        {open && isBuyer ? (
                          <button type="button" className="btn btn-quiet btn-block mt-3" disabled={busy} onClick={() => void onNftCancel(deal.id)}>
                            Cancel
                          </button>
                        ) : null}
                        {deal.sold && !deal.collected && !deal.cancelled && isBuyer ? (
                          <button
                            type="button"
                            className={busy ? "btn btn-primary btn-block mt-3" : "btn btn-primary btn-block mt-3 btn-claim-ready"}
                            disabled={busy}
                            onClick={() => void onNftCollect(deal.id)}
                          >
                            Claim NFT
                          </button>
                        ) : null}
                        {open && isHolder && !isBuyer && deal.deadline * 1000 > Date.now() ? (
                          <button
                            type="button"
                            className={busy ? "btn btn-primary btn-block mt-3" : "btn btn-primary btn-block mt-3 btn-claim-ready"}
                            disabled={busy}
                            onClick={() => void onNftSell(deal)}
                          >
                            Sell NFT
                          </button>
                        ) : null}
                        {open && isHolder && !isBuyer && deal.deadline * 1000 <= Date.now() ? (
                          <p className="mt-3 text-sm text-fg">Missed sell window</p>
                        ) : null}
                        {nftFault?.id === deal.id ? <p className="mt-2 text-sm text-fg">{nftFault.text}</p> : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}
              {nftRecords.some((record) => record.seller === me) ? (
                <div className="mt-4">
                  <h2 className="text-base font-medium text-fg">Sold NFTs</h2>
                  <div className="board-scroll">
                    {nftRecords
                      .filter((record) => record.seller === me)
                      .map((record) => (
                        <article className="shell" key={`sent-${record.id}`}>
                          <p className="shell-id">
                            <span className="shell-id-num">#{record.id}</span>
                          </p>
                          <p className="note shell-title text-lg font-medium">{record.seal}</p>
                          <p className="mt-1 text-base text-fg tabular-nums">{record.amount} {record.symbol || "MON"}</p>
                          <p className="unlocks-line">Deadline - {formatWhen(record.deadline)}</p>
                          <p className="addr mt-1 text-sm text-muted">Buyer {shortAddr(record.buyer)}</p>
                          <p className="unlocks-line">Sent</p>
                        </article>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
            ) : null}
            {formMode === "nft" ? null : (
            <>
            <p className="mt-3 text-sm text-muted">
              {formMode === "vest" && vestMode === "split"
                ? "Stamp is 25 $MONCHEL per shell. Half burns, half goes to the promo wallet."
                : "Stamp is 25 $MONCHEL. Half burns, half goes to the promo wallet."}
            </p>
            <div className="get-row">
              <a
                className="get-monchel"
                href="https://monadvision.com/token/0xB6842737e2a6d5a92aBA03eD0CCA578303E87777"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get $MONCHEL
              </a>
            </div>
            </>
            )}
            <p className="mt-2 min-h-6 text-sm text-fg" role="status">
              {shownStatus}
            </p>
            {formMode === "nft" ? null : (
            <>
            {shellCount !== null ? (
              <p className="burn-line">
                Shell Ups burned {burnedStamps(shellCount)} $MONCHEL
              </p>
            ) : null}
            <p className="scan-row">
              <a
                className="scan-link"
                href="https://monadscan.com/address/0x91A2bEA66F1B6E33C0B7e8A8fa6Ac25D96A89e55#writeContract"
                target="_blank"
                rel="noopener noreferrer"
              >
                Claim on Monadscan
              </a>
            </p>
            </>
            )}
          </form>
        </section>
        </div>

        <div className="stack">
          {account ? (
            <section className="panel" aria-labelledby="board-title">
              <div className="community-head">
                <h2 id="board-title" className="text-base font-medium text-fg">
                  My Shells
                </h2>
                <div className="file-tabs" role="tablist" aria-label="Board">
                  <button type="button" role="tab" aria-pressed={boardTab === "all"} onClick={() => setBoardTab("all")}>
                    All
                  </button>
                  <button type="button" role="tab" aria-pressed={boardTab === "active"} onClick={() => setBoardTab("active")}>
                    Active
                  </button>
                  <button type="button" role="tab" aria-pressed={boardTab === "claimed"} onClick={() => setBoardTab("claimed")}>
                    Claimed
                  </button>
                  <div className="tab-end">
                  <div className="kind-pick">
                    <span className="pick-label">sort</span>
                    <button
                      type="button"
                      className="kind-arrow"
                      aria-label="Sort"
                      aria-expanded={boardSortOpen}
                      onClick={() => {
                        setBoardKindOpen(false);
                        setBoardSortOpen((open) => !open);
                      }}
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                        <path d="M3.5 6 L8 10.5 L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                    {boardSortOpen ? (
                      <div className="kind-list" role="listbox" aria-label="Sort">
                        {(
                          [
                            ["new", "Newest"],
                            ["old", "Oldest"],
                            ["claim", "Claim date"],
                            ["bag", "Bag size"],
                            ["lock", "Lock up time"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            type="button"
                            role="option"
                            key={id}
                            aria-selected={boardSort === id}
                            onClick={() => {
                              setBoardSort(id);
                              setBoardSortOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="kind-pick view-pick">
                    <span className="pick-label">view</span>
                    <button
                      type="button"
                      className="kind-arrow"
                      aria-label={boardView === "list" ? "Grid" : "Stack"}
                      onClick={() => setBoardView(boardView === "list" ? "grid" : "list")}
                    >
                      {boardView === "list" ? (
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                          <rect x="2" y="2" width="5" height="5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <rect x="9" y="2" width="5" height="5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <rect x="2" y="9" width="5" height="5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <rect x="9" y="9" width="5" height="5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                          <path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="kind-pick">
                    <span className="pick-label">type</span>
                    <button
                      type="button"
                      className="kind-arrow"
                      aria-label="Card kind"
                      aria-expanded={boardKindOpen}
                      onClick={() => {
                        setBoardSortOpen(false);
                        setBoardKindOpen((open) => !open);
                      }}
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                        <path d="M3.5 6 L8 10.5 L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                    {boardKindOpen ? (
                      <div className="kind-list" role="listbox" aria-label="Card kind">
                        {(
                          [
                            ["all", "All"],
                            ["hold", "Hold"],
                            ["vest", "Vesting"],
                            ["drip", "Drip"],
                            ["inherit", "Inheritance"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            type="button"
                            role="option"
                            key={id}
                            aria-selected={boardKind === id}
                            onClick={() => {
                              setBoardKind(id);
                              setBoardKindOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </div>
              </div>
              {board === "loading" || quietListReading || dripListReading || potListReading ? (
                <p className="mt-4 text-muted">Reading shells</p>
              ) : null}
              {board === "error" ? <p className="mt-4 text-muted">Could not read Shells.</p> : null}
              {board !== "loading" && !quietListReading && !dripListReading && !potListReading && board !== "error" && boardCards.length === 0 ? (
                <p className="mt-4 text-muted">No Shells yet.</p>
              ) : null}
              {boardCards.length > 0 ? (
                <div className={boardView === "grid" ? "board-scroll board-grid" : "board-scroll"}>
                  {boardCards.map((item) =>
                    item.card === "pot"
                      ? potCard(item.box)
                      : item.card === "drip"
                        ? dripCard(item.box)
                        : item.card === "quiet"
                          ? quietCard(item.box)
                          : shellCard(item.shell),
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {account || community.length > 0 ? (
            <section className="panel" aria-labelledby="community-title">
              <div className="community-head">
                <h2 id="community-title" className="text-base font-medium text-fg">
                  Community Shells
                </h2>
                <div className="file-tabs" role="tablist" aria-label="Community Board">
                  <button type="button" role="tab" aria-pressed={communityTab === "all"} onClick={() => setCommunityTab("all")}>
                    All
                  </button>
                  <button type="button" role="tab" aria-pressed={communityTab === "active"} onClick={() => setCommunityTab("active")}>
                    Active
                  </button>
                  <button type="button" role="tab" aria-pressed={communityTab === "claimed"} onClick={() => setCommunityTab("claimed")}>
                    Claimed
                  </button>
                  <div className="tab-end">
                  <div className="kind-pick">
                    <span className="pick-label">sort</span>
                    <button
                      type="button"
                      className="kind-arrow"
                      aria-label="Sort"
                      aria-expanded={communitySortOpen}
                      onClick={() => {
                        setCommunityKindOpen(false);
                        setCommunitySortOpen((open) => !open);
                      }}
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                        <path d="M3.5 6 L8 10.5 L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                    {communitySortOpen ? (
                      <div className="kind-list" role="listbox" aria-label="Sort">
                        {(
                          [
                            ["new", "Newest"],
                            ["old", "Oldest"],
                            ["claim", "Claim date"],
                            ["bag", "Bag size"],
                            ["lock", "Lock up time"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            type="button"
                            role="option"
                            key={id}
                            aria-selected={communitySort === id}
                            onClick={() => {
                              setCommunitySort(id);
                              setCommunitySortOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="kind-pick view-pick">
                    <span className="pick-label">view</span>
                    <button
                      type="button"
                      className="kind-arrow"
                      aria-label={communityView === "list" ? "Grid" : "Stack"}
                      onClick={() => setCommunityView(communityView === "list" ? "grid" : "list")}
                    >
                      {communityView === "list" ? (
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                          <rect x="2" y="2" width="5" height="5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <rect x="9" y="2" width="5" height="5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <rect x="2" y="9" width="5" height="5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <rect x="9" y="9" width="5" height="5" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                          <path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="kind-pick">
                    <span className="pick-label">type</span>
                    <button
                      type="button"
                      className="kind-arrow"
                      aria-label="Card kind"
                      aria-expanded={communityKindOpen}
                      onClick={() => {
                        setCommunitySortOpen(false);
                        setCommunityKindOpen((open) => !open);
                      }}
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                        <path d="M3.5 6 L8 10.5 L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                    {communityKindOpen ? (
                      <div className="kind-list" role="listbox" aria-label="Card kind">
                        {(
                          [
                            ["holders", "Holders"],
                            ["vest", "Vesting"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            type="button"
                            role="option"
                            key={id}
                            aria-selected={communityKind === id}
                            onClick={() => {
                              setCommunityKind(id);
                              setCommunityKindOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </div>
              </div>
              {board === "loading" ? <p className="mt-4 text-muted">Reading Shells…</p> : null}
              {board === "error" ? <p className="mt-4 text-muted">Could not read Shells.</p> : null}
              {board !== "loading" && board !== "error" && communityShown.length === 0 ? (
                <p className="mt-4 text-muted">No Shells yet.</p>
              ) : null}
              {communityShown.length > 0 ? (
                <div className={communityView === "grid" ? "board-scroll board-grid" : "board-scroll"}>
                  {communityCards.map((item) => shellCard(item.shell))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
      <div className="site-foot">
        <a className="site-by" href="https://x.com/monchel_xyz" target="_blank" rel="noopener noreferrer">
          By Monchel & Frens
        </a>
        <p className="tx-key">
          <span className="tx-dot" aria-hidden="true" />
          = Check tx
        </p>
      </div>
      {toast ? <p className="lock-toast">{toast}</p> : null}
      {sharePic ? (
        <div className="share-image-layer" role="dialog" aria-label="Share image">
          <div className="share-image-window">
            <div className="share-image-bar">
              <button
                type="button"
                className="share-image-dl"
                aria-label="Download"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = sharePic.url;
                  a.download = `shell-${sharePic.id}.png`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M12 3v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M7 11l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 21h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="share-image-x" aria-label="Close" onClick={() => setSharePic(null)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <img src={sharePic.url} alt="" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
