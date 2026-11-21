/* PLANT MATTER — PLANT 목록 페이지 (/plant/)
   분류 탭(ALL · Tropical Plant · Orchid · Fern · Caudex)을 누르면 새로고침 없이 목록이 바뀌고,
   주소도 /plant/?c=orchid 처럼 바뀌어서 그대로 공유·즐겨찾기할 수 있습니다.
   상품은 assets/js/products.js, 분류는 assets/js/layout.js 에서 관리합니다. */
/* 제품 목록(products.js → Supabase)을 다 읽은 뒤 시작 */
(window.PM_PRODUCTS_READY || Promise.resolve()).then(() => {
  const PM = window.PM;
  if (!PM) return;
  const { t } = PM;
  const CATS = window.PM_CATEGORIES || [];
  const PRODUCTS = window.PM_PRODUCTS || [];

  const pillsEl = document.querySelector('[data-pills]');
  const gridEl = document.querySelector('[data-grid]');
  const titleEl = document.querySelector('[data-title]');
  const countEl = document.querySelector('[data-count]');
  const emptyEl = document.querySelector('[data-empty]');

  const valid = (c) => (CATS.some((x) => x.id === c) ? c : 'all');
  const fromUrl = () => valid(new URLSearchParams(location.search).get('c'));
  const urlFor = (c) => (c === 'all' ? '/plant/' : `/plant/?c=${c}`);
  let cat = fromUrl();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* 분류 탭 */
  pillsEl.innerHTML = [{ id: 'all', name: 'ALL' }, ...CATS]
    .map((c) => `<a class="pill" href="${urlFor(c.id)}" data-cat="${c.id}">${esc(c.name)}</a>`)
    .join('');
  const pills = [...pillsEl.querySelectorAll('.pill')];
  if (window.PM_FIT_TITLE) window.PM_FIT_TITLE(titleEl, ['ALL', ...CATS.map((c) => c.name)]);   // 제목 칸 너비 고정 (layout.js)

  /* 상품 칸은 assets/js/shop.js 의 cardHtml (COLLABORATION 페이지와 같은 모양) */
  const card = (p, lang) => window.PM_SHOP.cardHtml(p, lang);

  /* 분류 탭 표시는 누르는 즉시, 제목·개수·식물 목록은 renderContent() 에서 */
  const renderPills = () => {
    pills.forEach((p) => {
      const on = p.dataset.cat === cat;
      p.classList.toggle('is-active', on);
      if (on) p.setAttribute('aria-current', 'page'); else p.removeAttribute('aria-current');
    });
  };
  const renderContent = () => {
    const lang = PM.getLang();
    const c = CATS.find((x) => x.id === cat);
    const label = c ? c.name : 'ALL';
    titleEl.textContent = label;
    document.title = `${label} — PLANT MATTER`;
    const list = PRODUCTS.filter((p) => (cat === 'all' ? CATS.some((c) => c.id === p.category) : p.category === cat));   // 식물만 (협업 화분 등은 COLLABORATION 페이지에)
    countEl.textContent = list.length === 1 ? t('countOne') : t('count', { n: list.length });
    gridEl.innerHTML = list.map((p) => card(p, lang)).join('');
    emptyEl.hidden = list.length > 0;
  };
  const render = () => { renderPills(); renderContent(); };

  /* 분류를 바꿀 때 옆으로 넘기는 애니메이션
     오른쪽 탭으로 가면 지금 목록이 왼쪽으로 빠지고 새 목록이 오른쪽에서 들어옴 (왼쪽 탭이면 반대)
     '동작 줄이기' 설정을 켠 기기에서는 바로 바뀜 */
  const ORDER = ['all', ...CATS.map((c) => c.id)];
  const headEl = titleEl.closest('.list__head');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let running = [];
  const slideTo = (from, update) => {
    const dir = Math.sign(ORDER.indexOf(cat) - ORDER.indexOf(from));
    running.forEach((a) => a.cancel());
    running = [];
    if (!dir || reduceMotion.matches || !gridEl.animate) { update(); return Promise.resolve(); }
    const targets = [headEl, countEl, gridEl, emptyEl].filter(Boolean);
    const dist = Math.round(Math.min(72, window.innerWidth * 0.08));
    const outs = targets.map((el) => el.animate(
      [{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * dist}px)`, opacity: 0 }],
      { duration: 220, easing: 'cubic-bezier(.55, 0, .75, .3)', fill: 'forwards' }));
    running = outs;
    return Promise.all(outs.map((a) => a.finished)).then(() => {
      update();
      outs.forEach((a) => a.cancel());
      running = targets.map((el, i) => el.animate(
        [{ transform: `translateX(${dir * dist}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 560, delay: i === 2 ? 40 : 0, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }));
    }, () => { /* 더 빨리 다른 탭을 눌러 중간에 취소됨 */ });
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
    const from = cat;
    cat = valid(next);
    if (push) history.pushState(null, '', urlFor(cat) + hash);
    renderPills();
    slideTo(from, renderContent).then(() => { if (hash) setTimeout(() => reveal(hash), 120); });
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
});
