-- =====================================================================
-- MIGRATION V2 — новые фичи (кейсы, трейд, рефки, редкая валюта, избранное)
-- Запусти ЦЕЛИКОМ в Supabase SQL Editor (он идемпотентен).
-- =====================================================================

-- ── users: новые поля ─────────────────────────────────────────────────
alter table public.users add column if not exists favorites uuid[] not null default '{}';
alter table public.users add column if not exists referral_code text;
alter table public.users add column if not exists referred_by text;
alter table public.users add column if not exists rare_balance integer not null default 0;
create unique index if not exists users_referral_code_key on public.users (referral_code) where referral_code is not null;

-- Сгенерить рефкоды для тех, у кого их нет
update public.users
   set referral_code = upper(substr(md5(username || id::text), 1, 8))
 where referral_code is null;

-- ── nft_owners: метка "избранное" (на случай если favorites через id NFT неудобно) ─
-- favorites хранится в users.favorites как массив nft_owners.id (uuid)

-- ── cases (6 шт) ──────────────────────────────────────────────────────
create table if not exists public.cases (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  price       integer not null,
  image_url   text,
  min_price   integer not null default 1,     -- мин цена NFT, который может выпасть
  max_price   integer not null default 1000,  -- макс цена NFT, который может выпасть
  rarity_bias numeric not null default 1.0,   -- >1 = чаще дорогие, <1 = чаще дешёвые
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.cases enable row level security;
drop policy if exists "cases read"  on public.cases;
drop policy if exists "cases write" on public.cases;
create policy "cases read"  on public.cases for select using (true);
create policy "cases write" on public.cases for all    using (true) with check (true);

-- сидим 6 кейсов (если ещё пусто)
insert into public.cases (slug, name, price, min_price, max_price, rarity_bias, sort_order)
select * from (values
  ('starter',  'Стартовий',     100,     1,    300,  0.5, 1),
  ('bronze',   'Бронзовий',     500,    50,   1500,  0.7, 2),
  ('silver',   'Срібний',      2000,   200,   6000,  0.9, 3),
  ('gold',     'Золотий',     10000,  1000,  30000,  1.1, 4),
  ('platinum', 'Платиновий',  50000,  5000, 150000,  1.4, 5),
  ('legend',   'Легендарний',250000, 25000, 999999,  1.8, 6)
) as v(slug,name,price,min_price,max_price,rarity_bias,sort_order)
on conflict (slug) do nothing;

-- ── trades (P2P обмен NFT и валюты) ───────────────────────────────────
create table if not exists public.trades (
  id           uuid primary key default gen_random_uuid(),
  from_nick    text not null,
  to_nick      text not null,
  nft_owner_id uuid references public.nft_owners(id) on delete set null,
  amount_cr    integer not null default 0, -- сколько CR от sender → receiver
  amount_rc    integer not null default 0, -- сколько редкой валюты
  fee_cr       integer not null default 0,
  status       text    not null default 'pending', -- pending | accepted | declined | cancelled
  message      text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
alter table public.trades enable row level security;
drop policy if exists "trades read"  on public.trades;
drop policy if exists "trades write" on public.trades;
create policy "trades read"  on public.trades for select using (true);
create policy "trades write" on public.trades for all    using (true) with check (true);

-- ── referrals (анти-абуз) ─────────────────────────────────────────────
create table if not exists public.referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_nick text not null,
  referred_nick text not null unique,    -- 1 юзер = 1 реферрер
  reward_paid   boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.referrals enable row level security;
drop policy if exists "ref read"  on public.referrals;
drop policy if exists "ref write" on public.referrals;
create policy "ref read"  on public.referrals for select using (true);
create policy "ref write" on public.referrals for all    using (true) with check (true);

-- ── rare currency supply tracker (всего 500 на всю игру) ─────────────
create table if not exists public.rare_currency (
  id            int primary key default 1,
  total_supply  int not null default 500,
  minted        int not null default 0,
  updated_at    timestamptz not null default now(),
  constraint rc_singleton check (id = 1)
);
insert into public.rare_currency (id) values (1) on conflict (id) do nothing;
alter table public.rare_currency enable row level security;
drop policy if exists "rc read"  on public.rare_currency;
drop policy if exists "rc write" on public.rare_currency;
create policy "rc read"  on public.rare_currency for select using (true);
create policy "rc write" on public.rare_currency for all    using (true) with check (true);

-- ── атомарный mint редкой валюты ──────────────────────────────────────
create or replace function public.mint_rare(_to text, _amount int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean := false;
begin
  update public.rare_currency
     set minted = minted + _amount,
         updated_at = now()
   where id = 1 and (minted + _amount) <= total_supply
   returning true into ok;
  if ok then
    update public.users set rare_balance = rare_balance + _amount where username = _to;
  end if;
  return coalesce(ok, false);
end $$;
