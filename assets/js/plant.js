/* PLANT MATTER — PLANT 목록 페이지 (/plant/)
   분류 탭(ALL · Tropical Plant · Orchid · Fern · Caudex)을 누르면 새로고침 없이 목록이 바뀌고,
   주소도 /plant/?c=orchid 처럼 바뀌어서 그대로 공유·즐겨찾기할 수 있습니다.
   상품은 assets/js/products.js, 분류는 assets/js/layout.js 에서 관리합니다. */
(() => {
  const PM = window.PM;
  if (!PM) return;
  const { t } = PM;
  const CATS = window.PM_CATEGORIES || [];
  const PRODUCTS = window.PM_PRODUCTS || [];

  const pillsEl = document.querySelector('[data-pills]');
  const gridEl = document.querySelector('[data-grid]');
  const titleEl = document.querySelector('[data-title]');
  const crumbEl = document.querySelector('[data-crumb]');
  const countEl = document.querySelector('[data-count]');
  const emptyEl = document.querySelector('[data-empty]');

  const valid = (c) => (CATS.some((x) => x.id === c) ? c : 'all');
  const fromUrl = () => valid(new URLSearchParams(location.search).get('c'));
  const urlFor = (c) => (c === 'all' ? '/plant/' : `/plant/?c=${c}`);
  let cat = fromUrl();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const price = (p) => (p == null ? t('priceAsk') : `₩ ${Number(p).toLocaleString('ko-KR')}`);
  const BAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8.5h15l-1.2 12h-12.6z"/><path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5"/></svg>';

  /* 분류 탭 */
  pillsEl.innerHTML = [{ id: 'all', name: 'ALL' }, ...CATS]
    .map((c) => `<a class="pill" href="${urlFor(c.id)}" data-cat="${c.id}">${esc(c.name)}</a>`)
    .join('');
  const pills = [...pillsEl.querySelectorAll('.pill')];

  const card = (p, lang) => {
    const name = (p.name && (p.name[lang] || p.name.ko)) || p.id;
    const sold = p.status === 'soldout';
    const [italic = '', rest = ''] = p.sci || [];
    return `<li class="card${sold ? ' is-soldout' : ''}" id="p-${esc(p.id)}">
      <a class="card__link" href="/product/?id=${encodeURIComponent(p.id)}">
        <span class="card__img"><img src="${esc(p.image)}" alt="${esc(name)}" width="750" height="1000" loading="lazy"></span>
        ${sold ? `<span class="card__badge">${esc(t('soldOut'))}</span>` : ''}
        <span class="card__body">
          <span class="card__name">${esc(name)}</span>
          <span class="card__sci"><i>${esc(italic)}</i> ${esc(rest)}</span>
          <span class="card__price">${esc(price(p.price))}</span>
          ${p.exact ? `<span class="card__note">${esc(t('exactShip'))}</span>` : ''}
        </span>
      </a>
      <button class="card__cart" type="button" data-soon="cart" aria-label="${esc(t('addToCart'))}">${BAG}</button>
    </li>`;
  };

  const render = () => {
    const lang = PM.getLang();
    const c = CATS.find((x) => x.id === cat);
    const label = c ? c.name : 'ALL';
    titleEl.textContent = label;
    crumbEl.textContent = label;
    document.title = `${label} — PLANT MATTER`;
    pills.forEach((p) => {
      const on = p.dataset.cat === cat;
      p.classList.toggle('is-active', on);
      if (on) p.setAttribute('aria-current', 'page'); else p.removeAttribute('aria-current');
    });
    const list = PRODUCTS.filter((p) => cat === 'all' || p.category === cat);
    countEl.textContent = list.length === 1 ? t('countOne') : t('count', { n: list.length });
    gridEl.innerHTML = list.map((p) => card(p, lang)).join('');
    emptyEl.hidden = list.length > 0;
  };

  /* 검색 결과에서 온 경우(#p-식물id): 그 칸까지 내려가서 잠깐 테두리로 표시 */
  const reveal = (hash) => {
    const el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    const gnbH = document.querySelector('.gnb')?.offsetHeight || 0;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - gnbH - 24, behavior: 'smooth' });
    el.classList.remove('is-found');
    void el.offsetWidth;
    el.classList.add('is-found');
  };

  const go = (next, push = true, hash = '') => {
    cat = valid(next);
    if (push) history.pushState(null, '', urlFor(cat) + hash);
    render();
    if (hash) reveal(hash);
  };

  /* 탭·메뉴의 분류 링크는 이 페이지 안에서 바로 바꿈 (PLANT 탭 자체는 제외) */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="/plant/"]');
    if (!a || a.hasAttribute('data-menu') || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    PM.closeMenu();
    if (PM.closeSearch) PM.closeSearch();
    const u = new URL(a.href, location.href);
    go(u.searchParams.get('c'), true, u.hash);
    if (!u.hash) window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('popstate', () => go(fromUrl(), false, location.hash));
  PM.onLang(render);
  render();
  if (location.hash) setTimeout(() => reveal(location.hash), 150);
})();
