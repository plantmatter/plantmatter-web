// PLANT MATTER — CONTACT 페이지 문의 받기 (Supabase Edge Function 'wholesale-inquiry')
// /contact/ 의 두 양식을 받습니다 (보내는 값 kind 로 구분):
//   kind=b2b (기본) : 도매(B2B) 문의 → wholesale_inquiries 표 · 사업자등록증은 wholesale-docs 비공개 버킷
//   kind=collab     : 협업 제안      → collab_proposals 표
// 내용 확인 → 저장 → 운영자에게 메일
//
// ▸ 비밀값은 코드에 넣지 않습니다. Supabase 대시보드 > Edge Functions > Secrets 에서 넣습니다.
//     RESEND_API_KEY : Resend 의 'Sending access' API 키 (plantmatter.kr 도메인)
//     WHOLESALE_TO   : 문의를 받을 이메일 주소 (여러 개면 쉼표로 구분)
//     COLLAB_TO      : (선택) 협업 제안만 다른 주소로 받을 때. 없으면 WHOLESALE_TO 로
//   SUPABASE_URL 과 서버 키는 Supabase 가 자동으로 넣어 줍니다.
// ▸ 메일은 noreply@plantmatter.kr 에서 보내고, '답장'을 누르면 문의한 분에게 바로 갑니다. 사업자등록증은 첨부됩니다.
// ▸ 같은 곳(IP)에서 양식마다 1시간에 5건까지. 1년 지난 문의·제안과 파일은 새 문의가 들어올 때 지웁니다.
// ▸ 배포: verify_jwt = false (누구나 보내는 양식이라 로그인 없이 부름)

const ORIGINS = ['https://plantmatter.kr', 'https://www.plantmatter.kr', 'https://m.plantmatter.kr'];
const FROM = 'PLANT MATTER <noreply@plantmatter.kr>';
const BUCKET = 'wholesale-docs';
const MAX_FILE = 10 * 1024 * 1024;
const PER_HOUR = 5;
const KEEP_DAYS = 365;
const TYPES: Record<string, string> = {
  shop: '식물 매장·꽃집', space: '카페·쇼룸 등 공간', landscape: '조경·인테리어', online: '온라인 판매', other: '기타',
};
const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp',
};

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
/* 서버 키: 새 방식(SUPABASE_SECRET_KEYS) → 예전 방식(SUPABASE_SERVICE_ROLE_KEY) 순서로 */
const SERVER_KEY = (() => {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const k = keys.default ?? Object.values(keys)[0];
    if (typeof k === 'string' && k) return k;
  } catch { /* 없음 */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
})();

const cors = (req: Request) => {
  const o = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    'Vary': 'Origin',
  };
};
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

const api = (path: string, init: RequestInit = {}) =>
  fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: { apikey: SERVER_KEY, Authorization: `Bearer ${SERVER_KEY}`, ...(init.headers ?? {}) },
  });

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const bizOk = (d: string) => {
  if (!/^\d{10}$/.test(d)) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(d[i]) * w[i];
  s += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (s % 10)) % 10 === Number(d[9]);
};
const bizFmt = (d: string) => `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
const phoneFmt = (p: string) => (p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p);
const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, '0')).join('');
const base64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/* 1년 지난 문의 · 파일 지우기 (실패해도 문의 접수에는 영향 없음) */
const cleanup = async () => {
  const before = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  const r = await api(`/rest/v1/wholesale_inquiries?select=id,doc_path&created_at=lt.${before}&limit=100`);
  if (!r.ok) return;
  const old: { id: string; doc_path: string | null }[] = await r.json();
  if (!old.length) return;
  const paths = old.map((o) => o.doc_path).filter(Boolean);
  if (paths.length) {
    await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) });
  }
  await api(`/rest/v1/wholesale_inquiries?id=in.(${old.map((o) => o.id).join(',')})`, { method: 'DELETE' });
};
const cleanupCollab = async () => {
  const before = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  await api(`/rest/v1/collab_proposals?created_at=lt.${before}`, { method: 'DELETE' });
};

/* 같은 곳(IP)에서 너무 자주 보내면 잠시 막음 */
const rateLimited = async (table: string, ipHash: string | null) => {
  if (!ipHash) return false;
  const since = new Date(Date.now() - 3600e3).toISOString();
  const r = await api(`/rest/v1/${table}?select=id&ip_hash=eq.${ipHash}&created_at=gte.${since}&limit=${PER_HOUR}`);
  return r.ok && (await r.json()).length >= PER_HOUR;
};

/* 운영자에게 메일 (답장 → 보낸 분). 실패하면 이유 문자열, 성공하면 '' */
const sendMail = async (o: { resend: string; to: string[]; replyTo: string; subject: string; intro: string; note: string; rows: [string, string][]; attachments?: { filename: string; content: string }[] }) => {
  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#171717;font-size:14px;line-height:1.7">
<p style="margin:0 0 16px;font-size:16px">${esc(o.intro)}</p>
<table style="border-collapse:collapse;width:100%;max-width:640px">${o.rows.map(([k, v]) =>
    `<tr><th style="text-align:left;vertical-align:top;width:140px;padding:10px 12px 10px 0;border-top:1px solid #e8e8e8;color:#777;font-weight:400">${esc(k)}</th><td style="padding:10px 0;border-top:1px solid #e8e8e8;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>
