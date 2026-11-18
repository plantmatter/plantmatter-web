/* PLANT MATTER — 주문/결제 (/checkout/?id=식물id&qty=수량)
   주문자 정보 · 배송지(주소 찾기: assets/js/postcode.js) · 결제 수단(토스페이먼츠 결제위젯) · 주문 금액
   로그인한 회원은 저장된 이름·휴대폰·배송지가 자동으로 채워집니다 (assets/js/auth.js). 비회원 주문도 됩니다.
   결제 설정(키, 배송비)은 assets/js/shop.js 에 있습니다. */
(() => {
  const PM = window.PM;
  const S = window.PM_SHOP;
  if (!PM || !S || !window.PM_FORM) return;
  const { t } = PM;
  const { esc, won } = S;

  const form = document.querySelector('[data-form]');
  const none = document.querySelector('[data-none]');
  const testBadge = document.querySelector('[data-test]');
  const itemsEl = document.querySelector('[data-items]');
  const sumEl = document.querySelector('[data-sum]');
  const payBtn = document.querySelector('[data-pay]');
  const payErr = document.querySelector('[data-pay-err]');
  const memberNote = document.querySelector('[data-member-note]');
  const recvEl = document.querySelector('[data-recv]');
  const F = form.elements;
  const sameBox = F.same;

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
  const check = window.PM_FORM.bind(form);
  const syncSame = () => {
    recvEl.hidden = sameBox.checked;
    F.recvName.required = F.recvPhone.required = !sameBox.checked;
  };
  sameBox.addEventListener('change', syncSame);

  const fillEmpty = (values) => Object.entries(values).forEach(([k, v]) => { if (v && F[k] && !F[k].value) F[k].value = v; });
  /* 다시 결제하러 온 경우: 방금 쓴 정보를 다시 채워 둠 (이 탭 안에서만) */
  const prev = S.loadOrder();
  if (prev && prev.buyer && prev.ship) {
    fillEmpty({ buyerName: prev.buyer.name, buyerPhone: prev.buyer.phone, buyerEmail: prev.buyer.email,
      recvName: prev.ship.name, recvPhone: prev.ship.phone, zip: prev.ship.zip, addr: prev.ship.addr, addr2: prev.ship.addr2, memo: prev.ship.memo });
    sameBox.checked = prev.ship.same !== false;
  }
  syncSame();

  /* 회원: 저장된 정보로 채움 · 비회원: 로그인 안내 */
  const A = window.PM_AUTH;
  if (A && A.available()) {
    A.ready.then(async (u) => {
      if (!u) {
        memberNote.querySelector('a').href = `/account/?next=${encodeURIComponent(location.pathname + location.search)}`;
        memberNote.hidden = false;
        return;
      }
      const c = await A.getCustomer().catch(() => null);
      fillEmpty({ buyerEmail: u.email, buyerName: c && c.name, buyerPhone: c && c.phone, zip: c && c.zip, addr: c && c.addr, addr2: c && c.addr2 });
    });
  }

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
    if (!check.validate() || !widgets) return;
    const same = sameBox.checked;
    const buyer = { name: F.buyerName.value.trim(), phone: F.buyerPhone.value, email: F.buyerEmail.value.trim() };
    const order = {
      orderId: S.newOrderId(), orderName, amount, subtotal, shipping,
      items: [{ id: p.id, name: S.nameOf(p, 'ko'), price: p.price, qty }],
      buyer,
      ship: { same, name: same ? buyer.name : F.recvName.value.trim(), phone: same ? buyer.phone : F.recvPhone.value,
        zip: F.zip.value, addr: F.addr.value.trim(), addr2: F.addr2.value.trim(), memo: F.memo.value.trim() },
      member: (A && A.user() && A.user().id) || null,
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
