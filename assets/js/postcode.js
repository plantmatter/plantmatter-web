/* PLANT MATTER — 주소 찾기 (카카오 우편번호 서비스)
   [data-addr-find] 버튼을 누르면 창이 열리고, 고른 주소를 같은 form 의 zip · addr 칸에 넣은 뒤 addr2(상세 주소)로 이동합니다.
   주소 서비스를 불러오지 못하면 안내를 띄우고 직접 입력하게 합니다. */
(() => {
  const SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
  const t = (k) => (window.PM ? window.PM.t(k) : k);
  let loading = null;
  const load = () => loading || (loading = new Promise((resolve, reject) => {
    if (window.daum && window.daum.Postcode) { resolve(); return; }
    const s = document.createElement('script');
    s.src = SRC;
    s.onload = () => (window.daum && window.daum.Postcode ? resolve() : reject(new Error('postcode')));
    s.onerror = () => { loading = null; reject(new Error('postcode')); };
    document.head.appendChild(s);
  }));

  let layer = null;
  let frame = null;
  const close = () => {
    if (!layer || layer.hidden) return;
    layer.hidden = true;
    frame.innerHTML = '';
    document.documentElement.style.overflow = '';
  };
  const build = () => {
    layer = document.createElement('div');
    layer.className = 'addr-layer';
    layer.hidden = true;
    layer.innerHTML = `<div class="addr-layer__box" role="dialog" aria-modal="true" aria-labelledby="addr-title">
        <div class="addr-layer__head">
          <h2 id="addr-title" data-i18n="findAddr">${t('findAddr')}</h2>
          <button class="icon-btn" type="button" data-addr-close aria-label="${t('close')}" data-i18n-attr="aria-label: close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
        </div>
        <div class="addr-layer__frame"></div>
      </div>`;
    document.body.appendChild(layer);
    frame = layer.querySelector('.addr-layer__frame');
    layer.addEventListener('click', (e) => { if (e.target === layer || e.target.closest('[data-addr-close]')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  };

  /* onSelect({ zip, addr }) — 실패하면 false */
  const open = async (onSelect) => {
    try { await load(); } catch (e) {
      if (window.PM) window.PM.toast(t('addrLoadFail'));
      return false;
    }
    if (!layer) build();
    layer.querySelector('h2').textContent = t('findAddr');
    layer.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    new window.daum.Postcode({
      width: '100%', height: '100%',
      oncomplete: (d) => {
        close();
        onSelect({ zip: d.zonecode, addr: d.userSelectedType === 'J' ? d.jibunAddress : (d.roadAddress || d.address) });
      },
    }).embed(frame, { autoClose: false });
    return true;
  };

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-addr-find]');
    if (!btn) return;
    const form = btn.closest('form');
    const F = form.elements;
    const ok = await open(({ zip, addr }) => {
      F.zip.value = zip;
      F.addr.value = addr;
      [F.zip, F.addr].forEach((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
      if (F.addr2) F.addr2.focus();
    });
    if (!ok) F.zip.focus();
  });

  window.PM_POSTCODE = { open, close };
})();
