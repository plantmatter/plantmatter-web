-- PLANT MATTER WEB / 03 — 추가 배송지 (기본 배송지 외에 2곳까지)
-- web01 을 실행한 프로젝트의 SQL Editor 에서 한 번 실행하세요. 다시 실행해도 안전합니다.
-- 기본 배송지는 지금처럼 shop_customers 에 있고, 여기에는 추가 배송지만 저장합니다.
-- 본인만 보고 · 추가하고 · 고치고 · 지울 수 있으며, 한 사람당 2곳을 넘으면 서버가 거절합니다.
-- 계정을 삭제하면 함께 지워집니다 (on delete cascade).

create table if not exists public.shop_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null default '' check (char_length(label) <= 20),            -- 배송지 이름 (예: 회사, 부모님 댁)
  name text not null check (char_length(btrim(name)) between 1 and 40),       -- 받는 분
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  zip text not null check (zip ~ '^[0-9]{5}$'),
  addr text not null check (char_length(btrim(addr)) between 1 and 120),
  addr2 text not null default '' check (char_length(addr2) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_addresses_user_idx on public.shop_addresses (user_id, created_at);

alter table public.shop_addresses enable row level security;
drop policy if exists "Own addresses read" on public.shop_addresses;
drop policy if exists "Own addresses add" on public.shop_addresses;
drop policy if exists "Own addresses edit" on public.shop_addresses;
drop policy if exists "Own addresses remove" on public.shop_addresses;
create policy "Own addresses read" on public.shop_addresses for select to authenticated using (user_id = (select auth.uid()));
create policy "Own addresses add" on public.shop_addresses for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Own addresses edit" on public.shop_addresses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own addresses remove" on public.shop_addresses for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.shop_addresses from anon, authenticated;
grant select, insert, update, delete on public.shop_addresses to authenticated;

-- 한 사람당 2곳까지 (동시에 두 번 눌러도 넘지 않게 잠금 후 확인)
create or replace function public.shop_addresses_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('shop_addresses:' || new.user_id::text));
  if (select count(*) from public.shop_addresses a where a.user_id = new.user_id) >= 2 then
    raise exception 'address_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.shop_addresses_limit() from public, anon, authenticated;
drop trigger if exists shop_addresses_limit on public.shop_addresses;
create trigger shop_addresses_limit before insert on public.shop_addresses
  for each row execute function public.shop_addresses_limit();

-- 고칠 때: 수정 시각 갱신, 주인은 바꿀 수 없음
create or replace function public.shop_addresses_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.shop_addresses_touch() from public, anon, authenticated;
drop trigger if exists shop_addresses_touch on public.shop_addresses;
create trigger shop_addresses_touch before update on public.shop_addresses
  for each row execute function public.shop_addresses_touch();

notify pgrst, 'reload schema';

-- 확인: select user_id, label, name, zip, addr from public.shop_addresses order by created_at;
