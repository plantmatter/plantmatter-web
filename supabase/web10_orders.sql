-- PLANT MATTER — web10: 주문 (결제창 연결)
-- 흐름: 주문 버튼 → Edge Function 'shop-payment' action=create (서버가 DB 가격으로 금액 계산 · 주문번호 발급 · pending 저장)
--       → 토스 결제창 → /checkout/success/ → action=confirm (재고 잡기 → 토스 승인 → paid / 실패면 재고 되돌림)
-- ▸ 주문 표는 서버(Edge Function, 서버 키)만 쓰고, 회원은 자기 주문만 읽기, 관리자는 모두 읽기·상태 바꾸기
-- ▸ 테스트 키(test_…)로 받은 주문은 test = true, 재고는 확인만 하고 줄이지 않음
-- 여러 번 실행해도 안전합니다.

create table if not exists public.shop_orders (
  id          text primary key check (id ~ '^[A-Za-z0-9_-]{6,64}$'),   -- 토스 orderId 규칙
  user_id     uuid references auth.users (id) on delete set null,      -- 로그인한 회원 (비회원 주문이면 null)
  status      text not null default 'pending'
              check (status in ('pending', 'reserved', 'paid', 'waiting', 'shipped', 'failed', 'canceled')),
  test        boolean not null default false,
  order_name  text not null,
  amount      integer not null check (amount > 0),   -- 결제 금액 = subtotal + shipping
  subtotal    integer not null,
  shipping    integer not null default 0,
  items       jsonb not null,   -- [{ id, name, price, qty }]
  buyer       jsonb not null,   -- { name, email, phone }
  ship        jsonb not null,   -- { name, phone, zip, addr, addr2, memo }
  lang        text,
  payment_key text,
  method      text,             -- 카드 · 가상계좌 · 간편결제 …
  approved_at timestamptz,
  receipt_url text,
  pay_info    jsonb,            -- 가상계좌 정보 등 (은행 · 계좌번호 · 입금 기한)
  fail_reason text,
  ip_hash     text,
  email_error text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists shop_orders_user_idx on public.shop_orders (user_id, created_at desc);
create index if not exists shop_orders_created_idx on public.shop_orders (created_at desc);

alter table public.shop_orders enable row level security;
drop policy if exists shop_orders_own_read on public.shop_orders;
create policy shop_orders_own_read on public.shop_orders for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());
drop policy if exists shop_orders_admin_update on public.shop_orders;
create policy shop_orders_admin_update on public.shop_orders for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
revoke all on public.shop_orders from anon;
grant select, update on public.shop_orders to authenticated;

-- ---------- 재고 잡기: 모든 상품이 판매 중이고 재고가 충분하면 재고를 줄이고 reserved ----------
-- 테스트 주문은 확인만 (줄이지 않음). 하나라도 모자라면 'soldout:<상품 id>' 오류 → 아무것도 줄지 않음
create or replace function public.shop_order_reserve(p_id text) returns text
language plpgsql security definer set search_path = public as $$
declare
  o public.shop_orders;
  it jsonb;
  q integer;
  p public.shop_products;
begin
  select * into o from public.shop_orders where id = p_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'pending' then return o.status; end if;
  for it in select * from jsonb_array_elements(o.items) loop
    q := (it ->> 'qty')::integer;
    select * into p from public.shop_products where id = it ->> 'id' for update;
    if not found or p.status <> 'available' or p.price is null or (p.stock is not null and p.stock < q) then
      raise exception 'soldout:%', it ->> 'id';
    end if;
    if not o.test and p.stock is not null then
      update public.shop_products set stock = stock - q, updated_at = now() where id = p.id;
    end if;
  end loop;
  update public.shop_orders set status = 'reserved', updated_at = now() where id = p_id;
  return 'reserved';
end $$;

-- ---------- 재고 되돌리기: 승인 실패 · 입금 기한 지남 · 취소 ----------
create or replace function public.shop_order_release(p_id text, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.shop_orders;
  it jsonb;
begin
  if p_status not in ('failed', 'canceled') then raise exception 'bad_status'; end if;
  select * into o from public.shop_orders where id = p_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status in ('reserved', 'waiting', 'paid') and not o.test then
    for it in select * from jsonb_array_elements(o.items) loop
      update public.shop_products set stock = stock + (it ->> 'qty')::integer, updated_at = now()
        where id = it ->> 'id' and stock is not null;
    end loop;
  end if;
  if o.status in ('pending', 'reserved', 'waiting', 'paid') then
    update public.shop_orders set status = p_status, fail_reason = left(coalesce(p_reason, ''), 300), updated_at = now() where id = p_id;
  end if;
end $$;

revoke all on function public.shop_order_reserve(text) from public, anon, authenticated;
revoke all on function public.shop_order_release(text, text, text) from public, anon, authenticated;
grant execute on function public.shop_order_reserve(text) to service_role;
grant execute on function public.shop_order_release(text, text, text) to service_role;

-- 확인: select id, status, test, amount, order_name, created_at from public.shop_orders order by created_at desc limit 20;
