import { useMemo, useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { useNftPool, useUserNfts, giveNftToUser, removeOwnedNft } from "@/lib/nft";
import { Sparkles, Target, Package, Wallet } from "lucide-react";
import type { NftGift } from "@/lib/supabase";
import { setNavLocked } from "@/lib/lock";


function UpgraderPage() {
  const { user } = useAuth();
  const { pool } = useNftPool();
  const { items, reload } = useUserNfts(user?.username);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; nft?: NftGift } | null>(null);
  const [msg, setMsg] = useState("");
  const [selectedSnapshot, setSelectedSnapshot] = useState<(NftGift & { ownerRowId: string }) | null>(null);
  const [targetSnapshot, setTargetSnapshot] = useState<NftGift | null>(null);

  // FIX BUG 1: track the real CSS rotation value so each spin always goes forward
  const currentRotationRef = useRef(0);
  const pointerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => setNavLocked(false), []);

  const selected = useMemo(() => items.find((i) => i.ownerRowId === selectedRow), [items, selectedRow]);
  const target = useMemo(() => pool.find((p) => p.id === targetId), [pool, targetId]);

  const chance = useMemo(() => {
    const s = selectedSnapshot || selected;
    const t = targetSnapshot || target;
    if (!s || !t) return 0;
    if (t.price <= s.price) return 0.95;
    return Math.min(0.95, (s.price / t.price) * 0.9);
  }, [selected, target, selectedSnapshot, targetSnapshot]);

  const mult = useMemo(() => {
    const s = selectedSnapshot || selected;
    const t = targetSnapshot || target;
    if (!s || !t || s.price === 0) return 0;
    return +(t.price / s.price).toFixed(2);
  }, [selected, target, selectedSnapshot, targetSnapshot]);

  const poolFiltered = useMemo(() => {
    const s = selected;
    if (!s) return pool;
    return pool.filter((p) => p.price > s.price).sort((a, b) => a.price - b.price);
  }, [pool, selected]);

  const upgrade = async () => {
    if (!user || !selected || !target || spinning) return;

    const snapSelected = { ...selected };
    const snapTarget = { ...target };
    setSelectedSnapshot(snapSelected);
    setTargetSnapshot(snapTarget);

    setMsg(""); setResult(null); setSpinning(true);
    setNavLocked(true);

    const chanceVal = snapTarget.price > 0
      ? Math.min(0.95, (snapSelected.price / snapTarget.price) * 0.9)
      : 0.95;
    const won = Math.random() < chanceVal;

    // Win arc starts at 0° (12-o'clock). Pointer points UP at rotation=0.
    // Win zone: [0 .. winArcDeg), Loss zone: [winArcDeg .. 360)
    const winArcDeg = chanceVal * 360;
    const MARGIN = 4;
    const landing = won
      ? MARGIN + Math.random() * (winArcDeg - MARGIN * 2)
      : winArcDeg + MARGIN + Math.random() * (360 - winArcDeg - MARGIN * 2);

    const prev = currentRotationRef.current;
    // Always spin at least 5 full rotations forward, then land precisely
    const to = prev + 360 * 5 + ((landing - prev % 360) + 360) % 360;
    currentRotationRef.current = to;

    const el = pointerRef.current;
    if (el) {
      el.getAnimations().forEach((a) => a.cancel());
      const anim = el.animate(
        [
          { transform: `rotate(${prev}deg)` },
          { transform: `rotate(${to}deg)` },
        ],
        { duration: 3200, easing: "cubic-bezier(0.2, 0.85, 0.25, 1)", fill: "forwards" },
      );
      anim.addEventListener("finish", () => {
        el.style.transform = `rotate(${to}deg)`;
      });
    }

    setTimeout(async () => {
      try {
        try {
          await removeOwnedNft(snapSelected.ownerRowId);
        } catch (e: any) {
          setMsg("Помилка: не вдалося спалити NFT (" + (e?.message || "RLS") + ")");
          setSpinning(false);
          setNavLocked(false);
          setSelectedSnapshot(null);
          setTargetSnapshot(null);
          setSelectedRow(null);
          setTargetId(null);
          return;
        }

        if (won) {
          try {
            await giveNftToUser(user.username, snapTarget.id);
            setResult({ won: true, nft: snapTarget });
            setMsg(`Успіх! Отримано: ${snapTarget.name}`);
          } catch (e: any) {
            setMsg("Помилка видачі NFT: " + (e?.message || "невідома"));
          }
        } else {
          setResult({ won: false });
          setMsg("Не пощастило — обидва NFT згоріли");
        }
      } finally {
        setSpinning(false);
        setNavLocked(false);
        setSelectedSnapshot(null);
        setTargetSnapshot(null);
        setSelectedRow(null);
        setTargetId(null);
        await reload();
      }
    }, 3200);
  };

  const displaySelected = spinning ? selectedSnapshot : selected;
  const displayTarget = spinning ? targetSnapshot : target;
  const winArcDeg = chance * 360;

  return (
    <div>
      <PageHeader title="NFT Апгрейд" subtitle="Выбери свой NFT и цель — прокачай в более дорогой" />

      <div className="glass mb-4 flex items-center gap-2 rounded-2xl px-4 py-3">
        <Wallet className="h-4 w-4 text-primary" />
        <span className="text-sm text-muted-foreground">Баланс:</span>
        <span className="font-mono font-bold text-base" style={{ color: "var(--primary)" }}>
          {(user?.balance ?? 0).toLocaleString()} CR
        </span>
      </div>

      <style>{`
        @keyframes ringPulse {
          0%, 100% { filter: drop-shadow(0 0 8px var(--primary)); }
          50% { filter: drop-shadow(0 0 20px var(--primary)); }
        }
        .ring-pulse { animation: ringPulse 2s ease-in-out infinite; }
      `}</style>

      <div className="glass-strong rounded-3xl p-6">
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          {/* Your NFT */}
          <div className="glass rounded-2xl p-4 text-center">
            <div className="mb-2 flex items-center justify-center gap-1 text-xs uppercase text-muted-foreground">
              <Package className="h-3 w-3" /> Твой NFT
            </div>
            {displaySelected ? (
              <>
                <img
                  src={displaySelected.image_url}
                  alt={displaySelected.name}
                  className="mx-auto h-28 w-28 rounded-xl object-cover ring-2 ring-primary/60"
                  style={{
                    opacity: result ? 0.25 : 1,
                    filter: result ? "grayscale(1)" : "none",
                    transition: "all .4s ease",
                  }}
                />
                <div className="mt-2 truncate text-sm font-semibold">{displaySelected.name}</div>
                <div className="font-mono text-xs text-primary">{displaySelected.price} CR</div>
                {result && (
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-destructive font-semibold">
                    🔥 згорів
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                ↓ Выбери снизу
              </div>
            )}
          </div>

          {/* Wheel */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative h-36 w-36">
              {/* Wheel SVG — -rotate-90 so 0° is at 12-o'clock */}
              <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90 ring-pulse">
                {/* Loss zone (full ring background) */}
                <circle cx="60" cy="60" r="54" fill="none"
                  stroke="#ef444440" strokeWidth="12" />
                {/* Win zone — sharp edges, no linecap */}
                {chance > 0 && (
                  <circle cx="60" cy="60" r="54" fill="none"
                    stroke="var(--primary)"
                    strokeWidth="12"
                    strokeLinecap="butt"
                    strokeDasharray={`${(winArcDeg / 360) * 339.29} 339.29`}
                  />
                )}
                {/* Sharp border line at win/loss boundary */}
                {chance > 0 && chance < 1 && (
                  <>
                    {/* Line at start (0°) */}
                    <line x1="60" y1="6" x2="60" y2="18"
                      stroke="white" strokeWidth="2" opacity="0.7" />
                    {/* Line at win-arc end — rotate via transform */}
                    <line x1="60" y1="6" x2="60" y2="18"
                      stroke="white" strokeWidth="2" opacity="0.7"
                      transform={`rotate(${winArcDeg}, 60, 60)`} />
                  </>
                )}
              </svg>

              {/* Pointer — centred, rotates around centre of wheel */}
              <div
                ref={pointerRef}
                className="pointer-events-none absolute inset-0 flex items-start justify-center"
                style={{ transform: "rotate(0deg)", transformOrigin: "50% 50%" }}
              >
                {/* Triangle pointing UP toward 12-o'clock */}
                <div style={{
                  marginTop: "4px",
                  width: 0, height: 0,
                  borderLeft: "7px solid transparent",
                  borderRight: "7px solid transparent",
                  borderBottom: "14px solid white",
                  filter: "drop-shadow(0 0 5px var(--primary))",
                }} />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-mono text-2xl font-bold text-primary glow-text">
                  {(chance * 100).toFixed(1)}%
                </div>
                {mult > 0 && (
                  <div className="font-mono text-[10px] text-muted-foreground">x{mult}</div>
                )}
              </div>
            </div>
          </div>

          {/* Target NFT */}
          <div className="glass rounded-2xl p-4 text-center">
            <div className="mb-2 flex items-center justify-center gap-1 text-xs uppercase text-muted-foreground">
              <Target className="h-3 w-3" /> Цель
            </div>
            {displayTarget ? (
              <>
                <img
                  src={displayTarget.image_url}
                  alt={displayTarget.name}
                  className="mx-auto h-28 w-28 rounded-xl object-cover ring-2"
                  style={{
                    opacity: result && !result.won ? 0.25 : 1,
                    filter: result && !result.won ? "grayscale(1)" : "none",
                    transition: "all .4s ease",
                  }}
                />
                <div className="mt-2 truncate text-sm font-semibold">{displayTarget.name}</div>
                <div className="font-mono text-xs text-primary">{displayTarget.price} CR</div>
                {result?.won && (
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-primary font-semibold">
                    ✨ твоє!
                  </div>
                )}
                {result && !result.won && (
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-destructive font-semibold">
                    🔥 згорів
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                ↓ Выбери справа
              </div>
            )}
          </div>
        </div>

        <button
          onClick={upgrade}
          disabled={!selected || !target || spinning}
          className="btn-primary mt-6 w-full rounded-xl py-3 text-sm"
        >
          <Sparkles className="mr-1 inline h-4 w-4" />
          {spinning ? "Прокачиваем..." : !selected ? "Выбери свой NFT" : !target ? "Выбери целевой NFT" : `Апгрейд → ${target.name}`}
        </button>

        {msg && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-center text-sm ${
            result?.won ? "bg-primary/15 text-primary" : result && !result.won ? "bg-destructive/15 text-destructive" : "bg-secondary/40"
          }`}>{msg}</div>
        )}
      </div>

      {/* FIX BUG 2: block tab switching while spinning via pointer-events + visual dimming */}
      <div
        className="mt-6 grid gap-4 md:grid-cols-2"
        style={{
          pointerEvents: spinning ? "none" : "auto",
          opacity: spinning ? 0.45 : 1,
          transition: "opacity 0.3s ease",
          userSelect: spinning ? "none" : "auto",
        }}
      >
        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Мои NFT ({items.length})</h3>
            <div className="text-[10px] text-muted-foreground">
              {spinning ? "⏳ Дождись результата..." : "кликни чтобы выбрать"}
            </div>
          </div>
          {items.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              Пусто. Открой кейсы, чтобы получить NFT
            </div>
          ) : (
            <div className="grid max-h-[520px] grid-cols-3 gap-2 overflow-y-auto rounded-2xl pr-1">
              {items.map((n) => (
                <button
                  key={n.ownerRowId}
                  onClick={() => { setSelectedRow(n.ownerRowId); setResult(null); setMsg(""); }}
                  disabled={spinning}
                  className={`glass rounded-xl p-2 text-center transition hover:scale-[1.04] disabled:opacity-50 ${
                    selectedRow === n.ownerRowId ? "ring-2 ring-primary shadow-[var(--shadow-glow)]" : ""
                  }`}
                >
                  <img src={n.image_url} alt={n.name} className="mx-auto h-14 w-14 rounded-lg object-cover" loading="lazy" />
                  <div className="mt-1 truncate text-[11px]">{n.name}</div>
                  <div className="font-mono text-[10px] text-primary">{n.price} CR</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
              Цель апгрейда {selected && `(${poolFiltered.length})`}
            </h3>
            <div className="text-[10px] text-muted-foreground">
              {spinning ? "⏳ Дождись результата..." : selected ? "дороже твоего" : "сначала выбери свой"}
            </div>
          </div>
          {!selected ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              ← Сначала выбери свой NFT
            </div>
          ) : poolFiltered.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              Нет NFT дороже твоего 🎉
            </div>
          ) : (
            <div className="grid max-h-[520px] grid-cols-3 gap-2 overflow-y-auto rounded-2xl pr-1">
              {poolFiltered.map((n) => {
                const m = +(n.price / (selected?.price || 1)).toFixed(2);
                return (
                  <button
                    key={n.id}
                    onClick={() => { setTargetId(n.id); setResult(null); setMsg(""); }}
                    disabled={spinning}
                    className={`glass rounded-xl p-2 text-center transition hover:scale-[1.04] disabled:opacity-50 ${
                      targetId === n.id ? "ring-2 ring-primary shadow-[var(--shadow-glow)]" : ""
                    }`}
                  >
                    <img src={n.image_url} alt={n.name} className="mx-auto h-14 w-14 rounded-lg object-cover" loading="lazy" />
                    <div className="mt-1 truncate text-[11px]">{n.name}</div>
                    <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
                      <span className="text-primary">{n.price}</span>
                      <span className="text-muted-foreground">· x{m}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default UpgraderPage;
