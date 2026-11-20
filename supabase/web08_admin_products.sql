-- PLANT MATTER 웹 — 관리자 페이지(/admin/)용: 제품 · 재고 데이터베이스, 제품 사진 보관함, 문의 보기
-- web05 ~ web07 다음에 한 번 실행합니다. 여러 번 실행해도 됩니다 (이미 있는 제품은 덮어쓰지 않음).
--
-- ▸ 관리자 = 앱과 같은 관리자 명단 public.app_admins (앱 schema.sql). 함수 public.is_app_admin() 으로 확인
--   관리자 등록:  insert into public.app_admins (user_id) select id from auth.users where lower(email) = lower('이메일') on conflict do nothing;
-- ▸ shop_products: 사이트가 읽는 제품 목록. 누구나 읽기(숨김 제외), 쓰기는 관리자만
--     status  : available(판매 중) · soldout(품절) · hidden(사이트에서 숨김)
--     stock   : 남은 수량 (비우면 수량 관리 안 함). 0 이면 사이트에 SOLD OUT
-- ▸ product-images: 관리자 페이지에서 올린 제품 사진 (공개 읽기, 관리자만 올리기)
-- ▸ 도매 문의 · 협업 제안 · 사업자등록증: 관리자만 읽기 · 지우기

-- ---------- 제품 ----------
create table if not exists public.shop_products (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  sort        integer not null default 0,
  category    text check (category is null or category ~ '^[a-z0-9-]{1,40}$'),     -- PLANT 분류 (tropical · orchid · fern · caudex)
  collab      text check (collab is null or collab ~ '^[a-z0-9-]{1,60}$'),         -- COLLABORATION 이름 (thichi-yuiitsumuni …)
  name        jsonb not null,                                                       -- {"ko": "…", "en": "…", "ja": "…"}
  sci         jsonb,                                                                -- 학명 ["이탤릭 부분", "나머지"]
  sub         text check (sub is null or char_length(sub) <= 80),                  -- 학명 대신 둘째 줄 (협업 제품 모델명)
  price       integer check (price is null or price between 0 and 100000000),      -- 원. 비우면 '가격 문의'
  status      text not null default 'available' check (status in ('available', 'soldout', 'hidden')),
  stock       integer check (stock is null or stock >= 0),
  exact       boolean not null default false,                                       -- 동일 상품 배송
  plain       boolean not null default false,                                       -- 단색 배경 사진 (그라데이션 없음)
  image       text not null check (char_length(image) <= 500),
  images      jsonb,                                                                -- 상세에서 차례로 보일 사진들
  description jsonb,                                                                -- {"ko": "…", "en": "…", "ja": "…"}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.shop_products enable row level security;
grant select on public.shop_products to anon, authenticated;
grant insert, update, delete on public.shop_products to authenticated;
drop policy if exists shop_products_read on public.shop_products;
create policy shop_products_read on public.shop_products for select to anon, authenticated
  using (status <> 'hidden' or public.is_app_admin());
drop policy if exists shop_products_admin_insert on public.shop_products;
create policy shop_products_admin_insert on public.shop_products for insert to authenticated with check (public.is_app_admin());
drop policy if exists shop_products_admin_update on public.shop_products;
create policy shop_products_admin_update on public.shop_products for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists shop_products_admin_delete on public.shop_products;
create policy shop_products_admin_delete on public.shop_products for delete to authenticated using (public.is_app_admin());
drop trigger if exists shop_products_touch on public.shop_products;
create trigger shop_products_touch before update on public.shop_products for each row execute function private.touch_updated_at();
create index if not exists shop_products_sort on public.shop_products (sort, id);

-- 처음 제품 (assets/js/products.js 와 같은 내용). 이미 있으면 그대로 둠
insert into public.shop_products (id, sort, category, collab, name, sci, sub, price, status, stock, exact, plain, image, images, description) values
  ('ficus-murung-raya', 10, 'tropical', null, '{"ko":"피커스 sp. ‘무룽 라야’","en":"Ficus sp. ‘Murung Raya’","ja":"フィカス sp.「ムルン・ラヤ」"}'::jsonb, '["Ficus","sp. ‘Murung Raya’"]'::jsonb, null, 22000, 'available', null, false, false, '/assets/img/products/ficus-murung-raya.jpg?v=3', null, null),
  ('ficus-punctata', 20, 'tropical', null, '{"ko":"피커스 푼타타","en":"Ficus punctata","ja":"フィカス・プンクタタ"}'::jsonb, '["Ficus punctata",""]'::jsonb, null, 60000, 'available', null, false, false, '/assets/img/products/ficus-punctata.jpg?v=6', null, null),
  ('ficus-trichocarpa', 30, 'tropical', null, '{"ko":"피커스 트리코카르파","en":"Ficus trichocarpa","ja":"フィカス・トリコカルパ"}'::jsonb, '["Ficus trichocarpa",""]'::jsonb, null, 120000, 'available', null, false, false, '/assets/img/products/ficus-trichocarpa.jpg?v=3', null, null),
  ('specklinia-grobyi-1', 40, 'orchid', null, '{"ko":"스페클리니아 그로비 #1","en":"Specklinia grobyi #1","ja":"スペクリニア・グロビー #1"}'::jsonb, '["Specklinia grobyi",""]'::jsonb, null, 110000, 'available', 1, true, false, '/assets/img/products/specklinia-grobyi-1.jpg?v=2', null, null),
  ('specklinia-grobyi-2', 50, 'orchid', null, '{"ko":"스페클리니아 그로비 #2","en":"Specklinia grobyi #2","ja":"スペクリニア・グロビー #2"}'::jsonb, '["Specklinia grobyi",""]'::jsonb, null, 110000, 'available', 1, true, false, '/assets/img/products/specklinia-grobyi-2.jpg?v=2', null, null),
  ('thichi-bucotsu-bowl-long-4', 60, null, 'thichi-yuiitsumuni', '{"ko":"THICHIのBUCOTSU鉢","en":"THICHIのBUCOTSU鉢","ja":"THICHIのBUCOTSU鉢"}'::jsonb, null, 'BOWL LONG - 4', 40000, 'available', null, false, true, '/assets/img/products/thichi-bucotsu-bowl-long-4.jpg?v=3', null, null),
  ('thichi-bucotsu-bowl-mid-4', 70, null, 'thichi-yuiitsumuni', '{"ko":"THICHIのBUCOTSU鉢","en":"THICHIのBUCOTSU鉢","ja":"THICHIのBUCOTSU鉢"}'::jsonb, null, 'BOWL MID - 4', 35000, 'available', null, false, true, '/assets/img/products/thichi-bucotsu-bowl-mid-4.jpg?v=3', null, null),
  ('thichi-bucotsu-bowl-mid-5', 80, null, 'thichi-yuiitsumuni', '{"ko":"THICHIのBUCOTSU鉢","en":"THICHIのBUCOTSU鉢","ja":"THICHIのBUCOTSU鉢"}'::jsonb, null, 'BOWL MID - 5', 39000, 'available', null, false, true, '/assets/img/products/thichi-bucotsu-bowl-mid-5.jpg?v=3', null, null)
on conflict (id) do nothing;

-- ---------- 제품 사진 보관함 (공개 읽기 · 관리자만 올리기/지우기) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_app_admin());
drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_app_admin());
drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_app_admin());

