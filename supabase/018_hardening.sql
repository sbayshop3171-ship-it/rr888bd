-- 018: the security pass of 2026-09-12 — "site er security ta hard koro".
--
-- An audit of every table, grant and function after 017 found these; each
-- block says what it closes. Needs 017 (pay_withdrawal_charge below is 017's
-- body plus one check). Safe to run more than once.
--
--   1. the money leaves at the TrxID or at Approve now (014/016), but the
--      bonus-turnover and withdraw-lock checks only ran at request time —
--      claim a bonus after asking, lose the stake, send the TrxID, and bonus
--      money walked out with its turnover unbet. Both debits check again.
--   2. the first transaction password needed no password at all — a session
--      left open on a shared phone could set one, and from then on withdraw
--      with it. It now needs the login password; wrong guesses at either lock
--      the account's password checks for 15 minutes after 5.
--   3. signup took the phone number from client metadata, so a profile could
--      claim a number that was not its login. It comes from the login now.
--   4. `settings` had row-level security off (anyone with the public key
--      could write it); account_block() answered for any player id.
--   5. set_withdrawal_charge (007) is a leftover that writes a charge TrxID
--      past every 015–017 check. Dropped.
--   6. a promo code's limit was a count, then a separate payout — fifty
--      claims at once all passed "49 used". Counted and paid under one lock.
--   7. bonus claims summed the last 1,000 ledger rows; a busy player's older
--      rows fell out. The sums come from the database now.

-- ============================================================
-- 0. password attempts
-- ============================================================

create table if not exists security_attempts (
  user_id      uuid primary key references profiles(id) on delete cascade,
  fails        int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);
alter table security_attempts enable row level security;
revoke all on security_attempts from anon, authenticated;

