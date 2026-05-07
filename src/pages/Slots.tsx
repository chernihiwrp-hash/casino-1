import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";

// ─── SVG SYMBOLS (no emojis — pure SVG with theme gradients) ─────────────────

type SymbolKey = "cherry" | "lemon" | "bell" | "diamond" | "seven" | "star" | "jackpot";

const SYMBOL_DEFS: Record<SymbolKey, {
  payout: number;
  color: string;         // fixed accent color for payout table
  label: string;
}> = {
  cherry:  { payout: 3,  color: "#ef4444", label: "Вишня"   },
  lemon:   { payout: 4,  color: "#eab308", label: "Лимон"   },
  bell:    { payout: 6,  color: "#f97316", label: "Дзвін"   },
  diamond: { payout: 12, color: "#38bdf8", label: "Діамант" },
  seven:   { payout: 25, color: "#a855f7", label: "Сімка"   },
  star:    { payout: 8,  color: "#fbbf24", label: "Зірка"   },
  jackpot: { payout: 50, color: "var(--primary)", label: "Джекпот" },
};

const SYMBOL_KEYS = Object.keys(SYMBOL_DEFS) as SymbolKey[];

// SVG icon per symbol — clean minimal shapes with the symbol's accent color
function SymbolIcon({ sym, size = 48, glow = false }: { sym: SymbolKey; size?: number; glow?: boolean }) {
  const def = SYMBOL_DEFS[sym];
  const c = sym === "jackpot" ? "var(--primary)" : def.color;
  const id = `sg-${sym}-${size}`;

  const glowFilter = glow ? (
    <filter id={`gf-${id}`}>
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  ) : null;

  const filterAttr = glow ? `url(#gf-${id})` : undefined;

  switch (sym) {
    case "cherry":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`${id}a`} cx="35%" cy="28%" r="65%">
              <stop offset="0%" stopColor="#ff9999" />
              <stop offset="100%" stopColor="#cc0000" />
            </radialGradient>
            <radialGradient id={`${id}b`} cx="35%" cy="28%" r="65%">
              <stop offset="0%" stopColor="#ff9999" />
              <stop offset="100%" stopColor="#cc0000" />
            </radialGradient>
            {glowFilter}
          </defs>
          {/* stem */}
          <path d="M24 26 Q28 16 36 12 Q32 10 30 14 Q26 18 24 26Z" fill="#4ade80" />
          <path d="M24 26 Q20 16 12 12 Q16 10 18 14 Q22 18 24 26Z" fill="#4ade80" />
          {/* cherries */}
          <circle cx="15" cy="34" r="9" fill={`url(#${id}a)`} filter={filterAttr} />
          <circle cx="33" cy="34" r="9" fill={`url(#${id}b)`} filter={filterAttr} />
          {/* shine */}
          <circle cx="12" cy="30" r="3" fill="white" opacity="0.4" />
          <circle cx="30" cy="30" r="3" fill="white" opacity="0.4" />
        </svg>
      );
    case "lemon":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={id} cx="32%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#ca8a04" />
            </radialGradient>
            {glowFilter}
          </defs>
          <ellipse cx="24" cy="26" rx="16" ry="13" fill={`url(#${id})`} filter={filterAttr} />
          <path d="M24 13 Q26 8 30 7 Q27 9 24 13Z" fill="#4ade80" />
          {/* inner segments */}
          <line x1="24" y1="13" x2="24" y2="39" stroke="#ca8a0440" strokeWidth="1" />
          <line x1="8" y1="26" x2="40" y2="26" stroke="#ca8a0440" strokeWidth="1" />
          <ellipse cx="24" cy="26" rx="16" ry="13" fill="none" stroke="#fde68a80" strokeWidth="1" />
          {/* shine */}
          <ellipse cx="18" cy="20" rx="4" ry="3" fill="white" opacity="0.35" transform="rotate(-20 18 20)" />
        </svg>
      );
    case "bell":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            {glowFilter}
          </defs>
          {/* bell body */}
          <path d="M24 8 Q14 12 12 28 L36 28 Q34 12 24 8Z" fill={`url(#${id})`} filter={filterAttr} />
          {/* bell bottom rim */}
          <path d="M10 28 Q10 32 24 32 Q38 32 38 28Z" fill="#f59e0b" />
          {/* clapper */}
          <circle cx="24" cy="36" r="3.5" fill="#b45309" />
          <line x1="24" y1="32" x2="24" y2="36" stroke="#b45309" strokeWidth="2" />
          {/* top */}
          <circle cx="24" cy="8" r="3" fill="#fbbf24" />
          {/* shine */}
          <ellipse cx="19" cy="15" rx="3" ry="5" fill="white" opacity="0.3" transform="rotate(-15 19 15)" />
        </svg>
      );
    case "diamond":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`${id}a`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id={`${id}b`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
            {glowFilter}
          </defs>
          {/* top face */}
          <polygon points="24,6 38,18 24,16 10,18" fill={`url(#${id}a)`} filter={filterAttr} />
          {/* left face */}
          <polygon points="10,18 24,16 24,42" fill={`url(#${id}b)`} />
          {/* right face */}
          <polygon points="38,18 24,16 24,42" fill="#38bdf8" opacity="0.85" />
          {/* shine */}
          <polygon points="15,18 24,11 22,18" fill="white" opacity="0.4" />
        </svg>
      );
    case "seven":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e879f9" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>
            {glowFilter}
          </defs>
          <text x="24" y="38" textAnchor="middle" fontSize="36" fontWeight="900"
            fontFamily="Georgia, serif" fill={`url(#${id})`} filter={filterAttr}>7</text>
          {/* outline glow */}
          <text x="24" y="38" textAnchor="middle" fontSize="36" fontWeight="900"
            fontFamily="Georgia, serif" fill="none" stroke="#e879f960" strokeWidth="1.5">7</text>
        </svg>
      );
    case "star":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            {glowFilter}
          </defs>
          <polygon
            points="24,5 29,18 43,18 32,27 36,41 24,33 12,41 16,27 5,18 19,18"
            fill={`url(#${id})`} filter={filterAttr}
          />
          {/* inner highlight */}
          <polygon
            points="24,10 27.5,19 37,19 29.5,24.5 32,34 24,28.5 16,34 18.5,24.5 11,19 20.5,19"
            fill="white" opacity="0.15"
          />
          <circle cx="20" cy="16" r="2.5" fill="white" opacity="0.35" />
        </svg>
      );
    case "jackpot":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`${id}a`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="oklch(from var(--glow) calc(l+.1) c h)" />
              <stop offset="100%" stopColor="oklch(from var(--primary) calc(l-.15) c h)" />
            </linearGradient>
            <radialGradient id={`${id}b`} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="oklch(from var(--glow) l c h)" />
              <stop offset="100%" stopColor="oklch(from var(--primary) calc(l-.2) c h)" />
            </radialGradient>
            {glowFilter}
          </defs>
          {/* crown */}
          <path d="M8 34 L8 20 L16 28 L24 10 L32 28 L40 20 L40 34 Z"
            fill={`url(#${id}b)`} filter={filterAttr} />
          <rect x="8" y="34" width="32" height="5" rx="2.5" fill={`url(#${id}a)`} />
          {/* gems on crown */}
          <circle cx="24" cy="22" r="4" fill="white" opacity="0.6" />
          <circle cx="13" cy="30" r="2.5" fill="white" opacity="0.45" />
          <circle cx="35" cy="30" r="2.5" fill="white" opacity="0.45" />
        </svg>
      );
  }
}

