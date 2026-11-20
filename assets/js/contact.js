/* PLANT MATTER — CONTACT (/contact/) · 도매 문의 안내
   ▸ 아래 CONTACT 에 연락처를 넣으면 페이지에 보입니다. 비워 둔('') 항목은 보이지 않습니다.
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요. */
(() => {
  const CONTACT = {
    email: '',       // 예: 'wholesale@plantmatter.kr'
    phone: '',       // 예: '010-1234-5678'
    kakao: '',       // 카카오톡 채널 주소, 예: 'https://pf.kakao.com/_abcd'
    instagram: '',   // 계정 이름, 예: 'plantmatter'
    hours: { ko: '', en: '', ja: '' },   // 응대 시간, 예: { ko: '평일 10:00 – 18:00', en: 'Weekdays 10:00 – 18:00', ja: '平日 10:00 – 18:00' }
  };

  const PM = window.PM;
  if (!PM) return;
  const { t } = PM;
  const list = document.querySelector('[data-contact-list]');
  if (!list) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const safeUrl = (u) => (/^https:\/\//i.test(u) ? u : '');
  const ig = String(CONTACT.instagram || '').replace(/^@/, '').trim();

  const render = () => {
    const lang = PM.getLang();
    document.title = `CONTACT — PLANT MATTER`;
    const hours = CONTACT.hours && (CONTACT.hours[lang] || CONTACT.hours.ko);
    const rows = [
      CONTACT.email && [t('ctEmail'), `<a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a>`],
      CONTACT.phone && [t('ctPhone'), `<a href="tel:${esc(CONTACT.phone.replace(/[^\d+]/g, ''))}">${esc(CONTACT.phone)}</a>`],
      safeUrl(CONTACT.kakao) && [t('ctKakao'), `<a href="${esc(CONTACT.kakao)}" target="_blank" rel="noopener">${esc(t('ctKakaoOpen'))}</a>`],
      ig && [t('ctInstagram'), `<a href="https://www.instagram.com/${encodeURIComponent(ig)}/" target="_blank" rel="noopener">@${esc(ig)}</a>`],
      hours && [t('ctHours'), esc(hours)],
    ].filter(Boolean);
    list.innerHTML = rows.length
      ? rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')
      : `<div class="ct__none"><dd>${esc(t('ctNone'))}</dd></div>`;
  };
  PM.onLang(render);
  render();
})();