<p style="margin:16px 0 0;color:#777;font-size:12px">${esc(o.note)}</p></div>`;
  const text = o.rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${o.resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: o.to, reply_to: o.replyTo, subject: o.subject.slice(0, 150), html, text, ...(o.attachments ? { attachments: o.attachments } : {}) }),
    });
    return r.ok ? '' : `resend ${r.status}: ${(await r.text()).slice(0, 300)}`;
  } catch (e) {
    return `resend: ${String(e).slice(0, 300)}`;
  }
};
const markMailed = (table: string, id: string, mailErr: string) =>
  api(`/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(mailErr ? { email_error: mailErr } : { emailed_at: new Date().toISOString() }),
  });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const kst = (d: Date) => d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' });
/* 링크: 앞에 https:// 가 없으면 붙임. http(s) 주소가 아니면 '' */
const normLink = (v: string) => {
  if (!v) return '';
  const u = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.includes('.') ? x.toString() : ''; } catch { return ''; }
};

/* ---------- 협업 제안 (kind=collab) ---------- */
const handleCollab = async (req: Request, f: FormData, resend: string, to: string[]) => {
  const d = {
    name: str(f, 'name'),
    email: str(f, 'email'),
    type: str(f, 'collabType'),
    message: str(f, 'message'),
    linkRaw: str(f, 'link'),
    lang: ['ko', 'en', 'ja'].includes(str(f, 'lang')) ? str(f, 'lang') : 'ko',
  };
  const link = normLink(d.linkRaw);
  const bad: string[] = [];
  if (!d.name || d.name.length > 80) bad.push('name');
  if (!EMAIL_RE.test(d.email) || d.email.length > 120) bad.push('email');
  if (!d.type || d.type.length > 80) bad.push('collabType');
  if (!d.message || d.message.length > 3000) bad.push('message');
  if (d.linkRaw && (!link || link.length > 300)) bad.push('link');
  if (str(f, 'consent') !== 'yes') bad.push('consent');
  if (bad.length) return json(req, 400, { error: 'invalid', fields: bad });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
  const ipHash = ip ? await sha256(`pm-collab:${ip}`) : null;
  if (await rateLimited('collab_proposals', ipHash)) return json(req, 429, { error: 'rate' });
  cleanupCollab().catch((e) => console.error('cleanup collab', e));

  const now = new Date();
  const id = crypto.randomUUID();
  const ins = await api('/rest/v1/collab_proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ id, name: d.name, email: d.email, collab_type: d.type, message: d.message, link: link || null, lang: d.lang, consent_at: now.toISOString(), ip_hash: ipHash }),
  });
  if (!ins.ok) { console.error('insert collab', ins.status, await ins.text()); return json(req, 500, { error: 'server' }); }

  const mailErr = await sendMail({
    resend, to, replyTo: d.email,
    subject: `[협업 제안] ${d.name} · ${d.type}`,
    intro: '새 협업 제안이 들어왔습니다.',
    note: `이 메일에 답장하면 ${d.email} 로 갑니다. (Supabase › Table Editor › collab_proposals 에도 보관)`,
    rows: [
      ['업체 또는 개인명', d.name],
      ['이메일', d.email],
      ['협업 유형', d.type],
      ['제안 내용', d.message],
      ['관련 링크', link || '—'],
      ['접수', `${kst(now)} (문의 언어: ${d.lang})`],
      ['제안 번호', id],
    ],
  });
  if (mailErr) console.error(mailErr);
  await markMailed('collab_proposals', id, mailErr);
  return json(req, 200, { ok: true, id });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method' });

  const RESEND = Deno.env.get('RESEND_API_KEY') ?? '';
  const TO = (Deno.env.get('WHOLESALE_TO') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!URL_BASE || !SERVER_KEY || !RESEND || !TO.length) {
    console.error('setup: missing', { url: !!URL_BASE, key: !!SERVER_KEY, resend: !!RESEND, to: TO.length });
    return json(req, 503, { error: 'setup' });
  }

  let f: FormData;
  try { f = await req.formData(); } catch { return json(req, 400, { error: 'invalid' }); }

  /* 사람에게는 보이지 않는 칸 — 채워져 있으면 자동 프로그램으로 보고 조용히 무시 */
  if (str(f, 'website')) return json(req, 200, { ok: true });

  if (str(f, 'kind') === 'collab') {
    const collabTo = (Deno.env.get('COLLAB_TO') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return handleCollab(req, f, RESEND, collabTo.length ? collabTo : TO);
  }

  /* ---------- 도매(B2B) 문의 (kind=b2b, 기본) ---------- */

  const d = {
    company: str(f, 'company'),
    bizNo: str(f, 'bizNo').replace(/\D/g, ''),
    name: str(f, 'name'),
    email: str(f, 'email'),
    phone: str(f, 'phone').replace(/\D/g, ''),
    bizType: str(f, 'bizType'),
    items: str(f, 'items'),
    region: str(f, 'region'),
    message: str(f, 'message'),
    lang: ['ko', 'en', 'ja'].includes(str(f, 'lang')) ? str(f, 'lang') : 'ko',
  };
  const bad: string[] = [];
  if (!d.company || d.company.length > 80) bad.push('company');
  if (d.bizNo && !bizOk(d.bizNo)) bad.push('bizNo');   // 양식에서 뺀 칸 (값이 오면 확인만)
  if (!d.name || d.name.length > 40) bad.push('name');
  if (!EMAIL_RE.test(d.email) || d.email.length > 120) bad.push('email');
  if (!/^0\d{8,10}$/.test(d.phone)) bad.push('phone');
  if (d.bizType && !TYPES[d.bizType]) bad.push('bizType');
  if (d.items.length > 1000) bad.push('items');   // 양식에서 뺀 칸 (예전 양식·직접 보낸 값만)
  if (d.region.length > 120) bad.push('region');
  if (d.message.length > 2000) bad.push('message');
  if (str(f, 'consent') !== 'yes') bad.push('consent');
  const doc = f.get('doc');
  const ext = doc instanceof File ? (doc.name.split('.').pop() ?? '').toLowerCase() : '';
  if (!(doc instanceof File) || !doc.size || !FILE_TYPES[ext]) bad.push('doc');
  else if (doc.size > MAX_FILE) bad.push('docSize');
  if (bad.length) return json(req, 400, { error: 'invalid', fields: bad });
  const file = doc as File;

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
  const ipHash = ip ? await sha256(`pm-wholesale:${ip}`) : null;
  if (await rateLimited('wholesale_inquiries', ipHash)) return json(req, 429, { error: 'rate' });

  cleanup().catch((e) => console.error('cleanup', e));

  /* 1) 파일 → 비공개 버킷 */
  const now = new Date();
  const id = crypto.randomUUID();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const up = await api(`/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': FILE_TYPES[ext], 'x-upsert': 'false' },
    body: bytes,
  });
  if (!up.ok) { console.error('upload', up.status, await up.text()); return json(req, 500, { error: 'server' }); }

  /* 2) 문의 내용 → 표 */
  const ins = await api('/rest/v1/wholesale_inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      id, company: d.company, biz_no: d.bizNo || null, contact_name: d.name, email: d.email, phone: d.phone,
      biz_type: d.bizType || null, items: d.items || null, region: d.region || null, message: d.message || null,
      doc_path: path, doc_name: file.name.slice(0, 200), lang: d.lang, consent_at: now.toISOString(), ip_hash: ipHash,
    }),
  });
  if (!ins.ok) {
    console.error('insert', ins.status, await ins.text());
    await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) });
    return json(req, 500, { error: 'server' });
  }

  /* 3) 운영자에게 메일 (사업자등록증 첨부, 답장 → 문의한 분) */
  const mailErr = await sendMail({
    resend: RESEND, to: TO, replyTo: d.email,
    subject: `[도매 문의] ${d.company} · ${d.name}`,
    intro: '새 도매 문의가 들어왔습니다.',
    note: `사업자등록증은 첨부 파일로 보냅니다 (Supabase Storage › ${BUCKET} 에도 보관). 이 메일에 답장하면 ${d.email} 로 갑니다.`,
    rows: [
      ['업체명', d.company],
      ...(d.bizNo ? [['사업자등록번호', bizFmt(d.bizNo)] as [string, string]] : []),
      ['담당자', d.name],
      ['이메일', d.email],
      ['휴대폰', phoneFmt(d.phone)],
      ['업종', d.bizType ? TYPES[d.bizType] : '—'],   // 양식에서 뺀 칸(관심 식물·지역·사업자번호)은 값이 올 때만 메일에 표시
      ...(d.region ? [['받으실 지역 · 시기', d.region] as [string, string]] : []),
      ...(d.items ? [['관심 식물 · 수량', d.items] as [string, string]] : []),
      ['문의 내용', d.message || '—'],
      ['접수', `${kst(now)} (문의 언어: ${d.lang})`],
      ['문의 번호', id],
    ],
    attachments: [{ filename: `사업자등록증_${d.company.replace(/[\\/:*?"<>|]/g, '').slice(0, 40)}.${ext}`, content: base64(bytes) }],
  });
  if (mailErr) console.error(mailErr);
  await markMailed('wholesale_inquiries', id, mailErr);

  /* 메일이 실패해도 문의는 저장됐으므로 접수 완료로 안내 (대시보드에서 확인 가능) */
  return json(req, 200, { ok: true, id });
});
