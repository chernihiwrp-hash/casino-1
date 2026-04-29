import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Zap, History } from "lucide-react";
import rocket3d from "@/assets/rocket-3d.webp";

type Phase = "idle" | "flying" | "crashed" | "cashed";

// ─── ROCKET (flame is rendered BEHIND the rocket image, +2px lower) ───────────

function RocketSVG({ phase }: { phase: Phase }) {
  const flying = phase === "flying";
  const crashed = phase === "crashed";

  return (
    <>
      <style>{`
        @keyframes rFloat {
          0%,100% { transform: translateY(0) rotate(-1.5deg); }
          50%      { transform: translateY(-16px) rotate(1.5deg); }
        }
        @keyframes rIdle {
          0%,100% { transform: translateY(0) rotate(-0.5deg); }
          50%      { transform: translateY(-6px) rotate(0.5deg); }
        }
        @keyframes rCrash {
          0%   { transform: rotate(0deg) translate(0,0); opacity:1; }
          40%  { transform: rotate(35deg) translate(30px,20px); opacity:.9; }
          100% { transform: rotate(90deg) translate(70px,90px); opacity:0.15; }
        }
        @keyframes rGlow {
          0%,100% { filter: drop-shadow(0 0 18px oklch(from var(--primary) l c h/.55))
                            drop-shadow(0 0 38px oklch(from var(--primary) l c h/.25)); }
          50%     { filter: drop-shadow(0 0 28px oklch(from var(--primary) l c h/.85))
                            drop-shadow(0 0 65px oklch(from var(--primary) l c h/.45)); }
        }
        @keyframes fMain {
          0%,100% { transform: scaleY(1) scaleX(1); }
          40%     { transform: scaleY(1.35) scaleX(.8); }
          70%     { transform: scaleY(.85) scaleX(1.15); }
        }
        @keyframes fInner {
          0%,100% { transform: scaleY(1); }
          50%     { transform: scaleY(1.5) scaleX(.72); }
        }
        @keyframes fTip {
          0%,100% { transform: scaleY(1); opacity:.85; }
          50%     { transform: scaleY(1.8); opacity:1; }
        }
        @keyframes exhaustDot {
          0%   { transform: translateY(0) scale(1); opacity:.9; }
          100% { transform: translateY(60px) scale(0); opacity:0; }
        }
        .r-body {
          animation: ${flying ? "rFloat 2s ease-in-out infinite, rGlow 1.4s ease-in-out infinite"
                     : crashed ? "rCrash .65s cubic-bezier(.4,0,1,1) forwards"
                     : "rIdle 3.5s ease-in-out infinite"};
        }
        .f-main  { animation: ${flying ? "fMain  .11s ease-in-out infinite" : "none"}; transform-origin: top center; }
        .f-inner { animation: ${flying ? "fInner .075s ease-in-out infinite" : "none"}; transform-origin: top center; }
        .f-tip   { animation: ${flying ? "fTip   .06s ease-in-out infinite" : "none"}; transform-origin: top center; }
      `}</style>

      <div className="r-body" style={{ display: "inline-block", position: "relative" }}>
        {/* FLAME first in DOM => rendered UNDER the rocket image. Also +2px lower. */}
        <svg
          viewBox="0 0 80 80"
          width="80"
          height="80"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: "absolute",
            left: "50%",
            bottom: -35,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <defs>
            <linearGradient id="flo" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#ff6500" stopOpacity="1" />
              <stop offset="55%"  stopColor="#ff2200" stopOpacity=".85" />
              <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fli" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#ffff99" stopOpacity="1" />
              <stop offset="50%"  stopColor="#ffaa00" stopOpacity=".9" />
              <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="flt" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="white"   stopOpacity="1" />
              <stop offset="100%" stopColor="#ffff66" stopOpacity="0" />
            </linearGradient>
            <filter id="rglow">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {flying && [0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              cx={40 + (i % 2 === 0 ? -4 : 4)}
              cy={10 + i * 5}
              r={2.6 - i * 0.45}
              fill="oklch(from var(--primary) l c h)"
              opacity={0.7 - i * 0.14}
              style={{ animation: `exhaustDot ${0.35 + i * 0.12}s ease-out ${i * 0.07}s infinite` }}
            />
          ))}

          {(flying || phase === "idle") && (
            <g transform="translate(40 10)">
              <g className="f-main">
                <ellipse cx="0" cy="0"
                  rx={flying ? 11 : 5} ry={flying ? 30 : 9}
                  fill="url(#flo)" opacity={flying ? 0.92 : 0.4} />
              </g>
              <g className="f-inner">
                <ellipse cx="0" cy="0"
                  rx={flying ? 7 : 3} ry={flying ? 22 : 6}
                  fill="url(#fli)" opacity={flying ? 0.95 : 0.5} />
              </g>
              <g className="f-tip">
                <ellipse cx="0" cy="0"
                  rx={flying ? 3.5 : 1.5} ry={flying ? 13 : 3}
                  fill="url(#flt)" opacity={flying ? 1 : 0.6}
                  filter="url(#rglow)" />
              </g>
            </g>
          )}
        </svg>

        {/* Rocket image — rendered ON TOP of the flame */}
        <img
          src={rocket3d}
          alt="Ракета"
          width={130}
          height={170}
          draggable={false}
          style={{
            display: "block",
            width: 130,
            height: "auto",
            userSelect: "none",
            pointerEvents: "none",
            position: "relative",
            zIndex: 1,
          }}
        />
      </div>
    </>
  );
}

