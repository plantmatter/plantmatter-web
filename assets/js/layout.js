/* PLANT MATTER — 모든 페이지 공통 틀: 상단 바 · PLANT 메뉴 · 하단 · 검색 · 언어 창
   여기 한 곳만 고치면 모든 페이지에 똑같이 반영됩니다.
   각 페이지는 <body> 바로 아래에서 PM_LAYOUT.top(), 본문 다음에 PM_LAYOUT.bottom() 을 부릅니다. */
/* 새 버전 확인 — 사이트를 새로 올린 직후에는 브라우저가 예전에 받아 둔 페이지를 잠깐(최대 10분) 그대로 다시 쓰는 일이 있어
   (그러면 장바구니처럼 새로 생긴 기능이 그 페이지에서만 안 보임), 페이지를 열 때 /version.txt 와 이 파일의 ?v= 를 비교해
   예전 페이지면 한 번 새로고침합니다. 결제 페이지(/checkout/)와 입력을 시작한 뒤에는 새로고침하지 않습니다.
   ▸ 배포할 때 모든 페이지의 ?v= 값과 version.txt 를 같은 값으로 올려 주세요. */
(function () {
  var me = document.currentScript && /[?&]v=([\w-]+)/.exec(document.currentScript.src);
  if (!me || !window.fetch || location.pathname.indexOf('/checkout/') === 0) return;
  var typed = false;
  document.addEventListener('input', function () { typed = true; }, true);
  var check = function () {
    fetch('/version.txt', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (v) {
        v = String(v).trim();
        if (!/^[\w-]{1,40}$/.test(v) || v === me[1] || typed) return;
        var key = 'pm-reload-' + v;   // 같은 버전으로는 한 번만 (계속 새로고침되는 일 방지)
        try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) { return; }
        location.reload();
      })
      .catch(function () {});
  };
  check();
  window.addEventListener('pageshow', function (e) { if (e.persisted) check(); });   // 뒤로 가기로 돌아온 페이지도
})();

