import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { RequireAuth, PageHeader } from "@/components/RequireAuth";
import { useNftPool, pickWeightedNft, giveNftToUser } from "@/lib/nft";
import { Package, Sparkles, Star, Crown, ChevronLeft } from "lucide-react";
import type { NftGift } from "@/lib/supabase";
import { setNavLocked } from "@/lib/lock";

// ─── КАРТИНКИ КЕЙСІВ — вставте посилання замість null ───────────────────────
const CASE_IMAGE_BUM:  string | null = https://i.ibb.co/j9R5xFbX/pngwing-com-51.png;
const CASE_IMAGE_MID:  string | null = https://i.ibb.co/2B0Zy3G/pngwing-com-52.png;
const CASE_IMAGE_RICH: string | null = https://i.ibb.co/B511JY2L/pngwing-com-53.png;
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
    desc: "Середні NFT за норм ціну",
    price: 1500,
    image: CASE_IMAGE_MID,
    color: "#4ADE80",
    minPrice: 300,
    maxPrice: 5000,
    Icon: Star,
  },
  {
    id: "rich",
    name: "Кейс Мажора",
    desc: "Елітні NFT для обраних",
    price: 40000,
    image: CASE_IMAGE_RICH,
    color: "#FBBF24",
    minPrice: 5000,
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
  user: any; updateBalance: (d: number) => Promise<void>;
  onClose: () => void;
}) {
  const casePool = pool.filter(n => n.price >= c.minPrice && n.price < c.maxPrice);
  const [opening, setOpening] = useState(false);
  const [reel, setReel]       = useState<NftGift[]>([]);
  const [won, setWon]         = useState<NftGift | null>(null);
  const [msg, setMsg]         = useState("");
  const reelRef = useRef<HTMLDivElement>(null);
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
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto"
      style={{ background: "#0a0a0f" }}>

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-12 pb-3"
        style={{ background: "#0a0a0f", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onClose} disabled={opening}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition active:scale-90 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${c.color}20`, border: `1px solid ${c.color}40` }}>
            <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{c.name}</p>
            <p className="text-[10px]" style={{ color: c.color }}>{c.price} CR · {casePool.length} NFT</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Reel */}
        <div className="relative h-32 rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${c.color}30`,
            boxShadow: `0 0 24px ${c.color}15` }}>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px z-10"
            style={{ background: c.color, boxShadow: `0 0 16px ${c.color}` }} />
          <div className="absolute inset-y-0 left-0 w-16 z-10"
            style={{ background: "linear-gradient(90deg,#0a0a0f,transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-16 z-10"
            style={{ background: "linear-gradient(-90deg,#0a0a0f,transparent)" }} />

          {reel.length > 0 ? (
            <div ref={reelRef} className="flex h-full" style={{ transform: "translateX(0)" }}>
              {reel.map((n, i) => (
                <div key={i} className="flex h-full w-32 shrink-0 flex-col items-center justify-center gap-1 p-2"
                  style={{ borderRight: `1px solid ${c.color}15` }}>
                  <img src={n.image_url} alt={n.name} className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
                  <div className="text-[9px] font-mono" style={{ color: c.color }}>{n.price}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground text-sm">
              <Package className="h-5 w-5 opacity-40" /> Натисни «Відкрити»
            </div>
          )}
        </div>

        {/* Won */}
        {won && !opening && (
          <div className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: `${c.color}10`, border: `1px solid ${c.color}30` }}>
            <img src={won.image_url} alt={won.name}
              className="h-16 w-16 rounded-xl object-cover shrink-0"
              style={{ border: `2px solid ${c.color}`, boxShadow: `0 0 16px ${c.color}50` }} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: c.color }}>Дроп!</div>
              <div className="text-base font-black text-white truncate">{won.name}</div>
              <div className="text-sm font-mono mt-0.5" style={{ color: c.color }}>{won.price} CR</div>
            </div>
            <Sparkles className="w-5 h-5 shrink-0" style={{ color: c.color }} />
          </div>
        )}

        {msg && (
          <div className="rounded-xl px-4 py-2.5 text-sm text-center text-muted-foreground"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {msg}
          </div>
        )}

        {/* Open btn */}
        <button onClick={openCase}
          disabled={opening || (user?.balance ?? 0) < c.price || !casePool.length}
          className="w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: `${c.color}18`, border: `1.5px solid ${c.color}50`, color: c.color }}>
          {opening ? "Відкриваємо..." : `Відкрити · ${c.price} CR`}
        </button>

        {/* NFT пул */}
        {casePool.length > 0 && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2"
              style={{ color: "rgba(255,255,255,0.25)" }}>
              Можливі NFT ({casePool.length})
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {casePool.map((n) => (
                <div key={n.id} className="rounded-xl overflow-hidden"
                  style={{ background: `${c.color}08`, border: `1px solid ${c.color}20` }}>
                  <img src={n.image_url} alt={n.name} className="w-full aspect-square object-cover" loading="lazy" />
                  <div className="px-1 py-0.5 text-[8px] font-mono text-center truncate" style={{ color: c.color }}>
                    {n.price}
                  </div>
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
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

      {/* Картинка */}
      <div className="relative flex items-center justify-center py-6"
        style={{ background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${c.color}12, transparent)`,
          borderBottom: `1px solid ${c.color}20` }}>
        {c.image ? (
          <img src={c.image} alt={c.name} className="h-32 w-32 object-contain"
            style={{ filter: `drop-shadow(0 0 20px ${c.color}60)` }} />
        ) : (
          <div className="h-32 w-32 rounded-2xl flex flex-col items-center justify-center gap-2"
            style={{ background: `${c.color}10`, border: `1.5px dashed ${c.color}35` }}>
            <Icon className="h-12 w-12" style={{ color: c.color, opacity: 0.5 }} />
          </div>
        )}
        {/* Price badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black"
          style={{ background: `${c.color}20`, border: `1px solid ${c.color}40`, color: c.color }}>
          {c.price} CR
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-black text-white">{c.name}</p>
          <p className="text-[11px] mt-0.5" style={{ color: `${c.color}cc` }}>{c.desc}</p>
        </div>

        {/* Button */}
        <button onClick={() => onOpen(c)} disabled={!canOpen}
          className="w-full py-3 rounded-xl text-[13px] font-black uppercase tracking-wide transition-all active:scale-[0.97] disabled:opacity-35"
          style={{ background: canOpen ? `${c.color}18` : "transparent",
            border: `1px solid ${canOpen ? c.color + "50" : "rgba(255,255,255,0.1)"}`,
            color: canOpen ? c.color : "rgba(255,255,255,0.3)" }}>
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
        c={selected} pool={pool}
        user={user} updateBalance={updateBalance}
        onClose={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      <PageHeader title="NFT Кейси" subtitle="Відкрий кейс — отримай NFT" />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
          <Package className="h-5 w-5 animate-pulse" /> Завантаження...
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {CASES.map((c) => (
            <CaseCard
              key={c.id} c={c} pool={pool}
              balance={user?.balance ?? 0}
              onOpen={setSelected}
            />
          ))}
        </div>
      )}

      <p className="mt-5 mb-2 text-center text-[10px] text-muted-foreground">
        Шанс рідкісних NFT обернено пропорційний ціні
      </p>
    </div>
  );
}

export default function Cases() {
  return <RequireAuth><CasesPage /></RequireAuth>;
}
