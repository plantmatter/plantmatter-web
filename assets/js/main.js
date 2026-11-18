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
  };
  applyLang(lang, false);

  /* 주소의 ?lang= 은 적용 후 지워서 주소를 깔끔하게 */
  if (/[?&](lang|view)=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);

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
  menuTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const id = tab.dataset.menu;
      /* 마우스를 올려 막 열린 직후의 클릭은 닫지 않음 */
      if (openMenu === id && Date.now() - openedAt > 600) setMenu(null);
      else setMenu(id);
    });
  });
  document.querySelectorAll('[data-menu-close]').forEach((el) => el.addEventListener('click', () => setMenu(null)));
  if (window.matchMedia('(hover: hover)').matches) {
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
  document.querySelectorAll('[data-soon]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (!el.closest('.mega')) setMenu(null);
      showToast(t('soon', { name: t(el.dataset.soon) }));
    });
  });

  /* ---------- 검색 ---------- */
  const setSearch = (open) => {
    search.classList.toggle('is-open', open);
    search.setAttribute('aria-hidden', String(!open));
    searchOpen.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => input.focus(), 200);
    else { msg.textContent = ''; searchOpen.focus(); }
  };
  searchOpen.addEventListener('click', () => { setMenu(null); setSearch(true); });
  search.querySelectorAll('[data-search-close]').forEach((el) => el.addEventListener('click', () => setSearch(false)));
  search.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    msg.textContent = q ? t('searchSoon', { q }) : t('searchEmpty');
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


})();
