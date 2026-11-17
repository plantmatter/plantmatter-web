/* PLANT MATTER — PC (plantmatter.kr) */
(() => {
  /* 아직 없는 페이지·기능: 누르면 '준비 중' 안내 */
  const toast = document.querySelector('.toast');
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
      showToast(`${el.dataset.soon} · 준비 중입니다`);
    });
  });

  /* 검색 */
  const search = document.getElementById('search');
  const openBtn = document.querySelector('[data-search-open]');
  const input = document.getElementById('search-input');
  const msg = search.querySelector('.search__msg');
  const setSearch = (open) => {
    search.classList.toggle('is-open', open);
    search.setAttribute('aria-hidden', String(!open));
    openBtn.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => input.focus(), 200);
    else { msg.textContent = ''; openBtn.focus(); }
  };
  openBtn.addEventListener('click', () => setSearch(true));
  search.querySelectorAll('[data-search-close]').forEach((el) => el.addEventListener('click', () => setSearch(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.classList.contains('is-open')) setSearch(false);
  });
  search.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    msg.textContent = q ? `‘${q}’ — 검색 기능은 준비 중입니다.` : '검색어를 입력해 주세요.';
  });

  /* 휴대폰에서 PC 버전을 고른 경우: 모바일로 돌아가는 버튼 */
  const toMobile = document.querySelector('.to-mobile');
  const phone = /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile.+Firefox|Opera Mini/i.test(navigator.userAgent);
  if (phone && toMobile) {
    toMobile.hidden = false;
    toMobile.addEventListener('click', () => {
      try { localStorage.removeItem('pm-view'); } catch (e) {}
    });
  }
})();
