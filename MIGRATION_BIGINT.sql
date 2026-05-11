-- =====================================================================
-- MIGRATION: INTEGER → BIGINT
-- Знімає обмеження 2,147,483,647 на баланс та інші числові поля
-- 
-- Запусти ЦІЛКОМ в Supabase SQL Editor (він безпечний для повторного запуску)
-- Порядок важливий: спочатку залежні таблиці, потім users
-- =====================================================================

-- ── 1. trades: amount_cr, amount_rc, fee_cr ───────────────────────────────────
ALTER TABLE public.trades
  ALTER COLUMN amount_cr TYPE bigint,
  ALTER COLUMN amount_rc TYPE bigint,
  ALTER COLUMN fee_cr    TYPE bigint;

-- ── 2. users: balance, rare_balance ──────────────────────────────────────────
--    balance зараз integer → bigint (прибирає ліміт ~2.1 млрд)
--    rare_balance також integer → bigint на майбутнє
ALTER TABLE public.users
  ALTER COLUMN balance      TYPE bigint,
  ALTER COLUMN rare_balance TYPE bigint;

-- ── 3. cases: price, min_price, max_price ────────────────────────────────────
ALTER TABLE public.cases
  ALTER COLUMN price     TYPE bigint,
  ALTER COLUMN min_price TYPE bigint,
  ALTER COLUMN max_price TYPE bigint;

-- ── 4. nft_gifts: price ───────────────────────────────────────────────────────
ALTER TABLE public.nft_gifts
  ALTER COLUMN price TYPE bigint;

-- ── 5. Перевірка (покаже поточні типи — мають бути bigint) ───────────────────
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('balance','rare_balance','amount_cr','amount_rc','fee_cr','price','min_price','max_price')
  AND table_name IN ('users','trades','cases','nft_gifts')
ORDER BY table_name, column_name;
