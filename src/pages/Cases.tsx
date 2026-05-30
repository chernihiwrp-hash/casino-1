import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { RequireAuth, PageHeader } from "@/components/RequireAuth";
import { useNftPool, pickWeightedNft, giveNftToUser } from "@/lib/nft";
import { Package, Sparkles, Star, Crown, ChevronLeft } from "lucide-react";
import type { NftGift } from "@/lib/supabase";
import { setNavLocked } from "@/lib/lock";

// ─── КАРТИНКИ КЕЙСІВ ────────────────────────────────────────────────────────
const CASE_IMAGE_BUM:  string | null = "https://i.ibb.co/j9R5xFbX/pngwing-com-51.png";
const CASE_IMAGE_MID:  string | null = "https://i.ibb.co/2B0Zy3G/pngwing-com-52.png";
const CASE_IMAGE_RICH: string | null = "https://i.ibb.co/B511JY2L/pngwing-com-53.png";
// ────────────────────────────────────────────────────────────────────────────

const CASES = [
  {
    id: "bum",
    name: "Кейс Бомжа",
    desc: "Дешеві NFT для початківців",
    price: 500,
    image: CASE_IMAGE_BUM,
    color: "#6B8EF2",
    minPrice: 0,
    maxPrice: 500,
    Icon: Package,
  },
  {
    id: "mid",
    name: "Кейс Середнячка",
    desc: "Більше NFT, більше шансів",
    price: 3500,
    image: CASE_IMAGE_MID,
    color: "#4ADE80",
    minPrice: 300,
    maxPrice: 8000,
    Icon: Star,
  },
  {
    id: "rich",
    name: "Кейс Мажора",
    desc: "Елітні NFT для обраних",
    price: 75000,
    image: CASE_IMAGE_RICH,
    color: "#FBBF24",
    minPrice: 8000,
    maxPrice: Infinity,
    Icon: Crown,
  },
] as const;

type CaseDef = typeof CASES[number];

