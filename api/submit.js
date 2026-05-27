import { createClient } from '@supabase/supabase-js';

const ALLOWED_TABLES = [
  'users', 'casino_bets', 'transactions', 'promo_codes',
  'promo_uses', 'nft_gifts', 'nft_owners', 'inventory',
  'crypto_holdings', 'crypto_coins', 'banners', 'promotions',
  'cases', 'trades', 'referrals',
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
  const { table, data, returning, operation, match } = req.body || {};

  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ error: 'Table not allowed' });
  }

  // SELECT operation via service_role (щоб RLS не блокував anon)
  if (operation === 'select') {
    let query = supabaseAdmin.from(table).select(data?.columns || '*');
    if (data?.filters) {
      for (const f of data.filters) {
        if (f.op === 'eq')    query = query.eq(f.col, f.value);
        if (f.op === 'ilike') query = query.ilike(f.col, f.value);
        if (f.op === 'in')    query = query.in(f.col, f.value);
        if (f.op === 'neq')   query = query.neq(f.col, f.value);
      }
    }
    if (data?.order) query = query.order(data.order.col, { ascending: data.order.asc !== false });
    if (data?.limit) query = query.limit(data.limit);
    if (data?.single) {
      const { data: row, error } = await query.maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, data: row });
    }
    const { data: rows, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, data: rows });
  }

  // UPSERT operation
  if (operation === 'upsert') {
    const { data: rows, error } = await supabaseAdmin.from(table).upsert(data?.values, { onConflict: data?.onConflict }).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, data: rows });
  }

  // DELETE operation via service_role
  if (operation === 'delete') {
    if (!match || typeof match !== 'object' || Object.keys(match).length === 0) {
      return res.status(400).json({ error: 'match is required for delete' });
    }
    let query = supabaseAdmin.from(table).delete();
    for (const [col, val] of Object.entries(match)) {
      query = query.eq(col, val);
    }
    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  // UPDATE operation via service_role
  if (operation === 'update') {
    if (!match || typeof match !== 'object' || Object.keys(match).length === 0) {
      return res.status(400).json({ error: 'match is required for update' });
    }
    let query = supabaseAdmin.from(table).update(data);
    for (const [col, val] of Object.entries(match)) {
      query = query.eq(col, val);
    }
    if (returning) {
      const { data: rows, error } = await query.select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, data: rows });
    }
    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  // INSERT operation (default)
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
