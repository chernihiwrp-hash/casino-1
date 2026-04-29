import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kafivvwxqulxmkpyqinz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZml2dnd4cXVseG1rcHlxaW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTgyNDIsImV4cCI6MjA4OTg3NDI0Mn0.HD_Gxn5UIVxov0-7U4aVhtYXhGvYTsVqLlycE5ctBpg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

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
