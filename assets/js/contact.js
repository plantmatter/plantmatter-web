/* PLANT MATTER — CONTACT (/contact/) · 분류 탭 [B2B] [COLLAB]
   - B2B    (/contact/?c=b2b)    : 도매 문의 — 사업자등록증 첨부
   - COLLAB (/contact/?c=collab) : 협업 제안
   양식을 보내면 Supabase Edge Function 'wholesale-inquiry' 가 내용을 확인해 저장하고 운영자에게 메일로 보냅니다
   (답장하면 보낸 분에게 감). 함수 코드: supabase/functions/wholesale-inquiry/index.ts (보내는 값 kind 로 두 양식을 구분)
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요.

   ▸ 아래 CONTACT 에 연락처를 넣으면 B2B 양식 위에 함께 보입니다. 비워 둔('') 항목은 보이지 않습니다. */
(() => {
  const ENDPOINT = 'https://qssrtzvipwvxcfszxomo.supabase.co/functions/v1/wholesale-inquiry';
  const CONTACT = {
    email: '',       // 예: 'wholesale@plantmatter.kr'
    phone: '',       // 예: '010-1234-5678'
    kakao: '',       // 카카오톡 채널 주소, 예: 'https://pf.kakao.com/_abcd'
    instagram: '',   // 계정 이름, 예: 'plantmatter'
    hours: { ko: '', en: '', ja: '' },   // 응대 시간, 예: { ko: '평일 10:00 – 18:00', en: 'Weekdays 10:00 – 18:00', ja: '平日 10:00 – 18:00' }
  };
  const TABS = { b2b: 'B2B', collab: 'COLLAB' };   // 주소 ?c= 값 → 탭 · 경로 글씨

  const PM = window.PM;
  if (!PM || !window.PM_FORM) return;
  const { t } = PM;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* ---------- 분류 탭 (새로고침 없이 바뀌고, 주소도 바뀌어 그대로 공유 가능) ---------- */
  const tabs = [...document.querySelectorAll('[data-ct]')];
  const panels = [...document.querySelectorAll('[data-ct-panel]')];
  const crumb = document.querySelector('[data-ct-crumb]');
  const fromUrl = () => { const c = new URLSearchParams(location.search).get('c'); return TABS[c] ? c : 'b2b'; };
  let cur = null;
  const show = (c, push) => {
    if (c === cur) return;
    const first = cur === null;
    cur = c;
    tabs.forEach((a) => {
      const on = a.dataset.ct === c;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    panels.forEach((p) => {
      const on = p.dataset.ctPanel === c;
      p.hidden = !on;
      p.classList.toggle('is-in', on && !first);   // 탭을 바꿀 때만 살짝 나타나는 효과
    });
    crumb.textContent = TABS[c];
    if (push) history.pushState(null, '', c === 'b2b' ? '/contact/' : `/contact/?c=${c}`);
  };
  tabs.forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); show(a.dataset.ct, true); }));
  window.addEventListener('popstate', () => show(fromUrl(), false));
  show(fromUrl(), false);

  /* ---------- 연락처 (넣은 것만) ---------- */
  const list = document.querySelector('[data-contact-list]');
  const ig = String(CONTACT.instagram || '').replace(/^@/, '').trim();
  const renderList = () => {
    if (!list) return;
    const lang = PM.getLang();
    const hours = CONTACT.hours && (CONTACT.hours[lang] || CONTACT.hours.ko);
    const rows = [
      CONTACT.email && [t('ctEmail'), `<a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a>`],
      CONTACT.phone && [t('ctPhone'), `<a href="tel:${esc(CONTACT.phone.replace(/[^\d+]/g, ''))}">${esc(CONTACT.phone)}</a>`],
      /^https:\/\//i.test(CONTACT.kakao) && [t('ctKakao'), `<a href="${esc(CONTACT.kakao)}" target="_blank" rel="noopener">${esc(t('ctKakaoOpen'))}</a>`],
      ig && [t('ctInstagram'), `<a href="https://www.instagram.com/${encodeURIComponent(ig)}/" target="_blank" rel="noopener">@${esc(ig)}</a>`],
      hours && [t('ctHours'), esc(hours)],
    ].filter(Boolean);
    list.innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('');
    list.hidden = !rows.length;
  };

  /* ---------- 양식 (B2B · COLLAB 공통) ---------- */
  /* 서버가 알려 준 틀린 칸 → 그 칸의 오류 문구 */
  const FIELD_ERR = { bizNo: 'errBizNo', email: 'errEmail', phone: 'errPhone', doc: 'errDocType', docSize: 'errDocSize', link: 'errUrl' };
  const setups = [];
  const setupForm = (form, done, kind) => {
    if (!form || !done) return;
    const F = form.elements;
    const sendBtn = form.querySelector('[data-send]');
    const errBox = form.querySelector('[data-err]');
    const fileName = form.querySelector('[data-file-name]');
    const check = window.PM_FORM.bind(form);
    const agree = window.PM_FORM.bindAgree(form.querySelector('[data-agree-box]'));

    const renderFile = () => {
      if (!fileName) return;
      const f = F.doc.files && F.doc.files[0];
      const kb = f ? f.size / 1024 : 0;
      fileName.textContent = f ? `${f.name} · ${kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(kb))}KB`}` : t('wsDocNone');
      fileName.classList.toggle('is-empty', !f);
    };
    if (fileName) F.doc.addEventListener('change', () => { renderFile(); check.check(F.doc); });
    setups.push(renderFile);

    /* 개인정보 동의 '보기' */
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-view-toggle]');
      if (!b) return;
      const p = b.closest('.agree__row').querySelector('.agree__text');
      p.hidden = !p.hidden;
      b.setAttribute('aria-expanded', String(!p.hidden));
    });

    const showErr = (key) => { errBox.textContent = key ? t(key) : ''; errBox.hidden = !key; };
    const markFields = (fields) => {
      let first = null;
      (fields || []).forEach((name) => {
        if (name === 'consent') { agree.ok(); return; }
        const el = F[name === 'docSize' ? 'doc' : name];
        if (!el || !el.closest) return;
        check.setErr(el, FIELD_ERR[name] || 'errRequired');
        first = first || el;
      });
      if (first) first.focus();
    };

    let sending = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sending) return;
      showErr('');
      const okAgree = agree.ok();          // 동의 오류도 함께 보여 주되
      const okFields = check.validate();   // 커서는 첫 번째 틀린 칸으로
      if (!okFields || !okAgree) return;
      const body = new FormData(form);
      body.set('kind', kind);
      body.set('consent', 'yes');
      body.set('lang', PM.getLang());
      sending = true;
      sendBtn.disabled = true;
      sendBtn.textContent = t('wsSending');
      try {
        const res = await fetch(ENDPOINT, { method: 'POST', body });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          form.reset();
          renderFile();
          form.querySelectorAll('.agree__text').forEach((p) => { p.hidden = true; });
          form.hidden = true;
          done.hidden = false;
          done.focus({ preventScroll: true });
          done.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        if (data.error === 'invalid') { markFields(data.fields); showErr('wsErrInvalid'); }
        else if (data.error === 'rate') showErr('wsErrRate');
        else if (data.error === 'setup') showErr('wsErrSetup');
        else showErr('wsErrServer');
      } catch (err) {
        console.error(err);
        showErr('wsErrNetwork');
      } finally {
        sending = false;
        sendBtn.disabled = false;
        sendBtn.textContent = t('wsSend');
      }
    });

    done.querySelector('[data-ws-again]').addEventListener('click', () => {
      done.hidden = true;
      form.hidden = false;
      check.clear();
      form.querySelector('input:not([type="hidden"])').focus();
    });
  };
  setupForm(document.querySelector('[data-ws]'), document.querySelector('[data-ws-done]'), 'b2b');
  setupForm(document.querySelector('[data-collab]'), document.querySelector('[data-collab-done]'), 'collab');

  const render = () => {
    document.title = 'CONTACT — PLANT MATTER';
    renderList();
    setups.forEach((fn) => fn());
  };
  PM.onLang(render);
  render();
})();