// ─── RICH SPACE BACKGROUND (planets + stars + parallax, NO comets) ───────────

function SpaceBackground({ phase, mult }: { phase: Phase; mult: number }) {
  const starsBack = useRef(
    Array.from({ length: 60 }, (_, i) => ({
      x: (i * 137.508) % 100,
      y: (i * 71.3) % 100,
      size: 0.5 + (i % 3) * 0.25,
      delay: (i * 0.31) % 6,
      dur: 2.4 + (i % 5),
    }))
  );
  const starsMid = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      x: (i * 211.7) % 100,
      y: (i * 53.9) % 100,
      size: 0.9 + (i % 3) * 0.4,
      delay: (i * 0.47) % 5,
      dur: 1.6 + (i % 4),
    }))
  );

  const danger = mult > 4;
  const extreme = mult > 8;
  const shift = Math.min(mult * 2, 40);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-3xl" style={{ zIndex: 0 }}>
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity:.1; transform:scale(1); }
          50%      { opacity:.95; transform:scale(1.5); }
        }
        @keyframes shoot {
          0%   { transform:translateX(-80px) translateY(-25px) rotate(-20deg); opacity:0; }
          8%   { opacity:1; }
          92%  { opacity:.9; }
          100% { transform:translateX(380px) translateY(120px) rotate(-20deg); opacity:0; }
        }
        @keyframes nebPulse {
          0%,100% { transform:scale(1);    opacity:.22; }
          50%     { transform:scale(1.06); opacity:.42; }
        }
        @keyframes dangerPulse {
          0%,100% { opacity:.35; }
          50%     { opacity:.7; }
        }
        @keyframes extremeFlash {
          0%,100% { opacity:0; }
          45%,55% { opacity:.18; }
        }
        @keyframes groundGlow {
          0%,100% { opacity:.5; }
          50%     { opacity:.85; }
        }
        @keyframes thrusterRing {
          0%   { transform:scale(.7); opacity:.8; }
          100% { transform:scale(2.3); opacity:0; }
        }
        @keyframes planetFloat {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%     { transform: translateY(-8px) rotate(2deg); }
        }
        @keyframes planetFloatRev {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%     { transform: translateY(6px) rotate(-2deg); }
        }
        @keyframes ringSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        position: "absolute", inset: 0,
        background:
          "radial-gradient(ellipse at 35% 30%, oklch(0.22 0.10 260/.7) 0%, transparent 55%)," +
          "radial-gradient(ellipse at 70% 15%, oklch(0.18 0.08 295/.5) 0%, transparent 45%)," +
          "radial-gradient(ellipse at 20% 85%, oklch(from var(--primary) l c h/.18) 0%, transparent 55%)," +
          "oklch(0.07 0.022 240)",
      }} />

      {danger && (
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, oklch(0.65 0.28 25/${extreme ? ".25" : ".12"}) 0%, transparent 65%)`,
          animation: "dangerPulse .7s ease-in-out infinite",
        }} />
      )}

      {extreme && (
        <div style={{
          position: "absolute", inset: 0,
          background: "oklch(1 0 0/.15)",
          animation: "extremeFlash .5s ease-in-out infinite",
        }} />
      )}

      <div style={{
        position: "absolute", top: "8%", left: "5%", width: "55%", height: "48%",
        background: "radial-gradient(ellipse, oklch(from var(--primary) l c h/.22), transparent 70%)",
        animation: "nebPulse 9s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "50%", right: "0%", width: "42%", height: "35%",
        background: "radial-gradient(ellipse, oklch(.55 .18 320/.14), transparent 70%)",
        animation: "nebPulse 13s ease-in-out infinite reverse",
      }} />

      <div style={{
        position: "absolute", inset: 0,
        transform: `translate(${-shift * 0.15}px, ${shift * 0.1}px)`,
        transition: "transform .8s ease-out",
      }}>
        <div style={{
          position: "absolute", top: "8%", right: "6%",
          width: 110, height: 110,
          animation: "planetFloat 11s ease-in-out infinite",
        }}>
          <div style={{
            width: "100%", height: "100%", borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 28%, oklch(0.78 0.14 80) 0%, oklch(0.5 0.12 50) 50%, oklch(0.22 0.08 35) 100%)",
            boxShadow:
              "inset -14px -10px 22px oklch(0 0 0/.55), 0 0 40px oklch(from var(--primary) l c h/.25)",
          }} />
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: 180, height: 36,
            marginLeft: -90, marginTop: -18,
            borderRadius: "50%",
            border: "3px solid oklch(0.78 0.10 80/.55)",
            borderBottomColor: "oklch(0.78 0.10 80/.18)",
            transform: "rotate(-22deg)",
            boxShadow: "0 0 12px oklch(0.78 0.10 80/.3)",
            animation: "ringSpin 60s linear infinite",
          }} />
        </div>

        <div style={{
          position: "absolute", top: "55%", left: "8%",
          width: 56, height: 56, borderRadius: "50%",
          background:
            "radial-gradient(circle at 32% 30%, oklch(0.85 0.06 220) 0%, oklch(0.55 0.10 230) 60%, oklch(0.18 0.06 240) 100%)",
          boxShadow:
            "inset -8px -6px 14px oklch(0 0 0/.55), 0 0 22px oklch(0.55 0.10 230/.45)",
          animation: "planetFloatRev 14s ease-in-out infinite",
        }} />
      </div>

      <div style={{
        position: "absolute", inset: 0,
        transform: `translate(${-shift * 0.4}px, ${shift * 0.25}px)`,
        transition: "transform .8s ease-out",
      }}>
        <div style={{
          position: "absolute", bottom: "12%", right: "14%",
          width: 70, height: 70, borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 30%, oklch(0.72 0.18 30) 0%, oklch(0.45 0.15 25) 60%, oklch(0.18 0.08 25) 100%)",
          boxShadow:
            "inset -10px -8px 18px oklch(0 0 0/.6), 0 0 28px oklch(0.6 0.18 25/.4)",
          animation: "planetFloat 9s ease-in-out infinite",
        }} />

        <div style={{
          position: "absolute", top: "18%", left: "16%",
          width: 28, height: 28, borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.78 0.14 320) 0%, oklch(0.42 0.12 320) 70%, oklch(0.18 0.06 320) 100%)",
          boxShadow:
            "inset -4px -3px 8px oklch(0 0 0/.55), 0 0 14px oklch(0.55 0.18 320/.5)",
          animation: "planetFloatRev 7s ease-in-out infinite",
        }} />
      </div>

      <div style={{
        position: "absolute", inset: 0,
        transform: `translate(${-shift * 0.05}px, ${shift * 0.05}px)`,
        transition: "transform .8s ease-out",
      }}>
        {starsBack.current.map((s, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: "50%", background: "white",
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }} />
        ))}
      </div>

      <div style={{
        position: "absolute", inset: 0,
        transform: `translate(${-shift * 0.2}px, ${shift * 0.15}px)`,
        transition: "transform .8s ease-out",
      }}>
        {starsMid.current.map((s, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: "50%", background: "white",
            boxShadow: "0 0 4px white",
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }} />
        ))}
      </div>

      {/* Comets and shooting stars removed per request */}

      {phase === "flying" && [0, 1, 2].map((i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: "10%", left: "50%",
          width: 30, height: 30,
          marginLeft: -15, marginBottom: -15,
          borderRadius: "50%",
          border: `1.5px solid oklch(from var(--primary) l c h/.6)`,
          animation: `thrusterRing 1.2s ease-out ${i * 0.4}s infinite`,
        }} />
      ))}

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "28%",
        background: `linear-gradient(to top, oklch(from var(--primary) l c h/${phase === "flying" ? ".45" : ".15"}), transparent)`,
        animation: phase === "flying" ? "groundGlow 1.1s ease-in-out infinite" : "none",
        transition: "opacity .5s",
      }} />

      {phase === "crashed" && (
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 60% 70%, oklch(.75 .28 25/.5), transparent 50%)",
          animation: "dangerPulse .3s ease-in-out 3",
        }} />
      )}
    </div>
  );
}


// ─── MAIN GAME ────────────────────────────────────────────────────────────────

function RocketGame() {
  const { user, updateBalance } = useAuth();
  const [bet, setBet] = useState(50);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mult, setMult] = useState(1);
  const [crashAt, setCrashAt] = useState(0);
  const [history, setHistory] = useState<{ val: number; won: boolean }[]>([]);
  const [msg, setMsg] = useState("");
  const [winAmount, setWinAmount] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);

  const balance = user?.balance ?? 0;

  const launch = async () => {
    if (bet <= 0 || bet > balance || phase === "flying") return;
    setMsg(""); setWinAmount(0);
    try { await updateBalance(-bet); }
    catch (e: any) { setMsg(e.message); return; }

    const r = Math.random();
    const target = Math.max(1.01, +(0.99 / (1 - r)).toFixed(2));
    setCrashAt(target);
    setPhase("flying");
    setMult(1);
    start.current = performance.now();

    const tick = (t: number) => {
      const elapsed = (t - start.current) / 1000;
      const m = +(Math.pow(1.07, elapsed * 4)).toFixed(2);
      if (m >= target) {
        setMult(target);
        setPhase("crashed");
        setHistory(h => [{ val: target, won: false }, ...h].slice(0, 12));
        return;
      }
      setMult(m);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const cashout = async () => {
    if (phase !== "flying") return;
    if (raf.current) cancelAnimationFrame(raf.current);
    const m = mult;
    setPhase("cashed");
    const win = Math.floor(bet * m);
    setWinAmount(win);
    try {
      await updateBalance(win);
      setHistory(h => [{ val: m, won: true }, ...h].slice(0, 12));
    } catch (e: any) { setMsg(e.message); }
  };

  const reset = () => { setPhase("idle"); setMult(1); setMsg(""); setWinAmount(0); };

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const multColor =
    phase === "crashed" ? "var(--destructive)" :
    phase === "cashed"  ? "var(--primary)" :
    mult < 2  ? "var(--primary)" :
    mult < 4  ? "oklch(.82 .19 90)"  :
    mult < 8  ? "oklch(.78 .22 50)"  :
    "oklch(.7 .28 15)";

  const dangerLevel = phase === "flying" ? Math.min(1, (mult - 1) / 9) : 0;

  return (
    <div>
      <style>{`
        @keyframes multPop {
          0%,100% { transform:scale(1); }
          50%     { transform:scale(1.05); }
        }
        @keyframes winBurst {
          0%   { transform:scale(.75); opacity:0; }
          60%  { transform:scale(1.08); }
          100% { transform:scale(1); opacity:1; }
        }
        @keyframes cashPulse {
          0%,100% { box-shadow:0 4px 20px oklch(from var(--primary) l c h/.4); }
          50%     { box-shadow:0 4px 40px oklch(from var(--primary) l c h/.85),0 0 70px oklch(from var(--primary) l c h/.35); }
        }
        @keyframes dangerBtn {
          0%,100% { box-shadow:0 4px 20px oklch(.7 .28 15/.5); }
          50%     { box-shadow:0 4px 40px oklch(.7 .28 15/.9),0 0 60px oklch(.7 .28 15/.4); }
        }
      `}</style>

      <PageHeader title="Ракета" subtitle="Забери куш до крашу" />

      <div className="glass-strong relative mb-4 overflow-hidden rounded-3xl" style={{ minHeight: 400 }}>
        <SpaceBackground phase={phase} mult={mult} />

        <div className="relative flex flex-col items-center justify-center py-10" style={{ zIndex: 1 }}>
          <RocketSVG phase={phase} />

          <div className="mt-6 text-center">
            {phase === "cashed" && winAmount > 0 ? (
              <div style={{ animation: "winBurst .45s ease-out" }}>
                <div className="font-mono font-bold tabular-nums"
                  style={{
                    fontSize:"clamp(2.4rem,9vw,3.8rem)",
                    color:"var(--primary)",
                    textShadow:"0 0 30px oklch(from var(--primary) l c h/.8)",
                  }}>
                  +{winAmount.toLocaleString()} CR
                </div>
                <div className="mt-1 text-sm font-semibold text-primary opacity-80">
                  x{mult.toFixed(2)} — ВИВЕДЕНО
                </div>
              </div>
            ) : (
              <>
                <div className="font-mono font-bold tabular-nums transition-colors duration-300"
                  style={{
                    fontSize:"clamp(2.8rem,10vw,4.5rem)",
                    color: multColor,
                    textShadow:`0 0 28px ${multColor}cc, 0 0 55px ${multColor}44`,
                    animation: phase==="flying" ? "multPop .55s ease-in-out infinite" : "none",
                  }}>
                  x{mult.toFixed(2)}
                </div>
                {phase === "crashed" && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold"
                    style={{ color:"var(--destructive)" }}>
                    <AlertTriangle className="h-4 w-4" />
                    КРАШ @ x{crashAt}
                  </div>
                )}
                {phase === "idle" && (
                  <p className="mt-2 text-xs text-muted-foreground uppercase tracking-widest">
                    Готовий до старту
                  </p>
                )}
                {phase === "flying" && dangerLevel > 0.1 && (
                  <div className="mt-3 mx-auto w-32 h-1.5 rounded-full overflow-hidden"
                    style={{ background:"var(--muted)" }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{
                        width:`${dangerLevel*100}%`,
                        background: dangerLevel < .4
                          ? "var(--primary)"
                          : dangerLevel < .7
                          ? "oklch(.78 .22 50)"
                          : "oklch(.7 .28 15)",
                      }} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="glass mb-3 flex flex-wrap items-center gap-2 rounded-2xl p-4">
        <div className="flex items-center gap-2 mr-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Ставка</span>
          <input
            type="number" min={1} max={balance} value={bet}
            disabled={phase === "flying"}
            onChange={e => setBet(Math.max(1, Number(e.target.value) || 0))}
            className="w-24 rounded-xl bg-input px-3 py-2 text-center font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[10, 50, 100, 500].map(v => (
            <button key={v} onClick={() => setBet(Math.min(v, balance))} disabled={phase==="flying"}
              className="glass rounded-lg px-3 py-1.5 text-xs font-mono font-semibold hover:bg-primary/15 disabled:opacity-40 transition">
              {v}
            </button>
          ))}
          <button onClick={() => setBet(Math.floor(balance/2))} disabled={phase==="flying"}
            className="glass rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-primary/15 disabled:opacity-40 transition">½</button>
          <button onClick={() => setBet(balance)} disabled={phase==="flying"}
            className="glass rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-primary/15 disabled:opacity-40 transition">MAX</button>
        </div>
      </div>

      <div className="flex gap-3">
        {phase === "flying" ? (
          <button onClick={cashout}
            className="btn-primary flex-1 rounded-2xl py-4 text-base font-bold flex items-center justify-center gap-2"
            style={{
              animation: mult > 5 ? "dangerBtn .6s ease-in-out infinite" : "cashPulse .9s ease-in-out infinite",
              background: mult > 5
                ? "linear-gradient(135deg, oklch(.74 .25 28), oklch(.6 .24 15))"
                : undefined,
            }}>
            <CheckCircle className="h-5 w-5" />
            Забрати {Math.floor(bet * mult).toLocaleString()} CR
          </button>
        ) : (phase === "crashed" || phase === "cashed") ? (
          <button onClick={reset} className="btn-primary flex-1 rounded-2xl py-4 text-base font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Нова гра
          </button>
        ) : (
          <button onClick={launch} disabled={bet > balance || bet <= 0}
            className="btn-primary flex-1 rounded-2xl py-4 text-base font-bold flex items-center justify-center gap-2">
            <Zap className="h-5 w-5" />
            Запустити ({bet.toLocaleString()} CR)
          </button>
        )}
      </div>

      {msg && (
        <div className="glass mt-4 rounded-xl p-3 text-center text-sm font-semibold flex items-center justify-center gap-2"
          style={{ color: "var(--destructive)" }}>
          <AlertTriangle className="h-4 w-4" /> {msg}
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-3 px-1 text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" /> Історія
        </h3>
        <div className="flex flex-wrap gap-2">
          {history.length === 0 && (
            <span className="text-xs text-muted-foreground">Поки порожньо</span>
          )}
          {history.map((h, i) => (
            <span key={i}
              className="glass rounded-lg px-3 py-1.5 font-mono text-xs font-semibold flex items-center gap-1 transition"
              style={{
                color: h.won ? "var(--primary)" : h.val >= 2 ? "oklch(.78 .2 70)" : "var(--muted-foreground)",
                border: h.won
                  ? "1px solid oklch(from var(--primary) l c h/.35)"
                  : h.val >= 2
                  ? "1px solid oklch(.78 .2 70/.25)"
                  : "1px solid var(--border)",
              }}>
              {h.won && <CheckCircle className="h-3 w-3" />}
              {!h.won && h.val >= 2 && <TrendingUp className="h-3 w-3" />}
              x{h.val.toFixed(2)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RocketGame;
