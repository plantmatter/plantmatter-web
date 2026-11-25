/* PLANT MATTER — 주문/결제
   /checkout/?id=식물id&qty=수량 → 그 식물 하나만 바로 구매
   /checkout/?from=cart           → 장바구니(assets/js/cart.js)에 담긴 식물 전부 (품절·가격 미정은 빠짐)
   주문자 정보 · 배송지(주소 찾기: assets/js/postcode.js) · 결제 수단(토스페이먼츠 결제위젯) · 주문 금액
   로그인한 회원은 저장된 이름·휴대폰·배송지가 자동으로 채워집니다 (assets/js/auth.js). 비회원 주문도 됩니다.
   결제 설정(키, 배송비)은 assets/js/shop.js 에 있습니다. */
/* 제품 목록(products.js → Supabase)을 다 읽은 뒤 시작 */
(window.PM_PRODUCTS_READY || Promise.resolve()).then(() => {
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
  const fromCart = q.get('from') === 'cart';
  const C = window.PM_CART;
  testBadge.hidden = !S.isTest();

  /* 주문할 식물들: [{ p, qty }] */
  const single = fromCart ? null : S.find(q.get('id'));
  const getLines = () => {
    if (fromCart) return C ? C.orderable().map((x) => ({ p: x.p, qty: x.qty })) : [];
    const p = single;
    if (!p || p.status === 'soldout' || p.price == null) return [];
    return [{ p, qty: Math.min(S.maxQty(p), Math.max(1, parseInt(q.get('qty'), 10) || 1)) }];
  };
  let lines = [];
  let subtotal = 0;
  let shipping = 0;
  let amount = 0;
  let orderName = '';
  const compute = () => {
    lines = getLines();
    subtotal = lines.reduce((sum, l) => sum + l.p.price * l.qty, 0);
    shipping = S.shippingFor(subtotal);
    amount = subtotal + shipping;
    /* 결제창·영수증에 보이는 주문명 (토스페이먼츠: 100자까지) */
    const first = lines[0] ? S.nameOf(lines[0].p, 'ko') : '';
    orderName = (lines.length > 1 ? `${first} 외 ${lines.length - 1}건`
      : `${first}${lines[0] && lines[0].qty > 1 ? ` × ${lines[0].qty}` : ''}`).slice(0, 100);
  };

  /* 살 수 없는 경우: 없는 식물 · 품절 · 가격 미정 · 장바구니가 빔 */
  const showNone = () => {
    form.hidden = true;
    none.hidden = false;
    const p = single;
    let msg; let href; let label;
    if (fromCart) { msg = t('cartNone'); href = '/plant/'; label = t('backToList'); }
    else {
      msg = !p ? t('notFound') : p.status === 'soldout' ? t('soldOutMsg') : t('priceAsk');
      href = p ? `/product/?id=${encodeURIComponent(p.id)}` : '/plant/';
      label = t(p ? 'backToProduct' : 'backToList');
    }
    none.innerHTML = `<p>${esc(msg)}</p><a class="btn-line" href="${href}">${esc(label)}</a>`;
  };

  compute();
  if (!lines.length) {
    showNone();
    PM.onLang(() => { if (!form.hidden) return; showNone(); });
    /* 장바구니 주문인데 다른 탭에서 다시 담은 경우 */
    if (fromCart && C) C.onChange(() => { if (C.orderable().length) location.reload(); });
    return;
  }

  /* ---------- 주문 상품 · 금액 ---------- */
  const renderSummary = () => {
    const lang = PM.getLang();
    document.title = `${t('checkout')} — PLANT MATTER`;
    itemsEl.innerHTML = lines.map(({ p, qty }) => `<li class="co-item">
      <a class="co-item__img${p.plain ? ' is-plain' : ''}" href="/product/?id=${encodeURIComponent(p.id)}"><img src="${esc(p.image)}" alt="" width="750" height="1000"></a>
      <span class="co-item__text">
        <span class="co-item__name">${esc(S.nameOf(p, lang))}</span>
        <span class="co-item__sci">${S.sciHtml(p)}</span>
        <span class="co-item__meta">${esc(t('qty'))} ${qty} · ${esc(won(p.price * qty))}</span>
      </span>
    </li>`).join('');
    sumEl.innerHTML = `
      <div><dt>${esc(t('subtotal'))}</dt><dd>${esc(won(subtotal))}</dd></div>
      ${S.config.shippingFee > 0 ? `<div><dt>${esc(t('shipFee'))}</dt><dd>${esc(shipping ? won(shipping) : t('free'))}</dd></div>` : ''}
      <div class="co-sum__total"><dt>${esc(t('payTotal'))}</dt><dd>${esc(won(amount))}</dd></div>`;
    payBtn.textContent = t('payBtn', { amount: won(amount) });
  };
  PM.onLang(() => { if (form.hidden) showNone(); else renderSummary(); });
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

  /* 회원 배송지 고르기: [기본 배송지] [추가 배송지들] [새로 입력] — 추가 배송지가 있을 때만 보임 */
  const pickEl = document.querySelector('[data-addr-pick]');
  let pickOpts = [];
  let picked = '';
  const renderPick = () => {
    pickEl.innerHTML = pickOpts.map((o) => `<button class="pill${o.key === picked ? ' is-active' : ''}" type="button" data-pick="${esc(o.key)}" aria-pressed="${o.key === picked}">${esc(o.label())}</button>`).join('');
  };
  const applyPick = (key) => {
    const o = pickOpts.find((x) => x.key === key);
    if (!o) return;
    const v = o.fill();
    sameBox.checked = v.same;
    syncSame();
    ['recvName', 'recvPhone', 'zip', 'addr', 'addr2'].forEach((k) => { if (k in v) { F[k].value = v[k] || ''; check.setErr(F[k], null); } });
    picked = key;
    renderPick();
    if (key === 'new') F.zip.focus();
  };
  pickEl.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) applyPick(b.dataset.pick); });
  PM.onLang(renderPick);
  const setupPick = (c, extras) => {
    if (!extras.length) return;
    pickOpts = [];
    if (c && c.addr) {
      pickOpts.push({ key: 'default', label: () => t('addrDefault'), fill: () => ({ same: true, recvName: '', recvPhone: '', zip: c.zip, addr: c.addr, addr2: c.addr2 }) });
    }
    extras.forEach((a, i) => pickOpts.push({
      key: String(a.id), label: () => a.label || t('addrNoLabel', { n: i + 1 }),
      fill: () => ({ same: false, recvName: a.name, recvPhone: a.phone, zip: a.zip, addr: a.addr, addr2: a.addr2 }),
    }));
    pickOpts.push({ key: 'new', label: () => t('addrNew'), fill: () => ({ same: true, recvName: '', recvPhone: '', zip: '', addr: '', addr2: '' }) });
    /* 지금 칸에 들어 있는 주소와 같은 배송지를 선택 상태로 */
    const match = pickOpts.find((o) => o.key !== 'new' && o.fill().zip === F.zip.value && o.fill().addr === F.addr.value.trim());
    picked = match ? match.key : '';
    renderPick();
    pickEl.hidden = false;
  };

  /* 회원: 저장된 정보로 채움 · 비회원: 로그인 안내 */
  const A = window.PM_AUTH;
  if (A && A.available()) {
    A.ready.then(async (u) => {
      if (!u) {
        memberNote.querySelector('a').href = `/account/?next=${encodeURIComponent(location.pathname + location.search)}`;
        memberNote.hidden = false;
        return;
      }
      const [c, extras] = await Promise.all([A.getCustomer().catch(() => null), A.listAddresses().catch(() => [])]);
      fillEmpty({ buyerEmail: u.email, buyerPhone: c && c.phone, zip: c && c.zip, addr: c && c.addr, addr2: c && c.addr2 });   // 주문자 이름은 직접 입력 (회원 정보에 실명을 받지 않음)
      setupPick(c, extras);
    });
  }

  /* ---------- 결제 수단 · 약관 (토스페이먼츠 결제위젯) ---------- */
  const showPayErr = (text) => { payErr.textContent = text; payErr.hidden = !text; };
  let widgets = null;
  let ready = false;          // 결제 수단 화면을 다 그렸는지
  let widgetAmount = null;    // 결제위젯에 마지막으로 알린 금액
  let syncing = false;
  /* 결제위젯 금액을 지금 주문 금액에 맞춤 (맞추는 동안은 결제 버튼을 잠깐 끔) */
  const syncAmount = () => {
    if (!ready || syncing || widgetAmount === amount) return;
    const value = amount;
    syncing = true;
    payBtn.disabled = true;
    widgets.setAmount({ currency: 'KRW', value })
      .then(() => { widgetAmount = value; })
      .catch((err) => { console.error(err); showPayErr(t('payLoadFail')); })
      .finally(() => {
        syncing = false;
        if (widgetAmount === amount) payBtn.disabled = false;
        else if (widgetAmount === value) syncAmount();   // 맞추는 사이에 또 바뀜
      });
  };
  /* 장바구니 주문: 이 화면을 연 채로 장바구니를 바꾸면 주문 상품·금액도 바로 바뀜 */
  if (fromCart && C) {
    C.onChange(() => {
      compute();
      if (!lines.length) { showNone(); return; }
      renderSummary();
      syncAmount();
    });
  }
  (async () => {
    if (typeof window.TossPayments !== 'function') throw new Error('sdk');
    const toss = window.TossPayments(S.config.clientKey);
    widgets = toss.widgets({ customerKey: window.TossPayments.ANONYMOUS || '@@ANONYMOUS' });
    const first = amount;
    await widgets.setAmount({ currency: 'KRW', value: first });
    await Promise.all([
      widgets.renderPaymentMethods({ selector: '#pay-methods', variantKey: 'DEFAULT' }),
      widgets.renderAgreement({ selector: '#pay-agreement', variantKey: 'AGREEMENT' }),
    ]);
    widgetAmount = first;
    ready = true;
    if (first === amount) payBtn.disabled = false;
    else syncAmount();
  })().catch((err) => {
    widgets = null;
    ready = false;
    console.error(err);
    showPayErr(t('payLoadFail'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showPayErr('');
    if (!check.validate() || !ready || !lines.length || widgetAmount !== amount) return;
    const same = sameBox.checked;
    const buyer = { name: F.buyerName.value.trim(), phone: F.buyerPhone.value, email: F.buyerEmail.value.trim() };
    const order = {
      orderId: '', orderName, amount, subtotal, shipping, fromCart,
      items: lines.map(({ p, qty }) => ({ id: p.id, name: S.nameOf(p, 'ko'), price: p.price, qty })),
      buyer,
      ship: { same, name: same ? buyer.name : F.recvName.value.trim(), phone: same ? buyer.phone : F.recvPhone.value,
        zip: F.zip.value, addr: F.addr.value.trim(), addr2: F.addr2.value.trim(), memo: F.memo.value.trim() },
      member: (A && A.user() && A.user().id) || null,
      lang: PM.getLang(), createdAt: new Date().toISOString(),
    };
    payBtn.disabled = true;
    /* 1) 서버에 주문 만들기 — 금액은 서버가 DB 가격으로 다시 계산하고 주문번호를 정함 */
    let made;
    try {
      const token = A && A.accessToken ? await A.accessToken() : null;
      made = await S.payCall({ action: 'create', items: order.items.map(({ id, qty }) => ({ id, qty })), buyer, ship: order.ship, lang: order.lang }, token);
    } catch (err) {
      console.error(err);
      payBtn.disabled = false;
      showPayErr(t('payError', { msg: '' }));
      return;
    }
    if (!made.ok) {
      payBtn.disabled = false;
      const d = made.data || {};
      if (d.error === 'soldout') {
        const p = S.find(d.id);
        showPayErr(t('paySoldout', { name: p ? S.nameOf(p, PM.getLang()) : '' }));
      } else if (d.error === 'invalid') {
        (d.fields || []).forEach((n) => { if (F[n] && check.setErr) check.setErr(F[n], 'errRequired'); });
        showPayErr(t('payInvalid'));
      } else showPayErr(d.error === 'rate' ? t('payRate') : t('payError', { msg: '' }));
      return;
    }
    if (made.data.amount !== amount) { payBtn.disabled = false; showPayErr(t('payPriceChanged')); return; }   // 화면의 가격이 예전 것
    order.orderId = made.data.orderId;
    order.orderName = made.data.orderName;
    S.saveOrder(order);
    /* 2) 토스 결제창 */
    try {
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
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
  window.addEventListener('pageshow', (e) => { if (e.persisted && ready && widgetAmount === amount) payBtn.disabled = false; });
});
