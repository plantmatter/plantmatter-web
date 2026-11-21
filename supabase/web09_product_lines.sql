-- PLANT MATTER — web09: PRODUCT 묶음 (상단 PRODUCT 탭 · /products/ 페이지)
-- ▸ BASE Series · ORIGIN 이 MATTER 에서 PRODUCT 로 옮겨감. 제품이 어느 PRODUCT 항목에 속하는지 = line
--   (항목 목록은 사이트의 assets/js/layout.js PRODUCT_LINES. MATTER 칸(matter)은 나중 MATTER 항목용으로 그대로 둠)
-- ▸ 이미 MATTER 로 등록된 제품이 있으면 PRODUCT 의 같은 항목으로 옮김
-- 여러 번 실행해도 안전합니다.
alter table public.shop_products add column if not exists line text check (line is null or line ~ '^[a-z0-9-]{1,60}$');
comment on column public.shop_products.line is 'PRODUCT 항목 (layout.js 의 PRODUCT_LINES id: base-series · origin …)';
update public.shop_products set line = matter, matter = null where matter in ('base-series', 'origin') and line is null;
