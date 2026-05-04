import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";
import type { CryptoCoin, CryptoHolding } from "@/lib/crypto-types";
import { TrendingUp, TrendingDown, ArrowDownUp, Wallet, Search, Activity } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PricePoint = { price: number; ts: number }; // ts = unix ms
type CoinView = CryptoCoin & { history: PricePoint[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_LEN = 60;
const TICK_MS = 2000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function historyToPoints(data: PricePoint[], w: number, h: number) {
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  return data.map((d, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((d.price - min) / range) * (h - 8) - 4,
    price: d.price,
    ts: d.ts,
  }));
}

// ─── Sparkline (mini chart in list) ──────────────────────────────────────────

function Sparkline({ data, up }: { data: PricePoint[]; up: boolean }) {
  if (data.length < 2) return null;
  const w = 120, h = 36;
  const pts = historyToPoints(data, w, h);
  const color = up ? "var(--primary)" : "var(--destructive)";
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── BigChart with tooltip + smooth animation ─────────────────────────────────

type TooltipState = { x: number; y: number; price: number; ts: number } | null;

function BigChart({ data, up }: { data: PricePoint[]; up: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const crossXRef = useRef<SVGLineElement>(null);
  const crossYRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  const fromPtsRef = useRef<{ x: number; y: number; price: number; ts: number }[]>([]);
  const toPtsRef = useRef<{ x: number; y: number; price: number; ts: number }[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const ANIM_MS = 700;
  const W = 600, H = 160;

  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const currentPtsRef = useRef<{ x: number; y: number; price: number; ts: number }[]>([]);

  const color = up ? "var(--primary)" : "var(--destructive)";

  const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const lerpPts = (
    a: { x: number; y: number; price: number; ts: number }[],
    b: { x: number; y: number; price: number; ts: number }[],
    t: number
  ) => {
    const len = Math.min(a.length, b.length);
    return Array.from({ length: len }, (_, i) => ({
      x: a[i].x + (b[i].x - a[i].x) * t,
      y: a[i].y + (b[i].y - a[i].y) * t,
      price: a[i].price + (b[i].price - a[i].price) * t,
      ts: b[i].ts,
    }));
  };

  const applyPts = (pts: { x: number; y: number }[]) => {
    const linePath = smoothPath(pts);
    const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;
    if (lineRef.current) lineRef.current.setAttribute("d", linePath);
    if (areaRef.current) areaRef.current.setAttribute("d", areaPath);
  };

  useEffect(() => {
    if (data.length < 2) return;
    const newPts = historyToPoints(data, W, H);

    if (fromPtsRef.current.length === 0) {
      fromPtsRef.current = newPts;
      toPtsRef.current = newPts;
      currentPtsRef.current = newPts;
      applyPts(newPts);
      return;
    }

    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    if (startTimeRef.current !== null) {
      const elapsed = performance.now() - startTimeRef.current;
      const t = ease(Math.min(elapsed / ANIM_MS, 1));
      fromPtsRef.current = lerpPts(fromPtsRef.current, toPtsRef.current, t);
    } else {
      fromPtsRef.current = [...toPtsRef.current];
    }
    toPtsRef.current = newPts;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - (startTimeRef.current ?? now);
      const t = ease(Math.min(elapsed / ANIM_MS, 1));
      const mid = lerpPts(fromPtsRef.current, toPtsRef.current, t);
      currentPtsRef.current = mid;
      applyPts(mid);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromPtsRef.current = toPtsRef.current;
        currentPtsRef.current = toPtsRef.current;
        startTimeRef.current = null;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse/touch crosshair
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const pts = currentPtsRef.current;
    if (pts.length < 2) return;

    // Find nearest point by x
    let nearest = pts[0];
    let minDist = Math.abs(pts[0].x - mx);
    for (const p of pts) {
      const d = Math.abs(p.x - mx);
      if (d < minDist) { minDist = d; nearest = p; }
    }

    // Update crosshair elements directly (no re-render)
    if (crossXRef.current) {
      crossXRef.current.setAttribute("x1", String(nearest.x));
      crossXRef.current.setAttribute("x2", String(nearest.x));
      crossXRef.current.setAttribute("y1", "0");
      crossXRef.current.setAttribute("y2", String(H));
      crossXRef.current.style.opacity = "1";
    }
    if (crossYRef.current) {
      crossYRef.current.setAttribute("x1", "0");
      crossYRef.current.setAttribute("x2", String(W));
      crossYRef.current.setAttribute("y1", String(nearest.y));
      crossYRef.current.setAttribute("y2", String(nearest.y));
      crossYRef.current.style.opacity = "1";
    }
    if (dotRef.current) {
      dotRef.current.setAttribute("cx", String(nearest.x));
      dotRef.current.setAttribute("cy", String(nearest.y));
      dotRef.current.style.opacity = "1";
    }

    // Tooltip position (convert back to screen %)
    const tooltipX = (nearest.x / W) * rect.width + rect.left;
    const tooltipY = (nearest.y / H) * rect.height + rect.top;
    setTooltip({ x: tooltipX, y: tooltipY, price: nearest.price, ts: nearest.ts });
    void my;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (crossXRef.current) crossXRef.current.style.opacity = "0";
    if (crossYRef.current) crossYRef.current.style.opacity = "0";
    if (dotRef.current) dotRef.current.style.opacity = "0";
    setTooltip(null);
  }, []);

  if (data.length < 2) return null;

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path ref={areaRef} fill="url(#cg)" />
        <path ref={lineRef} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Crosshair lines */}
        <line ref={crossXRef} stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity="0" style={{ transition: "opacity 0.1s" }} />
        <line ref={crossYRef} stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity="0" style={{ transition: "opacity 0.1s" }} />
        {/* Hover dot */}
        <circle ref={dotRef} r="4" fill={color} stroke="var(--background)" strokeWidth="2" opacity="0" style={{ transition: "opacity 0.1s" }} />
      </svg>

      {/* Tooltip box */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 38,
            transform: tooltip.x > window.innerWidth - 180 ? "translateX(-110%)" : undefined,
          }}
        >
          <div className="font-mono text-sm font-bold" style={{ color }}>
            ${fmtPrice(tooltip.price)}
          </div>
          <div className="text-[10px] text-muted-foreground">{fmtTime(tooltip.ts)}</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExchangePage() {
  const { user, updateBalance } = useAuth();
  const [coins, setCoins] = useState<CoinView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<CryptoHolding[]>([]);
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amountCr, setAmountCr] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const tickRef = useRef<number | null>(null);

  // ── Load coins from Supabase, generate local history ────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: coinData } = await supabase
        .from("crypto_coins")
        .select("*")
        .eq("active", true)
        .order("market_cap", { ascending: false });
      const list = (coinData ?? []) as CryptoCoin[];

      const now = Date.now();
      const coinsWithHistory = list.map((c) => {
        // Генеруємо локальну синтетичну історію для кожного юзера окремо
        const synthetic: PricePoint[] = [];
        let p = c.price;
        for (let i = HISTORY_LEN - 1; i >= 0; i--) {
          p = Math.max(0.0001, p / (1 + (Math.random() - 0.5) * (c.volatility || 1) * 0.03));
          synthetic.unshift({ price: p, ts: now - i * TICK_MS });
        }
        synthetic[synthetic.length - 1] = { price: c.price, ts: now };
        return { ...c, history: synthetic };
      });

      setCoins(coinsWithHistory);
      setSelectedId(list[0]?.id ?? null);
    };
    init();
  }, []);

  // ── Локальний тікер: кожен юзер рахує ціни у себе ──────────────────────────
  useEffect(() => {
    if (coins.length === 0) return;
    tickRef.current = window.setInterval(() => {
      const now = Date.now();
      setCoins((prev) =>
        prev.map((c) => {
          if (Math.random() > 0.6) return c;
          const change = (Math.random() - 0.49) * (c.volatility || 1) * 0.006;
          const newPrice = Math.max(0.0001, c.price * (1 + change));
          const newChange = c.change_24h + change * 100 * 0.05;
          const newHistory = [...c.history.slice(-(HISTORY_LEN - 1)), { price: newPrice, ts: now }];
          return { ...c, price: newPrice, change_24h: newChange, history: newHistory };
        })
      );
    }, TICK_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [coins.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Holdings ────────────────────────────────────────────────────────────────
  const loadHoldings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("crypto_holdings").select("*").eq("username", user.username);
    setHoldings((data ?? []) as CryptoHolding[]);
  }, [user]);
  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coins;
    return coins.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  }, [coins, search]);

  const selected = useMemo(() => coins.find((c) => c.id === selectedId) ?? null, [coins, selectedId]);
  const holding = useMemo(() => holdings.find((h) => h.coin_id === selectedId) ?? null, [holdings, selectedId]);
  const portfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const c = coins.find((x) => x.id === h.coin_id);
      return sum + (c ? c.price * h.amount : 0);
    }, 0);
  }, [holdings, coins]);

  // ── Trade (fixed sell logic) ─────────────────────────────────────────────────
  const trade = async () => {
    if (!user || !selected || busy) return;
    const cr = Number(amountCr);
    if (!Number.isFinite(cr) || cr <= 0) { setMsg("Введи суму CR"); return; }
    setBusy(true); setMsg("");
    try {
      if (side === "buy") {
        if ((user.balance ?? 0) < cr) throw new Error("Недостатньо CR");
        const coinAmount = cr / selected.price;
        await updateBalance(-cr);
        if (holding) {
          const newAmount = holding.amount + coinAmount;
          const newAvg = (holding.amount * holding.avg_price + cr) / newAmount;
          const { error } = await supabase.from("crypto_holdings")
            .update({ amount: newAmount, avg_price: newAvg, updated_at: new Date().toISOString() })
            .eq("id", holding.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("crypto_holdings").insert({
            username: user.username, coin_id: selected.id, amount: coinAmount, avg_price: selected.price,
          });
          if (error) throw new Error(error.message);
        }
        setMsg(`✅ Куплено ${coinAmount.toFixed(6)} ${selected.symbol}`);
      } else {
        // SELL: cr is the CR amount the user wants to receive
        if (!holding || holding.amount <= 0) throw new Error("Немає монет для продажу");
        const coinAmount = cr / selected.price; // how many coins to sell for that CR amount
        if (coinAmount > holding.amount + 1e-9) throw new Error(`Недостатньо монет. В тебе: ${(holding.amount * selected.price).toFixed(2)} CR`);
        // Receive CR
        await updateBalance(+cr);
        const newAmount = holding.amount - coinAmount;
        if (newAmount < 1e-9) {
          const { error } = await supabase.from("crypto_holdings").delete().eq("id", holding.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("crypto_holdings")
            .update({ amount: newAmount, updated_at: new Date().toISOString() })
            .eq("id", holding.id);
          if (error) throw new Error(error.message);
        }
        setMsg(`✅ Продано ${coinAmount.toFixed(6)} ${selected.symbol}`);
      }
      setAmountCr("");
      await loadHoldings();
    } catch (e: unknown) {
      setMsg(`❌ ${(e as Error)?.message || "Помилка"}`);
    } finally {
      setBusy(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Крипто Біржа" subtitle="Купуй та продавай монети у реальному часі" />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">

        {/* LEFT */}
        <div className="space-y-4">
          {/* Wallet summary */}
          <div className="glass-strong grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Баланс</div>
              <div className="font-mono text-lg font-bold" style={{ color: "var(--primary)" }}>
                {(user?.balance ?? 0).toLocaleString()} CR
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Портфель</div>
              <div className="font-mono text-lg font-bold">{portfolioValue.toFixed(2)} CR</div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Монет</div>
              <div className="font-mono text-lg font-bold">{holdings.length}</div>
            </div>
          </div>

          {/* Chart */}
          {selected && (
            <div className="glass-strong rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <img src={selected.image_url} alt={selected.symbol} className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/40" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold">{selected.name}</div>
                    <div className="text-xs text-muted-foreground">{selected.symbol.toUpperCase()}</div>
                  </div>
                  <div className="font-mono text-2xl font-bold glow-text">${fmtPrice(selected.price)}</div>
                </div>
                <div className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-mono ${selected.change_24h >= 0 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                  {selected.change_24h >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {selected.change_24h >= 0 ? "+" : ""}{selected.change_24h.toFixed(2)}%
                </div>
              </div>
              <div className="mt-3 h-44 w-full overflow-visible rounded-xl border border-border bg-black/30">
                <BigChart data={selected.history} up={selected.change_24h >= 0} />
              </div>
            </div>
          )}

          {/* Market list */}
          <div className="glass-strong rounded-2xl p-3">
            <div className="mb-3 flex items-center gap-2 px-1">
              <Activity className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">Маркет</div>
              <div className="ml-auto flex items-center gap-2 rounded-xl bg-input px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук..."
                  className="w-32 bg-transparent text-xs outline-none sm:w-48" />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <div>Монета</div><div className="hidden sm:block">Графік</div><div className="text-right">Ціна</div><div className="text-right">24г</div>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {filtered.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Немає монет</div>}
                {filtered.map((c) => (
                  <button key={c.id} onClick={() => setSelectedId(c.id)}
                    className={`grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border/40 px-3 py-3 text-left transition hover:bg-primary/5 ${selectedId === c.id ? "bg-primary/10" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={c.image_url} alt={c.symbol} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{c.name}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">{c.symbol}</div>
                      </div>
                    </div>
                    <div className="hidden sm:block"><Sparkline data={c.history} up={c.change_24h >= 0} /></div>
                    <div className="text-right font-mono text-sm">${fmtPrice(c.price)}</div>
                    <div className={`text-right font-mono text-xs ${c.change_24h >= 0 ? "text-primary" : "text-destructive"}`}>
                      {c.change_24h >= 0 ? "+" : ""}{c.change_24h.toFixed(2)}%
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: trade panel */}
        <div className="space-y-4">
          <div className="glass-strong rounded-2xl p-4">
            <div className="mb-3 flex gap-2">
              {(["buy", "sell"] as const).map((s) => (
                <button key={s} onClick={() => setSide(s)} className="flex-1 rounded-xl py-2 text-sm font-semibold transition-all"
                  style={{
                    background: side === s ? "var(--gradient-primary)" : "transparent",
                    color: side === s ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    boxShadow: side === s ? "var(--shadow-glow)" : "none",
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
                    <div className="text-sm font-semibold">{selected.name}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{selected.symbol}</div>
                  </div>
                  <div className="font-mono text-sm">${fmtPrice(selected.price)}</div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Сума (CR)</span>
                    {side === "sell" && holding && (
                      <button className="text-primary hover:underline" onClick={() => setAmountCr((holding.amount * selected.price).toFixed(2))}>
                        MAX ({(holding.amount * selected.price).toFixed(0)} CR)
                      </button>
                    )}
                    {side === "buy" && (
                      <button className="text-primary hover:underline" onClick={() => setAmountCr(String(Math.floor(user?.balance ?? 0)))}>
                        MAX ({Math.floor(user?.balance ?? 0)} CR)
                      </button>
                    )}
                  </div>
                  <input type="number" value={amountCr} onChange={(e) => setAmountCr(e.target.value)} placeholder="0.00"
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
                  <div className={`rounded-xl px-3 py-2 text-center text-xs ${msg.startsWith("✅") ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                    {msg}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground">Оберіть монету</div>
            )}
          </div>

          {/* Portfolio */}
          <div className="glass-strong rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">Мій портфель</div>
            </div>
            {holdings.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground">Поки що порожньо</div>
            ) : (
              <div className="space-y-2">
                {holdings.map((h) => {
                  const c = coins.find((x) => x.id === h.coin_id);
                  if (!c) return null;
                  const value = c.price * h.amount;
                  const pl = (c.price - h.avg_price) * h.amount;
                  const plPct = ((c.price - h.avg_price) / h.avg_price) * 100;
                  return (
                    <button key={h.id} onClick={() => setSelectedId(c.id)}
                      className="glass flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-primary/5">
                      <img src={c.image_url} alt={c.symbol} className="h-8 w-8 rounded-full" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs font-semibold">{c.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{h.amount.toFixed(6)} {c.symbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs">{value.toFixed(2)} CR</div>
                        <div className={`font-mono text-[10px] ${pl >= 0 ? "text-primary" : "text-destructive"}`}>
                          {pl >= 0 ? "+" : ""}{plPct.toFixed(1)}%
                        </div>
                      </div>
                    </button>
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
