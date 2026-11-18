/* PLANT MATTER — 주문/결제 (/checkout/?id=식물id&qty=수량)
   주문자 정보 · 배송지(우편번호 찾기: 카카오 우편번호 서비스) · 결제 수단(토스페이먼츠 결제위젯) · 주문 금액
   결제 설정(키, 배송비)은 assets/js/shop.js 에 있습니다. */
(() => {
  const PM = window.PM;
  const S = window.PM_SHOP;
  if (!PM || !S) return;
  const { t } = PM;
  const { esc, won } = S;

  const form = document.querySelector('[data-form]');
  const none = document.querySelector('[data-none]');
  const testBadge = document.querySelector('[data-test]');
  const itemsEl = document.querySelector('[data-items]');
  const sumEl = document.querySelector('[data-sum]');
  const payBtn = document.querySelector('[data-pay]');
  const payErr = document.querySelector('[data-pay-err]');
  const sameBox = form.elements.same;
  const recvEl = document.querySelector('[data-recv]');

  const q = new URLSearchParams(location.search);
  const p = S.find(q.get('id'));
  testBadge.hidden = !S.isTest();

  /* 살 수 없는 경우: 없는 식물 · 품절 · 가격 미정 */
  if (!p || p.status === 'soldout' || p.price == null) {
    form.hidden = true;
    none.hidden = false;
    const msg = !p ? t('notFound') : p.status === 'soldout' ? t('soldOutMsg') : t('priceAsk');
    none.innerHTML = `<p>${esc(msg)}</p><a class="btn-line" href="${p ? `/product/?id=${encodeURIComponent(p.id)}` : '/plant/'}">${esc(t(p ? 'backToProduct' : 'backToList'))}</a>`;
    return;
  }

  const qty = Math.min(S.maxQty(p), Math.max(1, parseInt(q.get('qty'), 10) || 1));
  const subtotal = p.price * qty;
  const shipping = S.shippingFor(subtotal);
  const amount = subtotal + shipping;
  const orderName = `${S.nameOf(p, 'ko')}${qty > 1 ? ` × ${qty}` : ''}`;

  /* ---------- 주문 상품 · 금액 ---------- */
  const renderSummary = () => {
    const lang = PM.getLang();
    document.title = `${t('checkout')} — PLANT MATTER`;
    itemsEl.innerHTML = `<li class="co-item">
      <a class="co-item__img" href="/product/?id=${encodeURIComponent(p.id)}"><img src="${esc(p.image)}" alt="" width="750" height="1000"></a>
      <span class="co-item__text">
        <span class="co-item__name">${esc(S.nameOf(p, lang))}</span>
        <span class="co-item__sci">${S.sciHtml(p)}</span>
        <span class="co-item__meta">${esc(t('qty'))} ${qty} · ${esc(won(p.price))}</span>
      </span>
    </li>`;
    sumEl.innerHTML = `
      <div><dt>${esc(t('subtotal'))}</dt><dd>${esc(won(subtotal))}</dd></div>
      ${S.config.shippingFee > 0 ? `<div><dt>${esc(t('shipFee'))}</dt><dd>${esc(shipping ? won(shipping) : t('free'))}</dd></div>` : ''}
      <div class="co-sum__total"><dt>${esc(t('payTotal'))}</dt><dd>${esc(won(amount))}</dd></div>`;
    payBtn.textContent = t('payBtn', { amount: won(amount) });
  };
  PM.onLang(renderSummary);
  renderSummary();

  /* ---------- 입력 칸 ---------- */
  const F = form.elements;
  const digits = (v) => String(v || '').replace(/\D/g, '');
  ['buyerPhone', 'recvPhone', 'zip'].forEach((n) => F[n].addEventListener('input', () => {
    const d = digits(F[n].value);
    if (F[n].value !== d) F[n].value = d;
  }));
  const syncSame = () => {
    recvEl.hidden = sameBox.checked;
    F.recvName.required = F.recvPhone.required = !sameBox.checked;
  };
  sameBox.addEventListener('change', syncSame);

  /* 다시 결제하러 온 경우: 방금 쓴 정보를 다시 채워 둠 (이 탭 안에서만) */
  const prev = S.loadOrder();
  if (prev && prev.buyer && prev.ship) {
    const fill = { buyerName: prev.buyer.name, buyerPhone: prev.buyer.phone, buyerEmail: prev.buyer.email,
      recvName: prev.ship.name, recvPhone: prev.ship.phone, zip: prev.ship.zip, addr: prev.ship.addr, addr2: prev.ship.addr2, memo: prev.ship.memo };
    Object.entries(fill).forEach(([k, v]) => { if (v && F[k]) F[k].value = v; });
    sameBox.checked = prev.ship.same !== false;
  }
  syncSame();

  const RULES = {
    buyerPhone: (v) => /^0\d{8,10}$/.test(v) || 'errPhone',
    recvPhone: (v) => /^0\d{8,10}$/.test(v) || 'errPhone',
    buyerEmail: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'errEmail',
    zip: (v) => /^\d{5}$/.test(v) || 'errZip',
  };
  const setErr = (input, key) => {
    const field = input.closest('.field');
    field.classList.toggle('is-invalid', Boolean(key));
    field.querySelector('.field__err').textContent = key ? t(key) : '';
    input.setAttribute('aria-invalid', key ? 'true' : 'false');
  };
  const check = (input) => {
    if (!input.required && !input.value.trim()) { setErr(input, null); return true; }
    const v = input.value.trim();
    let key = v ? null : 'errRequired';
    if (!key && RULES[input.name]) { const r = RULES[input.name](v); key = r === true ? null : r; }
    setErr(input, key);
    return !key;
  };
  const fields = [...form.querySelectorAll('.field input')];
  /* 틀린 칸은 고치는 즉시 오류 문구를 지움 (칸을 벗어날 때 검사하면 문구가 사라지며 화면이 움직여 버튼 클릭이 빗나감) */
  fields.forEach((el) => el.addEventListener('input', () => { if (el.closest('.field').classList.contains('is-invalid')) check(el); }));
  const validate = () => {
    const bad = fields.filter((el) => !el.closest('[hidden]') && !check(el));
    if (bad.length) bad[0].focus();
    return !bad.length;
  };

  /* ---------- 주소 찾기 (카카오 우편번호 서비스) ---------- */
  const layer = document.querySelector('[data-addr-layer]');
  const frame = layer.querySelector('[data-addr-frame]');
  const POSTCODE_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
  let postcodeLoad;
  const loadPostcode = () => postcodeLoad || (postcodeLoad = new Promise((resolve, reject) => {
    if (window.daum && window.daum.Postcode) return resolve();
    const s = document.createElement('script');
    s.src = POSTCODE_SRC;
    s.onload = () => (window.daum && window.daum.Postcode ? resolve() : reject(new Error('postcode')));
    s.onerror = () => { postcodeLoad = null; reject(new Error('postcode')); };
    document.head.appendChild(s);
  }));
  const closeLayer = () => { layer.hidden = true; frame.innerHTML = ''; document.documentElement.style.overflow = ''; };
  document.querySelector('[data-addr-find]').addEventListener('click', async () => {
    try {
      await loadPostcode();
    } catch (e) {
      PM.toast(t('addrLoadFail'));
      F.zip.focus();
      return;
    }
    layer.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    new window.daum.Postcode({
      width: '100%', height: '100%',
      oncomplete: (d) => {
        F.zip.value = d.zonecode;
        F.addr.value = d.userSelectedType === 'J' ? d.jibunAddress : (d.roadAddress || d.address);
        setErr(F.zip, null); setErr(F.addr, null);
        closeLayer();
        F.addr2.focus();
      },
    }).embed(frame, { autoClose: false });
  });
  layer.addEventListener('click', (e) => { if (e.target === layer || e.target.closest('[data-addr-close]')) closeLayer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !layer.hidden) closeLayer(); });

  /* ---------- 결제 수단 · 약관 (토스페이먼츠 결제위젯) ---------- */
  const showPayErr = (text) => { payErr.textContent = text; payErr.hidden = !text; };
  let widgets = null;
  (async () => {
    if (typeof window.TossPayments !== 'function') throw new Error('sdk');
    const toss = window.TossPayments(S.config.clientKey);
    widgets = toss.widgets({ customerKey: window.TossPayments.ANONYMOUS || '@@ANONYMOUS' });
    await widgets.setAmount({ currency: 'KRW', value: amount });
    await Promise.all([
      widgets.renderPaymentMethods({ selector: '#pay-methods', variantKey: 'DEFAULT' }),
      widgets.renderAgreement({ selector: '#pay-agreement', variantKey: 'AGREEMENT' }),
    ]);
    payBtn.disabled = false;
  })().catch((err) => {
    widgets = null;
    console.error(err);
    showPayErr(t('payLoadFail'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showPayErr('');
    if (!validate() || !widgets) return;
    const same = sameBox.checked;
    const buyer = { name: F.buyerName.value.trim(), phone: F.buyerPhone.value, email: F.buyerEmail.value.trim() };
    const order = {
      orderId: S.newOrderId(), orderName, amount, subtotal, shipping,
      items: [{ id: p.id, name: S.nameOf(p, 'ko'), price: p.price, qty }],
      buyer,
      ship: { same, name: same ? buyer.name : F.recvName.value.trim(), phone: same ? buyer.phone : F.recvPhone.value,
        zip: F.zip.value, addr: F.addr.value.trim(), addr2: F.addr2.value.trim(), memo: F.memo.value.trim() },
      lang: PM.getLang(), createdAt: new Date().toISOString(),
    };
    S.saveOrder(order);
    payBtn.disabled = true;
    try {
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName,
        successUrl: `${location.origin}/checkout/success/`,
        failUrl: `${location.origin}/checkout/fail/`,
        customerName: buyer.name,
        customerEmail: buyer.email,
        customerMobilePhone: buyer.phone,
      });
    } catch (err) {
      payBtn.disabled = false;
      if (err && err.code === 'USER_CANCEL') return;   // 결제창을 닫음
      showPayErr(t('payError', { msg: (err && err.message) || '' }));
    }
  });
  /* 결제창에서 '뒤로'로 돌아온 경우 버튼 다시 켜기 */
  window.addEventListener('pageshow', (e) => { if (e.persisted && widgets) payBtn.disabled = false; });
})();
