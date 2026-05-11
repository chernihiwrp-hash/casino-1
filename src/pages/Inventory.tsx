import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { useUserNfts, removeOwnedNftSecure } from "@/lib/nft";
import { useState, useCallback } from "react";
import { secureUpdate } from "@/lib/supabase";
import {
  Star, Package, TrendingDown, Trash2,
  AlertTriangle, X, CheckCircle2, XCircle,
} from "lucide-react";

// ─── Confirm Modal ────────────────────────────────────────────────────────────

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmModal({ open, title, description, confirmLabel = "Підтвердити", onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass-strong rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full p-2 bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
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
            className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function InventoryPage() {
  const { user, updateBalance, refresh } = useAuth();
  const { items, loading, reload } = useUserNfts(user?.username);
  const [busy, setBusy]       = useState<string | null>(null);
  const [msg, setMsg]         = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [tab, setTab]         = useState<"all" | "favorites">("all");
  const [sellAllModal, setSellAllModal] = useState(false);

  // favorites — масив ownerRowId (uuid) збережений в users.favorites
  const favorites: string[] = (user?.favorites as string[] | null) ?? [];
  const isFav = (ownerRowId: string) => favorites.includes(ownerRowId);

  // Update favorites via service role key
  const saveFavorites = useCallback(async (next: string[]) => {
    if (!user) return;
    await secureUpdate("users", { favorites: next }, { id: user.id });
    await refresh();
  }, [user, refresh]);

  const toggleFav = useCallback(async (ownerRowId: string) => {
    if (!user) return;
    const next = isFav(ownerRowId)
      ? favorites.filter(f => f !== ownerRowId)
      : [...favorites, ownerRowId];
    await saveFavorites(next);
  }, [user, favorites, saveFavorites]); // eslint-disable-line react-hooks/exhaustive-deps

  const sell = async (rowId: string, price: number) => {
    if (!user || busy) return;
    // Guard: block selling favorited NFTs
    if (isFav(rowId)) {
      setMsg("Не можна продати обране NFT. Спочатку прибери із зірочок.");
      setMsgType("err");
      return;
    }
    setBusy(rowId); setMsg("");
    const payout = Math.floor(price * 0.7);
    try {
      await removeOwnedNftSecure(rowId);
      await updateBalance(payout);
      setMsg(`Продано за ${payout} CR`);
      setMsgType("ok");
    } catch (e: any) {
      setMsg("Помилка: " + (e?.message || "невідома"));
      setMsgType("err");
    } finally {
      await reload();
      setBusy(null);
    }
  };

  const doSellAll = async () => {
    setSellAllModal(false);
    if (!user || busy || items.length === 0) return;

    // Only sell non-favorited items
    const toSell = items.filter(it => !isFav(it.ownerRowId));
    if (toSell.length === 0) {
      setMsg("Всі NFT в обраних — зніми зірочки, щоб продати.");
      setMsgType("err");
      return;
    }

    setBusy("ALL"); setMsg("");
    let payout = 0;
    for (const it of toSell) {
      try {
        await removeOwnedNftSecure(it.ownerRowId);
        payout += Math.floor(it.price * 0.7);
      } catch {}
    }
    if (payout > 0) await updateBalance(payout);
    setMsg(`Продано ${toSell.length} NFT: +${payout.toLocaleString()} CR`);
    setMsgType("ok");
    await reload(); await refresh(); setBusy(null);
  };

  const displayed = tab === "favorites"
    ? items.filter(n => isFav(n.ownerRowId))
    : items;

  const nonFavItems  = items.filter(n => !isFav(n.ownerRowId));
  const totalValue   = items.reduce((s, i) => s + i.price, 0);
  const sellAllValue = Math.floor(nonFavItems.reduce((s, i) => s + i.price * 0.7, 0));
  const favCount     = items.filter(n => isFav(n.ownerRowId)).length;

  return (
    <div className="space-y-4">
      <ConfirmModal
        open={sellAllModal}
        title="Продати всі NFT?"
        description={
          nonFavItems.length < items.length
            ? `Обрані NFT (${favCount} шт.) не продаються. Буде продано ${nonFavItems.length} NFT за ~${sellAllValue.toLocaleString()} CR (70% від ціни).`
            : `Буде продано ${items.length} NFT за ~${sellAllValue.toLocaleString()} CR (70% від ціни).`
        }
        confirmLabel="Продати все"
        onConfirm={doSellAll}
        onCancel={() => setSellAllModal(false)}
      />

      <PageHeader title="Інвентар" subtitle="Твоя NFT-колекція" />

      {/* Stats */}
      <div className="glass-strong grid grid-cols-3 gap-3 rounded-2xl p-4">
        <Stat label="NFT" value={items.length} />
        <Stat label="Сума" value={`${totalValue.toLocaleString()} CR`} />
        <Stat label="Продаж 70%" value={`${Math.floor(totalValue * 0.7).toLocaleString()} CR`} />
      </div>

      {/* Tabs */}
      <div className="glass-strong flex rounded-2xl p-1 gap-1">
        {([
          { key: "all",       label: `Всі (${items.length})`,  icon: <Package className="h-3.5 w-3.5" /> },
          { key: "favorites", label: `Обрані (${favCount})`,   icon: <Star className="h-3.5 w-3.5" /> },
        ] as const).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all"
            style={{
              background: tab === key ? "var(--gradient-primary)" : "transparent",
              color:      tab === key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              boxShadow:  tab === key ? "var(--shadow-glow)" : "none",
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Sell All button — only on "all" tab, only non-fav items */}
      {tab === "all" && nonFavItems.length > 0 && (
        <button onClick={() => setSellAllModal(true)} disabled={!!busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/15 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-40 transition">
          <Trash2 className="h-4 w-4" />
          {busy === "ALL"
            ? "Продаємо..."
            : `Продати ВСЕ (~${sellAllValue.toLocaleString()} CR)${favCount > 0 ? ` · ${favCount} обраних пропущено` : ""}`}
        </button>
      )}

      {/* Message */}
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium
          ${msgType === "ok" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
          {msgType === "ok"
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <XCircle className="h-4 w-4 shrink-0" />}
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Завантаження...</div>
      ) : displayed.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          {tab === "favorites"
            ? <><Star className="mx-auto mb-3 h-8 w-8 opacity-30" />Немає обраних NFT. Натисни зірочку на будь-якому предметі</>
            : <><Package className="mx-auto mb-3 h-8 w-8 opacity-30" />Пусто. Відкрий кейси або зіграй на ракеті</>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {displayed.map((n) => {
            const fav = isFav(n.ownerRowId);
            return (
              <div key={n.ownerRowId} className="glass overflow-hidden rounded-2xl p-3 flex flex-col">
                <div className="relative">
                  <img src={n.image_url} alt={n.name}
                    className="mx-auto h-28 w-28 rounded-xl object-cover" loading="lazy" />
                  {/* Star toggle */}
                  <button
                    onClick={() => toggleFav(n.ownerRowId)}
                    className={`absolute top-1 right-1 rounded-full p-1 transition-all ${
                      fav
                        ? "bg-yellow-400/20 text-yellow-400"
                        : "bg-black/30 text-white/40 hover:text-yellow-400"
                    }`}
                    title={fav ? "Прибрати з обраних" : "Додати до обраних"}>
                    <Star className={`h-3.5 w-3.5 ${fav ? "fill-yellow-400" : ""}`} />
                  </button>
                  {/* Lock badge when favorited */}
                  {fav && (
                    <div className="absolute bottom-1 left-1 rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400 leading-none">
                      ОБРАНЕ
                    </div>
                  )}
                </div>
                <div className="mt-2 truncate text-sm font-semibold">{n.name}</div>
                <div className="font-mono text-xs text-primary">{n.price.toLocaleString()} CR</div>
                <button
                  onClick={() => sell(n.ownerRowId, n.price)}
                  disabled={!!busy || fav}
                  title={fav ? "Прибери із обраних, щоб продати" : undefined}
                  className={`mt-2 flex items-center justify-center gap-1 w-full rounded-lg py-1.5 text-xs transition
                    ${fav
                      ? "bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50"
                      : "bg-secondary hover:bg-primary/20 disabled:opacity-50"}`}>
                  {fav
                    ? <Star className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />}
                  {busy === n.ownerRowId
                    ? "..."
                    : fav
                      ? "Захищено"
                      : `Продати ${Math.floor(n.price * 0.7).toLocaleString()}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default InventoryPage;