// ─── GAME LOGIC ───────────────────────────────────────────────────────────────

const PAYOUT: Record<SymbolKey, number> = Object.fromEntries(
  SYMBOL_KEYS.map(k => [k, SYMBOL_DEFS[k].payout])
) as Record<SymbolKey, number>;

// Зважений вибір символу: дешеві символи частіше → пари/трійки трапляються частіше
const SYMBOL_WEIGHTS: Record<SymbolKey, number> = {
  cherry: 26,
  lemon: 22,
  bell: 18,
  star: 14,
  diamond: 10,
  seven: 7,
  jackpot: 3,
};
const TOTAL_WEIGHT = SYMBOL_KEYS.reduce((s, k) => s + SYMBOL_WEIGHTS[k], 0);

function randomSymbol(): SymbolKey {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const k of SYMBOL_KEYS) {
    r -= SYMBOL_WEIGHTS[k];
    if (r <= 0) return k;
  }
  return SYMBOL_KEYS[0];
}
function spinReel(): SymbolKey[] {
  return Array.from({ length: 3 }, () => randomSymbol());
}
// Зважений спін з гарантією, що середній символ заданий
function spinReelWithMiddle(mid: SymbolKey): SymbolKey[] {
  return [randomSymbol(), mid, randomSymbol()];
}
function generateStrip(final: SymbolKey, length = 28): SymbolKey[] {
  return [...Array.from({ length: length - 1 }, () => randomSymbol()), final];
}

