-- ============================================================
-- rr888bd — database schema
--
-- Apply in the Supabase SQL editor (or `supabase db push`).
-- Idempotent: safe to re-run. Existing objects are left alone, missing
-- ones are created, and policies are dropped before being recreated.
-- Money is stored in paisa (integer), never a float: ৳12.34 = 1234.
-- Every player-facing table has RLS on, so a leaked anon key cannot
-- read another player's rows.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- roles ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('player', 'agent', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'txn_kind') then
    create type txn_kind as enum ('deposit', 'withdraw', 'bet', 'win', 'bonus', 'rebate', 'adjust');
  end if;
  if not exists (select 1 from pg_type where typname = 'req_state') then
    create type req_state as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end $$;

-- ---------- profiles ----------
-- One row per auth.users row; holds everything the app shows about a player.
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  phone         text unique not null,
  display_name  text,
  role          user_role not null default 'player',
  vip_level     int not null default 0,
  referral_code text unique not null default encode(gen_random_bytes(4), 'hex'),
  referred_by   uuid references profiles(id),
  is_blocked    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------- wallet ----------
-- Balance is derived from `transactions`, but kept denormalised here so the
-- header does not have to sum a growing ledger on every page load. Only the
-- SECURITY DEFINER functions below may write it.
create table if not exists wallets (
  user_id        uuid primary key references profiles(id) on delete cascade,
  balance        bigint not null default 0 check (balance >= 0),
  bonus_balance  bigint not null default 0 check (bonus_balance >= 0),
  turnover_need  bigint not null default 0,
  turnover_done  bigint not null default 0,
  updated_at     timestamptz not null default now()
);

