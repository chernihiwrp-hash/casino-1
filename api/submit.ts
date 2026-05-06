// 📁 Создай этот файл по пути: pages/api/submit.ts
// Этот файл работает на СЕРВЕРЕ — ключ не виден в браузере!

import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Берём ключи из переменных окружения Vercel (не из браузера!)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Какие таблицы разрешены для INSERT (защита от взлома)
const ALLOWED_TABLES = [
  'license_applications',
  'car_plates',
  'faction_applications',
  'admin_applications',
  'house_purchase_requests',
  'city_voice',
  'sos_signals',
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { table, data } = req.body;

  // Проверяем что таблица разрешена
  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    return res.status(400).json({ error: 'Table not allowed' });
  }

  // Проверяем что data это объект
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid data' });
  }

  // Делаем INSERT через service_role ключ (серверный, безопасный)
  const { error } = await supabaseAdmin.from(table).insert(data);

  if (error) {
    console.error(`Insert error in ${table}:`, error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}