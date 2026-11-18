-- PLANT MATTER WEB / 01 — 웹사이트 회원 정보 (쇼핑용)
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 한 번 실행하세요. 다시 실행해도 안전합니다.
--
-- PLANT MATTER 앱(plantmatter/plantmatter-app)과 같은 Supabase 프로젝트·같은 계정을 씁니다.
-- 앱의 schema.sql 을 먼저 실행한 프로젝트에 실행하세요. 이 파일은 앱의 테이블을 바꾸지 않습니다.
--   · 웹에서 가입해도 앱의 profiles 는 만들지 않습니다. 그 계정으로 앱에 처음 들어가면 앱이 이름·약관을 물어 만듭니다.
--   · 이름·휴대폰·배송지·동의 기록은 아래의 shop_customers 에만 저장되고, 본인만 읽을 수 있습니다.
--   · 계정을 삭제하면 shop_customers 의 줄도 함께 지워집니다 (on delete cascade).

-- 1. 회원 정보 테이블 ------------------------------------------------------------------
create table if not exists public.shop_customers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  phone text not null default '' check (phone ~ '^[0-9]{0,15}$'),
  zip text not null default '' check (zip ~ '^[0-9]{0,5}$'),
  addr text not null default '' check (char_length(addr) <= 120),
  addr2 text not null default '' check (char_length(addr2) <= 80),
  marketing_consent boolean not null default false,
  terms_accepted_at timestamptz,          -- [필수] 이용약관 동의 시각
  privacy_accepted_at timestamptz,        -- [필수] 개인정보 수집·이용 동의 시각
  age_confirmed_at timestamptz,           -- [필수] 만 14세 이상 확인 시각
  marketing_consented_at timestamptz,     -- [선택] 마케팅 수신 동의를 바꾼 마지막 시각
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 본인만 읽기. 쓰기는 아래 save_shop_customer() 로만 (동의 시각을 임의로 바꾸지 못하게)
alter table public.shop_customers enable row level security;
drop policy if exists "Customer reads own record" on public.shop_customers;
create policy "Customer reads own record" on public.shop_customers
  for select to authenticated using (id = (select auth.uid()));
revoke all on public.shop_customers from anon, authenticated;
grant select on public.shop_customers to authenticated;

-- 2. 웹 회원가입 때 입력한 정보 저장 (가입 확인 메일을 쓰는 경우에도 동작) -----------------------
-- 웹 가입 양식은 정보를 user metadata 의 "shop" 에 담아 보냅니다. 앱 가입에는 "shop" 이 없으므로 아무 일도 하지 않습니다.
-- 여기서 오류가 나도 가입 자체는 막지 않습니다 (회원 정보는 마이페이지에서 다시 저장 가능).
create or replace function public.create_shop_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s jsonb := new.raw_user_meta_data -> 'shop';
begin
  if s is null or jsonb_typeof(s) <> 'object' then
    return new;
  end if;
  begin
    insert into public.shop_customers (id, name, phone, zip, addr, addr2, marketing_consent,
      terms_accepted_at, privacy_accepted_at, age_confirmed_at, marketing_consented_at)
    values (
      new.id,
      left(btrim(coalesce(s ->> 'name', '')), 40),
      left(regexp_replace(coalesce(s ->> 'phone', ''), '[^0-9]', '', 'g'), 15),
      left(regexp_replace(coalesce(s ->> 'zip', ''), '[^0-9]', '', 'g'), 5),
      left(btrim(coalesce(s ->> 'addr', '')), 120),
      left(btrim(coalesce(s ->> 'addr2', '')), 80),
      coalesce((s ->> 'marketing')::boolean, false),
      case when coalesce((s ->> 'terms')::boolean, false) then now() end,
      case when coalesce((s ->> 'privacy')::boolean, false) then now() end,
      case when coalesce((s ->> 'age14')::boolean, false) then now() end,
      case when coalesce((s ->> 'marketing')::boolean, false) then now() end)
    on conflict (id) do nothing;
  exception when others then
    raise warning 'shop_customers insert skipped for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;
revoke all on function public.create_shop_customer() from public, anon, authenticated;

drop trigger if exists on_plantmatter_shop_signup on auth.users;
create trigger on_plantmatter_shop_signup
  after insert on auth.users
  for each row execute function public.create_shop_customer();

-- 3. 마이페이지에서 회원 정보 저장 ----------------------------------------------------------
-- 처음 저장할 때(앱 계정으로 웹에 처음 온 경우 등)는 필수 동의 3가지가 모두 있어야 합니다.
create or replace function public.save_shop_customer(
  p_name text, p_phone text, p_zip text, p_addr text, p_addr2 text,
  p_marketing boolean default false,
  p_accept_terms boolean default false, p_accept_privacy boolean default false, p_confirm_age boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_exists boolean;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select exists (select 1 from public.shop_customers c where c.id = v_uid) into v_exists;
  if not v_exists and not (coalesce(p_accept_terms, false) and coalesce(p_accept_privacy, false) and coalesce(p_confirm_age, false)) then
    raise exception 'consent required' using errcode = '22023';
  end if;
  insert into public.shop_customers as c (id, name, phone, zip, addr, addr2, marketing_consent,
    terms_accepted_at, privacy_accepted_at, age_confirmed_at, marketing_consented_at, updated_at)
  values (
    v_uid,
    left(btrim(coalesce(p_name, '')), 40),
    left(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 15),
    left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5),
    left(btrim(coalesce(p_addr, '')), 120),
    left(btrim(coalesce(p_addr2, '')), 80),
    coalesce(p_marketing, false),
    now(), now(), now(),
    case when coalesce(p_marketing, false) then now() end,
    now())
  on conflict (id) do update set
    name = excluded.name, phone = excluded.phone, zip = excluded.zip, addr = excluded.addr, addr2 = excluded.addr2,
    marketing_consent = excluded.marketing_consent,
    marketing_consented_at = case when c.marketing_consent is distinct from excluded.marketing_consent
      then now() else c.marketing_consented_at end,
    terms_accepted_at = coalesce(c.terms_accepted_at, excluded.terms_accepted_at),
    privacy_accepted_at = coalesce(c.privacy_accepted_at, excluded.privacy_accepted_at),
    age_confirmed_at = coalesce(c.age_confirmed_at, excluded.age_confirmed_at),
    updated_at = now();
end $$;
revoke all on function public.save_shop_customer(text, text, text, text, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_shop_customer(text, text, text, text, text, boolean, boolean, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';

-- 확인 (SQL Editor 에서):
--   select count(*) from public.shop_customers;
--   select tgname from pg_trigger where tgrelid = 'auth.users'::regclass;   -- on_plantmatter_shop_signup 이 보이면 정상
