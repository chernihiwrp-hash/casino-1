
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { RequireAuth, PageHeader } from "@/components/RequireAuth";
import { useNftPool, pickWeightedNft, giveNftToUser } from "@/lib/nft";
import { Package, Sparkles } from "lucide-react";
import type { NftGift } from "@/lib/supabase";
import { setNavLocked } from "@/lib/lock";


const CASE_PRICE = 500;

function CasesPage() {
  const { user, updateBalance } = useAuth();
  const { pool, loading } = useNftPool();
  const [opening, setOpening] = useState(false);
  const [reel, setReel] = useState<NftGift[]>([]);
  const [won, setWon] = useState<NftGift | null>(null);
  const [msg, setMsg] = useState("");
  const reelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => setNavLocked(false), []);

  const openCase = async () => {
    if (!user || opening || pool.length === 0) return;
    if ((user.balance ?? 0) < CASE_PRICE) { setMsg("Недостаточно CR"); return; }
    setMsg(""); setWon(null);

    try { await updateBalance(-CASE_PRICE); } catch (e: any) { setMsg(e.message); return; }

    const winner = pickWeightedNft(pool)!;
    const startIndex = 6;
    const winnerIndex = 35;
    const startOffset = `translateX(calc(50% - 64px - ${startIndex * 128}px))`;
    const endOffset = `translateX(calc(50% - 64px - ${winnerIndex * 128}px))`;
    const items: NftGift[] = Array.from({ length: 40 }, () => pool[Math.floor(Math.random() * pool.length)]);
    items[winnerIndex] = winner;

    setReel(items);
    setOpening(true);
    setNavLocked(true);

    // Animate via WAAPI on next paint, after reel children are mounted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = reelRef.current;
        if (el) {
          el.getAnimations().forEach((a) => a.cancel());
          el.style.transform = startOffset;
          const anim = el.animate(
            [{ transform: startOffset }, { transform: endOffset }],
            { duration: 4300, easing: "cubic-bezier(0.15, 0.9, 0.25, 1)", fill: "forwards" },
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
        setMsg(`Отримано: ${winner.name} (${winner.price} CR)`);
      } catch (e: any) {
        console.warn("nft_owners insert failed:", e?.message);
        setMsg(`Дроп: ${winner.name} (${winner.price} CR) — не сохранился в инвентарь, проверь RLS политики`);
      }
    }, 4500);
  };

  return (
    <div>
      <PageHeader title="NFT Кейси" subtitle={`Цена кейса: ${CASE_PRICE} CR · ${pool.length} возможных NFT`} />

      <div className="glass-strong overflow-hidden rounded-3xl p-6">
        <div className="relative mx-auto h-32 w-full overflow-hidden rounded-2xl border border-border bg-black/40">
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-1 -translate-x-1/2 bg-primary shadow-[0_0_20px_var(--primary)]" />
          {reel.length > 0 ? (
            <div ref={reelRef} className="flex h-full" style={{ transform: "translateX(0)" }}>
              {reel.map((n, i) => (
                <div key={i} className="flex h-full w-32 shrink-0 flex-col items-center justify-center gap-1 border-r border-border/40 p-2">
                  <img src={n.image_url} alt={n.name} className="h-16 w-16 rounded-lg object-cover" loading="lazy" />
                  <div className="truncate text-[10px] text-muted-foreground">{n.price}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="mr-2 h-6 w-6" /> Нажми «Відкрити кейс»
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">Шанс редких NFT ~ обратно пропорционален цене</div>
          <button onClick={openCase} disabled={opening || loading || (user?.balance ?? 0) < CASE_PRICE}
            className="btn-primary rounded-xl px-6 py-2.5 text-sm">
            {opening ? "Открываем..." : `Відкрити за ${CASE_PRICE} CR`}
          </button>
        </div>

        {msg && <div className="mt-4 rounded-lg bg-secondary/40 px-3 py-2 text-center text-sm">{msg}</div>}

        {won && !opening && (
          <div className="glass mt-5 flex items-center gap-4 rounded-2xl p-4">
            <img src={won.image_url} alt={won.name} className="h-20 w-20 rounded-xl object-cover ring-2 ring-primary" />
            <div>
              <div className="text-xs uppercase text-primary">Дроп</div>
              <div className="text-lg font-bold">{won.name}</div>
              <div className="font-mono text-sm text-muted-foreground">{won.price} CR</div>
            </div>
            <Sparkles className="ml-auto h-6 w-6 text-primary" />
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-3 px-1 text-xs uppercase tracking-widest text-muted-foreground">Возможные NFT</h3>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {pool.map((n) => (
            <div key={n.id} className="glass rounded-2xl p-2 text-center">
              <img src={n.image_url} alt={n.name} className="mx-auto h-20 w-20 rounded-lg object-cover" loading="lazy" />
              <div className="mt-1 truncate text-xs">{n.name}</div>
              <div className="font-mono text-[10px] text-primary">{n.price} CR</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default CasesPage;