// ─── Opener (повноекранний) ──────────────────────────────────────────────────
function CaseOpener({
  c, pool, user, updateBalance, onClose,
}: {
  c: CaseDef; pool: NftGift[];
  user: any; updateBalance: (d: number) => Promise<any>;
  onClose: () => void;
}) {
  const casePool = pool.filter(n => n.price >= c.minPrice && n.price < c.maxPrice);
  const [opening, setOpening] = useState(false);
  const [reel, setReel]       = useState<NftGift[]>([]);
  const [won, setWon]         = useState<NftGift | null>(null);
  const [msg, setMsg]         = useState("");
  const reelRef = useRef<HTMLDivElement | null>(null);
  const { Icon } = c;

  const openCase = async () => {
    if (opening || !casePool.length) return;
    if ((user?.balance ?? 0) < c.price) { setMsg("Недостатньо CR"); return; }
    setMsg(""); setWon(null);
    try { await updateBalance(-c.price); } catch (e: any) { setMsg(e.message); return; }

    const winner = pickWeightedNft(casePool)!;
    const WIN_IDX = 35;
    const items: NftGift[] = Array.from({ length: 40 }, () => casePool[Math.floor(Math.random() * casePool.length)]);
    items[WIN_IDX] = winner;
    setReel(items);
    setOpening(true);
    setNavLocked(true);

    const startOff = `translateX(calc(50% - 64px - ${6 * 128}px))`;
    const endOff   = `translateX(calc(50% - 64px - ${WIN_IDX * 128}px))`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = reelRef.current;
      if (!el) return;
      el.getAnimations().forEach(a => a.cancel());
      el.style.transform = startOff;
      const anim = el.animate(
        [{ transform: startOff }, { transform: endOff }],
        { duration: 4300, easing: "cubic-bezier(0.15,0.9,0.25,1)", fill: "forwards" }
      );
      anim.onfinish = () => { el.style.transform = endOff; };
    }));

    setTimeout(async () => {
      setWon(winner); setOpening(false); setNavLocked(false);
      try {
        await giveNftToUser(user.username, winner.id);
        setMsg(`+${winner.name} · ${winner.price} CR`);
      } catch { setMsg(`Дроп: ${winner.name} — перевір RLS`); }
    }, 4500);
  };

  return (
    // ⬇️ ОСНОВНЕ ВИПРАВЛЕННЯ: фікс на весь екран + СКРОЛ + padding під header/safe-area
    <div className="fixed inset-0 z-50 bg-[#0a0a0f] overflow-y-auto overscroll-contain">
      {/* Header (sticky щоб кнопка завжди була видима) */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#0a0a0f]/95 backdrop-blur border-b border-white/5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Назад"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-base truncate">{c.name}</div>
          <div className="text-white/50 text-xs">{c.price} CR · {casePool.length} NFT</div>
        </div>
      </div>

      <div className="px-4 py-5 pb-32 space-y-5">
        {/* Reel */}
        <div className="relative overflow-hidden h-32 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-yellow-400 z-10" />
          {reel.length > 0 ? (
            <div ref={reelRef} className="flex h-full will-change-transform">
              {reel.map((n, i) => (
                <div key={i} className="w-32 h-32 shrink-0 flex flex-col items-center justify-center border-r border-white/5 p-2">
                  <div className="text-3xl">🎁</div>
                  <div className="text-[10px] text-white/60 mt-1">{n.price}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 text-sm">
              Натисни «Відкрити»
            </div>
          )}
        </div>

        {/* Won */}
        {won && !opening && (
          <div className="rounded-2xl p-5 text-center" style={{ background: `${c.color}15`, border: `1px solid ${c.color}50` }}>
            <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: c.color }} />
            <div className="text-white/60 text-xs uppercase tracking-wider">Дроп!</div>
            <div className="text-white font-black text-lg mt-1">{won.name}</div>
            <div className="text-sm mt-1" style={{ color: c.color }}>{won.price} CR</div>
          </div>
        )}

        {msg && (
          <div className="text-center text-sm text-white/70">{msg}</div>
        )}

        {/* Open btn */}
        <button
          onClick={openCase}
          disabled={opening || (user?.balance ?? 0) < c.price || !casePool.length}
          className="w-full py-4 rounded-2xl font-black uppercase tracking-wide text-black disabled:opacity-40 active:scale-[0.98] transition-transform"
          style={{ background: c.color }}
        >
          {opening ? "Відкриваємо..." : `Відкрити · ${c.price} CR`}
        </button>

        {/* NFT пул */}
        {casePool.length > 0 && (
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wider mb-3">
              Можливі NFT ({casePool.length})
            </div>
            <div className="grid grid-cols-3 gap-2">
              {casePool.map((n) => (
                <div key={n.id} className="aspect-square rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center p-2">
                  <div className="text-2xl">🎁</div>
                  <div className="text-[10px] text-white/60 mt-1 truncate w-full text-center">{n.name}</div>
                  <div className="text-[10px] font-bold mt-0.5" style={{ color: c.color }}>{n.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
function CaseCard({ c, pool, balance, onOpen }: {
  c: CaseDef; pool: NftGift[]; balance: number; onOpen: (c: CaseDef) => void;
}) {
  const casePool = pool.filter(n => n.price >= c.minPrice && n.price < c.maxPrice);
  const canOpen  = balance >= c.price && casePool.length > 0;
  const { Icon } = c;

  return (
    <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5">
      {/* Картинка */}
      <div className="relative aspect-square flex items-center justify-center" style={{ background: `${c.color}10` }}>
        {c.image ? (
          <img src={c.image} alt={c.name} className="w-full h-full object-contain p-4" />
        ) : (
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center" style={{ background: `${c.color}25` }}>
            <Icon className="w-12 h-12" style={{ color: c.color }} />
          </div>
        )}
        <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[11px] font-black"
             style={{ background: `${c.color}20`, color: c.color, border: `1px solid ${c.color}40` }}>
          {c.price} CR
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div>
          <div className="text-white font-black text-base">{c.name}</div>
          <div className="text-white/50 text-xs mt-0.5">{c.desc}</div>
        </div>

        <button
          onClick={() => onOpen(c)}
          disabled={!canOpen}
          className="w-full py-3 rounded-xl text-[13px] font-black uppercase tracking-wide transition-all active:scale-[0.97] disabled:opacity-35"
          style={{
            background: canOpen ? `${c.color}18` : "transparent",
            border: `1px solid ${canOpen ? c.color + "50" : "rgba(255,255,255,0.1)"}`,
            color: canOpen ? c.color : "rgba(255,255,255,0.3)",
          }}
        >
          {!casePool.length ? "Скоро" : `Відкрити · ${c.price} CR`}
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
function CasesPage() {
  const { user, updateBalance } = useAuth();
  const { pool, loading }       = useNftPool();
  const [selected, setSelected] = useState<CaseDef | null>(null);

  useEffect(() => () => setNavLocked(false), []);

  if (selected) {
    return (
      <CaseOpener
        c={selected}
        pool={pool}
        user={user}
        updateBalance={updateBalance}
        onClose={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="px-4 pb-24 space-y-4">
      <PageHeader title="Кейси" subtitle="Відкривай та збирай NFT" />

      {loading ? (
        <div className="text-center text-white/50 py-12">Завантаження...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {CASES.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              pool={pool}
              balance={user?.balance ?? 0}
              onOpen={setSelected}
            />
          ))}
        </div>
      )}

      <div className="text-center text-white/30 text-xs pt-4">
        Шанс рідкісних NFT обернено пропорційний ціні
      </div>
    </div>
  );
}

export default function Cases() {
  return <RequireAuth><CasesPage /></RequireAuth>;
}
