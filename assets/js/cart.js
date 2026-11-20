/* PLANT MATTER — 장바구니 (오른쪽에서 열리는 창, 탬버린즈 참고)
   - 담긴 식물은 이 기기·브라우저에 저장됩니다 (localStorage 'pm-cart'). 다른 탭에서 바꿔도 바로 같이 바뀝니다.
   - 상단 가방 아이콘 [data-cart-open] → 장바구니 열기 (아이콘에 담긴 개수 표시 [data-cart-count])
   - [data-cart-add="식물id"] (목록 카드의 가방 버튼 · 제품 상세 '장바구니에 담기') → 담고 장바구니 열기.
     data-qty="2" 가 있으면 그 수량만큼 담음
   - 주문하기 → /checkout/?from=cart : 담긴 식물을 한 번에 결제 → 결제가 끝나면 주문한 식물은 장바구니에서 빠짐 (result.js)
   - 수량은 +/− 또는 숫자를 직접 입력 (한 개체뿐인 '동일 상품 배송' 식물은 1개 고정)
   - 품절·가격 미정이 된 식물은 장바구니에 남아 있지만 표시만 되고 주문에서는 빠집니다.
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요.
   필요한 스크립트 순서: i18n → main → products → shop → cart */
(() => {
  const PM = window.PM;
  const S = window.PM_SHOP;
  if (!PM || !S) return;
  const { t } = PM;
  const { esc, won } = S;
  const KEY = 'pm-cart';

  const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  const DEL = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
  const MINUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>';
  const PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10"/></svg>';

  /* ---------- 저장 ---------- */
  const buyable = (p) => Boolean(p) && p.status !== 'soldout' && p.price != null;
  /* 없는 식물·중복은 빼고, 수량은 1 ~ 살 수 있는 최대 수량 사이로 */
  const clean = (arr) => {
    const seen = new Set();
    return (Array.isArray(arr) ? arr : [])
      .filter((x) => x && typeof x.id === 'string' && S.find(x.id) && !seen.has(x.id) && seen.add(x.id))
      .map((x) => ({ id: x.id, qty: Math.min(S.maxQty(S.find(x.id)), Math.max(1, parseInt(x.qty, 10) || 1)) }));
  };
  const load = () => { try { return clean(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return []; } };
  let lines = [];   // 제품 목록을 다 읽은 뒤 채움 (아래 whenReady)
  const whenReady = (fn) => (window.PM_PRODUCTS_READY || Promise.resolve()).then(fn);
  const listeners = [];
  /* typing: 수량 칸에 숫자를 입력하는 중 → 입력 칸은 다시 그리지 않고 금액·합계만 바꿈 */
  const save = (typing) => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) {}
    changed(typing);
  };

  const items = () => lines.map((l) => { const p = S.find(l.id); return { id: l.id, qty: l.qty, p, ok: buyable(p) }; });
  const orderable = () => items().filter((x) => x.ok);
  const count = () => lines.reduce((n, l) => n + l.qty, 0);

  /* ---------- 장바구니 창 ---------- */
  document.body.insertAdjacentHTML('beforeend', `
  <div class="drawer cart" id="cart-drawer" aria-hidden="true">
    <div class="drawer__dim" data-cart-close></div>
    <section class="drawer__panel cart__panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <header class="drawer__head">
        <h2 id="cart-title"><span data-i18n="cart">${esc(t('cart'))}</span><span class="cart__n" data-cart-n></span></h2>
        <button class="icon-btn drawer__close" type="button" data-cart-close aria-label="${esc(t('close'))}" data-i18n-attr="aria-label: close">${CLOSE}</button>
      </header>
      <div class="cart__body" data-cart-body></div>
      <footer class="cart__foot" data-cart-foot hidden></footer>
    </section>
  </div>`);
  const drawer = document.getElementById('cart-drawer');
  const bodyEl = drawer.querySelector('[data-cart-body]');
  const footEl = drawer.querySelector('[data-cart-foot]');
  const nEl = drawer.querySelector('[data-cart-n]');
  const isOpen = () => drawer.classList.contains('is-open');

  const itemHtml = ({ p, qty, ok }, lang) => {
    const name = S.nameOf(p, lang);
    const href = `/product/?id=${encodeURIComponent(p.id)}`;
    const max = S.maxQty(p);
    const qtyHtml = !ok ? '' : max > 1
      ? `<div class="qty cart-item__qty" role="group" aria-label="${esc(t('qty'))}">
          <button class="qty__btn" type="button" data-cart-step="-1" aria-label="${esc(t('qtyDown'))}"${qty <= 1 ? ' disabled' : ''}>${MINUS}</button>
          <input class="qty__val" data-cart-qty type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${qty}" aria-label="${esc(t('qty'))}">
          <button class="qty__btn" type="button" data-cart-step="1" aria-label="${esc(t('qtyUp'))}"${qty >= max ? ' disabled' : ''}>${PLUS}</button>
        </div>`
      : `<span class="cart-item__one">${esc(t('qty'))} 1</span>`;
    const price = !ok ? (p.status === 'soldout' ? t('soldOut') : t('priceAsk')) : won(p.price * qty);
    return `<li class="cart-item${ok ? '' : ' is-off'}" data-id="${esc(p.id)}">
      <a class="cart-item__img" href="${href}" tabindex="-1" aria-hidden="true"><img src="${esc(p.image)}" alt="" width="750" height="1000" loading="lazy"></a>
      <div class="cart-item__text">
        <a class="cart-item__name" href="${href}">${esc(name)}</a>
        <span class="cart-item__sci">${S.sciHtml(p)}</span>
        ${p.exact ? `<span class="cart-item__note">${esc(t('exactShip'))}</span>` : ''}
        ${ok ? '' : `<span class="cart-item__note">${esc(t('cartOffNote'))}</span>`}
        <div class="cart-item__row">${qtyHtml}<span class="cart-item__price">${esc(price)}</span></div>
      </div>
      <button class="cart-item__del" type="button" data-cart-del aria-label="${esc(t('cartRemove', { name }))}">${DEL}</button>
    </li>`;
  };

  const render = (typing) => {
    const lang = PM.getLang();
    const all = items();
    const n = count();
    nEl.textContent = n ? ` (${n})` : '';
    /* 상단 아이콘 숫자 */
    document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = n > 99 ? '99+' : String(n); el.hidden = !n; });
    document.querySelectorAll('[data-cart-open]').forEach((el) => {
      el.setAttribute('aria-label', n ? t('cartWith', { n }) : t('cart'));
      el.classList.toggle('has-items', n > 0);   // 담긴 것이 있으면 가방 안을 초록으로 (style.css .icon-cart.has-items)
    });
    if (!all.length) {
      bodyEl.innerHTML = `<p class="cart__empty">${esc(t('cartEmpty'))}</p>`;
      footEl.innerHTML = '';
      footEl.hidden = true;
      return;
    }
    if (typing === true) {
      all.forEach((x) => {
        const li = bodyEl.querySelector(`.cart-item[data-id="${CSS.escape(x.id)}"]`);
        if (!li || !x.ok) return;
        li.querySelector('.cart-item__price').textContent = won(x.p.price * x.qty);
        const down = li.querySelector('[data-cart-step="-1"]');
        const up = li.querySelector('[data-cart-step="1"]');
        if (down) down.disabled = x.qty <= 1;
        if (up) up.disabled = x.qty >= S.maxQty(x.p);
      });
    } else {
      bodyEl.innerHTML = `<ul class="cart__list">${all.map((x) => itemHtml(x, lang)).join('')}</ul>`;
    }
    const ok = all.filter((x) => x.ok);
    const subtotal = ok.reduce((s, x) => s + x.p.price * x.qty, 0);
    const shipping = ok.length ? S.shippingFor(subtotal) : 0;
    footEl.innerHTML = `
      <dl class="cart-sum">
        ${S.config.shippingFee > 0 ? `<div><dt>${esc(t('subtotal'))}</dt><dd>${esc(won(subtotal))}</dd></div>
        <div><dt>${esc(t('shipFee'))}</dt><dd>${esc(shipping ? won(shipping) : t('free'))}</dd></div>` : ''}
        <div class="cart-sum__total"><dt>${esc(t('cartTotal'))}</dt><dd>${esc(won(subtotal + shipping))}</dd></div>
      </dl>
      ${ok.length
        ? `<a class="btn-buy" href="/checkout/?from=cart">${esc(t('cartOrder'))}</a>`
        : `<button class="btn-buy" type="button" disabled>${esc(t('cartOrder'))}</button>`}`;
    footEl.hidden = false;
  };

  function changed(typing) {
    render(typing);
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  }

  /* 열고 닫기 — 닫으면 연 버튼으로 커서를 돌려 줌 */
  let opener = null;
  const setOpen = (open) => {
    if (open === isOpen()) return;
    if (open) {
      PM.closeMenu();
      PM.closeSearch();
      opener = document.activeElement;
      render();
    }
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.querySelectorAll('[data-cart-open]').forEach((el) => el.setAttribute('aria-expanded', String(open)));
    if (PM.lockScroll) PM.lockScroll();
    if (open) setTimeout(() => { if (isOpen()) drawer.querySelector('.drawer__close').focus({ preventScroll: true }); }, 250);
    else if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
  };

  /* 담기: 이미 최대 수량이면 안내만 하고 장바구니를 보여 줌 */
  const add = (id, qty = 1, { open = true } = {}) => {
    const p = S.find(id);
    if (!buyable(p)) return false;
    const max = S.maxQty(p);
    const want = Math.max(1, parseInt(qty, 10) || 1);
    const line = lines.find((l) => l.id === id);
    if (line && line.qty >= max) {
      PM.toast(max === 1 ? t('cartAlready') : t('cartMaxed', { n: max }));
    } else if (line) {
      if (line.qty + want > max) PM.toast(t('cartMaxed', { n: max }));
      line.qty = Math.min(max, line.qty + want);
      lines = [line, ...lines.filter((l) => l !== line)];   // 방금 담은 것이 맨 위
      save();
    } else {
      lines = [{ id, qty: Math.min(max, want) }, ...lines];
      save();
    }
    if (open) setOpen(true);
    return true;
  };
  const setQty = (id, qty) => {
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    line.qty = Math.min(S.maxQty(S.find(id)), Math.max(1, qty));
    save();
  };
  const remove = (ids) => {
    const drop = new Set([].concat(ids));
    const next = lines.filter((l) => !drop.has(l.id));
    if (next.length === lines.length) return;
    lines = next;
    save();
  };

  /* ---------- 누르기 ---------- */
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-cart-add]');
    if (addBtn) {
      e.preventDefault();
      const id = addBtn.dataset.cartAdd;
      const qty = addBtn.dataset.qty || 1;
      whenReady(() => add(id, qty));
      return;
    }
    if (e.target.closest('[data-cart-open]')) { e.preventDefault(); whenReady(() => setOpen(true)); }
  });
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-close]')) { setOpen(false); return; }
    const li = e.target.closest('.cart-item');
    if (!li) return;
    const id = li.dataset.id;
    const step = e.target.closest('[data-cart-step]');
    if (step) {
      const line = lines.find((l) => l.id === id);
      if (line) setQty(id, line.qty + Number(step.dataset.cartStep));
      /* 다시 그린 뒤에도 같은 버튼에 커서 유지 (키보드로 여러 번 누를 때) */
      const again = bodyEl.querySelector(`.cart-item[data-id="${CSS.escape(id)}"] [data-cart-step="${step.dataset.cartStep}"]`);
      if (again && !again.disabled) again.focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('[data-cart-del]')) {
      remove(id);
      drawer.querySelector('.drawer__close').focus({ preventScroll: true });
      return;
    }
    /* 제품으로 이동할 때는 창을 닫음 (같은 제품 페이지 안에서 눌러도 자연스럽게) */
    if (e.target.closest('a[href^="/product/"]')) setOpen(false);
  });
  /* 수량 직접 입력: 숫자만 받고 입력하는 동안 금액·합계에 바로 반영,
     칸을 벗어나거나 Enter 를 누르면 1 ~ 최대 수량으로 맞춤 */
  drawer.addEventListener('input', (e) => {
    const field = e.target.closest('[data-cart-qty]');
    if (!field) return;
    const digits = field.value.replace(/\D/g, '').slice(0, 3);
    if (digits !== field.value) field.value = digits;
    const line = lines.find((l) => l.id === field.closest('.cart-item').dataset.id);
    const n = parseInt(digits, 10);
    if (!line || !(n >= 1)) return;
    const next = Math.min(S.maxQty(S.find(line.id)), n);
    if (next !== line.qty) { line.qty = next; save(true); }
  });
  drawer.addEventListener('change', (e) => {
    const field = e.target.closest('[data-cart-qty]');
    if (!field) return;
    const id = field.closest('.cart-item').dataset.id;
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    const max = S.maxQty(S.find(id));
    const n = parseInt(field.value, 10);
    if (n > max) PM.toast(t('cartMaxed', { n: max }));
    const next = Math.min(max, Math.max(1, n || 1));
    /* 입력하는 동안 이미 저장됐으면 칸의 숫자만 맞춤 (다시 그리지 않아야 바로 누른 '주문하기'가 그대로 눌림) */
    if (next === line.qty) { if (field.value !== String(next)) field.value = String(next); }
    else setQty(id, next);
  });
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-cart-qty]')) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setOpen(false); });

  /* 다른 탭에서 바뀐 경우 */
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return;
    lines = load();
    changed();
  });
  /* 뒤로 가기로 돌아온 페이지(bfcache)는 저장된 값으로 다시 */
  window.addEventListener('pageshow', (e) => { if (e.persisted) { lines = load(); changed(); } });

  PM.onLang(render);
  let isReady = false;
  whenReady(() => { lines = load(); isReady = true; changed(); });
  /* 장바구니를 다 읽기 전에 들어온 담기 · 수량 · 빼기 요청은 읽은 뒤에 처리 (결제 완료 페이지의 '주문한 식물 빼기' 등) */
  const later = (fn) => (...args) => (isReady ? fn(...args) : whenReady(() => fn(...args)));

  window.PM_CART = {
    items, orderable, count, add: later(add), setQty: later(setQty), remove: later(remove),
    open: () => setOpen(true),
    close: () => setOpen(false),
    onChange: (fn) => listeners.push(fn),
  };
})();
