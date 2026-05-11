import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kafivvwxqulxmkpyqinz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZml2dnd4cXVseG1rcHlxaW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTgyNDIsImV4cCI6MjA4OTg3NDI0Mn0.HD_Gxn5UIVxov0-7U4aVhtYXhGvYTsVqLlycE5ctBpg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// ✅ БЕЗОПАСНЫЙ INSERT через серверный эндпоинт (как в site2)
// Все INSERT-операции идут через /api/submit с service_role ключом,
// чтобы RLS не блокировал анонимные вставки.
export async function secureInsert(table: string, data: unknown): Promise<void> {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, data }),
  });
  if (!res.ok) {
    let msg = "Insert failed";
    try {
      const err = await res.json();
      msg = err.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
}

// Same as secureInsert, but returns the inserted rows (uses .select() server-side).
export async function secureInsertReturning<T = unknown>(
  table: string,
  data: unknown,
): Promise<T[]> {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, data, returning: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Insert failed");
  return (json.data ?? []) as T[];
}

// ✅ БЕЗОПАСНЫЙ UPDATE через серверный эндпоинт с service_role ключом.
// match — объект вида { id: "abc" } (условие WHERE)
export async function secureUpdate(
  table: string,
  data: unknown,
  match: Record<string, unknown>,
): Promise<void> {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, data, match, operation: "update" }),
  });
  if (!res.ok) {
    let msg = "Update failed";
    try {
      const err = await res.json();
      msg = err.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
}

// ✅ БЕЗОПАСНЫЙ DELETE через серверный эндпоинт с service_role ключом.
export async function secureDelete(
  table: string,
  match: Record<string, unknown>,
): Promise<void> {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, match, operation: "delete" }),
  });
  if (!res.ok) {
    let msg = "Delete failed";
    try {
      const err = await res.json();
      msg = err.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}

export type DbUser = {
  id: number;
  username: string;
  telegram_id: string | null;
  avatar_url: string | null;
  role: "player" | "admin" | "mayor";
  theme: string;
  registered_at: string;
  is_banned: boolean;
  balance: number | null;
  password: string | null;
  owned_themes: string[] | null;
  owned_gifts: unknown;
  favorites: string[] | null;
  referral_code: string | null;
  referred_by: string | null;
  rare_balance: number | null;
};

export type CaseDef = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image_url: string | null;
  min_price: number;
  max_price: number;
  rarity_bias: number;
  sort_order: number;
  active: boolean;
};

export type Trade = {
  id: string;
  from_nick: string;
  to_nick: string;
  nft_owner_id: string | null;
  amount_cr: number;
  amount_rc: number;
  fee_cr: number;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type NftGift = {
  id: string;
  name: string;
  price: number;
  image_url: string;
  created_at: string;
  sold: boolean;
};

export type NftOwner = {
  id: string;
  owner_nick: string;
  nft_id: string;
  acquired_at: string;
};
