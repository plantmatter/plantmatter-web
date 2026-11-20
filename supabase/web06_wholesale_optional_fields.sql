-- PLANT MATTER 웹 — 도매 문의 양식에서 '관심 있는 식물 · 수량', '사업자등록번호' 칸을 뺌 → 두 값을 비워도 되게
-- web05 다음에 한 번 실행합니다. 여러 번 실행해도 됩니다. (사업자 확인은 첨부하는 사업자등록증으로)
alter table public.wholesale_inquiries alter column items drop not null;
alter table public.wholesale_inquiries drop constraint if exists wholesale_inquiries_items_check;
alter table public.wholesale_inquiries add constraint wholesale_inquiries_items_check
  check (items is null or char_length(items) <= 1000);

alter table public.wholesale_inquiries alter column biz_no drop not null;
alter table public.wholesale_inquiries drop constraint if exists wholesale_inquiries_biz_no_check;
alter table public.wholesale_inquiries add constraint wholesale_inquiries_biz_no_check
  check (biz_no is null or biz_no ~ '^[0-9]{10}$');
