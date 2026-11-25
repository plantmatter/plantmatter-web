/* PLANT MATTER — 결제 결과 (/checkout/success/ · /checkout/fail/)
   토스페이먼츠 결제창이 끝나면 이 페이지로 돌아옵니다.
   - 성공: ?paymentKey=…&orderId=…&amount=… → 결제 서버(shop.js 의 payUrl, Edge Function 'shop-payment')에 승인 요청
           서버가 재고를 확인하고 토스에 승인 → 주문 완료 (가상계좌는 '입금 대기' + 입금 계좌 안내)
   - 실패/취소: ?code=…&message=…&orderId=…
   장바구니에서 한 주문이면 결제가 끝난 뒤 주문한 식물을 장바구니에서 뺍니다 (assets/js/cart.js). */
(() => {
  const PM = window.PM;
  const S = window.PM_SHOP;
  if (!PM || !S) return;
  const { t } = PM;
  const { esc, won } = S;

  const root = document.querySelector('[data-result]');
  const kind = root.dataset.result;   // 'success' | 'fail'
  const q = new URLSearchParams(location.search);
  const order = S.loadOrder();
  const orderId = q.get('orderId') || '';
  const mine = order && order.orderId === orderId ? order : null;

  /* state: confirming | done | waiting | test | error | fail */
  let state = 'fail';
  let detail = '';
  let server = mine && mine.server ? mine.server : null;   // 서버가 돌려준 주문 요약

  const kdate = (iso) => { try { return new Date(iso).toLocaleString(PM.getLang() === 'ko' ? 'ko-KR' : PM.getLang() === 'ja' ? 'ja-JP' : 'en-US', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } };
  const info = () => {
    const rows = [];
    if (orderId) rows.push([t('orderNo'), esc(orderId)]);
    const o = server || mine;
    if (o) {
      rows.push([t('orderItems'), esc(o.orderName)]);
      rows.push([t('paidAmount'), esc(won(o.amount))]);
      if (server && server.method) rows.push([t('payMethod'), esc(server.method)]);
      const va = server && server.virtualAccount;
      if (state === 'waiting' && va) {
        rows.push([t('vaAccount'), `${esc(va.bank)} ${esc(va.accountNumber)}${va.holder ? `<br>${esc(va.holder)}` : ''}`]);
        if (va.dueDate) rows.push([t('vaDue'), esc(kdate(va.dueDate))]);
      }
      const s = (server && server.ship) || (mine && mine.ship) || {};
      if (state !== 'fail' && state !== 'error' && s.addr) rows.push([t('shipTo'), `${esc(s.name)} · ${esc(s.phone)}<br>(${esc(s.zip)}) ${esc(s.addr)} ${esc(s.addr2 || '')}`]);
      if (server && server.receiptUrl && /^https:\/\//.test(server.receiptUrl)) rows.push(['', `<a class="res__receipt" href="${esc(server.receiptUrl)}" target="_blank" rel="noopener">${esc(t('receiptView'))}</a>`]);
    } else if (q.get('amount')) {
      rows.push([t('paidAmount'), esc(won(Number(q.get('amount'))))]);
    }
    return rows.length ? `<dl class="res__info">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '';
  };

  const render = () => {
    const title = { confirming: t('confirming'), done: t('doneTitle'), waiting: t('waitingTitle'), test: t('testDoneTitle'), error: t('failTitle'), fail: t('failTitle') }[state];
    document.title = `${title} — PLANT MATTER`;
    let text = '';
    if (state === 'test' || ((state === 'done' || state === 'waiting') && server && server.test)) text = t('testDoneText');
    if (state === 'waiting') text = [t('waitingText'), text].filter(Boolean).join(' ');
    if (state === 'error' || state === 'fail') text = detail;
    const retry = !mine ? '' : mine.fromCart ? '/checkout/?from=cart'
      : mine.items && mine.items[0] ? `/checkout/?id=${encodeURIComponent(mine.items[0].id)}&qty=${mine.items[0].qty}` : '';
    const actions = state === 'confirming' ? '' : `<div class="res__actions">
        ${(state === 'fail' || state === 'error') && retry ? `<a class="btn-buy" href="${retry}">${esc(t('retry'))}</a>` : ''}
        <a class="btn-line" href="/plant/">${esc(t('continueShopping'))}</a>
      </div>`;
    root.innerHTML = `
      <p class="res__eyebrow">${state === 'done' || state === 'test' || state === 'waiting' ? 'THANK YOU' : 'ORDER'}</p>
      <h1 class="res__title">${esc(title)}</h1>
      ${text ? `<p class="res__text">${esc(text)}</p>` : ''}
      ${S.isTest() && state !== 'test' ? `<p class="co__test">${esc(t('testMode'))}</p>` : ''}
      ${state === 'confirming' ? '' : info()}
      ${actions}`;
  };
  PM.onLang(render);

  const setState = (next, msg = '') => { state = next; detail = msg; render(); };

  if (kind === 'fail') {
    const code = q.get('code') || '';
    const msg = code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL' ? t('canceled') : (q.get('message') || t('payError', { msg: code }));
    setState('fail', msg);
    return;
  }

  /* ---------- 성공으로 돌아온 경우 ---------- */
  const paymentKey = q.get('paymentKey');
  const amount = Number(q.get('amount'));
  if (!paymentKey || !orderId || !Number.isFinite(amount)) { setState('error', t('payError', { msg: 'missing parameters' })); return; }
  if (mine && mine.amount !== amount) { setState('error', t('amountMismatch')); return; }
  /* 장바구니에서 주문한 식물 빼기 */
  const clearCart = () => {
    if (mine && mine.fromCart && window.PM_CART && Array.isArray(mine.items)) window.PM_CART.remove(mine.items.map((i) => i.id));
  };
  if (mine && mine.confirmed && server) { setState(server.status === 'waiting' ? 'waiting' : 'done'); return; }   // 새로고침: 다시 승인하지 않음 (장바구니도 이미 비움)

  const finish = (data) => {
    server = data;
    if (mine) S.saveOrder({ ...mine, confirmed: true, server: data, paymentKey });
    clearCart();
    setState(data.status === 'waiting' ? 'waiting' : 'done');
  };

  if (!S.config.payUrl) { setState('error', t('noServer')); return; }

  setState('confirming');
  S.payCall({ action: 'confirm', paymentKey, orderId, amount })
    .then(({ ok, data }) => {
      if (ok) { finish(data); return; }
      const d = data || {};
      if (d.error === 'soldout') setState('error', t('soldoutNoCharge'));
      else if (d.error === 'amount') setState('error', t('amountMismatch'));
      else if (d.error === 'state') setState('error', t('orderState'));
      else setState('error', t('confirmFail', { msg: d.message || d.code || d.error || '' }));
    })
    .catch((err) => setState('error', t('confirmFail', { msg: err.message })));
})();
