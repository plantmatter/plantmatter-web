/* PLANT MATTER — 모든 페이지 공통 틀: 상단 바 · PLANT 메뉴 · 하단 · 검색 · 언어 창
   여기 한 곳만 고치면 모든 페이지에 똑같이 반영됩니다.
   각 페이지는 <body> 바로 아래에서 PM_LAYOUT.top(), 본문 다음에 PM_LAYOUT.bottom() 을 부릅니다. */
/* 일본어 주소 — 일본어로 볼 때는 주소 앞에 /ja 를 붙임 (/ja/plant/ 처럼).
   공유 미리보기 문구는 앱이 주소마다 페이지 안의 글을 읽어 가는 것이라, /ja/… 페이지(tools/make_ja_pages.py 로 만듦)에만
   일본어 문구를 넣어 일본어로 보다가 공유하면 일본어 미리보기가 나오게 함. 한국어 · 영어는 /ja 없는 주소.
   - 페이지 안에서 주소를 바꾸는 곳(분류 탭 등)은 /ja 를 몰라도 되게 여기서 자동으로 붙이고 뗌
   - 지금 페이지가 어디인지는 location.pathname 대신 PM_PATH() (앞의 /ja 를 뗀 주소)로 확인 */
(function () {
  var H = window.history;
  if (!H || !H.replaceState) { window.PM_PATH = function () { return location.pathname; }; window.PM_SYNC_URL = function () {}; return; }
  var JA = /^\/ja(?=[\/?#]|$)/;
  var fix = function (u) {
    if (typeof u !== 'string' || u.charAt(0) !== '/' || u.charAt(1) === '/') return u;   // 이 사이트 안의 주소만
    var bare = u.replace(JA, '');
    if (bare.charAt(0) !== '/') bare = '/' + bare;
    return document.documentElement.lang === 'ja' ? '/ja' + bare : bare;
  };
  var push = H.pushState, rep = H.replaceState;
  H.pushState = function (s, t, u) { return push.call(H, s, t, u == null ? u : fix(String(u))); };
  H.replaceState = function (s, t, u) { return rep.call(H, s, t, u == null ? u : fix(String(u))); };
  window.PM_PATH = function () { return location.pathname.replace(JA, '') || '/'; };
  /* 언어에 맞게 지금 주소의 /ja 를 붙이거나 뗌 (언어를 바꿀 때 main.js 도 부름) */
  window.PM_SYNC_URL = function () {
    var cur = location.pathname + location.search + location.hash;
    if (fix(cur) !== cur) H.replaceState(H.state, '', cur);
  };
  window.PM_SYNC_URL();
})();

/* PC: 분류 탭은 제목 바로 오른쪽 — 제목이 바뀌어 길이가 달라지면(ALL ↔ Tropical Plant) 탭이 새 자리로 부드럽게 미끄러짐
   (제목 옆으로 넘어오는 애니메이션과 같은 시간 · 곡선). 모바일은 탭이 제목 아래라 움직일 일이 없음
   PM_TITLE_FOLLOW(제목 칸, 탭 묶음) — plant.js · group.js · contact.js 가 부름 */
window.PM_TITLE_FOLLOW = function (headEl, barEl) {
  if (!headEl || !barEl || !window.ResizeObserver || !barEl.animate) return;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var spot = function () { return { x: barEl.offsetLeft, y: barEl.offsetTop }; };   // 움직이는 중인 모양(transform)과 상관없는 실제 자리
  var last = null, anim = null;
  new ResizeObserver(function () {
    var now = spot();
    if (last && (now.x !== last.x || now.y !== last.y) && !reduce.matches) {
      var dx = last.x - now.x, dy = last.y - now.y;
      if (anim) {   // 아직 미끄러지는 중이면 지금 보이는 자리에서 이어서
        var m = new DOMMatrixReadOnly(getComputedStyle(barEl).transform);
        dx += m.m41; dy += m.m42;
        anim.cancel();
      }
      anim = barEl.animate([{ transform: 'translate(' + dx + 'px, ' + dy + 'px)' }, { transform: 'none' }],
        { duration: 560, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      anim.onfinish = function () { anim = null; };
    }
    last = now;
  }).observe(headEl);
  window.addEventListener('resize', function () { last = spot(); });   // 창 크기로 바뀐 자리는 그냥 기억만
};

/* 새 버전 확인 — 사이트를 새로 올린 직후에는 브라우저가 예전에 받아 둔 페이지를 잠깐(최대 10분) 그대로 다시 쓰는 일이 있어
   (그러면 장바구니처럼 새로 생긴 기능이 그 페이지에서만 안 보임), 페이지를 열 때 /version.txt 와 이 파일의 ?v= 를 비교해
   예전 페이지면 한 번 새로고침합니다. 결제 페이지(/checkout/)와 입력을 시작한 뒤에는 새로고침하지 않습니다.
   ▸ 배포할 때 모든 페이지의 ?v= 값과 version.txt 를 같은 값으로 올려 주세요. */
(function () {
  var me = document.currentScript && /[?&]v=([\w-]+)/.exec(document.currentScript.src);
  if (!me || !window.fetch || PM_PATH().indexOf('/checkout/') === 0) return;
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
    { id: 'thichi-yuiitsumuni',   name: 'THICHI YUIITSUMUNI',   img: '/assets/img/products/thichi-bucotsu-bowl-long-4.jpg?v=5' }
  ];
  window.PM_COLLABS = COLLABS;

  /* MATTER 하위 항목 — 순서 · 이름 · 메뉴 썸네일(세로 3:4, 없으면 '') · PLANT 분류와 같은 방식
     제품은 관리자 페이지에서 구분을 이 항목으로 고르면 /matter/ 페이지 그 탭에 나옵니다 */
  var MATTERS = [
    { id: 'base-series', name: 'BASE Series', img: '' },
    { id: 'origin',      name: 'ORIGIN',      img: '' }
  ];
  window.PM_MATTERS = MATTERS;

  var plantHere = PM_PATH().indexOf('/plant/') === 0 ? ' class="is-here" aria-current="page"' : '';
  var contactHere = PM_PATH().indexOf('/contact/') === 0 ? ' class="is-here" aria-current="page"' : '';
  var collabHere = PM_PATH().indexOf('/collaboration/') === 0 ? ' class="is-here" aria-current="page"' : '';
  var matterHere = PM_PATH().indexOf('/matter/') === 0 ? ' class="is-here" aria-current="page"' : '';
  /* 장바구니 아이콘: 담긴 것이 있으면 처음 그릴 때부터 초록 가방 + 숫자 (자세한 확인은 뒤에 cart.js 가 다시 함)
     — 페이지를 옮길 때 검은 가방이 잠깐 보였다가 초록으로 바뀌는 깜빡임 방지 */
  var cartN = 0;
  try {
    JSON.parse(localStorage.getItem('pm-cart') || '[]').forEach(function (l) { if (l && l.id) cartN += Math.max(1, parseInt(l.qty, 10) || 1); });
  } catch (e) { cartN = 0; }
  var cartCls = cartN ? ' has-items' : '';
  var cartText = cartN > 99 ? '99+' : cartN ? String(cartN) : '';

  /* marquee: 이름이 칸보다 길면 두 줄로 내려가지 않고 한 줄로 옆으로 흐름 (COLLABORATION 메뉴만 — 아래 setupMarquee) */
  var megaList = function (items, base, marquee) {
    return items.map(function (c) {
      return '        <li><a class="mega__item" href="' + base + '?c=' + c.id + '"><span class="mega__img">' +
        (c.img ? '<img src="' + c.img + '" alt="" width="720" height="960" loading="lazy">' : '') +
        '</span><span class="mega__name' + (marquee ? ' is-marquee"><span class="mega__track"><span class="mega__txt">' + c.name + '</span></span>' : '">' + c.name) + '</span></a></li>';
    }).join('\n');
  };
  var megaItems = megaList(CATEGORIES, '/plant/');
  var collabItems = megaList(COLLABS, '/collaboration/', true);
  var matterItems = megaList(MATTERS, '/matter/');

  var TOP = `  <!-- ───────── 상단 바 ───────── -->
  <header class="gnb">
    <a class="gnb__logo" href="/" aria-label="PLANT MATTER 홈" data-i18n-attr="aria-label: home">
      <img src="/assets/img/wordmark.png" alt="PLANT MATTER" width="2084" height="164">
    </a>

    <nav class="gnb__menu" aria-label="주요 메뉴" data-i18n-attr="aria-label: menu">
      <a href="/plant/" data-label="PLANT" data-menu="plant"${plantHere} aria-controls="menu-plant" aria-expanded="false">PLANT</a>
      <a href="/matter/" data-label="MATTER" data-menu="matter"${matterHere} aria-controls="menu-matter" aria-expanded="false">MATTER</a>
      <a href="/collaboration/" data-label="COLLABORATION" data-menu="collab"${collabHere} aria-controls="menu-collab" aria-expanded="false">COLLABORATION</a>
      <a href="/contact/" data-label="CONTACT"${contactHere}>CONTACT</a>
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

  <!-- ───────── MATTER 탭 아래로 내려오는 메뉴 (항목은 위 MATTERS) — PLANT 메뉴와 같은 모양 ───────── -->
  <div class="mega" id="menu-matter" aria-hidden="true">
    <div class="mega__panel" aria-label="MATTER">
      <ul class="mega__list">
${matterItems}
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

  /* COLLABORATION 메뉴의 긴 이름: 칸에 다 들어가면 그대로, 넘치면 한쪽(왼쪽)으로만 계속 흐름 —
     뒤에 같은 이름을 하나 더 이어 붙여 끊김 없이 돌고, 한 바퀴마다 처음 자리에서 잠깐 멈춤
     PC(마우스) 는 그 이름에 마우스를 올렸을 때만, 모바일(터치) 은 메뉴가 열려 있는 동안 항상.
     '동작 줄이기' 설정이면 움직이지 않고 끝을 … 으로 줄임 (style.css) */
  function setupMarquee() {
    var hover = window.matchMedia('(hover: hover)').matches;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var menu = document.getElementById('menu-collab');
    if (!menu || !Element.prototype.animate) return;
    var boxes = Array.prototype.slice.call(menu.querySelectorAll('.mega__name.is-marquee'));
    var runs = boxes.map(function (box) {
      var track = box.querySelector('.mega__track');
      var txt = track.querySelector('.mega__txt');
      var anim = null;
      var over = function () { return txt.offsetWidth - box.clientWidth; };
      var stop = function () { if (anim) { anim.cancel(); anim = null; } };
      var start = function () {
        if (over() <= 1 || reduce.matches || anim) return;
        var dup = track.querySelector('.mega__dup');
        if (!dup) {                                    // 이어 붙는 두 번째 이름 (읽어 주기에서는 숨김)
          dup = txt.cloneNode(true);
          dup.classList.add('mega__dup');
          dup.setAttribute('aria-hidden', 'true');
          track.appendChild(dup);
        }
        var d = dup.offsetLeft - txt.offsetLeft;       // 이름 하나 + 사이 간격 = 한 바퀴
        var wait = hover ? 400 : 1400;                 // 한 바퀴마다 처음 자리에서 멈춤 (마우스는 짧게)
        var slide = d / 30 * 1000;                     // 1초에 30px 정도
        var total = wait + slide;
        anim = track.animate([
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: wait / total },
          { transform: 'translateX(' + (-d) + 'px)', offset: 1 }
        ], { duration: total, iterations: Infinity });
      };
      var link = box.closest('.mega__item');
      if (hover) {
        link.addEventListener('mouseenter', start);
        link.addEventListener('mouseleave', stop);
        link.addEventListener('focus', start);
        link.addEventListener('blur', stop);
      }
      return { start: start, stop: stop };
    });
    /* 모바일: 메뉴가 열리면 흐르기 시작, 닫히면 멈춤 */
    if (!hover) {
      var sync = function () { runs.forEach(function (r) { if (menu.classList.contains('is-open')) r.start(); else r.stop(); }); };
      new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['class'] });
    }
    /* 글꼴이 늦게 들어오거나 화면 크기가 바뀌면 길이를 다시 잼 */
    var restart = function () { runs.forEach(function (r) { r.stop(); }); if (!hover && menu.classList.contains('is-open')) runs.forEach(function (r) { r.start(); }); };
    window.addEventListener('resize', restart);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(restart);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupMarquee);
  else setTimeout(setupMarquee, 0);

  function insertHere(html) { document.currentScript.insertAdjacentHTML('afterend', html); }
  window.PM_LAYOUT = {
    top: function () { insertHere(TOP); },
    bottom: function () { insertHere(BOTTOM); }
  };
})();