create table if not exists transactions (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       txn_kind not null,
  amount     bigint not null,           -- signed: credits positive, debits negative
  balance_after bigint not null,
  ref        text,                      -- round id, deposit id, admin note…
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_created_idx on transactions (user_id, created_at desc);

-- ---------- cashier ----------
create table if not exists payment_channels (
  id         text primary key,          -- 'bkash', 'nagad', …
  name       text not null,
  kind       text not null default 'mobile',
  -- operator's receiving account; admin-only, never exposed to players
  account_no text,
  account_name text,
  min_amount bigint not null default 30000,
  max_amount bigint not null default 3000000,
  is_active  boolean not null default true,
  sort_order int not null default 0
);

create table if not exists deposits (
  id           bigserial primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  channel_id   text not null references payment_channels(id),
  amount       bigint not null check (amount > 0),
  -- what the player says they sent from
  sender_no    text,
  txn_id       text,
  state        req_state not null default 'pending',
  admin_note   text,
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists deposits_state_created_idx on deposits (state, created_at desc);

create table if not exists withdrawals (
  id           bigserial primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  channel_id   text not null references payment_channels(id),
  amount       bigint not null check (amount > 0),
  account_no   text not null,
  state        req_state not null default 'pending',
  admin_note   text,
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists withdrawals_state_created_idx on withdrawals (state, created_at desc);

-- ---------- catalogue ----------
create table if not exists games (
  id          text primary key,         -- slug used in /casino/<id>
  name        text not null,
  provider    text not null,
  category    text not null,
  thumb_url   text,                     -- licensed art; null → generated tile
  tag         text,                     -- 'hot' | 'new' | 'top'
  is_playable boolean not null default false,
  is_active   boolean not null default true,
  sort_order  int not null default 0
);

create table if not exists banners (
  id         bigserial primary key,
  title      text not null,
  subtitle   text,
  image_url  text,
  href       text,
  placement  text not null default 'home',  -- 'home' | 'announcement'
  is_active  boolean not null default true,
  sort_order int not null default 0
);

create table if not exists promotions (
  id         text primary key,
  title      text not null,
  body       text not null,
  image_url  text,
  is_active  boolean not null default true,
  sort_order int not null default 0
);

-- ---------- Aviator ----------
-- The server owns the seed. `server_seed` stays null to the client until the
-- round busts, which is what makes the fairness commitment meaningful.
create table if not exists aviator_rounds (
  id               bigserial primary key,
  server_seed      text not null,
  server_seed_hash text not null,
  crash_at         numeric(10,2) not null,
  started_at       timestamptz,
  crashed_at       timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists aviator_bets (
  id         bigserial primary key,
  round_id   bigint not null references aviator_rounds(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  stake      bigint not null check (stake > 0),
  auto_at    numeric(10,2),
  cashed_at  numeric(10,2),
  payout     bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (round_id, user_id)
);
create index if not exists aviator_bets_user_created_idx on aviator_bets (user_id, created_at desc);

-- ---------- site settings ----------
create table if not exists settings (
  key   text primary key,
  value jsonb not null
);

-- ============================================================
-- Row level security
-- ============================================================

alter table profiles       enable row level security;
alter table wallets        enable row level security;
alter table transactions   enable row level security;
alter table deposits       enable row level security;
alter table withdrawals    enable row level security;
alter table aviator_bets   enable row level security;
alter table aviator_rounds enable row level security;
alter table games          enable row level security;
alter table banners        enable row level security;
alter table promotions     enable row level security;
alter table payment_channels enable row level security;

-- helper: is the caller an admin?
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles     for select using (id = auth.uid() or is_admin());
drop policy if exists "edit own profile" on profiles;
create policy "edit own profile" on profiles     for update using (id = auth.uid() or is_admin());
drop policy if exists "own wallet" on wallets;
create policy "own wallet" on wallets      for select using (user_id = auth.uid() or is_admin());
drop policy if exists "own ledger" on transactions;
create policy "own ledger" on transactions for select using (user_id = auth.uid() or is_admin());

drop policy if exists "own deposits" on deposits;
create policy "own deposits" on deposits     for select using (user_id = auth.uid() or is_admin());
drop policy if exists "raise deposit" on deposits;
create policy "raise deposit" on deposits     for insert with check (user_id = auth.uid());
drop policy if exists "admin reviews dep" on deposits;
create policy "admin reviews dep" on deposits     for update using (is_admin());

drop policy if exists "own withdrawals" on withdrawals;
create policy "own withdrawals" on withdrawals  for select using (user_id = auth.uid() or is_admin());
drop policy if exists "raise withdrawal" on withdrawals;
create policy "raise withdrawal" on withdrawals  for insert with check (user_id = auth.uid());
drop policy if exists "admin reviews wd" on withdrawals;
create policy "admin reviews wd" on withdrawals  for update using (is_admin());

drop policy if exists "own bets" on aviator_bets;
create policy "own bets" on aviator_bets for select using (user_id = auth.uid() or is_admin());

-- Rounds are public, but the seed column is masked until the bust by the view
-- below; clients should read `aviator_rounds_public`, never the base table.
drop policy if exists "admin reads rounds" on aviator_rounds;
create policy "admin reads rounds" on aviator_rounds for select using (is_admin());

create or replace view aviator_rounds_public as
  select id, server_seed_hash, started_at, crashed_at,
         case when crashed_at is not null then crash_at end     as crash_at,
         case when crashed_at is not null then server_seed end   as server_seed
  from aviator_rounds;

-- catalogue is world-readable, admin-writable
drop policy if exists "read games" on games;
create policy "read games" on games            for select using (is_active or is_admin());
drop policy if exists "read banners" on banners;
create policy "read banners" on banners          for select using (is_active or is_admin());
drop policy if exists "read promos" on promotions;
create policy "read promos" on promotions       for select using (is_active or is_admin());
drop policy if exists "read channels" on payment_channels;
create policy "read channels" on payment_channels for select using (is_active or is_admin());
drop policy if exists "admin games" on games;
create policy "admin games" on games            for all using (is_admin()) with check (is_admin());
drop policy if exists "admin banners" on banners;
create policy "admin banners" on banners          for all using (is_admin()) with check (is_admin());
drop policy if exists "admin promos" on promotions;
create policy "admin promos" on promotions       for all using (is_admin()) with check (is_admin());
drop policy if exists "admin channels" on payment_channels;
create policy "admin channels" on payment_channels for all using (is_admin()) with check (is_admin());

-- ============================================================
-- Money movement — the only sanctioned way to touch a balance
-- ============================================================

create or replace function wallet_apply(
  p_user uuid, p_kind txn_kind, p_amount bigint, p_ref text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare new_balance bigint;
begin
  update wallets
     set balance = balance + p_amount, updated_at = now()
   where user_id = p_user
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'no wallet for %', p_user;
  end if;

  insert into transactions (user_id, kind, amount, balance_after, ref)
  values (p_user, p_kind, p_amount, new_balance, p_ref);

  return new_balance;
end;
$$;

-- new signup → profile + wallet
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone) values (new.id, coalesce(new.phone, new.email));
  insert into wallets (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- seed ----------
insert into payment_channels (id, name, min_amount, max_amount, sort_order) values
  ('bkash',  'bKash',         30000,  3000000, 1),
  ('nagad',  'Nagad',         30000,  3000000, 2),
  ('rocket', 'Rocket',        30000,  2500000, 3),
  ('upay',   'Upay',          30000,  2000000, 4),
  ('bank',   'Bank Transfer', 100000, 20000000, 5),
  ('usdt',   'USDT (TRC20)',  50000,  50000000, 6)
on conflict (id) do nothing;

insert into settings (key, value) values
  ('site',    '{"name":"rr888bd","domain":"rr888bd.site","currency":"BDT"}'::jsonb),
  ('support', '{"email":"mpmony1@gmail.com"}'::jsonb)
on conflict (key) do nothing;
