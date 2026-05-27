import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { RequireAuth, PageHeader } from "@/components/RequireAuth";
import { useNftPool, pickWeightedNft, giveNftToUser } from "@/lib/nft";
import { Package, Sparkles, Star, Crown, Gem } from "lucide-react";
import type { NftGift } from "@/lib/supabase";
import { setNavLocked } from "@/lib/lock";

// ─────────────────────────────────────────────────────────────────────────────
// НАЛАШТУВАННЯ КЕЙСІВ
// Замінити image_url на реальні посилання на картинки кейсів
// ─────────────────────────────────────────────────────────────────────────────
const CASES = [
  {
    id: "bum",
    name: "Кейс Бомжа",
    subtitle: "Дешевi NFT для початківців",
    price: 500,
    // 👇 ВСТАВИТИ ПОСИЛАННЯ НА КАРТИНКУ КЕЙСА (замість null)
    image_url: null as string | null,
    accent: "oklch(0.55 0.12 240)",
    glow: "oklch(0.55 0.12 240 / 0.3)",
    bg: "linear-gradient(135deg, oklch(0.18 0.06 240), oklch(0.13 0.03 240))",
    border: "oklch(0.55 0.12 240 / 0.35)",
    icon: Package,
    tier: "common",
    // NFT до 500 CR включно
    maxPrice: 500,
    minPrice: 0,
  },
  {
    id: "mid",
    name: "Кейс Середнячка",
    subtitle: "Середні NFT за нормальну ціну",
    price: 1000,
    // 👇 ВСТАВИТИ ПОСИЛАННЯ НА КАРТИНКУ КЕЙСА (замість null)
    image_url: null as string | null,
    accent: "oklch(0.65 0.18 145)",
    glow: "oklch(0.65 0.18 145 / 0.3)",
    bg: "linear-gradient(135deg, oklch(0.18 0.07 145), oklch(0.13 0.03 145))",
    border: "oklch(0.65 0.18 145 / 0.35)",
    icon: Star,
    tier: "rare",
    // NFT від 500 до 2000 CR
    maxPrice: 2000,
    minPrice: 500,
  },
  {
    id: "rich",
    name: "Кейс Мажора",
    subtitle: "Елітні NFT для обраних",
    price: 2000,
    // 👇 ВСТАВИТИ ПОСИЛАННЯ НА КАРТИНКУ КЕЙСА (замість null)
    image_url: null as string | null,
    accent: "oklch(0.75 0.18 55)",
    glow: "oklch(0.75 0.18 55 / 0.3)",
    bg: "linear-gradient(135deg, oklch(0.20 0.08 55), oklch(0.13 0.04 55))",
    border: "oklch(0.75 0.18 55 / 0.4)",
    icon: Crown,
    tier: "legendary",
    // NFT від 2000 CR
    maxPrice: Infinity,
    minPrice: 2000,
  },
] as const;

type CaseDef = typeof CASES[number];

// ─────────────────────────────────────────────────────────────────────────────

