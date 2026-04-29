
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { RequireAuth, PageHeader } from "@/components/RequireAuth";


type Color = "red" | "black" | "green";
const NUMBERS: { n: number; c: Color }[] = Array.from({ length: 15 }, (_, i) => {
  const n = i;
  if (n === 0) return { n, c: "green" };
  return { n, c: i % 2 === 0 ? "black" : "red" };
});

function RouletteGame() {
  const { user, updateBalance } = useAuth();
  const [bet, setBet] = useState(50);
  const [pick, setPick] = useState<Color>("red");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ n: number; c: Color } | null>(null);
  const [msg, setMsg] = useState("");
  const [offset, setOffset] = useState(0);

  const balance = user?.balance ?? 0;

  const spin = async () => {
    if (spinning || bet <= 0 || bet > balance) return;
    setMsg(""); setResult(null);
    try { await updateBalance(-bet); } catch (e: any) { setMsg(e.message); return; }
    setSpinning(true);

    const winIdx = Math.floor(Math.random() * NUMBERS.length);
    const w = NUMBERS[winIdx];
    const tileW = 64;
    const cycles = 6;
    const target = cycles * NUMBERS.length * tileW + winIdx * tileW;
    setOffset(target);

    setTimeout(async () => {
      setResult(w);
      setSpinning(false);
      let win = 0;
      if (w.c === pick) win = pick === "green" ? bet * 14 : bet * 2;
      if (win > 0) {
        await updateBalance(win);
        setMsg(`🎉 Випало ${w.n} ${w.c}. Виграш ${win} CR`);
      } else setMsg(`Випало ${w.n} ${w.c}. Удачи в следующий раз.`);
      // reset offset visually after a moment
      setTimeout(() => setOffset((o) => o % (NUMBERS.length * tileW)), 800);
    }, 4200);
  };

  return (
    <div>
      <PageHeader title="Рулетка" subtitle="Red x2 · Black x2 · Zero x14" />

      <div className="glass-strong overflow-hidden rounded-3xl p-6">
        <div className="relative h-20 overflow-hidden rounded-2xl border border-border bg-black/40">
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-1 -translate-x-1/2 bg-primary shadow-[0_0_20px_var(--primary)]" />
          <div
            className="flex h-full"
            style={{
              transform: `translateX(calc(50% - 32px - ${offset}px))`,
              transition: spinning ? "transform 4s cubic-bezier(0.15, 0.85, 0.25, 1)" : "none",
            }}
          >
            {Array.from({ length: 30 }).flatMap((_, k) =>
              NUMBERS.map((t, i) => (
                <div
                  key={`${k}-${i}`}
                  className={`flex h-full w-16 shrink-0 items-center justify-center font-mono text-lg font-bold ${
                    t.c === "red" ? "bg-red-600/80" : t.c === "black" ? "bg-zinc-800" : "bg-emerald-500/80"
                  }`}
                >
                  {t.n}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {(["red", "green", "black"] as Color[]).map((c) => (
            <button
              key={c}
              onClick={() => setPick(c)}
              className={`rounded-xl border-2 py-3 text-sm font-semibold capitalize transition ${
                pick === c ? "border-primary scale-[1.02]" : "border-transparent opacity-70"
              } ${c === "red" ? "bg-red-600/70" : c === "black" ? "bg-zinc-800" : "bg-emerald-500/70"}`}
            >
              {c} {c === "green" ? "x14" : "x2"}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input type="number" min={1} max={balance} value={bet}
            onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 0))}
            className="w-28 rounded-lg bg-input px-3 py-1.5 text-center font-mono text-sm outline-none focus:ring-2 focus:ring-ring" />
          {[10, 50, 100, 500].map((v) => (
            <button key={v} onClick={() => setBet(Math.min(v, balance))} className="glass rounded-lg px-3 py-1.5 text-xs">{v}</button>
          ))}
          <button onClick={spin} disabled={spinning || bet > balance} className="btn-primary ml-auto rounded-xl px-6 py-2.5 text-sm">
            {spinning ? "Крутиться..." : `Крутить ${bet} CR`}
          </button>
        </div>

        {msg && <div className="mt-4 rounded-lg bg-secondary/40 px-3 py-2 text-center text-sm">{msg}</div>}
      </div>
    </div>
  );
}
export default RouletteGame;
