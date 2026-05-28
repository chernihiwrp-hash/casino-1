import { useEffect, useState, useCallback } from "react";
import { secureSelect, secureDelete, secureInsert, NftGift } from "./supabase";

// ─── Пул NFT для кейсів та апгрейдера (з nft_gifts) ──────────────────────────
export function useNftPool() {
  const [pool, setPool] = useState<NftGift[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    secureSelect<NftGift>("nft_gifts", { order: { col: "price", asc: true } })
      .then((data) => { setPool(data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return { pool, loading };
}

// Тип рядка nft_owners з вкладеним nft_gifts (PostgREST join)
type NftOwnerRow = {
  id: string;
  owner_nick: string;
  nft_id: string;
  acquired_at: string;
  nft_gifts: NftGift | null;
};

// ─── NFT конкретного гравця — з nft_owners (join nft_gifts) ──────────────────
// ilike = case-insensitive, тому "Vasya" і "vasya" однаково знаходяться
export function useUserNfts(username: string | undefined) {
  const [items, setItems] = useState<(NftGift & { ownerRowId: string; acquired_at: string })[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!username) { setItems([]); return; }
    setLoading(true);
    try {
      // Один запит з join — надійніше двох окремих
      const rows = await secureSelect<NftOwnerRow>("nft_owners", {
        columns: "id,owner_nick,nft_id,acquired_at,nft_gifts(*)",
        filters: [{ col: "owner_nick", op: "ilike", value: username }],
        order: { col: "acquired_at", asc: false },
      });

      setItems(
        rows
          .filter((r) => r.nft_gifts !== null)
          .map((r) => ({ ...r.nft_gifts!, ownerRowId: r.id, acquired_at: r.acquired_at }))
      );
    } catch (e) {
      console.error("useUserNfts join failed, trying fallback:", e);
      // Fallback: два окремих запити якщо join не спрацював
      try {
        const owners = await secureSelect<{ id: string; nft_id: string; acquired_at: string }>(
          "nft_owners",
          { filters: [{ col: "owner_nick", op: "ilike", value: username }], order: { col: "acquired_at", asc: false } }
        );
        if (owners.length === 0) { setItems([]); setLoading(false); return; }
        const nftIds = owners.map((o) => o.nft_id);
        const gifts = await secureSelect<NftGift>("nft_gifts", { filters: [{ col: "id", op: "in", value: nftIds }] });
        const giftMap = Object.fromEntries(gifts.map((g) => [String(g.id), g]));
        setItems(
          owners
            .filter((o) => giftMap[String(o.nft_id)])
            .map((o) => ({ ...giftMap[String(o.nft_id)], ownerRowId: o.id, acquired_at: o.acquired_at }))
        );
      } catch (e2) { console.error("useUserNfts fallback failed:", e2); }
    }
    setLoading(false);
  }, [username]);

  useEffect(() => { reload(); }, [reload]);
  return { items, loading, reload };
}

// ─── Вибір випадкового NFT (дешевші — частіше) ───────────────────────────────
export function pickWeightedNft(pool: NftGift[]): NftGift | null {
  if (pool.length === 0) return null;
  const weights = pool.map((n) => 1 / Math.max(10, n.price));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ─── Видати NFT гравцю (insert в nft_owners) ─────────────────────────────────
export async function giveNftToUser(username: string, nftId: string) {
  await secureInsert("nft_owners", {
    owner_nick: username.toLowerCase().trim(),
    nft_id: nftId,
  });
}

// ─── Забрати NFT гравця (delete з nft_owners по id рядка) ────────────────────
export async function removeOwnedNftSecure(ownerRowId: string) {
  await secureDelete("nft_owners", { id: ownerRowId });
}

// Алiас для сумісності з Upgrader
export const removeOwnedNft = removeOwnedNftSecure;
