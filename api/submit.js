import { createClient } from '@supabase/supabase-js';

const ALLOWED_TABLES = [
  'users', 'casino_bets', 'transactions', 'promo_codes',
  'promo_uses', 'nft_gifts', 'nft_owners', 'inventory',
  'crypto_holdings', 'crypto_coins', 'banners', 'promotions',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server config error' });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  const { table, data, returning } = req.body || {};

  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: 'Table not allowed' });
  }

  let query = supabaseAdmin.from(table).insert(data);
  if (returning) {
    const { data: rows, error } = await query.select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, data: rows });
  }

  const { error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