-- Seconds this player's password checks are shut for; 0 when open.
create or replace function password_lock_left(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(greatest(0, ceil(extract(epoch from (locked_until - now()))))::int, 0)
    from security_attempts where user_id = p_user
  union all select 0 limit 1;
$$;

-- Record one check. A success clears the count; the fifth failure in a row
-- shuts checks for 15 minutes. Returns password_lock_left afterwards.
create or replace function password_attempt(p_user uuid, p_ok boolean)
returns int language plpgsql security definer set search_path = public as $$
begin
  if p_ok then
    delete from security_attempts where user_id = p_user;
    return 0;
  end if;
  insert into security_attempts (user_id, fails, updated_at) values (p_user, 1, now())
  on conflict (user_id) do update
     set fails = case when security_attempts.locked_until is not null
                       and security_attempts.locked_until <= now() then 1
                      else security_attempts.fails + 1 end,
         locked_until = case when security_attempts.locked_until is not null
                              and security_attempts.locked_until <= now() then null
                             else security_attempts.locked_until end,
         updated_at = now();
  update security_attempts
     set locked_until = now() + interval '15 minutes'
   where user_id = p_user and fails >= 5 and locked_until is null;
  return password_lock_left(p_user);
end;
$$;

revoke all on function password_lock_left(uuid) from public, anon, authenticated;
revoke all on function password_attempt(uuid, boolean) from public, anon, authenticated;

-- ============================================================
-- 2. transaction password: the first one needs the login password
-- ============================================================
-- Returns 'ok', 'wrong' or 'locked' instead of raising, so a wrong guess
-- is counted (an exception would roll the count back with it).

drop function if exists set_transaction_password(text, text);
create function set_transaction_password(p_new text, p_old text default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  uid   uuid := auth.uid();
  cur   text;
  login text;
  ok    boolean;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_new is null or length(p_new) < 6 then
    raise exception 'transaction password too short' using errcode = 'invalid_parameter_value';
  end if;
  if password_lock_left(uid) > 0 then return 'locked'; end if;

  select txn_password into cur from security_settings where user_id = uid for update;
  if nullif(btrim(cur), '') is not null then
    ok := p_old is not null and cur = crypt(p_old, cur);
  else
    -- the first one: proven with the login password
    select encrypted_password into login from auth.users where id = uid;
    ok := p_old is not null and login is not null and login = crypt(p_old, login);
  end if;
  if not ok then
    perform password_attempt(uid, false);
    return case when password_lock_left(uid) > 0 then 'locked' else 'wrong' end;
  end if;
  perform password_attempt(uid, true);

  insert into security_settings (user_id, txn_password, updated_at)
       values (uid, crypt(p_new, gen_salt('bf')), now())
  on conflict (user_id) do update
      set txn_password = excluded.txn_password,
          updated_at   = now();
  return 'ok';
end;
$$;

revoke all on function set_transaction_password(text, text) from public, anon;
grant execute on function set_transaction_password(text, text) to authenticated;

create or replace function verify_transaction_password(p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  cur text;
  ok  boolean;
begin
  if uid is null then return false; end if;
  if password_lock_left(uid) > 0 then return false; end if;
  select txn_password into cur from security_settings where user_id = uid;
  if nullif(btrim(cur), '') is null then return false; end if;
  ok := p_password is not null and cur = crypt(p_password, cur);
  perform password_attempt(uid, ok);
  return ok;
end;
$$;

revoke all on function verify_transaction_password(text) from public, anon;
grant execute on function verify_transaction_password(text) to authenticated;

-- ============================================================
-- 1. the debit checks turnover and the lock again
-- ============================================================

create or replace function pay_withdrawal_charge(
  p_id      bigint,
  p_user    uuid,
  p_charge  bigint,
  p_channel text default null,
  p_trx     text default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  w       withdrawals%rowtype;
  trx     text := nullif(upper(regexp_replace(coalesce(p_trx, ''), '[^A-Za-z0-9]', '', 'g')), '');
  channel text;
  had     text;
  t_need  bigint;
  t_done  bigint;
begin
  select * into w from withdrawals where id = p_id and user_id = p_user for update;
  if not found then
    raise exception 'withdrawal % not found', p_id using errcode = 'no_data_found';
  end if;
  if w.state <> 'pending' then
    raise exception 'withdrawal % already %', p_id, w.state using errcode = 'invalid_parameter_value';
  end if;

  if trx is not null then
    had := nullif(upper(regexp_replace(coalesce(w.charge_trx_id, ''), '[^A-Za-z0-9]', '', 'g')), '');
    if had is not null and had <> trx then
      raise exception 'txn locked' using errcode = 'invalid_parameter_value';
    end if;

    channel := lower(coalesce(nullif(btrim(p_channel), ''), w.charge_channel_id, ''));
    if channel = 'bkash' and length(trx) <> 10 then
      raise exception 'txn format' using errcode = 'check_violation',
        hint = 'A bKash TrxID has 10 characters';
    end if;
    if length(trx) < 6 or length(trx) > 20 or trx ~ '^(.)\1+$' then
      raise exception 'txn format' using errcode = 'check_violation';
    end if;

    perform pg_advisory_xact_lock(hashtext('txn:' || trx));
    if txn_taken(trx, p_id) then
      raise exception 'txn used' using errcode = 'unique_violation';
    end if;
  end if;

  -- the money leaves with the TrxID, once; balance >= 0 aborts a short wallet
  if trx is not null and not w.debited then
    -- 018: what was true when they asked has to be true when the money goes
    if exists (select 1 from profiles where id = p_user and withdraw_locked) then
      raise exception 'account locked' using errcode = 'insufficient_privilege';
    end if;
    select turnover_need, turnover_done into t_need, t_done
      from wallets where user_id = p_user for update;
    if coalesce(t_need, 0) > coalesce(t_done, 0) then
      raise exception 'turnover left %', t_need - t_done using errcode = 'invalid_parameter_value';
    end if;
    perform wallet_apply(p_user, 'withdraw', -w.amount, 'withdraw:' || p_id);
  end if;

  update withdrawals
     set charge_amount     = case when coalesce(charge_amount, 0) > 0 then charge_amount
                                  else coalesce(p_charge, charge_amount) end,
         charge_channel_id = coalesce(nullif(btrim(p_channel), ''), charge_channel_id),
         charge_trx_id     = coalesce(trx, charge_trx_id),
         charge_paid_at    = case when trx is not null and charge_paid_at is null then now()
                                  else charge_paid_at end,
         debited           = debited or trx is not null
   where id = p_id;

  return trx is not null;
end;
$$;

revoke all on function pay_withdrawal_charge(bigint, uuid, bigint, text, text) from public, anon, authenticated;

create or replace function approve_withdrawal(p_id bigint, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  w      withdrawals%rowtype;
  t_need bigint;
  t_done bigint;
begin
  select * into w from withdrawals where id = p_id for update;

  if not found then
    raise exception 'withdrawal % not found', p_id using errcode = 'no_data_found';
  end if;
  if w.state <> 'pending' then
    raise exception 'withdrawal % already %', p_id, w.state using errcode = 'invalid_parameter_value';
  end if;

  if not w.debited then
    -- 018: a request that has not taken its money yet takes it only if the
    -- turnover is done and nobody has locked the account since
    if exists (select 1 from profiles where id = w.user_id and withdraw_locked) then
      raise exception 'account locked' using errcode = 'insufficient_privilege';
    end if;
    select turnover_need, turnover_done into t_need, t_done
      from wallets where user_id = w.user_id for update;
    if coalesce(t_need, 0) > coalesce(t_done, 0) then
      raise exception 'turnover left %', t_need - t_done using errcode = 'invalid_parameter_value';
    end if;
    -- balance >= 0 is a check constraint: a player who has spent the money
    -- since asking aborts the approval here, and the request stays pending
    perform wallet_apply(w.user_id, 'withdraw', -w.amount, 'withdraw:' || p_id);
  end if;

  update withdrawals
     set state = 'approved', admin_note = p_note, reviewed_at = now(), debited = true
   where id = p_id;
end;
$$;

revoke all on function approve_withdrawal(bigint, text) from public, anon, authenticated;

-- ============================================================
-- 3. signup: the phone is the login, nothing else
-- ============================================================
-- Every signup comes from the register page, whose login is
-- <11-digit phone>@id.rr888bd.site (rr888bd.local before 2026-09). Anything
-- else is refused rather than given a profile with a made-up phone.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  login_phone text := split_part(coalesce(new.email, ''), '@', 1);
  meta_ref    text := nullif(lower(trim(new.raw_user_meta_data ->> 'referral_code')), '');
  meta_agent  text := nullif(upper(trim(new.raw_user_meta_data ->> 'agent_code')), '');
  inviter     uuid;
begin
  if coalesce(new.email, '') !~ '^01[0-9]{9}@(id\.rr888bd\.site|rr888bd\.local)$' then
    raise exception 'signup must use a phone login' using errcode = 'check_violation';
  end if;

  if meta_ref is not null then
    select id into inviter from profiles where referral_code = meta_ref;
  end if;

  insert into profiles (id, phone, referred_by, agent_code)
  values (new.id, login_phone, inviter, meta_agent);

  insert into wallets (user_id) values (new.id);
  return new;
end;
$$;

-- ============================================================
-- 4. settings, account_block, a definer view
-- ============================================================

alter table if exists settings enable row level security;
revoke all on table settings from anon, authenticated;

-- a player asks about themselves only
create or replace function my_account_block()
returns text language sql stable security definer set search_path = public as $$
  select account_block(auth.uid());
$$;
revoke all on function my_account_block() from public, anon;
grant execute on function my_account_block() to authenticated;

drop policy if exists "raise deposit" on deposits;
create policy "raise deposit" on deposits
  for insert with check (user_id = auth.uid() and my_account_block() is distinct from 'banned');

revoke execute on function account_block(uuid) from authenticated;

do $$ begin
  if to_regclass('public.aviator_rounds_public') is not null then
    execute 'alter view aviator_rounds_public set (security_invoker = on)';
  end if;
end $$;

-- ============================================================
-- 5. the leftover charge writer
-- ============================================================

drop function if exists set_withdrawal_charge(bigint, bigint, text, text, text);

-- ============================================================
-- 6. a promo code's limit, counted and paid under one lock
-- ============================================================

create or replace function claim_promo(
  p_user uuid, p_ref text, p_amount bigint, p_turnover bigint, p_limit int
) returns bigint language plpgsql security definer set search_path = public as $$
declare used int;
begin
  perform pg_advisory_xact_lock(hashtext('promo:' || p_ref));
  if coalesce(p_limit, 0) > 0 then
    select count(*) into used from transactions where ref = p_ref;
    if used >= p_limit then
      raise exception 'code used up' using errcode = 'check_violation';
    end if;
  end if;
  return credit_bonus(p_user, 'bonus', p_amount, p_ref, p_turnover);
end;
$$;

revoke all on function claim_promo(uuid, text, bigint, bigint, int) from public, anon, authenticated;

-- ============================================================
-- 7. the sums a bonus claim needs, over the whole ledger
-- ============================================================

create or replace function bonus_facts(p_user uuid, p_from timestamptz, p_to timestamptz)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'deposited', coalesce(sum(amount) filter (where kind = 'deposit'), 0),
    'staked',    coalesce(-sum(amount) filter (where kind = 'bet' and created_at >= p_from and created_at < p_to), 0),
    'won',       coalesce(sum(amount) filter (where kind = 'win' and created_at >= p_from and created_at < p_to), 0)
  )
  from transactions where user_id = p_user;
$$;

revoke all on function bonus_facts(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ============================================================
-- the service role gets back what the revokes took
-- ============================================================

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function password_lock_left(uuid)                               to service_role;
    grant execute on function password_attempt(uuid, boolean)                        to service_role;
    grant execute on function pay_withdrawal_charge(bigint, uuid, bigint, text, text) to service_role;
    grant execute on function approve_withdrawal(bigint, text)                       to service_role;
    grant execute on function account_block(uuid)                                    to service_role;
    grant execute on function claim_promo(uuid, text, bigint, bigint, int)           to service_role;
    grant execute on function bonus_facts(uuid, timestamptz, timestamptz)            to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';

-- What you should see: seven rows.
select 'table security_attempts' as added where to_regclass('public.security_attempts') is not null
union all select 'function ' || proname from pg_proc
 where proname in ('password_attempt', 'claim_promo', 'bonus_facts', 'my_account_block')
union all select 'settings RLS on' from pg_class where relname = 'settings' and relrowsecurity
union all select 'set_withdrawal_charge gone'
 where not exists (select 1 from pg_proc where proname = 'set_withdrawal_charge');
