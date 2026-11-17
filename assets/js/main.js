/* PLANT MATTER — PC (plantmatter.kr) */
(() => {
  const MOBILE_URL = 'https://m.plantmatter.kr';
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
  const toMobile = document.querySelector('.to-mobile');

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
    if (toMobile) toMobile.href = `${MOBILE_URL}/?view=m&lang=${lang}`;
    msg.textContent = '';
  };
  applyLang(lang, false);

  /* 주소의 ?lang=, ?view= 는 적용 후 지워서 주소를 깔끔하게 */
  if (/[?&](lang|view)=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);

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
  searchOpen.addEventListener('click', () => setSearch(true));
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
  drawerOpen.addEventListener('click', () => setDrawer(true));
  drawer.querySelectorAll('[data-drawer-close]').forEach((el) => el.addEventListener('click', () => setDrawer(false)));
  document.getElementById('lang-form').addEventListener('submit', (e) => {
    e.preventDefault();
    applyLang(langSelect.value, true);
    setDrawer(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drawer.classList.contains('is-open')) setDrawer(false);
    else if (search.classList.contains('is-open')) setSearch(false);
  });

  /* ---------- 휴대폰에서 PC 버전을 고른 경우: 모바일로 돌아가는 버튼 ---------- */
  const phone = /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile.+Firefox|Opera Mini/i.test(navigator.userAgent);
  if (phone && toMobile) {
    toMobile.hidden = false;
    toMobile.addEventListener('click', () => {
      try { localStorage.removeItem('pm-view'); } catch (e) {}
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
