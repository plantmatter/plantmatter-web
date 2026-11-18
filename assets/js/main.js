/* PLANT MATTER — PC (plantmatter.kr) */
(() => {
  const LANGS = ['ko', 'en', 'ja'];
  const DICT = window.PM_I18N || {};
  const root = document.documentElement;
  let lang = LANGS.includes(root.lang) ? root.lang : 'ko';

  const t = (key, vars = {}) => {
    const s = (DICT[lang] && DICT[lang][key]) ?? (DICT.ko && DICT.ko[key]) ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  };
  const langListeners = [];

  const toast = document.querySelector('.toast');
  const search = document.getElementById('search');
  const searchOpen = document.querySelector('[data-search-open]');
  const input = document.getElementById('search-input');
  const msg = search.querySelector('.search__msg');

  /* ---------- 언어 ---------- */
  const applyLang = (next, save) => {
    lang = LANGS.includes(next) ? next : 'ko';
    root.lang = lang;
    if (save) { try { localStorage.setItem('pm-lang', lang); } catch (e) {} }
    document.title = t('title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'));
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    msg.textContent = '';
    langListeners.forEach((fn) => fn(lang));
  };
  applyLang(lang, false);

  /* 주소의 ?lang= 은 적용 후 지워서 주소를 깔끔하게 (?c= 같은 다른 값은 유지) */
  const params = new URLSearchParams(location.search);
  if (params.has('lang') || params.has('view')) {
    params.delete('lang');
    params.delete('view');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }

  /* ---------- 탭 아래로 내려오는 메뉴 (PLANT) ---------- */
  /* 마우스를 올리면 열리고(PC), 눌러도 열립니다. 바깥·어두운 부분·Esc로 닫힘 */
  const gnb = document.querySelector('.gnb');
  const menuTabs = document.querySelectorAll('[data-menu]');
  let openMenu = null;
  let openedAt = 0;
  let hoverTimer;
  const setMenu = (id) => {
    document.querySelectorAll('.mega').forEach((m) => {
      const on = m.id === `menu-${id}`;
      m.classList.toggle('is-open', on);
      m.setAttribute('aria-hidden', String(!on));
    });
    menuTabs.forEach((tab) => {
      const on = tab.dataset.menu === id;
      tab.classList.toggle('is-current', on);
      tab.setAttribute('aria-expanded', String(on));
    });
    gnb.classList.toggle('is-menu-open', Boolean(id));
    if (id && id !== openMenu) openedAt = Date.now();
    openMenu = id || null;
  };
  const canHover = window.matchMedia('(hover: hover)').matches;
  menuTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      if (canHover) return;   /* 마우스: 메뉴는 올리면 열리고, 누르면 PLANT 전체 목록으로 이동 */
      e.preventDefault();     /* 터치(아이패드 등): 누르면 메뉴 열기/닫기 */
      const id = tab.dataset.menu;
      /* 마우스를 올려 막 열린 직후의 클릭은 닫지 않음 */
      if (openMenu === id && Date.now() - openedAt > 600) setMenu(null);
      else setMenu(id);
    });
  });
  document.querySelectorAll('[data-menu-close]').forEach((el) => el.addEventListener('click', () => setMenu(null)));
  if (canHover) {
    const stay = () => clearTimeout(hoverTimer);
    const leave = () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => setMenu(null), 220); };
    menuTabs.forEach((tab) => tab.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => setMenu(tab.dataset.menu), 80);
    }));
    document.querySelectorAll('.gnb__menu a:not([data-menu])').forEach((a) => a.addEventListener('mouseenter', () => { clearTimeout(hoverTimer); setMenu(null); }));
    gnb.addEventListener('mouseenter', stay);
    gnb.addEventListener('mouseleave', leave);
    document.querySelectorAll('.mega__panel').forEach((p) => {
      p.addEventListener('mouseenter', stay);
      p.addEventListener('mouseleave', leave);
    });
  }

  /* ---------- 아직 없는 페이지·기능: '준비 중' 안내 ---------- */
  let toastTimer;
  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), 2200);
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-soon]');
    if (!el) return;
    e.preventDefault();
    if (!el.closest('.mega')) setMenu(null);
    showToast(t('soon', { name: t(el.dataset.soon) }));
  });

  /* ---------- 검색 ---------- */
  const setSearch = (open) => {
    search.classList.toggle('is-open', open);
    search.setAttribute('aria-hidden', String(!open));
    searchOpen.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => input.focus(), 200);
    else { input.value = ''; showResults(''); searchOpen.focus(); }
  };
  searchOpen.addEventListener('click', () => { setMenu(null); setSearch(true); });
  search.querySelectorAll('[data-search-close]').forEach((el) => el.addEventListener('click', () => setSearch(false)));
  /* 등록된 식물(products.js) 중 이름(한·영·일)이나 학명이 맞는 것을 입력하는 동안 바로 보여줌.
     띄어쓰기·따옴표는 무시 ('무룽라야' → 무룽 라야) */
  const resultsEl = search.querySelector('.search__results');
  const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s'"‘’“”「」・.·-]/g, '');
  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const findPlants = (q) => {
    const nq = norm(q);
    if (!nq) return [];
    return (window.PM_PRODUCTS || []).filter((p) =>
      [p.id, ...Object.values(p.name || {}), (p.sci || []).join(' ')].some((v) => norm(v).includes(nq)));
  };
  const showResults = (q, submitted = false) => {
    const query = q.trim();
    if (!query) {
      resultsEl.innerHTML = '';
      msg.textContent = submitted ? t('searchEmpty') : '';
      return;
    }
    const list = findPlants(query);
    msg.textContent = list.length ? t('searchCount', { n: list.length }) : t('searchNone', { q: query });
    resultsEl.innerHTML = list.map((p) => {
      const name = (p.name && (p.name[lang] || p.name.ko)) || p.id;
      const [italic = '', rest = ''] = p.sci || [];
      const price = p.price == null ? t('priceAsk') : `₩ ${Number(p.price).toLocaleString('ko-KR')}`;
      return `<li><a class="hit" href="/product/?id=${encodeURIComponent(p.id)}">
        <span class="hit__img"><img src="${escHtml(p.image)}" alt="" width="750" height="1000" loading="lazy"></span>
        <span class="hit__text"><span class="hit__name">${escHtml(name)}</span><span class="hit__sci"><i>${escHtml(italic)}</i> ${escHtml(rest)}</span></span>
        <span class="hit__price">${escHtml(price)}</span>
      </a></li>`;
    }).join('');
  };
  let searchTimer;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => showResults(input.value), 120);
  });
  langListeners.push(() => { if (search.classList.contains('is-open')) showResults(input.value); });
  search.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(searchTimer);
    showResults(input.value, true);
  });

  /* ---------- 언어 설정 창 ---------- */
  const drawer = document.getElementById('lang-drawer');
  const drawerOpen = document.querySelector('[data-lang-open]');
  const langSelect = document.getElementById('lang-select');
  const setDrawer = (open) => {
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    drawerOpen.setAttribute('aria-expanded', String(open));
    if (open) { langSelect.value = lang; setTimeout(() => langSelect.focus(), 250); }
    else drawerOpen.focus();
  };
  drawerOpen.addEventListener('click', () => { setMenu(null); setDrawer(true); });
  drawer.querySelectorAll('[data-drawer-close]').forEach((el) => el.addEventListener('click', () => setDrawer(false)));
  document.getElementById('lang-form').addEventListener('submit', (e) => {
    e.preventDefault();
    applyLang(langSelect.value, true);
    setDrawer(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openMenu) setMenu(null);
    else if (drawer.classList.contains('is-open')) setDrawer(false);
    else if (search.classList.contains('is-open')) setSearch(false);
  });

  /* 다른 페이지 스크립트(PLANT 목록 등)와 공유 */
  window.PM = {
    t,
    getLang: () => lang,
    onLang: (fn) => langListeners.push(fn),
    closeMenu: () => setMenu(null),
    closeSearch: () => { if (search.classList.contains('is-open')) setSearch(false); },
    toast: showToast,
  };

  /* ---------- 홈 사진 슬라이드 (자동으로 넘어감) ---------- */
  const SLIDE_INTERVAL = 8000;   /* 한 장이 머무는 시간 (밀리초) */
  const hero = document.querySelector('.hero');
  const track = hero && hero.querySelector('.slides__track');
  if (track) {
    const bars = [...hero.querySelectorAll('.bar')];
    const count = bars.length;
    /* 마지막 → 첫 장으로 이어지게 첫 장 복사본을 맨 뒤에 붙임 */
    const clone = track.children[0].cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelector('img')?.removeAttribute('fetchpriority');
    track.appendChild(clone);
    hero.style.setProperty('--interval', `${SLIDE_INTERVAL}ms`);

    let index = 0;
    let busy = false;
    let busyTimer;
    const setPos = (i, animate) => {
      track.style.transition = animate ? '' : 'none';
      track.style.transform = `translateX(${-i * 100}%)`;
      if (!animate) void track.offsetWidth;   /* 즉시 적용 */
    };
    const activate = (k) => {
      bars.forEach((b) => { b.classList.remove('is-active'); b.setAttribute('aria-current', 'false'); });
      void bars[k].offsetWidth;               /* 막대 채우기 처음부터 다시 */
      bars[k].classList.add('is-active');
      bars[k].setAttribute('aria-current', 'true');
      [...track.children].forEach((s, j) => { if (j < count) s.setAttribute('aria-hidden', String(j !== k)); });
    };
    const goTo = (target) => {
      if (busy || target === index) return;
      busy = true;
      clearTimeout(busyTimer);
      busyTimer = setTimeout(() => { busy = false; }, 1400);
      if (target < 0) { setPos(count, false); target = count - 1; }   /* 첫 장에서 뒤로: 복사본 위치로 옮긴 뒤 이동 */
      index = target;
      setPos(index, true);
      activate(index % count);
    };
    const next = () => goTo(index + 1);
    const prev = () => goTo(index - 1);
    track.addEventListener('transitionend', (e) => {
      if (e.target !== track) return;
      busy = false;
      if (index === count) { index = 0; setPos(0, false); }   /* 복사본에 도착하면 진짜 첫 장으로 조용히 교체 */
    });

    bars.forEach((b, k) => {
      /* 막대가 다 차면 다음 사진으로 */
      b.querySelector('.bar__fill').addEventListener('animationend', () => { if (b.classList.contains('is-active')) next(); });
      b.addEventListener('click', () => {
        const cur = index % count;
        if (k === cur) return;
        goTo(k === 0 && cur === count - 1 ? count : k);
      });
    });

    /* 손가락으로 밀어 넘기기 */
    let sx = null;
    let sy = null;
    const area = hero.querySelector('.slides');
    area.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    area.addEventListener('touchend', (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
      sx = null;
    }, { passive: true });

    /* 다른 탭을 보고 있을 때는 멈춤 */
    document.addEventListener('visibilitychange', () => hero.classList.toggle('is-paused', document.hidden));

    setPos(0, false);
    activate(0);
  }
})();
