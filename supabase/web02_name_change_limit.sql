-- PLANT MATTER WEB / 02 — 회원 이름 변경 제한
-- web01_shop_customers.sql 을 실행한 프로젝트의 SQL Editor 에서 한 번 실행하세요. 다시 실행해도 안전합니다.
--
-- 규칙: 가입 때 처음 정한 이름은 횟수에 들어가지 않음
--       그 뒤 2번까지는 바로 변경 가능
--       2번을 쓴 뒤로는 마지막으로 바꾼 날부터 60일이 지나야 다시 변경 가능 (그 뒤로도 매번 60일 간격)
-- 화면에서만 막으면 우회할 수 있어서, 저장 함수(save_shop_customer) 안에서 지킵니다.
-- 휴대폰·배송지·마케팅 동의는 이름이 잠겨 있어도 자유롭게 바꿀 수 있습니다.

alter table public.shop_customers add column if not exists name_change_count integer not null default 0;
alter table public.shop_customers add column if not exists name_changed_at timestamptz;

create or replace function public.save_shop_customer(
  p_name text, p_phone text, p_zip text, p_addr text, p_addr2 text,
  p_marketing boolean default false,
  p_accept_terms boolean default false, p_accept_privacy boolean default false, p_confirm_age boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.shop_customers%rowtype;
  v_name text := left(btrim(coalesce(p_name, '')), 40);
  v_changed boolean := false;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into v_row from public.shop_customers c where c.id = v_uid;
  if not found then
    if not (coalesce(p_accept_terms, false) and coalesce(p_accept_privacy, false) and coalesce(p_confirm_age, false)) then
      raise exception 'consent required' using errcode = '22023';
    end if;
  else
    -- 비어 있던 이름을 처음 채우는 것은 변경이 아님
    v_changed := v_row.name <> '' and v_name is distinct from v_row.name;
    if v_changed and v_row.name_change_count >= 2 and v_row.name_changed_at > now() - interval '60 days' then
      raise exception 'name_locked:%',
        to_char((v_row.name_changed_at + interval '60 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        using errcode = 'P0001';
    end if;
  end if;
  insert into public.shop_customers as c (id, name, phone, zip, addr, addr2, marketing_consent,
    terms_accepted_at, privacy_accepted_at, age_confirmed_at, marketing_consented_at, updated_at)
  values (
    v_uid,
    v_name,
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
    name_change_count = c.name_change_count + case when v_changed then 1 else 0 end,
    name_changed_at = case when v_changed then now() else c.name_changed_at end,
    updated_at = now();
end $$;
revoke all on function public.save_shop_customer(text, text, text, text, text, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.save_shop_customer(text, text, text, text, text, boolean, boolean, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';

-- 확인: select name, name_change_count, name_changed_at from public.shop_customers;
