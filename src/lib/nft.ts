import { useEffect, useState, useCallback } from "react";
import { supabase, NftGift } from "./supabase";

export function useNftPool() {
  const [pool, setPool] = useState<NftGift[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("nft_gifts").select("*").order("price", { ascending: true })
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
    const { data } = await supabase
      .from("nft_owners")
      .select("id, nft_id, acquired_at, nft_gifts(*)")
      .eq("owner_nick", username)
      .order("acquired_at", { ascending: false });
    const mapped = (data ?? []).map((r: any) => ({
      ...(r.nft_gifts as NftGift),
      ownerRowId: r.id,
      acquired_at: r.acquired_at,
    }));
    setItems(mapped);
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
  const { error } = await supabase.from("nft_owners").insert({ owner_nick: username, nft_id: nftId });
  if (error) throw new Error(error.message);
}

export async function removeOwnedNft(ownerRowId: string) {
  const { error } = await supabase.from("nft_owners").delete().eq("id", ownerRowId);
  if (error) throw new Error(error.message);
}