// ─── REEL COMPONENT ───────────────────────────────────────────────────────────

interface ReelProps {
  symbols: SymbolKey[];
  isSpinning: boolean;
  finalSymbol: SymbolKey;
  delay: number;
  won: boolean;
  highlight: boolean;
}

function SlotReel({ symbols, isSpinning, finalSymbol, delay, won, highlight }: ReelProps) {
  const [display, setDisplay] = useState<SymbolKey[]>(symbols);
  const [settled, setSettled] = useState(true);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSpinning) return;
    setSettled(false);
    const strip = generateStrip(finalSymbol, 26);
    let idx = 0;

    intervalRef.current = setInterval(() => {
      setDisplay([strip[idx % strip.length], strip[(idx + 1) % strip.length], strip[(idx + 2) % strip.length]]);
      idx++;
    }, 38);

    animRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!);
      setDisplay([randomSymbol(), finalSymbol, randomSymbol()]);
      setTimeout(() => { setDisplay(symbols); setSettled(true); }, 110);
    }, 580 + delay);

    return () => {
      clearInterval(intervalRef.current!);
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, [isSpinning]);

  const mid = display[1];
  const midColor = mid === "jackpot" ? "var(--primary)" : SYMBOL_DEFS[mid].color;

  return (
    <div className="relative overflow-hidden rounded-2xl"
      style={{
        background: "var(--gradient-card)",
        border: highlight ? `2px solid ${midColor}` : "1px solid var(--border)",
        boxShadow: highlight
          ? `0 0 24px ${midColor}66, inset 0 0 30px ${midColor}18`
          : "var(--shadow-card)",
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}>
      {/* Top / bottom fade */}
      <div className="absolute top-0 left-0 right-0 h-10 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, var(--background) 0%, transparent 100%)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-10 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to top, var(--background) 0%, transparent 100%)" }} />

      {/* Middle line */}
      <div className="absolute left-0 right-0 z-20 pointer-events-none"
        style={{
          top: "calc(33.33% - 1px)", height: "33.34%",
          background: highlight ? `${midColor}18` : "oklch(from var(--primary) l c h / 0.05)",
          borderTop: `1px solid ${highlight ? midColor + "66" : "oklch(from var(--primary) l c h / 0.18)"}`,
          borderBottom: `1px solid ${highlight ? midColor + "66" : "oklch(from var(--primary) l c h / 0.18)"}`,
          transition: "background 0.3s, border-color 0.3s",
        }} />

      {display.map((sym, j) => (
        <div key={j} className="flex items-center justify-center"
          style={{
            height: "5.5rem",
            opacity: j === 1 ? 1 : 0.4,
            transform: j === 1 && won && !isSpinning && settled ? "scale(1.12)" : "scale(1)",
            transition: "transform 0.3s",
          }}>
          <SymbolIcon
            sym={sym}
            size={j === 1 ? 54 : 36}
            glow={j === 1 && won && !isSpinning && settled}
          />
        </div>
      ))}
    </div>
  );
}

// ─── COIN BURST ───────────────────────────────────────────────────────────────

function CoinBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
      <style>{`
        @keyframes coinFly {
          0%   { transform: translate(-50%,-50%) rotate(0deg) translateX(0) scale(1); opacity:1; }
          100% { transform: translate(-50%,-50%) rotate(calc(var(--a))) translateX(var(--d)) scale(0); opacity:0; }
        }
      `}</style>
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} className="absolute left-1/2 top-1/2"
          style={{
            width: 28, height: 28,
            animation: `coinFly .9s ease-out ${(Math.random() * 0.25).toFixed(2)}s forwards`,
            "--a": `${(i / 16) * 360}deg`,
            "--d": `${70 + Math.random() * 80}px`,
          } as React.CSSProperties}>
          <SymbolIcon sym="jackpot" size={28} />
        </div>
      ))}
    </div>
  );
}

// ─── MAIN GAME ────────────────────────────────────────────────────────────────