(function () {
  /* PLANT 하위 분류 — 순서 · 이름 · 메뉴 썸네일(세로 3:4, 없으면 '') */
  var CATEGORIES = [
    { id: 'tropical', name: 'Tropical Plant', img: '/assets/img/menu/tropical-plant.jpg?v=2' },
    { id: 'orchid',   name: 'Orchid',         img: '/assets/img/menu/orchid.jpg' },
    { id: 'fern',     name: 'Fern',           img: '' },
    { id: 'caudex',   name: 'Caudex',         img: '' }
  ];
  window.PM_CATEGORIES = CATEGORIES;

  /* COLLABORATION 하위 항목 — 순서 · 이름 · 메뉴 썸네일(세로 3:4, 없으면 '') · PLANT 분류와 같은 방식
     항목을 더하면 상단 COLLABORATION 메뉴와 /collaboration/ 페이지 탭에 함께 생깁니다 */
  var COLLABS = [
    { id: 'gecko-in-the-library', name: 'GECKO IN THE LIBRARY', img: '' },
    { id: 'thichi-yuiitsumuni',   name: 'THICHI YUIITSUMUNI',   img: '/assets/img/products/thichi-bucotsu-bowl-long-4.jpg?v=2' }
  ];
  window.PM_COLLABS = COLLABS;

  var plantHere = location.pathname.indexOf('/plant/') === 0 ? ' class="is-here" aria-current="page"' : '';
  var contactHere = location.pathname.indexOf('/contact/') === 0 ? ' class="is-here" aria-current="page"' : '';
  var collabHere = location.pathname.indexOf('/collaboration/') === 0 ? ' class="is-here" aria-current="page"' : '';
  /* 장바구니 아이콘: 담긴 것이 있으면 처음 그릴 때부터 초록 가방 + 숫자 (자세한 확인은 뒤에 cart.js 가 다시 함)
     — 페이지를 옮길 때 검은 가방이 잠깐 보였다가 초록으로 바뀌는 깜빡임 방지 */
  var cartN = 0;
  try {
    JSON.parse(localStorage.getItem('pm-cart') || '[]').forEach(function (l) { if (l && l.id) cartN += Math.max(1, parseInt(l.qty, 10) || 1); });
  } catch (e) { cartN = 0; }
  var cartCls = cartN ? ' has-items' : '';
  var cartText = cartN > 99 ? '99+' : cartN ? String(cartN) : '';

  var megaList = function (items, base) {
    return items.map(function (c) {
      return '        <li><a class="mega__item" href="' + base + '?c=' + c.id + '"><span class="mega__img">' +
        (c.img ? '<img src="' + c.img + '" alt="" width="720" height="960" loading="lazy">' : '') +
        '</span><span class="mega__name">' + c.name + '</span></a></li>';
    }).join('\n');
  };
  var megaItems = megaList(CATEGORIES, '/plant/');
  var collabItems = megaList(COLLABS, '/collaboration/');

  var TOP = `  <!-- ───────── 상단 바 ───────── -->
  <header class="gnb">
    <a class="gnb__logo" href="/" aria-label="PLANT MATTER 홈" data-i18n-attr="aria-label: home">
      <img src="/assets/img/wordmark.png" alt="PLANT MATTER" width="2084" height="164">
    </a>

    <nav class="gnb__menu" aria-label="주요 메뉴" data-i18n-attr="aria-label: menu">
      <a href="/plant/" data-menu="plant"${plantHere} aria-controls="menu-plant" aria-expanded="false">PLANT</a>
      <a href="#" data-soon="MATTER">MATTER</a>
      <a href="/collaboration/" data-menu="collab"${collabHere} aria-controls="menu-collab" aria-expanded="false">COLLABORATION</a>
      <a href="/contact/"${contactHere}>CONTACT</a>
    </nav>

    <div class="gnb__util">
      <button class="icon-btn" type="button" data-search-open aria-label="검색" data-i18n-attr="aria-label: search" aria-controls="search" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
      </button>
      <a class="icon-btn" href="/account/" aria-label="내 정보" data-i18n-attr="aria-label: account">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-7 8-7s8 2 8 7"/></svg>
      </a>
      <button class="icon-btn icon-cart${cartCls}" type="button" data-cart-open aria-label="장바구니" data-i18n-attr="aria-label: cart" aria-controls="cart-drawer" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path class="bag__body" d="M4.5 8.5h15l-1.2 12h-12.6z"/><path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5"/></svg>
        <span class="cart-badge" data-cart-count${cartN ? '' : ' hidden'}>${cartText}</span>
      </button>
    </div>
  </header>

  <!-- ───────── PLANT 탭 아래로 내려오는 메뉴 (분류는 위 CATEGORIES) ───────── -->
  <div class="mega" id="menu-plant" aria-hidden="true">
    <div class="mega__panel" aria-label="PLANT">
      <ul class="mega__list">
${megaItems}
      </ul>
    </div>
    <div class="mega__dim" data-menu-close></div>
  </div>

  <!-- ───────── COLLABORATION 탭 아래로 내려오는 메뉴 (항목은 위 COLLABS) — PLANT 메뉴와 같은 모양 ───────── -->
  <div class="mega" id="menu-collab" aria-hidden="true">
    <div class="mega__panel" aria-label="COLLABORATION">
      <ul class="mega__list">
${collabItems}
      </ul>
    </div>
    <div class="mega__dim" data-menu-close></div>
  </div>
`;

  var BOTTOM = `  <!-- ───────── 하단 ───────── -->
  <footer class="foot">
    <span class="foot__copy">© PLANT MATTER</span>
    <button class="foot__lang" type="button" data-lang-open aria-controls="lang-drawer" aria-expanded="false"><span data-i18n="footLang">VIEW IN KOREAN</span><svg viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6"/></svg></button>
  </footer>

  <!-- ───────── 검색 ───────── -->
  <div class="search" id="search" aria-hidden="true">
    <div class="search__panel" role="dialog" aria-modal="true" aria-label="검색" data-i18n-attr="aria-label: search">
      <form class="search__form" role="search">
        <label class="sr-only" for="search-input" data-i18n="searchLabel">검색어</label>
        <input id="search-input" type="search" name="q" placeholder="식물 이름, 학명으로 검색" data-i18n-attr="placeholder: searchPlaceholder" autocomplete="off">
        <button class="icon-btn" type="submit" aria-label="검색하기" data-i18n-attr="aria-label: searchSubmit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
        </button>
      </form>
      <p class="search__msg" aria-live="polite"></p>
      <ul class="search__results"></ul>
      <button class="search__close" type="button" data-search-close>CLOSE</button>
    </div>
    <div class="search__dim" data-search-close></div>
  </div>

  <!-- ───────── 언어 설정 (오른쪽에서 열리는 창) ───────── -->
  <div class="drawer" id="lang-drawer" aria-hidden="true">
    <div class="drawer__dim" data-drawer-close></div>
    <section class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="lang-title">
      <header class="drawer__head">
        <h2 id="lang-title" data-i18n="langTitle">언어 설정</h2>
        <button class="icon-btn drawer__close" type="button" data-drawer-close aria-label="닫기" data-i18n-attr="aria-label: close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </header>
      <form class="drawer__body" id="lang-form">
        <label class="drawer__label" for="lang-select" data-i18n="language">언어 선택</label>
        <div class="select">
          <select id="lang-select" name="lang">
            <option value="ko" lang="ko">한국어</option>
            <option value="en" lang="en">English</option>
            <option value="ja" lang="ja">日本語</option>
          </select>
          <svg class="select__chev" viewBox="0 0 14 8" aria-hidden="true"><path d="M1 1l6 6 6-6"/></svg>
        </div>
        <button class="btn-solid" type="submit" data-i18n="langApply">적용하기</button>
      </form>
    </section>
  </div>

  <div class="toast" role="status" aria-live="polite"></div>
`;

  function insertHere(html) { document.currentScript.insertAdjacentHTML('afterend', html); }
  window.PM_LAYOUT = {
    top: function () { insertHere(TOP); },
    bottom: function () { insertHere(BOTTOM); }
  };
})();
