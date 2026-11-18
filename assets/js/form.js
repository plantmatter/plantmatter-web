/* PLANT MATTER — 입력 양식 공통 (주문/결제 · 회원가입 · 마이페이지 · 비밀번호)
   .field 안의 input 을 검사합니다.
     required          : 꼭 입력
     data-rule="…"     : phone(휴대폰) · email · zip(우편번호 5자리) · password(8자 이상 + 대문자·숫자·특수문자) · code(메일 인증 코드)
     data-match="이름" : 다른 칸과 같아야 함 (비밀번호 확인)
     data-digits       : 숫자만 남김
   오류 문구는 칸 아래 .field__err 에 나오고, 고치는 즉시 사라집니다. */
(() => {
  const digits = (v) => String(v || '').replace(/\D/g, '');
  /* 새 비밀번호 조건 (회원가입 · 비밀번호 찾기 · 비밀번호 변경). 로그인 칸에는 적용하지 않음 */
  const PW_CHECKS = [
    ['pwRuleLen', (v) => v.length >= 8],
    ['pwRuleUpper', (v) => /[A-Z]/.test(v)],
    ['pwRuleDigit', (v) => /[0-9]/.test(v)],
    ['pwRuleSpecial', (v) => /[!-\/:-@[-`{-~]/.test(v)],   // ! " # $ % & ' ( ) * + , - . / : ; < = > ? @ [ \ ] ^ _ ` { | } ~
  ];
  const RULES = {
    phone: (v) => /^0\d{8,10}$/.test(v) || 'errPhone',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'errEmail',
    zip: (v) => /^\d{5}$/.test(v) || 'errZip',
    password: (v) => PW_CHECKS.every(([, ok]) => ok(v)) || 'errPwRule',   // 8자 이상 + 영어 대문자 + 숫자 + 특수문자
    code: (v) => /^\d{6,10}$/.test(v) || 'errCodeFormat',   // 메일로 받은 인증 코드 (기본 6자리)
  };

  const bind = (form) => {
    const t = (k) => window.PM.t(k);
    form.querySelectorAll('[data-digits]').forEach((el) => el.addEventListener('input', () => {
      const d = digits(el.value);
      if (el.value !== d) el.value = d;
    }));
    const setErr = (input, key) => {
      const field = input.closest('.field');
      if (!field) return;
      field.classList.toggle('is-invalid', Boolean(key));
      const box = field.querySelector('.field__err');
      if (box) box.textContent = key ? t(key) : '';
      input.setAttribute('aria-invalid', key ? 'true' : 'false');
    };
    const check = (input) => {
      const v = (input.type === 'password' || input.dataset.pwToggle) ? input.value : input.value.trim();   // 비밀번호는 보이게 해도 앞뒤 공백 그대로
      if (!input.required && !v) { setErr(input, null); return true; }
      let key = v ? null : 'errRequired';
      const rule = RULES[input.dataset.rule];
      if (!key && rule) { const r = rule(v); key = r === true ? null : r; }
      if (!key && input.dataset.match) {
        const other = form.elements[input.dataset.match];
        if (other && other.value !== input.value) key = 'errPwMatch';
      }
      setErr(input, key);
      return !key;
    };
    const inputs = () => [...form.querySelectorAll('.field input')].filter((el) => !el.readOnly && !el.disabled && !el.closest('[hidden]'));
    /* 틀린 칸은 고치는 즉시 다시 검사 (칸을 벗어날 때 검사하면 문구가 사라지며 화면이 움직여 버튼 클릭이 빗나감) */
    form.addEventListener('input', (e) => {
      const el = e.target;
      if (el.matches('.field input') && el.closest('.field').classList.contains('is-invalid')) check(el);
      if (el.name && form.querySelector(`[data-match="${el.name}"]`)) {
        const m = form.querySelector(`[data-match="${el.name}"]`);
        if (m.closest('.field').classList.contains('is-invalid')) check(m);
      }
    });
    const validate = () => {
      const bad = inputs().filter((el) => !check(el));
      if (bad.length) bad[0].focus();
      return !bad.length;
    };
    const clear = () => inputs().forEach((el) => setErr(el, null));
    return { validate, check, setErr, clear };
  };

  /* 동의 체크: [data-agree-all] 이 나머지 [data-agree] 를 한꺼번에 켜고 끔 */
  const bindAgree = (box) => {
    if (!box) return { ok: () => true, values: () => ({}) };
    const all = box.querySelector('[data-agree-all]');
    const items = [...box.querySelectorAll('[data-agree]')];
    const sync = () => { if (all) all.checked = items.every((i) => i.checked); };
    if (all) all.addEventListener('change', () => { items.forEach((i) => { i.checked = all.checked; }); box.classList.remove('is-invalid'); });
    items.forEach((i) => i.addEventListener('change', () => { sync(); if (items.filter((x) => x.required).every((x) => x.checked)) box.classList.remove('is-invalid'); }));
    return {
      ok: () => {
        const good = items.filter((i) => i.required).every((i) => i.checked);
        box.classList.toggle('is-invalid', !good);
        const err = box.querySelector('.agree__err');
        if (err) err.textContent = good ? '' : window.PM.t('errAgree');
        if (!good) (items.find((i) => i.required && !i.checked) || all).focus();
        return good;
      },
      values: () => Object.fromEntries(items.map((i) => [i.dataset.agree, i.checked])),
    };
  };

  /* 비밀번호 칸: 오른쪽 눈 모양 버튼으로 보이기 ↔ 숨기기 (모든 .field 의 비밀번호 칸에 자동으로 붙음) */
  const EYE = '<svg class="pw__show" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>'
    + '<svg class="pw__hide" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>';
  const toggles = [];
  const label = (btn) => {
    const shown = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-label', window.PM ? window.PM.t(shown ? 'pwHide' : 'pwShow') : '');
  };
  document.querySelectorAll('.field input[type="password"]').forEach((input) => {
    input.dataset.pwToggle = '1';   // (data-pw 는 비밀번호 변경 양식 이름이라 겹치지 않게)
    const wrap = document.createElement('div');
    wrap.className = 'pw';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw__toggle';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-controls', input.id);
    btn.innerHTML = EYE;
    wrap.appendChild(btn);
    label(btn);
    toggles.push(btn);
    const set = (show) => {
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      label(btn);
    };
    btn.addEventListener('click', () => {
      const pos = input.selectionStart;
      set(input.type === 'password');
      input.focus();
      if (pos != null) { try { input.setSelectionRange(pos, pos); } catch (e) { /* 일부 브라우저 */ } }
    });
    /* 양식을 비우거나(로그인·변경 완료) 다른 화면으로 넘어갈 때는 다시 숨김 */
    if (input.form) input.form.addEventListener('reset', () => set(false));
  });
  if (window.PM) window.PM.onLang(() => toggles.forEach(label));

  /* 새 비밀번호 칸 아래: 조건 4가지를 보여 주고, 맞출 때마다 진하게 */
  const ruleLists = [];
  document.querySelectorAll('.field input[data-rule="password"]').forEach((input) => {
    const ul = document.createElement('ul');
    ul.className = 'pw-rules';
    ul.innerHTML = PW_CHECKS.map(([key]) => `<li data-k="${key}"></li>`).join('');
    const field = input.closest('.field');
    field.insertBefore(ul, field.querySelector('.field__err'));
    const paint = () => {
      PW_CHECKS.forEach(([key, ok]) => ul.querySelector(`[data-k="${key}"]`).classList.toggle('is-ok', ok(input.value)));
    };
    const words = () => PW_CHECKS.forEach(([key]) => { ul.querySelector(`[data-k="${key}"]`).textContent = window.PM ? window.PM.t(key) : key; });
    words();
    input.addEventListener('input', paint);
    if (input.form) input.form.addEventListener('reset', () => setTimeout(paint, 0));
    ruleLists.push(words);
  });
  if (window.PM) window.PM.onLang(() => ruleLists.forEach((fn) => fn()));

  window.PM_FORM = { bind, bindAgree, digits };
})();
