
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { useUserNfts, removeOwnedNft } from "@/lib/nft";
import { useState } from "react";


function InventoryPage() {
  const { user, updateBalance } = useAuth();
  const { items, loading, reload } = useUserNfts(user?.username);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const sell = async (rowId: string, price: number) => {
    if (!user || busy) return;
    setBusy(rowId); setMsg("");
    const payout = Math.floor(price * 0.7);

    try {
      // 1) Try to remove the NFT first. If RLS blocks this, throw — don't pay out.
      await removeOwnedNft(rowId);
    } catch (e: any) {
      setMsg("Не вдалося продати: " + (e?.message || "помилка БД (RLS)"));
      setBusy(null);
      return;
    }

    try {
      // 2) Only credit balance after the NFT was actually removed.
      await updateBalance(payout);
      setMsg(`Продано за ${payout} CR`);
    } catch (e: any) {
      setMsg("NFT видалено, але баланс не оновлено: " + (e?.message || ""));
    } finally {
      await reload();
      setBusy(null);
    }
  };

  const totalValue = items.reduce((s, i) => s + i.price, 0);

  return (
    <div>
      <PageHeader title="Инвентарь" subtitle="Твоя NFT-коллекция" />

      <div className="glass-strong mb-4 grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-3">
        <Stat label="NFT" value={items.length} />
        <Stat label="Сумма" value={`${totalValue.toLocaleString()} CR`} />
        <Stat label="Продажа = 70%" value={`${Math.floor(totalValue * 0.7)} CR`} />
      </div>

      {msg && <div className="glass mb-3 rounded-lg p-2 text-center text-sm">{msg}</div>}

      {loading ? (
        <div className="text-center text-sm text-muted-foreground">Завантаження...</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Пусто. Відкрий кейси або зіграй на ракеті</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((n) => (
            <div key={n.ownerRowId} className="glass overflow-hidden rounded-2xl p-3">
              <img src={n.image_url} alt={n.name} className="mx-auto h-28 w-28 rounded-xl object-cover" loading="lazy" />
              <div className="mt-2 truncate text-sm font-semibold">{n.name}</div>
              <div className="font-mono text-xs text-primary">{n.price} CR</div>
              <button onClick={() => sell(n.ownerRowId, n.price)} disabled={busy === n.ownerRowId}
                className="mt-2 w-full rounded-lg bg-secondary py-1.5 text-xs hover:bg-primary/20 disabled:opacity-50">
                {busy === n.ownerRowId ? "..." : `Продать ${Math.floor(n.price * 0.7)}`}
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
      <div className="mt-0.5 font-mono text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
export default InventoryPage;
