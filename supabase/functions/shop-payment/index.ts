// PLANT MATTER — 주문 · 결제 승인 (Supabase Edge Function 'shop-payment')
// 사이트의 결제 화면(/checkout/)과 결과 화면(/checkout/success/)이 부릅니다. 표: supabase/web10_orders.sql
//
//   action=create  : 주문 버튼을 누르면 — 서버가 DB 의 가격·재고로 금액을 다시 계산하고 주문번호를 발급해 'pending' 으로 저장
//                    (화면에서 금액을 바꿔도 소용없음. 이 금액과 주문번호로만 토스 결제창이 열림)
//   action=confirm : 결제창이 끝나고 돌아오면 — 금액 확인 → 재고 잡기(shop_order_reserve) → 토스 결제 승인
//                    → 성공: paid (가상계좌는 입금 전까지 waiting) · 실패: 재고 되돌림(shop_order_release) → 운영자에게 메일
//   ?hook=toss     : 토스 웹훅 (가상계좌 입금 · 취소). 내용은 믿지 않고 토스에 주문 상태를 다시 물어봐서 반영
//
// ▸ 비밀값은 코드에 넣지 않습니다. Supabase 대시보드 > Edge Functions > Secrets
//     TOSS_SECRET_KEY : 토스페이먼츠 '시크릿 키' (test_gsk_… 또는 live_gsk_…). 사이트의 클라이언트 키(shop.js)와 같은 짝
//     ORDER_TO        : (선택) 주문 알림을 받을 이메일. 없으면 WHOLESALE_TO
//     RESEND_API_KEY  : 메일 발송 (문의 메일과 같은 키)
// ▸ 테스트 키(test_…)일 때 받은 주문은 test = true 로 저장하고 재고는 확인만 (줄이지 않음). 메일 제목에 [테스트]
// ▸ 배송비는 사이트 assets/js/shop.js 의 config 와 아래 SHIPPING 을 같게 맞춰 주세요
// ▸ 배포: verify_jwt = false (비회원도 주문). 로그인한 회원이면 사이트가 보내는 토큰으로 회원 주문으로 저장

