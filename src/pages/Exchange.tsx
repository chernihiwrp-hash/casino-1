import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";
import type { CryptoCoin, CryptoHolding } from "@/lib/crypto-types";
import { TrendingUp, TrendingDown, ArrowDownUp, Wallet, Search, Activity } from "lucide-react";

type CoinView = CryptoCoin & { history: number[] };

function genHistory(price: number, vol: number): number[] {
  const out: number[] = [];
  let p = price;
  for (let i = 0; i < 60; i++) {
    p = Math.max(0.0001, p * (1 + (Math.random() - 0.5) * vol * 0.04));
    out.push(p);
  }
  out[out.length - 1] = price;
  return out;
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 120, h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const color = up ? "var(--primary)" : "var(--destructive)";
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

export default function ExchangePage() {
  const { user, updateBalance } = useAuth();
  const [coinsRaw, setCoinsRaw] = useState<CryptoCoin[]>([]);
  const [coins, setCoins] = useState<CoinView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<CryptoHolding[]>([]);
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amountCr, setAmountCr] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Load coins
  const loadCoins = async () => {
    const { data } = await supabase.from("crypto_coins").select("*").eq("active", true).order("market_cap", { ascending: false });
    const list = (data ?? []) as CryptoCoin[];
    setCoinsRaw(list);
    setCoins(list.map((c) => ({ ...c, history: genHistory(c.price, c.volatility || 1) })));
    if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
  };

  const loadHoldings = async () => {
    if (!user) return;
    const { data } = await supabase.from("crypto_holdings").select("*").eq("username", user.username);
    setHoldings((data ?? []) as CryptoHolding[]);
  };

  useEffect(() => {
    loadCoins();
    loadHoldings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  // Live price ticker (cosmetic, client-side)
  useEffect(() => {
    if (coins.length === 0) return;
    tickRef.current = window.setInterval(() => {
      setCoins((prev) =>
        prev.map((c) => {
          const change = (Math.random() - 0.5) * c.volatility * 0.012;
          const next = Math.max(0.0001, c.price * (1 + change));
          const h = [...c.history.slice(1), next];
          return { ...c, price: next, change_24h: c.change_24h + change * 100 * 0.05, history: h };
        }),
      );
    }, 1500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [coins.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coins;
    return coins.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  }, [coins, search]);

  const selected = useMemo(() => coins.find((c) => c.id === selectedId) ?? null, [coins, selectedId]);
  const holding = useMemo(() => holdings.find((h) => h.coin_id === selectedId) ?? null, [holdings, selectedId]);

  const trade = async () => {
    if (!user || !selected || busy) return;
    const cr = Number(amountCr);
    if (!Number.isFinite(cr) || cr <= 0) { setMsg("Введи сумму CR"); return; }
    setBusy(true); setMsg("");
    try {
      if (side === "buy") {
        if ((user.balance ?? 0) < cr) throw new Error("Недостаточно CR");
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
        setMsg(`Куплено ${coinAmount.toFixed(6)} ${selected.symbol}`);
      } else {
        if (!holding || holding.amount <= 0) throw new Error("Нет монет для продажи");
        const coinAmount = cr / selected.price;
        if (coinAmount > holding.amount) throw new Error("Недостаточно монет");
        await updateBalance(+cr);
        const newAmount = holding.amount - coinAmount;
        if (newAmount < 1e-9) {
          await supabase.from("crypto_holdings").delete().eq("id", holding.id);
        } else {
          await supabase.from("crypto_holdings")
            .update({ amount: newAmount, updated_at: new Date().toISOString() })
            .eq("id", holding.id);
        }
        setMsg(`Продано ${coinAmount.toFixed(6)} ${selected.symbol}`);
      }
      setAmountCr("");
      await loadHoldings();
    } catch (e: any) {
      setMsg(e?.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const portfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const c = coins.find((x) => x.id === h.coin_id);
      return sum + (c ? c.price * h.amount : 0);
    }, 0);
  }, [holdings, coins]);

  return (
    <div>
      <PageHeader title="Крипто Біржа" subtitle="Купуй та продавай монети у реальному часі" />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* MAIN: list + chart */}
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

          {/* Selected coin chart */}
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
              <div className="mt-3 h-40 w-full overflow-hidden rounded-xl border border-border bg-black/30">
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
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Пошук..."
                  className="w-32 bg-transparent text-xs outline-none sm:w-48"
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <div>Монета</div>
                <div className="hidden sm:block">Графік</div>
                <div className="text-right">Ціна</div>
                <div className="text-right">24г</div>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">Немає монет</div>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border/40 px-3 py-3 text-left transition hover:bg-primary/5 ${selectedId === c.id ? "bg-primary/10" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={c.image_url} alt={c.symbol} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{c.name}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">{c.symbol}</div>
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <Sparkline data={c.history} up={c.change_24h >= 0} />
                    </div>
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

        {/* SIDE: trade panel */}
        <div className="space-y-4">
          <div className="glass-strong rounded-2xl p-4">
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setSide("buy")}
                className="flex-1 rounded-xl py-2 text-sm font-semibold transition"
                style={{
                  background: side === "buy" ? "var(--gradient-primary)" : "transparent",
                  color: side === "buy" ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  boxShadow: side === "buy" ? "var(--shadow-glow)" : "none",
                }}
              >Купити</button>
              <button
                onClick={() => setSide("sell")}
                className="flex-1 rounded-xl py-2 text-sm font-semibold transition"
                style={{
                  background: side === "sell" ? "linear-gradient(135deg, oklch(0.65 0.24 25), oklch(0.55 0.22 20))" : "transparent",
                  color: side === "sell" ? "var(--primary-foreground)" : "var(--muted-foreground)",
                }}
              >Продати</button>
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
                      <button className="text-primary" onClick={() => setAmountCr(String((holding.amount * selected.price).toFixed(2)))}>MAX</button>
                    )}
                    {side === "buy" && (
                      <button className="text-primary" onClick={() => setAmountCr(String(user?.balance ?? 0))}>MAX</button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={amountCr}
                    onChange={(e) => setAmountCr(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl bg-input px-4 py-3 font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>≈ {amountCr ? (Number(amountCr) / selected.price).toFixed(6) : "0"} {selected.symbol}</span>
                    {holding && <span>В тебе: {holding.amount.toFixed(6)}</span>}
                  </div>
                </div>

                <button
                  onClick={trade}
                  disabled={busy}
                  className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50"
                  style={side === "sell" ? { background: "linear-gradient(135deg, oklch(0.65 0.24 25), oklch(0.55 0.22 20))" } : undefined}
                >
                  <ArrowDownUp className="h-4 w-4" />
                  {busy ? "..." : side === "buy" ? "Купити" : "Продати"}
                </button>
                {msg && <div className="rounded-xl bg-secondary/40 px-3 py-2 text-center text-xs">{msg}</div>}
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
                    <button
                      key={h.id}
                      onClick={() => setSelectedId(c.id)}
                      className="glass flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-primary/5"
                    >
                      <img src={c.image_url} alt={c.symbol} className="h-8 w-8 rounded-full" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs font-semibold">{c.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{h.amount.toFixed(6)} {c.symbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs">${value.toFixed(2)}</div>
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

function BigChart({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 600, h = 160;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 8) - 4}`).join(" ");
  const color = up ? "var(--primary)" : "var(--destructive)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#cg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