function CaseCard({
  caseDef,
  pool,
  onOpen,
  userBalance,
}: {
  caseDef: CaseDef;
  pool: NftGift[];
  onOpen: (c: CaseDef) => void;
  userBalance: number;
}) {
  const Icon = caseDef.icon;
  const casePool = pool.filter(
    (n) => n.price >= caseDef.minPrice && n.price < caseDef.maxPrice
  );
  const canOpen = userBalance >= caseDef.price && casePool.length > 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl flex flex-col transition-all active:scale-[0.98]"
      style={{ background: caseDef.bg, border: `1px solid ${caseDef.border}`, boxShadow: `0 0 30px ${caseDef.glow}` }}
    >
      {/* Glow top */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${caseDef.accent}, transparent)` }} />

      {/* Картинка кейса */}
      <div
        className="relative flex items-center justify-center"
        style={{ minHeight: 160, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${caseDef.accent}18, transparent)` }}
      >
        {caseDef.image_url ? (
          <img
            src={caseDef.image_url}
            alt={caseDef.name}
            className="h-36 w-36 object-contain drop-shadow-2xl"
            style={{ filter: `drop-shadow(0 0 20px ${caseDef.accent})` }}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2 h-36 w-36 rounded-2xl"
            style={{ background: `${caseDef.accent}12`, border: `1.5px dashed ${caseDef.accent}50` }}
          >
            <Icon className="h-10 w-10 opacity-40" style={{ color: caseDef.accent }} />
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-40" style={{ color: caseDef.accent }}>
              Додай картинку
            </span>
          </div>
        )}
      </div>

      {/* Інфо */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Icon className="h-3.5 w-3.5" style={{ color: caseDef.accent }} />
            <p className="text-sm font-black text-white">{caseDef.name}</p>
          </div>
          <p className="text-[10px]" style={{ color: `${caseDef.accent}` }}>{caseDef.subtitle}</p>
        </div>

        {/* NFT preview мінімальний */}
        <div className="flex gap-1">
          {casePool.slice(0, 5).map((n) => (
            <img
              key={n.id}
              src={n.image_url}
              alt={n.name}
              className="h-8 w-8 rounded-lg object-cover"
              style={{ border: `1px solid ${caseDef.accent}30` }}
            />
          ))}
          {casePool.length > 5 && (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-[9px] font-bold"
              style={{ background: `${caseDef.accent}15`, border: `1px solid ${caseDef.accent}30`, color: caseDef.accent }}>
              +{casePool.length - 5}
            </div>
          )}
        </div>

        {/* Ціна + кнопка */}
        <button
          onClick={() => onOpen(caseDef)}
          disabled={!canOpen}
          className="w-full py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canOpen ? `${caseDef.accent}20` : "oklch(0.15 0 0)",
            border: `1px solid ${caseDef.accent}${canOpen ? "50" : "20"}`,
            color: caseDef.accent,
          }}
        >
          {casePool.length === 0 ? "NFT немає" : `Відкрити · ${caseDef.price} CR`}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CaseOpener({
  caseDef,
  pool,
  onClose,
  user,
  updateBalance,
}: {
  caseDef: CaseDef;
  pool: NftGift[];
  onClose: () => void;
  user: any;
  updateBalance: (d: number) => Promise<void>;
}) {
  const [opening, setOpening] = useState(false);
  const [reel, setReel] = useState<NftGift[]>([]);
  const [won, setWon] = useState<NftGift | null>(null);
  const [msg, setMsg] = useState("");
  const reelRef = useRef<HTMLDivElement | null>(null);

  const casePool = pool.filter(
    (n) => n.price >= caseDef.minPrice && n.price < caseDef.maxPrice
  );

  const openCase = async () => {
    if (opening || casePool.length === 0) return;
    if ((user.balance ?? 0) < caseDef.price) { setMsg("Недостатньо CR"); return; }
    setMsg(""); setWon(null);

    try { await updateBalance(-caseDef.price); } catch (e: any) { setMsg(e.message); return; }

    const winner = pickWeightedNft(casePool)!;
    const winnerIndex = 35;
    const startIndex = 6;
    const startOffset = `translateX(calc(50% - 64px - ${startIndex * 128}px))`;
    const endOffset = `translateX(calc(50% - 64px - ${winnerIndex * 128}px))`;
    const items: NftGift[] = Array.from({ length: 40 }, () => casePool[Math.floor(Math.random() * casePool.length)]);
    items[winnerIndex] = winner;

    setReel(items);
    setOpening(true);
    setNavLocked(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = reelRef.current;
        if (el) {
          el.getAnimations().forEach((a) => a.cancel());
          el.style.transform = startOffset;
          const anim = el.animate(
            [{ transform: startOffset }, { transform: endOffset }],
            { duration: 4300, easing: "cubic-bezier(0.15, 0.9, 0.25, 1)", fill: "forwards" }
          );
          anim.addEventListener("finish", () => { el.style.transform = endOffset; });
        }
      });
    });

    setTimeout(async () => {
      setWon(winner);
      setOpening(false);
      setNavLocked(false);
      try {
        await giveNftToUser(user.username, winner.id);
        setMsg(`Отримано: ${winner.name} · ${winner.price} CR`);
      } catch (e: any) {
        setMsg(`Дроп: ${winner.name} — не збережено в інвентар`);
      }
    }, 4500);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "oklch(0.06 0.01 240)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-4">
        <button onClick={onClose} disabled={opening}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
          style={{ background: "oklch(0.14 0.02 240)", border: "1px solid oklch(0.22 0.03 240)" }}>
          ←
        </button>
        <div>
          <p className="text-sm font-black text-white">{caseDef.name}</p>
          <p className="text-[10px]" style={{ color: caseDef.accent }}>{caseDef.price} CR · {casePool.length} NFT</p>
        </div>
      </div>

      {/* Reel */}
      <div className="px-4 mb-6">
        <div className="relative mx-auto h-32 w-full overflow-hidden rounded-2xl"
          style={{ background: "oklch(0.08 0.02 240)", border: `1px solid ${caseDef.border}`, boxShadow: `0 0 30px ${caseDef.glow}` }}>
          {/* Indicator */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-0.5 -translate-x-1/2"
            style={{ background: caseDef.accent, boxShadow: `0 0 20px ${caseDef.accent}` }} />
          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10"
            style={{ background: "linear-gradient(90deg, oklch(0.08 0.02 240), transparent)" }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10"
            style={{ background: "linear-gradient(-90deg, oklch(0.08 0.02 240), transparent)" }} />

          {reel.length > 0 ? (
            <div ref={reelRef} className="flex h-full" style={{ transform: "translateX(0)" }}>
              {reel.map((n, i) => (
                <div key={i} className="flex h-full w-32 shrink-0 flex-col items-center justify-center gap-1 p-2"
                  style={{ borderRight: `1px solid ${caseDef.accent}20` }}>
                  <img src={n.image_url} alt={n.name} className="h-16 w-16 rounded-xl object-cover" loading="lazy"
                    style={{ border: `1px solid ${caseDef.accent}30` }} />
                  <div className="text-[9px] font-mono" style={{ color: caseDef.accent }}>{n.price} CR</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Package className="h-5 w-5" /> Натисни «Відкрити»
            </div>
          )}
        </div>
      </div>

      {/* Won */}
      {won && !opening && (
        <div className="px-4 mb-4">
          <div className="relative overflow-hidden rounded-2xl p-4 flex items-center gap-4"
            style={{ background: `${caseDef.accent}12`, border: `1px solid ${caseDef.border}`, boxShadow: `0 0 30px ${caseDef.glow}` }}>
            <div className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${caseDef.accent}, transparent)`, transform: "translate(30%, -30%)" }} />
            <img src={won.image_url} alt={won.name} className="h-20 w-20 rounded-xl object-cover shrink-0"
              style={{ border: `2px solid ${caseDef.accent}`, boxShadow: `0 0 20px ${caseDef.glow}` }} />
            <div className="flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: caseDef.accent }}>Дроп!</div>
              <div className="text-base font-black text-white">{won.name}</div>
              <div className="text-sm font-mono mt-0.5" style={{ color: caseDef.accent }}>{won.price} CR</div>
            </div>
            <Sparkles className="h-6 w-6 shrink-0" style={{ color: caseDef.accent }} />
          </div>
        </div>
      )}

      {msg && (
        <div className="px-4 mb-4">
          <div className="rounded-xl px-4 py-2.5 text-sm text-center"
            style={{ background: "oklch(0.14 0.02 240)", border: "1px solid oklch(0.22 0.03 240)", color: "oklch(0.7 0 0)" }}>
            {msg}
          </div>
        </div>
      )}

      {/* Open button */}
      <div className="px-4 mt-auto mb-8">
        <button onClick={openCase}
          disabled={opening || (user?.balance ?? 0) < caseDef.price || casePool.length === 0}
          className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-[0.97] disabled:opacity-40"
          style={{
            background: `${caseDef.accent}20`,
            border: `1.5px solid ${caseDef.accent}50`,
            color: caseDef.accent,
            boxShadow: `0 0 30px ${caseDef.glow}`,
          }}>
          {opening ? "Відкриваємо..." : `Відкрити за ${caseDef.price} CR`}
        </button>

        {/* NFT пул */}
        <div className="mt-4">
          <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "oklch(0.4 0 0)" }}>
            Можливі NFT ({casePool.length})
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {casePool.map((n) => (
              <div key={n.id} className="rounded-xl p-1 text-center"
                style={{ background: `${caseDef.accent}08`, border: `1px solid ${caseDef.accent}20` }}>
                <img src={n.image_url} alt={n.name} className="h-12 w-full rounded-lg object-cover" loading="lazy" />
                <div className="mt-0.5 text-[8px] font-mono truncate" style={{ color: caseDef.accent }}>{n.price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CasesPage() {
  const { user, updateBalance } = useAuth();
  const { pool, loading } = useNftPool();
  const [selectedCase, setSelectedCase] = useState<CaseDef | null>(null);

  useEffect(() => () => setNavLocked(false), []);

  if (selectedCase) {
    return (
      <CaseOpener
        caseDef={selectedCase}
        pool={pool}
        onClose={() => setSelectedCase(null)}
        user={user}
        updateBalance={updateBalance}
      />
    );
  }

  return (
    <div>
      <PageHeader title="NFT Кейси" subtitle="Відкрий кейс — отримай NFT" />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Завантаження...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {CASES.map((c) => (
            <CaseCard
              key={c.id}
              caseDef={c}
              pool={pool}
              onOpen={setSelectedCase}
              userBalance={user?.balance ?? 0}
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[10px] text-muted-foreground">
        Шанс рідкісних NFT обернено пропорційний ціні
      </p>
    </div>
  );
}

export default CasesPage;
