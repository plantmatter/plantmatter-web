/* PLANT MATTER — 제품 상세 (/product/?id=식물id)
   왼쪽 큰 사진 · 오른쪽 이름 · 학명 · 가격 · 수량 · 총 금액 · 장바구니에 담기 / 구매하기 · 제품 정보 (탬버린즈 · 무지개맨션 참고)
   장바구니에 담기는 assets/js/cart.js 가 처리합니다 ([data-cart-add] · data-qty = 고른 수량).
   내용은 assets/js/products.js 에서 읽습니다. 사진 여러 장은 products.js 에 images: ['…', '…'] 로 넣으면 차례로 보입니다.
   설명 문구는 desc: { ko: '…', en: '…', ja: '…' } 로 넣으면 가격 아래에 보입니다. */
/* 제품 목록(products.js → Supabase)을 다 읽은 뒤 시작 */
(window.PM_PRODUCTS_READY || Promise.resolve()).then(() => {
  const PM = window.PM;
  const S = window.PM_SHOP;
  if (!PM || !S) return;
  const { t } = PM;
  const { esc, won } = S;

  const main = document.querySelector('[data-product]');
  const crumb = document.querySelector('[data-pd-crumb]');
  const p = S.find(new URLSearchParams(location.search).get('id'));
  const max = S.maxQty(p);
  let qty = 1;

  const CHEV = '<svg class="acc__chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6"/></svg>';
  const MINUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>';
  const PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10"/></svg>';

  const buyHref = () => `/checkout/?id=${encodeURIComponent(p.id)}&qty=${qty}`;
  const pcs = (n) => t('pieces', { n });

  /* keepField: 숫자를 직접 입력하는 중에는 입력 칸은 그대로 두고 금액만 바꿈 */
  const update = (keepField) => {
    const field = main.querySelector('[data-qty-field]');
    if (field.tagName === 'INPUT') { if (!keepField) field.value = qty; } else field.textContent = qty;
    main.querySelector('[data-total]').textContent = won(p.price * qty);
    main.querySelector('[data-pcs]').textContent = pcs(qty);
    const down = main.querySelector('[data-step="-1"]');
    const up = main.querySelector('[data-step="1"]');
    if (down) down.disabled = qty <= 1;   // 한 개체뿐인 식물은 +/− 버튼·입력 없이 수량 1
    if (up) up.disabled = qty >= max;
    main.querySelector('[data-buy]').href = buyHref();
    const add = main.querySelector('[data-cart-add]');
    if (add) add.dataset.qty = qty;
  };

  const render = () => {
    const lang = PM.getLang();
    if (!p) {
      document.title = 'PLANT MATTER';
      main.innerHTML = `<div class="pd-none"><p>${esc(t('notFound'))}</p><a class="btn-line" href="/plant/">${esc(t('backToList'))}</a></div>`;
      crumb.hidden = true;
      return;
    }
    const name = S.nameOf(p, lang);
    const cat = S.category(p.category);
    const col = S.groupOf(p);   // COLLABORATION · PRODUCT · MATTER 제품
    const sold = p.status === 'soldout';
    const canBuy = !sold && p.price != null;
    const images = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean);
    const desc = p.desc && (p.desc[lang] || p.desc.ko);
    const fee = S.config.shippingFee;
    const over = S.config.freeShippingOver;
    document.title = `${name} — PLANT MATTER`;

    main.innerHTML = `
      <div class="pd__media">
        ${images.map((src, i) => `<figure class="pd__img${p.plain ? ' is-plain' : ''}"><img src="${esc(src)}" alt="${i ? '' : esc(name)}" width="750" height="1000"${i ? ' loading="lazy"' : ''}></figure>`).join('')}
      </div>
      <div class="pd__info"><div class="pd__inner">
        <h1 class="pd__name">${esc(name)}</h1>
        <p class="pd__sci">${S.sciHtml(p)}</p>
        <p class="pd__price">${esc(p.price == null ? t('priceAsk') : won(p.price))}</p>
        ${p.exact ? `<p class="pd__exact"><span>${esc(t('exactShip'))}</span>${esc(t('exactShipText'))}</p>` : ''}
        ${desc ? `<p class="pd__desc">${esc(desc)}</p>` : ''}
        ${fee > 0 ? `<dl class="pd__ship"><dt>${esc(t('shipFee'))}</dt><dd>${esc(won(fee))}${over != null ? ` (${esc(t('freeOver', { amount: won(over) }))})` : ''}</dd></dl>` : ''}
        ${canBuy ? `
        <div class="pd__opt">
          <span class="pd__opt-label">${esc(t('qty'))}</span>
          <div class="qty" role="group" aria-label="${esc(t('qty'))}">
            ${max > 1 ? `<button class="qty__btn" type="button" data-step="-1" aria-label="${esc(t('qtyDown'))}">${MINUS}</button>` : ''}
            ${max > 1
              ? `<input class="qty__val" data-qty-field type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${qty}" aria-label="${esc(t('qty'))}">`
              : `<output class="qty__val" data-qty-field>${qty}</output>`}
            ${max > 1 ? `<button class="qty__btn" type="button" data-step="1" aria-label="${esc(t('qtyUp'))}">${PLUS}</button>` : ''}
          </div>
        </div>
        <div class="pd__total"><span>${esc(t('total'))}</span><span><strong data-total>${esc(won(p.price * qty))}</strong> <small data-pcs>${esc(pcs(qty))}</small></span></div>
        <div class="pd__cta">
          ${window.PM_CART ? `<button class="btn-buy btn-buy--line" type="button" data-cart-add="${esc(p.id)}" data-qty="${qty}">${esc(t('addToCart'))}</button>` : ''}
          <a class="btn-buy" data-buy href="${buyHref()}">${esc(t('buyNow'))}</a>
        </div>` : `
        <div class="pd__cta"><button class="btn-buy" type="button" disabled>${esc(sold ? t('soldOut') : t('priceAsk'))}</button></div>`}
        <div class="acc">
          <details class="acc__item">
            <summary>${esc(t('infoTitle'))}${CHEV}</summary>
            <dl class="acc__body">
              <dt>${esc(t(p.sub ? 'modelLabel' : 'sciLabel'))}</dt><dd>${S.sciHtml(p)}</dd>
              ${cat ? `<dt>${esc(t('catLabel'))}</dt><dd><a href="/plant/?c=${esc(cat.id)}">${esc(cat.name)}</a></dd>` : ''}
              ${col ? `<dt>${esc(col.section === 'COLLAB' ? t('collabLabel') : col.section)}</dt><dd><a href="${col.base}?c=${esc(col.id)}">${esc(col.name)}</a></dd>` : ''}
            </dl>
          </details>
        </div>
      </div></div>`;

    crumb.innerHTML = `<a href="/">HOME</a><span aria-hidden="true">/</span>`
      + (col ? `<a href="${col.base}">${col.section}</a><span aria-hidden="true">/</span><a href="${col.base}?c=${esc(col.id)}">${esc(col.name)}</a>`
        : `<a href="/plant/">PLANT</a>` + (cat ? `<span aria-hidden="true">/</span><a href="/plant/?c=${esc(cat.id)}">${esc(cat.name)}</a>` : ''))
      + `<span aria-hidden="true">/</span><span aria-current="page">${esc(name)}</span>`;
    if (canBuy) update();
  };

  main.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn || !p) return;
    qty = Math.min(max, Math.max(1, qty + Number(btn.dataset.step)));
    update();
  });
  /* 수량 직접 입력: 숫자만 · 입력하는 동안 금액 바로 반영 · 칸을 벗어나거나 Enter 를 누르면 1 ~ 최대 수량으로 맞춤 */
  main.addEventListener('input', (e) => {
    const field = e.target.closest('input[data-qty-field]');
    if (!field) return;
    const digits = field.value.replace(/\D/g, '').slice(0, 3);
    if (digits !== field.value) field.value = digits;
    const n = parseInt(digits, 10);
    if (n >= 1) { qty = Math.min(max, n); update(true); }
  });
  main.addEventListener('change', (e) => {
    const field = e.target.closest('input[data-qty-field]');
    if (!field) return;
    const n = parseInt(field.value, 10);
    if (n > max) PM.toast(t('qtyMax', { n: max }));
    qty = Math.min(max, Math.max(1, n || 1));
    update();
  });
  main.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[data-qty-field]')) e.target.blur();
  });

  PM.onLang(render);
  render();
});
