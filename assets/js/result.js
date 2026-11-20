/* PLANT MATTER — 결제 결과 (/checkout/success/ · /checkout/fail/)
   토스페이먼츠 결제창이 끝나면 이 페이지로 돌아옵니다.
   - 성공: ?paymentKey=…&orderId=…&amount=… → 금액을 확인하고, 결제 승인 서버(shop.js 의 confirmUrl)에 승인을 요청
           (승인 서버가 없고 테스트 키이면 '테스트 결제 완료' 안내만 보여 줌)
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

  /* state: confirming | done | test | error | fail */
  let state = 'fail';
  let detail = '';

  const info = () => {
    const rows = [];
    if (orderId) rows.push([t('orderNo'), esc(orderId)]);
    if (mine) {
      rows.push([t('orderItems'), esc(mine.orderName)]);
      rows.push([t('paidAmount'), esc(won(mine.amount))]);
      const s = mine.ship || {};
      if (state !== 'fail' && s.addr) rows.push([t('shipTo'), `${esc(s.name)} · ${esc(s.phone)}<br>(${esc(s.zip)}) ${esc(s.addr)} ${esc(s.addr2 || '')}`]);
    } else if (q.get('amount')) {
      rows.push([t('paidAmount'), esc(won(Number(q.get('amount'))))]);
    }
    return rows.length ? `<dl class="res__info">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '';
  };

  const render = () => {
    const title = { confirming: t('confirming'), done: t('doneTitle'), test: t('testDoneTitle'), error: t('failTitle'), fail: t('failTitle') }[state];
    document.title = `${title} — PLANT MATTER`;
    let text = '';
    if (state === 'test') text = t('testDoneText');
    if (state === 'error' || state === 'fail') text = detail;
    const retry = !mine ? '' : mine.fromCart ? '/checkout/?from=cart'
      : mine.items && mine.items[0] ? `/checkout/?id=${encodeURIComponent(mine.items[0].id)}&qty=${mine.items[0].qty}` : '';
    const actions = state === 'confirming' ? '' : `<div class="res__actions">
        ${(state === 'fail' || state === 'error') && retry ? `<a class="btn-buy" href="${retry}">${esc(t('retry'))}</a>` : ''}
        <a class="btn-line" href="/plant/">${esc(t('continueShopping'))}</a>
      </div>`;
    root.innerHTML = `
      <p class="res__eyebrow">${state === 'done' || state === 'test' ? 'THANK YOU' : 'ORDER'}</p>
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
  if (mine && mine.confirmed) { setState(mine.test ? 'test' : 'done'); return; }   // 새로고침: 다시 승인하지 않음 (장바구니도 이미 비움)

  const finish = (test) => {
    if (mine) S.saveOrder({ ...mine, confirmed: true, test, paymentKey });
    clearCart();
    setState(test ? 'test' : 'done');
  };

  if (!S.config.confirmUrl) {
    if (S.isTest()) finish(true);
    else setState('error', t('noServer'));
    return;
  }

  setState('confirming');
  fetch(S.config.confirmUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount, order: mine }),
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      finish(false);
    })
    .catch((err) => setState('error', t('confirmFail', { msg: err.message })));
})();