function SlotsGame() {
  const { user, updateBalance } = useAuth();
  const [bet, setBet] = useState(20);
  const [reels, setReels] = useState<SymbolKey[][]>([spinReel(), spinReel(), spinReel()]);
  const [finalReels, setFinalReels] = useState<SymbolKey[][]>([
    ["cherry","cherry","cherry"], ["cherry","cherry","cherry"], ["cherry","cherry","cherry"]
  ]);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState("");
  const [won, setWon] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [burstActive, setBurstActive] = useState(false);
  const [history, setHistory] = useState<{ line: SymbolKey[]; win: number }[]>([]);
  const [pullAnim, setPullAnim] = useState(false);

  const balance = user?.balance ?? 0;

  const spin = async () => {
    if (spinning || bet <= 0 || bet > balance) return;
    setMsg(""); setWon(false); setWinAmount(0);
    try { await updateBalance(-bet); }
    catch (e: any) { setMsg(e.message); return; }

    setPullAnim(true);
    setTimeout(() => setPullAnim(false), 300);

    // Ребаланс: 3% трійка, 25% пара, 72% програш (RTP ~85%)
    const roll = Math.random();
    let finals: SymbolKey[][];
    if (roll < 0.03) {
      // Трійка — рідкісна подія (5%)
      // Звичайні символи частіше, jackpot/seven дуже рідко
      const pickPool: SymbolKey[] = [
        "cherry", "cherry", "cherry",
        "lemon",  "lemon",  "lemon",
        "bell",   "bell",
        "star",   "star",
        "diamond",
        "seven",
        "jackpot",
      ];
      const sym = pickPool[Math.floor(Math.random() * pickPool.length)];
      finals = [spinReelWithMiddle(sym), spinReelWithMiddle(sym), spinReelWithMiddle(sym)];
    } else if (roll < 0.28) {
      // Пара (25%) — два однакових символи
      const sym = randomSymbol();
      const left = Math.random() < 0.5;
      let other = randomSymbol();
      while (other === sym) other = randomSymbol();
      finals = left
        ? [spinReelWithMiddle(sym),   spinReelWithMiddle(sym),   spinReelWithMiddle(other)]
        : [spinReelWithMiddle(other), spinReelWithMiddle(sym),   spinReelWithMiddle(sym)];
    } else {
      // Програш (72%) — всі три різні
      let s1 = randomSymbol();
      let s2 = randomSymbol(); while (s2 === s1) s2 = randomSymbol();
      let s3 = randomSymbol(); while (s3 === s2) s3 = randomSymbol();
      finals = [spinReelWithMiddle(s1), spinReelWithMiddle(s2), spinReelWithMiddle(s3)];
    }
    setFinalReels(finals);
    setSpinning(true);

    setTimeout(() => {
      setReels(finals);
      setSpinning(false);
      const line: SymbolKey[] = [finals[0][1], finals[1][1], finals[2][1]];
      let win = 0;
      if (line[0] === line[1] && line[1] === line[2]) {
        win = bet * (PAYOUT[line[0]] ?? 5);
      } else if (line[0] === line[1] || line[1] === line[2]) {
        win = Math.floor(bet * 1.5);
      }
      if (win > 0) {
        setWon(true); setWinAmount(win);
        setBurstActive(true);
        setTimeout(() => setBurstActive(false), 1000);
        updateBalance(win).then(() => setMsg(`Виграш: +${win} CR!`));
      } else {
        setMsg("Немає виграшу");
      }
      setHistory(h => [{ line, win }, ...h].slice(0, 8));
    }, 1200);
  };

  const isHighlight = (i: number) => !spinning && won && reels[i][1] === reels[0][1];

  return (
    <div>
      <style>{`
        @keyframes leverPull {
          0%,100% { transform:translateY(0); }
          50%      { transform:translateY(14px); }
        }
        @keyframes winPulse {
          0%,100% { transform:scale(1); }
          50%      { transform:scale(1.04); }
        }
        @keyframes winText {
          0%   { transform:scale(.5) translateY(20px); opacity:0; }
          60%  { transform:scale(1.12) translateY(-4px); opacity:1; }
          100% { transform:scale(1) translateY(0); opacity:1; }
        }
        @keyframes shimmer {
          0%   { background-position:-200% center; }
          100% { background-position:200% center; }
        }
        .slot-frame {
          background: var(--gradient-card);
          border: 2px solid oklch(from var(--primary) l c h / 0.3);
          box-shadow: 0 0 60px oklch(from var(--primary) l c h / 0.18),
                      inset 0 2px 0 oklch(1 0 0 / 0.08),
                      0 20px 60px oklch(0 0 0 / 0.5);
        }
      `}</style>

      <PageHeader title="Слоти" subtitle="Збіг по середній лінії" />

      <div className="slot-frame rounded-3xl p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-center mb-5 gap-2">
          <div className="h-px flex-1 rounded-full" style={{ background: "linear-gradient(to right, transparent, oklch(from var(--primary) l c h / 0.5), transparent)" }} />
          <div className="text-2xl font-bold tracking-widest text-primary px-4 glow-text">SLOTS</div>
          <div className="h-px flex-1 rounded-full" style={{ background: "linear-gradient(to left, transparent, oklch(from var(--primary) l c h / 0.5), transparent)" }} />
        </div>

        {/* Win banner */}
        {won && (
          <div className="absolute inset-x-6 top-20 z-40 flex justify-center pointer-events-none">
            <div className="rounded-2xl px-8 py-3 font-bold text-2xl"
              style={{
                background: "var(--gradient-primary)",
                color: "var(--primary-foreground)",
                animation: "winText 0.4s ease-out forwards",
                boxShadow: "var(--shadow-glow)",
              }}>
              +{winAmount} CR
            </div>
          </div>
        )}

        {/* Reels */}
        <div className="relative grid grid-cols-3 gap-3"
          style={{ animation: won && !spinning ? "winPulse 0.6s ease-in-out" : "none" }}>
          <CoinBurst active={burstActive} />
          {reels.map((reel, i) => (
            <SlotReel key={i} symbols={reel} isSpinning={spinning}
              finalSymbol={finalReels[i][1]} delay={i * 200}
              won={won} highlight={isHighlight(i)} />
          ))}
        </div>

        {/* Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Ставка</span>
            <input type="number" min={1} max={balance} value={bet}
              disabled={spinning}
              onChange={e => setBet(Math.max(1, Number(e.target.value) || 0))}
              className="w-24 rounded-xl bg-input px-3 py-2 text-center font-mono text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {[10, 50, 100, 500].map(v => (
            <button key={v} onClick={() => setBet(Math.min(v, balance))} disabled={spinning}
              className="glass rounded-xl px-3 py-2 text-xs hover:bg-primary/10 disabled:opacity-40 transition">{v}</button>
          ))}
          <button onClick={() => setBet(Math.floor(balance / 2))} disabled={spinning}
            className="glass rounded-xl px-3 py-2 text-xs hover:bg-primary/10 disabled:opacity-40 transition">½</button>
          <button onClick={() => setBet(balance)} disabled={spinning}
            className="glass rounded-xl px-3 py-2 text-xs hover:bg-primary/10 disabled:opacity-40 transition">MAX</button>
        </div>

        {/* Spin button */}
        <div className="mt-4">
          <button onClick={spin} disabled={spinning || bet > balance || bet <= 0}
            className="btn-primary w-full rounded-2xl py-4 text-base font-bold disabled:opacity-50"
            style={{ animation: pullAnim ? "leverPull 0.3s ease-out" : "none" }}>
            {spinning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin">◎</span> Крутиться...
              </span>
            ) : `Крутити — ${bet} CR`}
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl px-4 py-3 text-center text-sm font-semibold"
            style={{
              background: won ? "oklch(from var(--primary) l c h / 0.1)" : "var(--muted)",
              border: won ? "1px solid oklch(from var(--primary) l c h / 0.35)" : "1px solid var(--border)",
              color: won ? "var(--primary)" : "var(--muted-foreground)",
            }}>
            {msg}
          </div>
        )}
      </div>

      {/* Payout table */}
      <div className="glass mt-4 rounded-2xl p-4">
        <div className="mb-3 font-semibold text-sm">Таблиця виплат</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SYMBOL_KEYS.map(sym => (
            <div key={sym} className="flex items-center gap-2 rounded-xl px-3 py-2.5 glass">
              <SymbolIcon sym={sym} size={28} />
              <div className="ml-1 min-w-0">
                <div className="text-xs text-muted-foreground truncate">{SYMBOL_DEFS[sym].label}</div>
                <div className="font-mono font-bold text-sm" style={{ color: sym === "jackpot" ? "var(--primary)" : SYMBOL_DEFS[sym].color }}>
                  x{SYMBOL_DEFS[sym].payout}
                </div>
              </div>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4 rounded-xl px-3 py-2 text-xs text-muted-foreground glass">
            2 однакових поруч → x1.5 від ставки
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass mt-4 rounded-2xl p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Історія</div>
          <div className="flex flex-col gap-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  background: "var(--muted)",
                  border: `1px solid ${h.win > 0 ? "oklch(from var(--primary) l c h / 0.3)" : "var(--border)"}`,
                }}>
                <div className="flex items-center gap-1">
                  {h.line.map((sym, j) => <SymbolIcon key={j} sym={sym} size={22} />)}
                </div>
                {h.win > 0
                  ? <span className="ml-auto font-mono text-sm font-bold text-primary">+{h.win} CR</span>
                  : <span className="ml-auto text-xs text-muted-foreground">Немає виграшу</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SlotsGame;
