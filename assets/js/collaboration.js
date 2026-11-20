/* PLANT MATTER — COLLABORATION 페이지 (/collaboration/) — PLANT 목록(assets/js/plant.js)과 같은 형식
   분류 탭(ALL · GECKO IN THE LIBRARY · THICHI YUIITSUMUNI …)을 누르면 새로고침 없이 옆으로 넘기며 바뀌고,
   주소도 /collaboration/?c=gecko-in-the-library 처럼 바뀌어 그대로 공유·즐겨찾기할 수 있습니다.
   항목(이름 · 메뉴 썸네일)은 assets/js/layout.js 의 COLLABS, 각 협업의 제품은 assets/js/products.js (collab: '이름') 에서 관리합니다.
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요. */
/* 제품 목록(products.js → Supabase)을 다 읽은 뒤 시작 */
(window.PM_PRODUCTS_READY || Promise.resolve()).then(() => {
  const PM = window.PM;
  if (!PM) return;
  const { t } = PM;
  const ITEMS = window.PM_COLLABS || [];

  const pillsEl = document.querySelector('[data-pills]');
  const gridEl = document.querySelector('[data-grid]');
  const titleEl = document.querySelector('[data-title]');
  const crumbEl = document.querySelector('[data-crumb]');
  const countEl = document.querySelector('[data-count]');
  const emptyEl = document.querySelector('[data-empty]');

  const valid = (c) => (ITEMS.some((x) => x.id === c) ? c : 'all');
  const fromUrl = () => valid(new URLSearchParams(location.search).get('c'));
  const urlFor = (c) => (c === 'all' ? '/collaboration/' : `/collaboration/?c=${c}`);
  let cur = fromUrl();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* 분류 탭 */
  pillsEl.innerHTML = [{ id: 'all', name: 'ALL' }, ...ITEMS]
    .map((c) => `<a class="pill" href="${urlFor(c.id)}" data-cat="${esc(c.id)}">${esc(c.name)}</a>`)
    .join('');
  const pills = [...pillsEl.querySelectorAll('.pill')];

  /* ALL: 협업 카드 (PLANT 목록의 식물 카드와 같은 모양) */
  const card = (c) => `<li class="card">
      <a class="card__link" href="${urlFor(c.id)}">
        <span class="card__img">${c.img ? `<img src="${esc(c.img)}" alt="${esc(c.name)}" width="750" height="1000" loading="lazy">` : ''}</span>
        <span class="card__body"><span class="card__name">${esc(c.name)}</span></span>
      </a>
    </li>`;

  const renderPills = () => {
    pills.forEach((p) => {
      const on = p.dataset.cat === cur;
      p.classList.toggle('is-active', on);
      if (on) p.setAttribute('aria-current', 'page'); else p.removeAttribute('aria-current');
    });
  };
  const renderContent = () => {
    const c = ITEMS.find((x) => x.id === cur);
    const label = c ? c.name : 'ALL';
    titleEl.textContent = label;
    crumbEl.textContent = label;
    document.title = `${label} — PLANT MATTER`;
    if (c) {
      /* 이 협업의 제품 (products.js 에서 collab 이 이 이름인 것) — PLANT 목록과 같은 카드 */
      const list = (window.PM_PRODUCTS || []).filter((p) => p.collab === c.id);
      const lang = PM.getLang();
      countEl.textContent = list.length ? t('countItems', { n: list.length }) : '';
      gridEl.innerHTML = window.PM_SHOP ? list.map((p) => window.PM_SHOP.cardHtml(p, lang)).join('') : '';
      emptyEl.hidden = list.length > 0;
    } else {
      countEl.textContent = t('collabCount', { n: ITEMS.length });
      gridEl.innerHTML = ITEMS.map(card).join('');
      emptyEl.hidden = ITEMS.length > 0;
    }
  };
  const render = () => { renderPills(); renderContent(); };

  /* 분류를 바꿀 때 옆으로 넘기는 애니메이션 (PLANT 목록과 같은 거리·시간·곡선, '동작 줄이기'면 바로) */
  const ORDER = ['all', ...ITEMS.map((c) => c.id)];
  const headEl = titleEl.closest('.list__head');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let running = [];
  const slideTo = (from, update) => {
    const dir = Math.sign(ORDER.indexOf(cur) - ORDER.indexOf(from));
    running.forEach((a) => a.cancel());
    running = [];
    if (!dir || reduceMotion.matches || !gridEl.animate) { update(); return; }
    const targets = [headEl, countEl, gridEl, emptyEl].filter(Boolean);
    const dist = Math.round(Math.min(72, window.innerWidth * 0.08));
    const outs = targets.map((el) => el.animate(
      [{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * dist}px)`, opacity: 0 }],
      { duration: 220, easing: 'cubic-bezier(.55, 0, .75, .3)', fill: 'forwards' }));
    running = outs;
    Promise.all(outs.map((a) => a.finished)).then(() => {
      update();
      outs.forEach((a) => a.cancel());
      running = targets.map((el, i) => el.animate(
        [{ transform: `translateX(${dir * dist}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 560, delay: i === 2 ? 40 : 0, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }));
    }, () => { /* 더 빨리 다른 탭을 눌러 중간에 취소됨 */ });
  };

  const go = (next, push = true) => {
    const from = cur;
    cur = valid(next);
    if (push) history.pushState(null, '', urlFor(cur));
    renderPills();
    slideTo(from, renderContent);
  };

  /* 탭 · 카드 · 메뉴의 항목 링크는 이 페이지 안에서 바로 바꿈 (COLLABORATION 탭 자체는 제외) */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="/collaboration/"]');
    if (!a || a.hasAttribute('data-menu') || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    PM.closeMenu();
    if (PM.closeSearch) PM.closeSearch();
    go(new URL(a.href, location.href).searchParams.get('c'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('popstate', () => go(fromUrl(), false));
  PM.onLang(render);
  render();
});
