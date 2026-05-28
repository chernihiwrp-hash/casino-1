import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { supabase, secureSelect, secureUpdate, secureInsert, secureDelete } from "@/lib/supabase";
import type { CryptoCoin, CryptoHolding } from "@/lib/crypto-types";
import { TrendingUp, TrendingDown, ArrowDownUp, Wallet, Search, Activity, AlertTriangle, X, CheckCircle2, XCircle } from "lucide-react";

// ─── Confirm Modal ─────────────────────────────────────────────────────────────

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmModal({ open, title, description, confirmLabel = "Підтвердити", danger = false, onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass-strong rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${danger ? "bg-destructive/15" : "bg-primary/15"}`}>
              <AlertTriangle className={`h-5 w-5 ${danger ? "text-destructive" : "text-primary"}`} />
            </div>
            <h2 className="text-base font-bold">{title}</h2>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted/50 transition">
            Скасувати
          </button>
          <button onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
              danger
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "btn-primary"
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PricePoint = { price: number; ts: number };
type CoinView   = CryptoCoin & { history: PricePoint[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_LEN = 60;   // total points in rolling window
const EDGE_LEN    = 6;    // how many points at each edge animate
const TICK_MS     = 2000;
const W = 600, H = 160, PAD = 6;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1)    return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t  = 0.18;
    d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t},`
       + ` ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t},`
       + ` ${p2.x} ${p2.y}`;
  }
  return d;
}

function dataToPts(data: PricePoint[]) {
  const prices = data.map((d) => d.price);
  const min    = Math.min(...prices);
  const max    = Math.max(...prices);
  const range  = max - min || 1;
  return data.map((d, i) => ({
    x:     (i / (data.length - 1)) * W,
    y:     H - PAD - ((d.price - min) / range) * (H - PAD * 2),
    price: d.price,
    ts:    d.ts,
  }));
}