-- ---------- 도매 문의 · 협업 제안: 관리자만 읽기 · 지우기 ----------
grant select, delete on public.wholesale_inquiries, public.collab_proposals to authenticated;
drop policy if exists wholesale_admin_read on public.wholesale_inquiries;
create policy wholesale_admin_read on public.wholesale_inquiries for select to authenticated using (public.is_app_admin());
drop policy if exists wholesale_admin_delete on public.wholesale_inquiries;
create policy wholesale_admin_delete on public.wholesale_inquiries for delete to authenticated using (public.is_app_admin());
drop policy if exists collab_admin_read on public.collab_proposals;
create policy collab_admin_read on public.collab_proposals for select to authenticated using (public.is_app_admin());
drop policy if exists collab_admin_delete on public.collab_proposals;
create policy collab_admin_delete on public.collab_proposals for delete to authenticated using (public.is_app_admin());
-- 사업자등록증 파일: 관리자만 열기(서명된 임시 링크) · 지우기
drop policy if exists wholesale_docs_admin_read on storage.objects;
create policy wholesale_docs_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'wholesale-docs' and public.is_app_admin());
drop policy if exists wholesale_docs_admin_delete on storage.objects;
create policy wholesale_docs_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'wholesale-docs' and public.is_app_admin());

-- (추가) MATTER 묶음 (BASE Series · ORIGIN …) — layout.js 의 MATTERS 이름
alter table public.shop_products add column if not exists matter text check (matter is null or matter ~ '^[a-z0-9-]{1,60}$');
