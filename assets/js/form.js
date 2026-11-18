/* PLANT MATTER — 입력 양식 공통 (주문/결제 · 회원가입 · 마이페이지 · 비밀번호)
   .field 안의 input 을 검사합니다.
     required          : 꼭 입력
     data-rule="…"     : phone(휴대폰) · email · zip(우편번호 5자리) · password(8자 이상) · code(메일 인증 코드)
     data-match="이름" : 다른 칸과 같아야 함 (비밀번호 확인)
     data-digits       : 숫자만 남김
   오류 문구는 칸 아래 .field__err 에 나오고, 고치는 즉시 사라집니다. */
(() => {
  const digits = (v) => String(v || '').replace(/\D/g, '');
  const RULES = {
    phone: (v) => /^0\d{8,10}$/.test(v) || 'errPhone',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'errEmail',
    zip: (v) => /^\d{5}$/.test(v) || 'errZip',
    password: (v) => v.length >= 8 || 'errPwShort',
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
      const v = input.type === 'password' ? input.value : input.value.trim();
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

  window.PM_FORM = { bind, bindAgree, digits };
})();