function genHistory(basePrice: number, vol: number): PricePoint[] {
  const now = Date.now();
  const pts: PricePoint[] = [];
  let p = basePrice;
  for (let i = HISTORY_LEN - 1; i >= 0; i--) {
    p = Math.max(0.0001, p / (1 + (Math.random() - 0.5) * vol * 0.03));
    pts.unshift({ price: p, ts: now - i * TICK_MS });
  }
  pts[pts.length - 1] = { price: basePrice, ts: now };
  return pts;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, up }: { data: PricePoint[]; up: boolean }) {
  if (data.length < 2) return null;
  const SW = 120, SH = 36;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices), max = Math.max(...prices), rng = max - min || 1;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * SW,
    y: SH - 3 - ((d.price - min) / rng) * (SH - 6),
  }));
  const color = up ? "var(--primary)" : "var(--destructive)";
  return (
    <svg width={SW} height={SH} className="overflow-visible">
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── BigChart ─────────────────────────────────────────────────────────────────
//
// Animation strategy — "edge-only" motion:
//   • The middle HISTORY_LEN-2*EDGE_LEN points are frozen from the previous frame.
//   • Only the first EDGE_LEN points (fade-in at left) and last EDGE_LEN points
//     (new price arriving at right) animate between old and new values.
//   • This gives the "ticker tape" feel: the bulk of the chart stays rock-solid
//     while the leading edge smoothly scrolls in.
//
// Tooltip strategy — zero React re-renders:
//   • All crosshair + tooltip DOM manipulation is done via direct refs.
//   • The tooltip <div> is absolutely positioned inside the container; we
//     translate the SVG-space nearest-point back to container-pixel space.

function BigChart({ data, up }: { data: PricePoint[]; up: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const lineRef      = useRef<SVGPathElement>(null);
  const areaRef      = useRef<SVGPathElement>(null);
  const crossVRef    = useRef<SVGLineElement>(null);
  const crossHRef    = useRef<SVGLineElement>(null);
  const dotRef       = useRef<SVGCircleElement>(null);
  const ttBoxRef     = useRef<HTMLDivElement>(null);
  const ttPriceRef   = useRef<HTMLSpanElement>(null);
  const ttTimeRef    = useRef<HTMLSpanElement>(null);

  // Animation refs — NO state, never triggers re-render
  const prevPtsRef   = useRef<ReturnType<typeof dataToPts>>([]);
  const curPtsRef    = useRef<ReturnType<typeof dataToPts>>([]);
  const rafRef       = useRef<number | null>(null);
  const animStartRef = useRef<number | null>(null);
  const ANIM_MS      = 500;

  const color    = up ? "var(--primary)" : "var(--destructive)";
  const GRAY     = "#6b7280";

  const ease = (t: number) => t < 0.5 ? 4*t*t*t : 1 - (-2*t+2)**3/2;

  const applyPts = (pts: { x: number; y: number }[]) => {
    const line = smoothPath(pts);
    lineRef.current?.setAttribute("d", line);
    areaRef.current?.setAttribute("d", `${line} L ${W} ${H} L 0 ${H} Z`);
  };

  useEffect(() => {
    if (data.length < 2) return;
    const newPts = dataToPts(data);

    // First mount
    if (prevPtsRef.current.length === 0) {
      prevPtsRef.current = newPts;
      curPtsRef.current  = newPts;
      applyPts(newPts);
      return;
    }

    // Cancel in-flight animation, snapshot current state as new "from"
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const snapPts = curPtsRef.current.length ? [...curPtsRef.current] : [...prevPtsRef.current];
    prevPtsRef.current = snapPts;
    animStartRef.current = performance.now();

    const tick = (now: number) => {
      const t = ease(Math.min((now - animStartRef.current!) / ANIM_MS, 1));

      // Build blended array — only edges animate, middle is fixed
      const len = Math.min(snapPts.length, newPts.length);
      const mid: { x: number; y: number; price: number; ts: number }[] = [];

      for (let i = 0; i < len; i++) {
        const a = snapPts[i];
        const b = newPts[i];

        // Left edge: first EDGE_LEN points
        const leftW  = i < EDGE_LEN ? ease(Math.min(i / EDGE_LEN + t / EDGE_LEN, 1)) : 1;
        // Right edge: last EDGE_LEN points
        const rightW = i >= len - EDGE_LEN
          ? ease(Math.min((i - (len - EDGE_LEN)) / EDGE_LEN + t, 1))
          : 1;

        // Middle points stay frozen until t=1
        const blend = i < EDGE_LEN
          ? t * leftW
          : i >= len - EDGE_LEN
            ? t * rightW
            : t < 1 ? 0 : 1; // middle: jump at end of animation

        mid.push({
          x:     a.x     + (b.x     - a.x)     * blend,
          y:     a.y     + (b.y     - a.y)     * blend,
          price: a.price + (b.price - a.price) * blend,
          ts:    b.ts,
        });
      }

      curPtsRef.current = mid;
      applyPts(mid);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevPtsRef.current  = newPts;
        curPtsRef.current   = newPts;
        animStartRef.current = null;
        rafRef.current       = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mouse handler — pure DOM ──────────────────────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const tt  = ttBoxRef.current;
    const con = containerRef.current;
    if (!svg || !tt || !con) return;

    const svgRect = svg.getBoundingClientRect();
    const conRect = con.getBoundingClientRect();

    // Cursor in SVG-viewBox coords
    const svgX = ((e.clientX - svgRect.left) / svgRect.width)  * W;

    // Nearest point by x
    const pts = curPtsRef.current;
    if (pts.length < 2) return;
    let nearest = pts[0];
    for (const p of pts)
      if (Math.abs(p.x - svgX) < Math.abs(nearest.x - svgX)) nearest = p;

    // Crosshair in SVG-space (always pixel-perfect regardless of aspect ratio)
    crossVRef.current?.setAttribute("x1", String(nearest.x));
    crossVRef.current?.setAttribute("x2", String(nearest.x));
    crossVRef.current?.setAttribute("y1", "0");
    crossVRef.current?.setAttribute("y2", String(H));
    crossHRef.current?.setAttribute("x1", "0");
    crossHRef.current?.setAttribute("x2", String(W));
    crossHRef.current?.setAttribute("y1", String(nearest.y));
    crossHRef.current?.setAttribute("y2", String(nearest.y));
    dotRef.current?.setAttribute("cx", String(nearest.x));
    dotRef.current?.setAttribute("cy", String(nearest.y));
    if (crossVRef.current) crossVRef.current.style.opacity = "1";
    if (crossHRef.current) crossHRef.current.style.opacity = "1";
    if (dotRef.current)    dotRef.current.style.opacity    = "1";

    // Convert nearest SVG point → pixels inside container
    const px = (nearest.x / W) * svgRect.width  + svgRect.left - conRect.left;
    const py = (nearest.y / H) * svgRect.height + svgRect.top  - conRect.top;

    // Update tooltip content
    if (ttPriceRef.current) ttPriceRef.current.textContent = `$${fmtPrice(nearest.price)}`;
    if (ttTimeRef.current)  ttTimeRef.current.textContent  = fmtTime(nearest.ts);

    // Position tooltip RIGHT NEXT TO the dot (8px right, vertically centred on dot)
    tt.style.opacity = "1";
    const ttW = tt.offsetWidth  || 110;
    const ttH = tt.offsetHeight || 44;
    let left  = px + 12;
    let top   = py - ttH / 2;

    // Flip to left if near right edge
    if (left + ttW + 8 > conRect.width) left = px - ttW - 12;
    // Clamp vertically
    if (top < 2)                        top  = 2;
    if (top + ttH > conRect.height - 2) top  = conRect.height - ttH - 2;

    tt.style.left = `${left}px`;
    tt.style.top  = `${top}px`;
  }, []);

  const onMouseLeave = useCallback(() => {
    if (crossVRef.current) crossVRef.current.style.opacity = "0";
    if (crossHRef.current) crossHRef.current.style.opacity = "0";
    if (dotRef.current)    dotRef.current.style.opacity    = "0";
    if (ttBoxRef.current)  ttBoxRef.current.style.opacity  = "0";
  }, []);

  if (data.length < 2) return null;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full cursor-crosshair select-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <defs>
          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </linearGradient>
        </defs>

        <path ref={areaRef} fill="url(#chart-area-grad)" />
        <path ref={lineRef} fill="none" stroke={color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />

        {/* Crosshair — always gray */}
        <line ref={crossVRef} stroke={GRAY} strokeWidth="1" strokeDasharray="3 3" opacity="0" />
        <line ref={crossHRef} stroke={GRAY} strokeWidth="1" strokeDasharray="3 3" opacity="0" />

        {/* Snap dot on the line */}
        <circle ref={dotRef} r="4.5" fill={color}
                stroke="var(--background)" strokeWidth="2" opacity="0" />
      </svg>

      {/* Tooltip — absolutely inside container, zero React state */}
      <div
        ref={ttBoxRef}
        className="pointer-events-none absolute z-50 rounded-xl border border-border/60
                   bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm"
        style={{ opacity: 0, top: 0, left: 0, transition: "opacity 0.08s", whiteSpace: "nowrap" }}
      >
        <span ref={ttPriceRef}
              className="block font-mono text-sm font-bold"
              style={{ color }} />
        <span ref={ttTimeRef}
              className="block text-[10px] text-muted-foreground" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExchangePage() {
  const { user, updateBalance } = useAuth();
  const [coins, setCoins]       = useState<CoinView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<CryptoHolding[]>([]);
  const [search, setSearch]     = useState("");
  const [side, setSide]         = useState<"buy" | "sell">("buy");
  const [amountCr, setAmountCr] = useState("");
  const [msg, setMsg]           = useState("");
  const [msgType, setMsgType]   = useState<"ok" | "err">("ok");
  const [busy, setBusy]         = useState(false);

  // Modals
  const [sellAllModal, setSellAllModal] = useState(false);
  const [sellHoldingModal, setSellHoldingModal] = useState<CryptoHolding | null>(null);

  const coinsRef = useRef<CoinView[]>([]);
  const tickRef  = useRef<number | null>(null);
  useEffect(() => { coinsRef.current = coins; }, [coins]);

  // ── Load coins (each user gets own local history) ────────────────────────────
  useEffect(() => {
    (async () => {
      const data = await secureSelect<CryptoCoin>("crypto_coins", {
        filters: [{ col: "active", op: "eq", value: true }],
        order: { col: "market_cap", asc: false },
      });
      const list = data ?? [];
      setCoins(list.map((c) => ({ ...c, history: genHistory(c.price, c.volatility || 1) })));
      setSelectedId((p) => p ?? list[0]?.id ?? null);
    })();
  }, []);

  // ── Local ticker — each user's chart runs independently ──────────────────────
  useEffect(() => {
    if (!coins.length) return;
    tickRef.current = window.setInterval(() => {
      setCoins((prev) => prev.map((c) => {
        const chg      = (Math.random() - 0.46) * (c.volatility || 1) * 0.006;
        const newPrice = Math.max(0.0001, c.price * (1 + chg));
        const newHistory = [
          ...c.history.slice(-(HISTORY_LEN - 1)),
          { price: newPrice, ts: Date.now() },
        ];
        return { ...c, price: newPrice, change_24h: c.change_24h + chg * 5, history: newHistory };
      }));
    }, TICK_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [coins.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Holdings ────────────────────────────────────────────────────────────────
  const loadHoldings = useCallback(async () => {
    if (!user) return;
    const data = await secureSelect("crypto_holdings", {
      filters: [{ col: "username", op: "eq", value: user.username }],
    });
    setHoldings((data ?? []) as CryptoHolding[]);
  }, [user]);
  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? coins.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)) : coins;
  }, [coins, search]);

  const selected       = useMemo(() => coins.find((c) => c.id === selectedId) ?? null, [coins, selectedId]);
  const holding        = useMemo(() => holdings.find((h) => h.coin_id === selectedId) ?? null, [holdings, selectedId]);
  const portfolioValue = useMemo(() =>
    holdings.reduce((s, h) => {
      const c = coins.find((x) => x.id === h.coin_id);
      return s + (c ? c.price * h.amount : 0);
    }, 0), [holdings, coins]);

  // ── Trade ───────────────────────────────────────────────────────────────────
  const trade = async () => {
    if (!user || !selected || busy) return;
    const cr = Number(amountCr);
    if (!cr || cr <= 0) { setMsg("Введи суму CR"); setMsgType("err"); return; }
    setBusy(true); setMsg("");
    try {
      if (side === "buy") {
        if ((user.balance ?? 0) < cr) throw new Error("Недостатньо CR");
        const coins_ = cr / selected.price;
        await updateBalance(-cr);
        if (holding) {
          const na = holding.amount + coins_;
          await secureUpdate(
            "crypto_holdings",
            { amount: na, avg_price: (holding.amount * holding.avg_price + cr) / na, updated_at: new Date().toISOString() },
            { id: holding.id },
          );
        } else {
          await secureInsert("crypto_holdings", {
            username: user.username,
            coin_id: selected.id,
            amount: coins_,
            avg_price: selected.price,
          });
        }
        setMsg(`Куплено ${(cr / selected.price).toFixed(6)} ${selected.symbol}`);
        setMsgType("ok");
      } else {
        if (!holding || holding.amount <= 0) throw new Error("Немає монет для продажу");
        const sellCoins = cr / selected.price;
        if (sellCoins > holding.amount + 1e-9)
          throw new Error(`Максимум: ${(holding.amount * selected.price).toFixed(2)} CR`);
        await updateBalance(cr);
        const na = holding.amount - sellCoins;
        if (na < 1e-9) {
          await secureDelete("crypto_holdings", { id: holding.id });
        } else {
          await secureUpdate(
            "crypto_holdings",
            { amount: na, updated_at: new Date().toISOString() },
            { id: holding.id },
          );
        }
        setMsg(`Продано ${sellCoins.toFixed(6)} ${selected.symbol}`);
        setMsgType("ok");
      }
      setAmountCr(""); await loadHoldings();
    } catch (e: unknown) {
      setMsg((e as Error)?.message ?? "Помилка");
      setMsgType("err");
    } finally { setBusy(false); }
  };

  // ── Sell ALL holdings ──────────────────────────────────────────────────────
  const sellAll = async () => {
    if (!user || busy) return;
    if (holdings.length === 0) { setMsg("Портфель порожній"); return; }
    setSellAllModal(true);
  };

  const doSellAll = async () => {
    setSellAllModal(false);
    if (!user || busy) return;
    setBusy(true); setMsg("");
    try {
      let total = 0;
      for (const h of holdings) {
        const c = coins.find((x) => x.id === h.coin_id);
        if (!c) continue;
        const cr = c.price * h.amount;
        total += cr;
        await secureDelete("crypto_holdings", { id: h.id });
      }
      if (total > 0) await updateBalance(Math.floor(total));
      setMsg(`Продано все: +${Math.floor(total).toLocaleString()} CR`);
      setMsgType("ok");
      await loadHoldings();
    } catch (e: any) {
      setMsg(e.message ?? "Помилка");
      setMsgType("err");
    } finally { setBusy(false); }
  };

  // ── Sell single holding ──────────────────────────────────────────────────────
  const doSellHolding = async (h: CryptoHolding) => {
    setSellHoldingModal(null);
    if (!user || busy) return;
    const c = coins.find((x) => x.id === h.coin_id);
    if (!c) return;
    const cr = Math.floor(c.price * h.amount);
    setBusy(true); setMsg("");
    try {
      await secureDelete("crypto_holdings", { id: h.id });
      await updateBalance(cr);
      setMsg(`Продано ${c.name}: +${cr.toLocaleString()} CR`);
      setMsgType("ok");
      await loadHoldings();
    } catch (e: any) {
      setMsg((e as Error)?.message ?? "Помилка");
      setMsgType("err");
    } finally { setBusy(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <ConfirmModal
        open={sellAllModal}
        title="Продати всі активи?"
        description={`Ти отримаєш ~${Math.floor(portfolioValue).toLocaleString()} CR. Усі монети будуть продані за поточним курсом.`}
        confirmLabel="Продати все"
        danger
        onConfirm={doSellAll}
        onCancel={() => setSellAllModal(false)}
      />

      <ConfirmModal
        open={!!sellHoldingModal}
        title={`Продати ${coins.find(c => c.id === sellHoldingModal?.coin_id)?.name ?? "монету"}?`}
        description={sellHoldingModal ? `Ти отримаєш ~${Math.floor((coins.find(c => c.id === sellHoldingModal.coin_id)?.price ?? 0) * sellHoldingModal.amount).toLocaleString()} CR за ${sellHoldingModal.amount.toFixed(6)} ${coins.find(c => c.id === sellHoldingModal.coin_id)?.symbol ?? ""}.` : ""}
        confirmLabel="Продати"
        danger
        onConfirm={() => sellHoldingModal && doSellHolding(sellHoldingModal)}
        onCancel={() => setSellHoldingModal(null)}
      />

      <PageHeader title="Крипто Біржа" subtitle="Купуй та продавай монети у реальному часі" />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">

        {/* LEFT */}
        <div className="space-y-4">

          {/* Stats bar */}
          <div className="glass-strong grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Баланс</p>
              <p className="font-mono text-lg font-bold" style={{ color: "var(--primary)" }}>
                {(user?.balance ?? 0).toLocaleString()} CR
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Портфель</p>
              <p className="font-mono text-lg font-bold">{portfolioValue.toFixed(2)} CR</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Монет</p>
              <p className="font-mono text-lg font-bold">{holdings.length}</p>
            </div>
          </div>

          {/* Chart card */}
          {selected && (
            <div className="glass-strong rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <img src={selected.image_url} alt={selected.symbol}
                     className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/40" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{selected.name}</span>
                    <span className="text-xs text-muted-foreground">{selected.symbol.toUpperCase()}</span>
                  </div>
                  <div className="font-mono text-2xl font-bold glow-text">${fmtPrice(selected.price)}</div>
                </div>
                <div className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-mono
                  ${selected.change_24h >= 0 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                  {selected.change_24h >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {selected.change_24h >= 0 ? "+" : ""}{selected.change_24h.toFixed(2)}%
                </div>
              </div>
              {/* overflow-visible so tooltip can escape the clipping rect */}
              <div className="relative mt-3 h-44 w-full overflow-visible rounded-xl border border-border bg-black/30">
                <BigChart data={selected.history} up={selected.change_24h >= 0} />
              </div>
            </div>
          )}

          {/* Market list */}
          <div className="glass-strong rounded-2xl p-3">
            <div className="mb-3 flex items-center gap-2 px-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Маркет</span>
              <div className="ml-auto flex items-center gap-2 rounded-xl bg-input px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                       placeholder="Пошук..." className="w-32 bg-transparent text-xs outline-none sm:w-48" />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border
                              px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Монета</span>
                <span className="hidden sm:block">Графік</span>
                <span className="text-right">Ціна</span>
                <span className="text-right">24г</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">Немає монет</p>
                )}
                {filtered.map((c) => (
                  <button key={c.id} onClick={() => setSelectedId(c.id)}
                    className={`grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3
                      border-b border-border/40 px-3 py-3 text-left transition hover:bg-primary/5
                      ${selectedId === c.id ? "bg-primary/10" : ""}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <img src={c.image_url} alt={c.symbol}
                           className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{c.symbol}</p>
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <Sparkline data={c.history} up={c.change_24h >= 0} />
                    </div>
                    <p className="text-right font-mono text-sm">${fmtPrice(c.price)}</p>
                    <p className={`text-right font-mono text-xs
                      ${c.change_24h >= 0 ? "text-primary" : "text-destructive"}`}>
                      {c.change_24h >= 0 ? "+" : ""}{c.change_24h.toFixed(2)}%
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <div className="glass-strong rounded-2xl p-4">
            <div className="mb-3 flex gap-2">
              {(["buy", "sell"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)}
                  className="flex-1 rounded-xl py-2 text-sm font-semibold transition-all"
                  style={{
                    background: side === s ? "var(--gradient-primary)" : "transparent",
                    color:      side === s ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    boxShadow:  side === s ? "var(--shadow-glow)" : "none",
                  }}>
                  {s === "buy" ? "Купити" : "Продати"}
                </button>
              ))}
            </div>

            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl bg-input p-3">
                  <img src={selected.image_url} alt={selected.symbol} className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{selected.symbol}</p>
                  </div>
                  <p className="font-mono text-sm">${fmtPrice(selected.price)}</p>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Сума (CR)</span>
                    {side === "sell" && holding ? (
                      <button className="text-primary hover:underline"
                        onClick={() => setAmountCr((holding.amount * selected.price).toFixed(2))}>
                        MAX ({(holding.amount * selected.price).toFixed(0)} CR)
                      </button>
                    ) : side === "buy" ? (
                      <button className="text-primary hover:underline"
                        onClick={() => setAmountCr(String(Math.floor(user?.balance ?? 0)))}>
                        MAX ({Math.floor(user?.balance ?? 0)} CR)
                      </button>
                    ) : null}
                  </div>
                  <input type="number" value={amountCr} onChange={(e) => setAmountCr(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl bg-input px-4 py-3 font-mono text-lg outline-none focus:ring-2 focus:ring-ring" />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>≈ {amountCr ? (Number(amountCr) / selected.price).toFixed(6) : "0"} {selected.symbol}</span>
                    {holding && (
                      <span>В тебе: {holding.amount.toFixed(6)} ({(holding.amount * selected.price).toFixed(2)} CR)</span>
                    )}
                  </div>
                </div>

                <button onClick={trade} disabled={busy}
                  className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                  <ArrowDownUp className="h-4 w-4" />
                  {busy ? "..." : side === "buy" ? "Купити" : "Продати"}
                </button>

                {msg && (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium
                    ${msgType === "ok" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                    {msgType === "ok"
                      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                    {msg}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Оберіть монету</p>
            )}
          </div>

          {/* Portfolio */}
          <div className="glass-strong rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Мій портфель</span>
              </div>
              {holdings.length > 0 && (
                <button onClick={sellAll} disabled={busy}
                  className="rounded-lg bg-destructive/15 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-40 transition">
                  Продати ВСЕ
                </button>
              )}
            </div>
            {holdings.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">Поки що порожньо</p>
            ) : (
              <div className="space-y-2">
                {holdings.map((h) => {
                  const c = coins.find((x) => x.id === h.coin_id);
                  if (!c) return null;
                  const val   = c.price * h.amount;
                  const pl    = (c.price - h.avg_price) * h.amount;
                  const plPct = ((c.price - h.avg_price) / h.avg_price) * 100;
                  return (
                    <div key={h.id} className="glass flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-primary/5">
                      <button onClick={() => setSelectedId(c.id)} className="flex items-center gap-3 flex-1 min-w-0">
                        <img src={c.image_url} alt={c.symbol} className="h-8 w-8 rounded-full shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{c.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {h.amount.toFixed(6)} {c.symbol}
                          </p>
                        </div>
                        <div className="text-right mr-2">
                          <p className="font-mono text-xs">{val.toFixed(2)} CR</p>
                          <p className={`font-mono text-[10px] ${pl >= 0 ? "text-primary" : "text-destructive"}`}>
                            {pl >= 0 ? "+" : ""}{plPct.toFixed(1)}%
                          </p>
                        </div>
                      </button>
                      <button onClick={() => setSellHoldingModal(h)} disabled={busy}
                        className="shrink-0 rounded-lg bg-destructive/15 px-2 py-1.5 text-[10px] font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-40 transition">
                        Продати
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
