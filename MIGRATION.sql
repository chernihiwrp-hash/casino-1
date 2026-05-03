-- Run in Supabase SQL editor

create table if not exists public.crypto_coins (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text not null,
  image_url text not null,
  price numeric not null default 1,
  change_24h numeric not null default 0,
  volatility numeric not null default 1,
  market_cap numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.crypto_holdings (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  coin_id uuid not null references public.crypto_coins(id) on delete cascade,
  amount numeric not null default 0,
  avg_price numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (username, coin_id)
);

alter table public.crypto_coins  enable row level security;
alter table public.crypto_holdings enable row level security;

drop policy if exists "coins read"  on public.crypto_coins;
drop policy if exists "coins write" on public.crypto_coins;
create policy "coins read"  on public.crypto_coins  for select using (true);
create policy "coins write" on public.crypto_coins  for all    using (true) with check (true);

drop policy if exists "hold read"  on public.crypto_holdings;
drop policy if exists "hold write" on public.crypto_holdings;
create policy "hold read"  on public.crypto_holdings for select using (true);
create policy "hold write" on public.crypto_holdings for all    using (true) with check (true);

-- Price history table (persistent chart data)
create table if not exists public.crypto_price_history (
  id          bigserial primary key,
  coin_id     uuid not null references public.crypto_coins(id) on delete cascade,
  price       numeric not null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_price_history_coin_time
  on public.crypto_price_history (coin_id, recorded_at desc);

alter table public.crypto_price_history enable row level security;

drop policy if exists "hist read"  on public.crypto_price_history;
drop policy if exists "hist write" on public.crypto_price_history;
create policy "hist read"  on public.crypto_price_history for select using (true);
create policy "hist write" on public.crypto_price_history for all    using (true) with check (true);
