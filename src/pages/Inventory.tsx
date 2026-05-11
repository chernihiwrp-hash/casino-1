import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { useUserNfts, removeOwnedNft } from "@/lib/nft";
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Star, Package, TrendingDown, Trash2 } from "lucide-react";

function InventoryPage() {
  const { user, updateBalance, refresh } = useAuth();
  const { items, loading, reload } = useUserNfts(user?.username);
  const [busy, setBusy]     = useState<string | null>(null);
  const [msg, setMsg]       = useState("");
  const [tab, setTab]       = useState<"all" | "favorites">("all");

  // favorites — масив ownerRowId (uuid) збережений в users.favorites
  const favorites: string[] = (user?.favorites as string[] | null) ?? [];

  const isFav = (ownerRowId: string) => favorites.includes(ownerRowId);

  const toggleFav = useCallback(async (ownerRowId: string) => {
    if (!user) return;
    const next = isFav(ownerRowId)
      ? favorites.filter(f => f !== ownerRowId)
      : [...favorites, ownerRowId];
    await supabase.from("users").update({ favorites: next }).eq("id", user.id);
    await refresh();
  }, [user, favorites, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const sell = async (rowId: string, price: number) => {
    if (!user || busy) return;
    setBusy(rowId); setMsg("");
    const payout = Math.floor(price * 0.7);
    try {
      await removeOwnedNft(rowId);
    } catch (e: any) {
      setMsg("Не вдалося продати: " + (e?.message || "помилка БД (RLS)"));
      setBusy(null);
      return;
    }
    try {
      await updateBalance(payout);
      // Remove from favorites if was there
      if (isFav(rowId)) {
        const next = favorites.filter(f => f !== rowId);
        await supabase.from("users").update({ favorites: next }).eq("id", user.id);
        await refresh();
      }
      setMsg(`Продано за ${payout} CR`);
    } catch (e: any) {
      setMsg("NFT видалено, але баланс не оновлено: " + (e?.message || ""));
    } finally {
      await reload();
      setBusy(null);
    }
  };

  const sellAll = async () => {
    if (!user || busy || items.length === 0) return;
    if (!confirm(`Продати всі ${items.length} NFT за ~${Math.floor(totalValue * 0.7)} CR?`)) return;
    setBusy("ALL"); setMsg("");
    let payout = 0;
    const soldIds: string[] = [];
    for (const it of items) {
      try { await removeOwnedNft(it.ownerRowId); payout += Math.floor(it.price * 0.7); soldIds.push(it.ownerRowId); } catch {}
    }
    if (payout > 0) await updateBalance(payout);
    // Clear sold ids from favorites
    const nextFavs = favorites.filter(f => !soldIds.includes(f));
    await supabase.from("users").update({ favorites: nextFavs }).eq("id", user.id);
    setMsg(`Продано все: +${payout} CR`);
    await reload(); await refresh(); setBusy(null);
  };

  const displayed = tab === "favorites"
    ? items.filter(n => isFav(n.ownerRowId))
    : items;

  const totalValue = items.reduce((s, i) => s + i.price, 0);
  const favCount   = items.filter(n => isFav(n.ownerRowId)).length;

  return (
    <div className="space-y-4">
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
          { key: "all",       label: `Всі (${items.length})`,       icon: <Package className="h-3.5 w-3.5" /> },
          { key: "favorites", label: `Обрані (${favCount})`, icon: <Star className="h-3.5 w-3.5" /> },
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

      {/* Sell All */}
      {tab === "all" && items.length > 0 && (
        <button onClick={sellAll} disabled={!!busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/15 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-40 transition">
          <Trash2 className="h-4 w-4" />
          {busy === "ALL" ? "Продаємо..." : `Продати ВСЕ (~${Math.floor(totalValue * 0.7).toLocaleString()} CR)`}
        </button>
      )}

      {msg && <div className="glass rounded-lg p-2 text-center text-sm">{msg}</div>}

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Завантаження...</div>
      ) : displayed.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          {tab === "favorites"
            ? <><Star className="mx-auto mb-3 h-8 w-8 opacity-30" />Немає обраних NFT. Натисни ⭐ на будь-якому предметі</>
            : <><Package className="mx-auto mb-3 h-8 w-8 opacity-30" />Пусто. Відкрий кейси або зіграй на ракеті</>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {displayed.map((n) => (
            <div key={n.ownerRowId} className="glass overflow-hidden rounded-2xl p-3 flex flex-col">
              <div className="relative">
                <img src={n.image_url} alt={n.name}
                  className="mx-auto h-28 w-28 rounded-xl object-cover" loading="lazy" />
                {/* Favourite toggle */}
                <button
                  onClick={() => toggleFav(n.ownerRowId)}
                  className={`absolute top-1 right-1 rounded-full p-1 transition-all ${
                    isFav(n.ownerRowId)
                      ? "bg-yellow-400/20 text-yellow-400"
                      : "bg-black/30 text-white/40 hover:text-yellow-400"
                  }`}
                  title={isFav(n.ownerRowId) ? "Прибрати з обраних" : "Додати до обраних"}>
                  <Star className={`h-3.5 w-3.5 ${isFav(n.ownerRowId) ? "fill-yellow-400" : ""}`} />
                </button>
              </div>
              <div className="mt-2 truncate text-sm font-semibold">{n.name}</div>
              <div className="font-mono text-xs text-primary">{n.price.toLocaleString()} CR</div>
              <button onClick={() => sell(n.ownerRowId, n.price)} disabled={busy === n.ownerRowId}
                className="mt-auto mt-2 flex items-center justify-center gap-1 w-full rounded-lg bg-secondary py-1.5 text-xs hover:bg-primary/20 disabled:opacity-50 transition">
                <TrendingDown className="h-3 w-3" />
                {busy === n.ownerRowId ? "..." : `Продати ${Math.floor(n.price * 0.7).toLocaleString()}`}
              </button>
            </div>
          ))}
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
