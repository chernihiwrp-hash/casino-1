import { useEffect, useState, useCallback } from "react";
import { supabase, secureSelect, secureDelete, NftGift, secureInsert } from "./supabase";

export function useNftPool() {
  const [pool, setPool] = useState<NftGift[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    secureSelect<NftGift>("nft_gifts", { order: { col: "price", asc: true } }).then(data => ({ data, error: null })).catch(e => ({ data: null, error: e }))
      .then(({ data }) => { setPool((data as NftGift[]) ?? []); setLoading(false); });
  }, []);
  return { pool, loading };
}

export function useUserNfts(username: string | undefined) {
  const [items, setItems] = useState<(NftGift & { ownerRowId: string; acquired_at: string })[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!username) { setItems([]); return; }
    setLoading(true);
    try {
      const owners = await secureSelect<{ id: string; nft_id: string; acquired_at: string }>(
        "nft_owners",
        { filters: [{ col: "owner_nick", op: "eq", value: username }], order: { col: "acquired_at", asc: false } }
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
    } catch (e) { console.error("useUserNfts:", e); }
    setLoading(false);
  }, [username]);

  useEffect(() => { reload(); }, [reload]);
  return { items, loading, reload };
}

// Pick weighted random NFT — cheaper = more likely
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

export async function giveNftToUser(username: string, nftId: string) {
  await secureInsert("nft_owners", { owner_nick: username, nft_id: nftId });
}

export async function removeOwnedNft(ownerRowId: string) {
  await secureDelete("nft_owners", { id: ownerRowId }); const error = null;
  if (error) throw new Error(error.message);
}

import { secureDelete } from "./supabase";

export async function removeOwnedNftSecure(ownerRowId: string) {
  await secureDelete("nft_owners", { id: ownerRowId });
}
