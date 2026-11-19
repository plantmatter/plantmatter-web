-- PLANT MATTER WEB / 04 — 아이디 · 본인인증 정보 칸
-- web01·web02 를 실행한 프로젝트의 SQL Editor 에서 한 번 실행하세요. 다시 실행해도 안전합니다.
--
-- 1) 지금까지의 '이름'(shop_customers.name)은 이제 '아이디'로 씁니다.
--    · 2~20자, 한글·영문·숫자와 . _ - 만 (띄어쓰기 없음) — 새로 정하거나 바꿀 때만 확인 (이미 쓰던 값은 그대로 유지 가능)
--    · 다른 회원과 겹치지 않게 (대소문자 구분 없이)
--    · 2번까지 바로 변경, 그 뒤로는 마지막 변경 후 60일 (web02 규칙 그대로)
-- 2) 본인인증(PASS 등)으로 받을 이름 · 생년월일 · 성별 칸을 만듭니다. 아직 본인인증은 켜지 않았으므로 비어 있습니다.
--    · 이 칸들은 서버(본인인증 확인 함수)만 쓸 수 있고, 회원이 직접 바꿀 수 없습니다.
--    · 본인인증을 마친 회원은 휴대폰 번호도 인증된 번호로 고정됩니다.
--
-- ※ 주민등록번호는 저장하지 않습니다. 법령 근거 없이 주민등록번호를 수집·저장하는 것은 금지되어 있습니다
--   (개인정보 보호법 제24조의2). 화면의 '주민등록번호' 칸은 생년월일·성별로 900101-1****** 처럼
--   앞 6자리와 뒷자리 첫 숫자만 만들어 보여 주며, 뒷자리 나머지는 어디에도 없습니다.

-- 1. 본인인증 정보 칸 (서버만 기록) ------------------------------------------------------------
alter table public.shop_customers add column if not exists real_name text not null default '';
alter table public.shop_customers add column if not exists birth_date date;
alter table public.shop_customers add column if not exists gender text;
alter table public.shop_customers add column if not exists foreigner boolean not null default false;
alter table public.shop_customers add column if not exists identity_verified_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'shop_customers_real_name_len') then
    alter table public.shop_customers add constraint shop_customers_real_name_len check (char_length(real_name) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shop_customers_gender_val') then
    alter table public.shop_customers add constraint shop_customers_gender_val check (gender is null or gender in ('M', 'F'));
  end if;
end $$;

-- 2. 아이디: 겹치지 않게 ------------------------------------------------------------------------
-- 혹시 이미 같은 값이 있으면 나중에 만든 쪽 뒤에 _ + 5글자를 붙여 구분 (지금은 회원이 적어 대부분 해당 없음)
with ranked as (
  select id, row_number() over (partition by lower(btrim(name)) order by created_at, id) as rn
  from public.shop_customers where btrim(name) <> ''
)
update public.shop_customers c
  set name = left(btrim(c.name), 14) || '_' || substr(replace(c.id::text, '-', ''), 1, 5), updated_at = now()
  from ranked r where r.id = c.id and r.rn > 1;
create unique index if not exists shop_customers_id_unique
  on public.shop_customers (lower(btrim(name))) where btrim(name) <> '';

-- 가입 화면에서 아이디를 쓸 수 있는지 미리 확인 (로그인 전에도 사용)
create or replace function public.shop_id_available(p_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select btrim(coalesce(p_id, '')) ~ '^[가-힣A-Za-z0-9._-]{2,20}$'
     and not exists (
       select 1 from public.shop_customers c
       where lower(btrim(c.name)) = lower(btrim(p_id)) and c.id is distinct from (select auth.uid()));
$$;
revoke all on function public.shop_id_available(text) from public;
grant execute on function public.shop_id_available(text) to anon, authenticated;

-- 3. 웹 회원가입 때: 아이디가 형식에 맞지 않거나 이미 쓰이고 있으면 비워 둠 (마이페이지에서 다시 정함)
create or replace function public.create_shop_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s jsonb := new.raw_user_meta_data -> 'shop';
  v_id text;
begin
  if s is null or jsonb_typeof(s) <> 'object' then
    return new;
  end if;
  v_id := btrim(coalesce(s ->> 'name', ''));
  if v_id !~ '^[가-힣A-Za-z0-9._-]{2,20}$'
     or exists (select 1 from public.shop_customers c where lower(btrim(c.name)) = lower(v_id)) then
    v_id := '';
  end if;
  begin
    insert into public.shop_customers (id, name, phone, zip, addr, addr2, marketing_consent,
      terms_accepted_at, privacy_accepted_at, age_confirmed_at, marketing_consented_at)
    values (
      new.id,
      v_id,
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

-- 4. 마이페이지 저장: 아이디 형식·중복 확인 + 변경 제한(web02) + 본인인증 회원은 휴대폰 고정 ----------
create or replace function public.save_shop_customer(
  p_name text, p_phone text, p_zip text, p_addr text, p_addr2 text,
  p_marketing boolean default false,
  p_accept_terms boolean default false, p_accept_privacy boolean default false, p_confirm_age boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.shop_customers%rowtype;
  v_exists boolean;
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := left(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 15);
  v_changed boolean := false;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into v_row from public.shop_customers c where c.id = v_uid;
  v_exists := found;
  if not v_exists then
    if not (coalesce(p_accept_terms, false) and coalesce(p_accept_privacy, false) and coalesce(p_confirm_age, false)) then
      raise exception 'consent required' using errcode = '22023';
    end if;
  end if;
  -- 아이디: 새로 정하거나 바꿀 때만 형식 확인 (예전부터 쓰던 값을 그대로 두는 것은 허용)
  if not (v_exists and v_name = v_row.name and v_name <> '') then
    if v_name !~ '^[가-힣A-Za-z0-9._-]{2,20}$' then
      raise exception 'id_invalid' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from public.shop_customers c where lower(btrim(c.name)) = lower(v_name) and c.id <> v_uid) then
    raise exception 'id_taken' using errcode = '23505';
  end if;
  if v_exists then
    v_changed := v_row.name <> '' and v_name is distinct from v_row.name;
    if v_changed and v_row.name_change_count >= 2 and v_row.name_changed_at > now() - interval '60 days' then
      raise exception 'name_locked:%',
        to_char((v_row.name_changed_at + interval '60 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        using errcode = 'P0001';
    end if;
    if v_row.identity_verified_at is not null then
      v_phone := v_row.phone;   -- 본인인증한 번호로 고정
    end if;
  end if;
  insert into public.shop_customers as c (id, name, phone, zip, addr, addr2, marketing_consent,
    terms_accepted_at, privacy_accepted_at, age_confirmed_at, marketing_consented_at, updated_at)
  values (
    v_uid, v_name, v_phone,
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
    name_change_count = c.name_change_count + case when v_changed then 1 else 0 end,
    name_changed_at = case when v_changed then now() else c.name_changed_at end,
    updated_at = now();
end $$;
revoke all on function public.save_shop_customer(text, text, text, text, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_shop_customer(text, text, text, text, text, boolean, boolean, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';

-- 확인: select name as 아이디, real_name, birth_date, gender, identity_verified_at from public.shop_customers;
