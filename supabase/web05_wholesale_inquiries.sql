-- PLANT MATTER 웹 — 도매 문의 (CONTACT 페이지 양식)
-- 같은 Supabase 프로젝트(앱과 공유)의 SQL Editor 에서 한 번 실행합니다. 여러 번 실행해도 됩니다.
--
-- ▸ 문의 내용은 wholesale_inquiries 표, 사업자등록증 파일은 비공개 저장소(버킷) wholesale-docs 에 보관합니다.
-- ▸ 사이트에 들어 있는 공개 키(publishable)로는 읽기도 쓰기도 할 수 없습니다 (정책을 만들지 않음).
--   저장은 Edge Function 'wholesale-inquiry'(supabase/functions/wholesale-inquiry) 만 서버 안에서 합니다.
-- ▸ 운영자는 Supabase 대시보드의 Table Editor · Storage 에서 볼 수 있고, 새 문의는 메일로도 받습니다.
-- ▸ 보관 기간: 문의일로부터 1년 — 새 문의가 들어올 때 1년 지난 문의와 파일은 함수가 지웁니다.

create table if not exists public.wholesale_inquiries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  company       text not null check (char_length(company) between 1 and 80),
  biz_no        text not null check (biz_no ~ '^[0-9]{10}$'),
  contact_name  text not null check (char_length(contact_name) between 1 and 40),
  email         text not null check (char_length(email) between 3 and 120),
  phone         text not null check (phone ~ '^0[0-9]{8,10}$'),
  biz_type      text check (char_length(biz_type) <= 40),
  items         text not null check (char_length(items) between 1 and 1000),
  region        text check (char_length(region) <= 120),
  message       text check (char_length(message) <= 2000),
  doc_path      text,
  doc_name      text,
  lang          text,
  consent_at    timestamptz not null,
  ip_hash       text,
  emailed_at    timestamptz,
  email_error   text
);

alter table public.wholesale_inquiries enable row level security;
revoke all on public.wholesale_inquiries from anon, authenticated;
create index if not exists wholesale_inquiries_ip_time on public.wholesale_inquiries (ip_hash, created_at desc);
create index if not exists wholesale_inquiries_created on public.wholesale_inquiries (created_at);

-- 사업자등록증 파일: 비공개, 10MB, PDF·사진만
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wholesale-docs', 'wholesale-docs', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- storage.objects 에 이 버킷용 정책을 만들지 않음 → 함수(서버)만 올리고 지울 수 있음
