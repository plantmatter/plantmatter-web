-- PLANT MATTER 웹 — 협업 제안 (CONTACT 페이지 › COLLAB 탭)
-- web05·web06 다음에 한 번 실행합니다. 여러 번 실행해도 됩니다.
-- ▸ 제안 내용은 collab_proposals 표에 보관합니다. 사이트 공개 키로는 읽기·쓰기 불가 (정책 없음).
--   저장은 Edge Function 'wholesale-inquiry'(kind=collab)만 서버 안에서 합니다. 새 제안은 메일로도 받습니다.
-- ▸ 보관 기간: 제안일로부터 1년 — 새 문의가 들어올 때 1년 지난 제안은 함수가 지웁니다.

create table if not exists public.collab_proposals (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(name) between 1 and 80),    -- 업체 또는 개인명
  email         text not null check (char_length(email) between 3 and 120),
  collab_type   text not null check (char_length(collab_type) between 1 and 80),
  message       text not null check (char_length(message) between 1 and 3000),
  link          text check (link is null or char_length(link) <= 300),
  lang          text,
  consent_at    timestamptz not null,
  ip_hash       text,
  emailed_at    timestamptz,
  email_error   text
);

alter table public.collab_proposals enable row level security;
revoke all on public.collab_proposals from anon, authenticated;
create index if not exists collab_proposals_ip_time on public.collab_proposals (ip_hash, created_at desc);
create index if not exists collab_proposals_created on public.collab_proposals (created_at);