const ORIGINS = ['https://plantmatter.kr', 'https://www.plantmatter.kr', 'https://m.plantmatter.kr'];
const FROM = 'PLANT MATTER <noreply@plantmatter.kr>';
const SHIPPING = { fee: 0, freeOver: null as number | null };   // shop.js 의 shippingFee · freeShippingOver 와 같게
const MAX_LINES = 20;
const MAX_QTY = 99;
const CREATE_PER_HOUR = 30;   // 같은 곳(IP)에서 1시간에 만들 수 있는 주문 수
const PENDING_KEEP_HOURS = 48;   // 결제창까지 가지 않은 주문은 이 시간이 지나면 지움
const TOSS = 'https://api.tosspayments.com/v1';

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVER_KEY = (() => {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const k = keys.default ?? Object.values(keys)[0];
    if (typeof k === 'string' && k) return k;
  } catch { /* 없음 */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
})();
const SECRET = Deno.env.get('TOSS_SECRET_KEY') ?? '';
const TEST = SECRET.startsWith('test_');

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
const rpc = (fn: string, args: Record<string, unknown>) =>
  api(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
const patchOrder = (id: string, data: Record<string, unknown>) =>
  api(`/rest/v1/shop_orders?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
const getOrder = async (id: string) => {
  const r = await api(`/rest/v1/shop_orders?id=eq.${encodeURIComponent(id)}&select=*`);
  const rows = r.ok ? await r.json() : [];
  return rows[0] ?? null;
};
const tossFetch = (path: string, init: RequestInit = {}) =>
  fetch(`${TOSS}${path}`, {
    ...init,
    headers: { Authorization: `Basic ${btoa(`${SECRET}:`)}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

const sha = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, '0')).join('');
const ipHashOf = async (req: Request) => {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
  return ip ? (await sha(`${ip}|${SERVER_KEY.slice(-12)}`)).slice(0, 32) : null;
};
/* 로그인한 회원이면 회원 번호 (토큰이 없거나 맞지 않으면 비회원) */
const userIdOf = async (req: Request) => {
  const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!tok || tok.split('.').length !== 3) return null;
  try {
    const r = await fetch(`${URL_BASE}/auth/v1/user`, { headers: { apikey: SERVER_KEY, Authorization: `Bearer ${tok}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return typeof u?.id === 'string' ? u.id : null;
  } catch { return null; }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;
const ORDER_RE = /^[A-Za-z0-9_-]{6,64}$/;
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const won = (n: number) => `₩ ${Number(n).toLocaleString('ko-KR')}`;
const kst = (d: Date) => d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const BANKS: Record<string, string> = {
  '02': 'KDB산업은행', '03': 'IBK기업은행', '06': 'KB국민은행', '07': 'Sh수협은행', '11': 'NH농협은행', '12': '단위농협',
  '20': '우리은행', '23': 'SC제일은행', '27': '씨티은행', '31': 'iM뱅크(대구)', '32': '부산은행', '34': '광주은행',
  '35': '제주은행', '37': '전북은행', '39': '경남은행', '45': '새마을금고', '48': '신협', '50': '저축은행', '54': 'HSBC',
  '64': '산림조합', '71': '우체국', '81': '하나은행', '88': '신한은행', '89': '케이뱅크', '90': '카카오뱅크', '92': '토스뱅크',
};
const STATUS_KO: Record<string, string> = { paid: '결제 완료', waiting: '입금 대기 (가상계좌)', shipped: '발송 완료', failed: '실패', canceled: '취소' };

/* ---------- 주문 만들기 ---------- */
const handleCreate = async (req: Request, b: Record<string, unknown>) => {
  // 상품 · 수량 (같은 상품은 합침)
  const want = new Map<string, number>();
  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (!rawItems.length || rawItems.length > MAX_LINES) return json(req, 400, { error: 'invalid', fields: ['items'] });
  for (const it of rawItems) {
    const id = String((it as Record<string, unknown>)?.id ?? '');
    const qty = Number((it as Record<string, unknown>)?.qty);
    if (!ID_RE.test(id) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return json(req, 400, { error: 'invalid', fields: ['items'] });
    want.set(id, (want.get(id) ?? 0) + qty);
  }
  // 주문자 · 받는 분
  const buyerIn = (b.buyer ?? {}) as Record<string, unknown>;
  const shipIn = (b.ship ?? {}) as Record<string, unknown>;
  const buyer = { name: text(buyerIn.name, 40), email: text(buyerIn.email, 120), phone: digits(buyerIn.phone).slice(0, 11) };
  const ship = {
    name: text(shipIn.name, 40), phone: digits(shipIn.phone).slice(0, 11), zip: digits(shipIn.zip).slice(0, 5),
    addr: text(shipIn.addr, 200), addr2: text(shipIn.addr2, 100), memo: text(shipIn.memo, 200),
  };
  const bad: string[] = [];
  if (!buyer.name) bad.push('buyerName');
  if (!EMAIL_RE.test(buyer.email)) bad.push('buyerEmail');
  if (!/^01\d{8,9}$/.test(buyer.phone)) bad.push('buyerPhone');
  if (!ship.name) bad.push('recvName');
  if (!/^0\d{8,10}$/.test(ship.phone)) bad.push('recvPhone');
  if (!/^\d{5}$/.test(ship.zip)) bad.push('zip');
  if (!ship.addr) bad.push('addr');
  if (bad.length) return json(req, 400, { error: 'invalid', fields: bad });

  const ipHash = await ipHashOf(req);
  if (ipHash) {
    const since = new Date(Date.now() - 3600e3).toISOString();
    const r = await api(`/rest/v1/shop_orders?select=id&ip_hash=eq.${ipHash}&created_at=gte.${since}&limit=${CREATE_PER_HOUR}`);
    if (r.ok && (await r.json()).length >= CREATE_PER_HOUR) return json(req, 429, { error: 'rate' });
  }

  // DB 의 지금 가격 · 재고로 다시 계산
  const ids = [...want.keys()];
  const pr = await api(`/rest/v1/shop_products?select=id,name,price,status,stock&id=in.(${ids.map(encodeURIComponent).join(',')})`);
  if (!pr.ok) return json(req, 500, { error: 'server' });
  const prods = new Map<string, Record<string, unknown>>((await pr.json()).map((p: Record<string, unknown>) => [p.id as string, p]));
  const items: { id: string; name: string; price: number; qty: number }[] = [];
  for (const [id, qty] of want) {
    const p = prods.get(id);
    const price = Number(p?.price);
    if (!p || p.status !== 'available' || !Number.isInteger(price) || price <= 0 || (p.stock != null && Number(p.stock) < qty)) {
      return json(req, 409, { error: 'soldout', id, stock: p && p.stock != null ? Number(p.stock) : null });
    }
    const nm = (p.name ?? {}) as Record<string, string>;
    items.push({ id, name: String(nm.ko || nm.en || id).slice(0, 80), price, qty });
  }
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = SHIPPING.fee > 0 && !(SHIPPING.freeOver != null && subtotal >= SHIPPING.freeOver) ? SHIPPING.fee : 0;
  const amount = subtotal + shipping;
  const orderName = (items.length > 1 ? `${items[0].name} 외 ${items.length - 1}건` : items[0].name).slice(0, 100);

  // 주문번호: PM + 날짜(한국) + 무작위 10자
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(10)), (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
  const id = `PM${day}${rand}`;

  const ins = await api('/rest/v1/shop_orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      id, user_id: await userIdOf(req), status: 'pending', test: TEST, order_name: orderName,
      amount, subtotal, shipping, items, buyer, ship, lang: text(b.lang, 5) || null, ip_hash: ipHash,
    }),
  });
  if (!ins.ok) { console.error('insert', ins.status, await ins.text()); return json(req, 500, { error: 'server' }); }

  // 오래된 미결제 주문 정리 (기다리지 않음)
  api(`/rest/v1/shop_orders?status=eq.pending&created_at=lt.${new Date(Date.now() - PENDING_KEEP_HOURS * 3600e3).toISOString()}`, { method: 'DELETE' }).catch(() => {});

  return json(req, 200, { ok: true, orderId: id, orderName, amount, subtotal, shipping, test: TEST });
};

/* 결과 화면에 보여 줄 주문 요약 (개인정보는 받는 분 정도만) */
const summary = (o: Record<string, any>) => ({
  ok: true, orderId: o.id, status: o.status, test: o.test, orderName: o.order_name, amount: o.amount,
  method: o.method, receiptUrl: o.receipt_url, virtualAccount: o.pay_info?.virtualAccount ?? null,
  ship: o.ship ? { name: o.ship.name, phone: o.ship.phone, zip: o.ship.zip, addr: o.ship.addr, addr2: o.ship.addr2 } : null,
});

/* 운영자에게 주문 알림 메일 */
const notify = async (o: Record<string, any>, headline: string) => {
  const resend = Deno.env.get('RESEND_API_KEY') ?? '';
  const to = (Deno.env.get('ORDER_TO') || Deno.env.get('WHOLESALE_TO') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!resend || !to.length) return 'mail not set up';
  const va = o.pay_info?.virtualAccount;
  const rows: [string, string][] = [
    ['주문번호', o.id],
    ['상태', STATUS_KO[o.status] ?? o.status],
    ['결제 수단', o.method ?? ''],
    ['결제 금액', won(o.amount) + (o.shipping ? ` (배송비 ${won(o.shipping)} 포함)` : '')],
    ['상품', (o.items ?? []).map((i: any) => `${i.name} × ${i.qty}  ${won(i.price * i.qty)}`).join('\n')],
    ['주문자', `${o.buyer?.name ?? ''} · ${o.buyer?.phone ?? ''}\n${o.buyer?.email ?? ''}`],
    ['받는 분', `${o.ship?.name ?? ''} · ${o.ship?.phone ?? ''}`],
    ['주소', `(${o.ship?.zip ?? ''}) ${o.ship?.addr ?? ''} ${o.ship?.addr2 ?? ''}`.trim()],
    ...(o.ship?.memo ? [['배송 메모', o.ship.memo] as [string, string]] : []),
    ...(va ? [['입금 계좌', `${va.bank} ${va.accountNumber} (기한 ${va.dueDate ? kst(new Date(va.dueDate)) : '-'})`] as [string, string]] : []),
    ['회원', o.user_id ? '회원 주문' : '비회원 주문'],
    ['주문 시각', kst(new Date(o.created_at))],
  ];
  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#171717;font-size:14px;line-height:1.7">
<p style="margin:0 0 16px;font-size:16px">${esc(headline)}</p>
<table style="border-collapse:collapse;width:100%;max-width:640px">${rows.map(([k, v]) =>
    `<tr><th style="text-align:left;vertical-align:top;width:120px;padding:10px 12px 10px 0;border-top:1px solid #e8e8e8;color:#777;font-weight:400">${esc(k)}</th><td style="padding:10px 0;border-top:1px solid #e8e8e8;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>
<p style="margin:16px 0 0;color:#777;font-size:12px">관리자 페이지(plantmatter.kr/admin/) › 주문 에서도 볼 수 있습니다.${o.test ? ' 테스트 키로 받은 주문이라 실제 결제·재고 변화는 없습니다.' : ''}</p></div>`;
  const subject = `${o.test ? '[테스트] ' : ''}[${o.status === 'waiting' ? '입금 대기' : '주문'}] ${o.order_name} · ${won(o.amount)}`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, reply_to: o.buyer?.email || undefined, subject: subject.slice(0, 150), html,
        text: rows.map(([k, v]) => `${k}: ${v}`).join('\n') }),
    });
    return r.ok ? '' : `resend ${r.status}: ${(await r.text()).slice(0, 300)}`;
  } catch (e) { return `resend: ${String(e).slice(0, 300)}`; }
};

/* 토스 결과 → 주문에 저장할 값 */
const fromToss = (t: Record<string, any>) => {
  const va = t.virtualAccount
    ? { bank: BANKS[t.virtualAccount.bankCode] ?? t.virtualAccount.bankCode, accountNumber: t.virtualAccount.accountNumber,
        dueDate: t.virtualAccount.dueDate, holder: t.virtualAccount.customerName ?? null }
    : null;
  const easy = t.easyPay?.provider ? String(t.easyPay.provider) : '';
  return {
    status: t.status === 'WAITING_FOR_DEPOSIT' ? 'waiting' : 'paid',
    payment_key: t.paymentKey,
    method: [t.method, easy].filter(Boolean).join(' · ') || null,
    approved_at: t.approvedAt ?? null,
    receipt_url: t.receipt?.url ?? null,
    pay_info: va ? { virtualAccount: va } : (easy ? { easyPay: easy } : null),
  };
};

/* ---------- 결제 승인 ---------- */
const handleConfirm = async (req: Request, b: Record<string, unknown>) => {
  const paymentKey = String(b.paymentKey ?? '');
  const orderId = String(b.orderId ?? '');
  const amount = Number(b.amount);
  if (!paymentKey || paymentKey.length > 200 || !ORDER_RE.test(orderId) || !Number.isInteger(amount)) return json(req, 400, { error: 'invalid' });
  if (!SECRET) return json(req, 503, { error: 'setup' });

  const o = await getOrder(orderId);
  if (!o) return json(req, 404, { error: 'not_found' });
  if (['paid', 'waiting', 'shipped'].includes(o.status)) {
    return o.payment_key === paymentKey ? json(req, 200, summary(o)) : json(req, 409, { error: 'state' });   // 새로고침 등: 다시 승인하지 않음
  }
  if (o.status !== 'pending') return json(req, 409, { error: 'state', status: o.status });
  if (o.amount !== amount) {
    await rpc('shop_order_release', { p_id: orderId, p_status: 'failed', p_reason: `amount mismatch ${amount} != ${o.amount}` });
    return json(req, 400, { error: 'amount' });
  }

  // 재고 잡기 (모자라면 승인하지 않음 → 결제되지 않음)
  const rr = await rpc('shop_order_reserve', { p_id: orderId });
  if (!rr.ok) {
    const msg = await rr.text();
    const sold = /soldout:([a-z0-9-]+)/.exec(msg);
    await rpc('shop_order_release', { p_id: orderId, p_status: 'failed', p_reason: sold ? `soldout ${sold[1]}` : msg.slice(0, 200) });
    return json(req, 409, sold ? { error: 'soldout', id: sold[1] } : { error: 'server' });
  }

  // 토스 결제 승인
  let t: Record<string, any> = {};
  let ok = false;
  try {
    const tr = await tossFetch('/payments/confirm', {
      method: 'POST',
      headers: { 'Idempotency-Key': `confirm-${orderId}` },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    t = await tr.json().catch(() => ({}));
    ok = tr.ok && (t.status === 'DONE' || t.status === 'WAITING_FOR_DEPOSIT');
  } catch (e) {
    t = { code: 'NETWORK', message: String(e).slice(0, 200) };
  }
  if (!ok) {
    await rpc('shop_order_release', { p_id: orderId, p_status: 'failed', p_reason: `${t.code ?? ''} ${t.message ?? ''}`.trim() || 'toss' });
    return json(req, 402, { error: 'toss', code: t.code ?? null, message: t.message ?? null });
  }

  const upd = fromToss(t);
  await patchOrder(orderId, upd);
  const saved = { ...o, ...upd };
  const mailErr = await notify(saved, saved.status === 'waiting' ? '가상계좌 주문이 들어왔습니다. 입금되면 다시 알려 드립니다.' : '새 주문이 결제되었습니다.');
  if (mailErr) { console.error(mailErr); await patchOrder(orderId, { email_error: mailErr }); }
  return json(req, 200, summary(saved));
};

/* ---------- 토스 웹훅: 가상계좌 입금 · 결제 취소 ----------
   토스 개발자센터 > 웹훅에 https://qssrtzvipwvxcfszxomo.supabase.co/functions/v1/shop-payment?hook=toss 등록
   (PAYMENT_STATUS_CHANGED · DEPOSIT_CALLBACK). 보낸 내용은 믿지 않고 토스에 주문 상태를 직접 다시 물어봄 */
const handleHook = async (b: Record<string, any>) => {
  const orderId = String(b?.data?.orderId ?? b?.orderId ?? '');
  if (!ORDER_RE.test(orderId) || !SECRET) return new Response('ok');
  const o = await getOrder(orderId);
  if (!o || !['waiting', 'paid'].includes(o.status)) return new Response('ok');
  const tr = await tossFetch(`/payments/orders/${encodeURIComponent(orderId)}`);
  if (!tr.ok) return new Response('ok');
  const t = await tr.json();
  if (t.status === 'DONE' && o.status === 'waiting') {
    await patchOrder(orderId, { status: 'paid', approved_at: t.approvedAt ?? new Date().toISOString() });
    await notify({ ...o, status: 'paid' }, '가상계좌 입금이 확인되었습니다. 발송을 준비해 주세요.');
  } else if (['CANCELED', 'PARTIAL_CANCELED', 'EXPIRED', 'ABORTED'].includes(t.status)) {
    await rpc('shop_order_release', { p_id: orderId, p_status: 'canceled', p_reason: `toss ${t.status}` });
  }
  return new Response('ok');
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get('hook') === 'toss') {
    if (req.method !== 'POST') return new Response('ok');
    try { return await handleHook(await req.json()); } catch (e) { console.error('hook', e); return new Response('ok'); }
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method' });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, 400, { error: 'invalid' }); }
  try {
    if (b.action === 'create') return await handleCreate(req, b);
    if (b.action === 'confirm') return await handleConfirm(req, b);
    return json(req, 400, { error: 'invalid' });
  } catch (e) {
    console.error(e);
    return json(req, 500, { error: 'server' });
  }
});
