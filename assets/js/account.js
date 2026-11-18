/* PLANT MATTER — 계정 페이지
   /account/         로그인 ↔ 마이페이지(회원 정보 · 기본 배송지 · 비밀번호 변경 · 주문 내역 · 로그아웃)
   /account/signup/  회원가입 (이메일 · 비밀번호 · 이름 · 휴대폰 · 기본 배송지 · 약관 동의 → 메일로 받은 코드 입력)
   /account/reset/   비밀번호 찾기 (메일로 받은 코드 + 새 비밀번호)
   가입 확인과 비밀번호 찾기는 앱과 같이 메일로 받은 6자리 코드를 씁니다.
   로그인 처리는 assets/js/auth.js, 입력 검사는 assets/js/form.js 에 있습니다.
   /account/?next=/checkout/… 처럼 next 를 붙이면 로그인 후 그 페이지로 돌아갑니다. */
(() => {
  const PM = window.PM;
  const A = window.PM_AUTH;
  const FORM = window.PM_FORM;
  if (!PM || !FORM) return;
  const { t } = PM;

  const root = document.querySelector('[data-account]');
  const page = root.dataset.account;
  const views = [...root.querySelectorAll('[data-view]')];
  const setTitle = () => {
    const v = views.find((x) => !x.hidden);
    const h = v && v.querySelector('h1');
    if (h) document.title = `${h.textContent} — PLANT MATTER`;
  };
  const show = (name) => {
    views.forEach((v) => { v.hidden = v.dataset.view !== name; });
    setTitle();
  };
  PM.onLang(setTitle);

  const showErr = (form, err) => {
    const box = form.querySelector('[data-err]');
    if (!box) return;
    let text = '';
    if (err) {
      const key = typeof err === 'string' ? err : (A && A.errorKey(err));
      text = key ? t(key) : String((err && err.message) || err);
    }
    box.textContent = text;
    box.hidden = !text;
  };
  const busy = (form, on) => { const b = form.querySelector('[type=submit]'); if (b) b.disabled = on; };
  const nextUrl = () => {
    const n = new URLSearchParams(location.search).get('next');
    return n && /^\/(?!\/)/.test(n) ? n : null;   // 이 사이트 안의 주소만
  };
  const val = (form, name) => (form.elements[name] ? form.elements[name].value.trim() : '');
  /* '코드 다시 받기': 너무 자주 보내지 않도록 60초 동안 잠금 */
  const resendButton = (btn, send) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try { await send(); PM.toast(t('codeSent')); } catch (err) { PM.toast(t(A.errorKey(err) || 'errNetwork')); }
    setTimeout(() => { btn.disabled = false; }, 60000);
  });

  /* 약관 '보기' 펼치기 */
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view-toggle]');
    if (!b) return;
    const p = b.closest('.agree__row').querySelector('.agree__text');
    p.hidden = !p.hidden;
    b.setAttribute('aria-expanded', String(!p.hidden));
  });

  /* 로그인 서버(라이브러리)를 못 불러온 경우 */
  if (!A || !A.available()) {
    show(page === 'home' ? 'login' : views.find((v) => v.dataset.view !== 'loading').dataset.view);
    root.querySelectorAll('form').forEach((f) => showErr(f, 'errNetwork'));
    return;
  }

  /* ---------- 가입 확인 코드 입력 (회원가입 · 로그인 화면 공통: [data-view="verify"]) ---------- */
  const setupVerify = (onDone) => {
    const view = root.querySelector('[data-view="verify"]');
    const form = view.querySelector('[data-verify]');
    const text = view.querySelector('[data-verify-text]');
    const check = FORM.bind(form);
    let email = '';
    const setText = () => { text.textContent = t('verifyText', { email }); };
    PM.onLang(() => { if (email) setText(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(form, null);
      if (!check.validate()) return;
      busy(form, true);
      try {
        await A.verifySignup(email, val(form, 'code'));
        PM.toast(t('welcome'));
        await onDone();
      } catch (err) {
        showErr(form, err);
      } finally {
        busy(form, false);
      }
    });
    resendButton(view.querySelector('[data-resend]'), () => A.resendSignup(email));
    return {
      open(address) {
        email = address;
        form.reset();
        check.clear();
        showErr(form, null);
        setText();
        show('verify');
        window.scrollTo(0, 0);
        form.elements.code.focus();
      },
    };
  };

  /* ---------- /account/ : 로그인 · 마이페이지 ---------- */
  const home = () => {
    const loginForm = root.querySelector('[data-login]');
    const infoForm = root.querySelector('[data-info]');
    const pwForm = root.querySelector('[data-pw]');
    const helloEl = root.querySelector('[data-hello]');
    const firstBox = infoForm.querySelector('[data-first-agree]');
    const loginCheck = FORM.bind(loginForm);
    const infoCheck = FORM.bind(infoForm);
    const pwCheck = FORM.bind(pwForm);
    const firstAgree = FORM.bindAgree(firstBox);
    let customer = null;

    /* 이름 변경 제한: 처음 정한 이름은 제외, 2번까지는 바로, 그 뒤로는 마지막 변경 후 60일 (서버에서도 막음 — supabase/web02) */
    const NAME_FREE = 2;
    const NAME_WAIT_DAYS = 60;
    const nameInput = infoForm.elements.name;
    const nameHint = infoForm.querySelector('[data-name-hint]');
    const fmtDate = (d) => d.toLocaleDateString({ ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' }[PM.getLang()] || 'ko-KR',
      { year: 'numeric', month: 'long', day: 'numeric' });
    const nameLockedUntil = () => {
      if (!customer || !customer.name) return null;
      const n = customer.name_change_count || 0;
      if (n < NAME_FREE || !customer.name_changed_at) return null;
      const until = new Date(new Date(customer.name_changed_at).getTime() + NAME_WAIT_DAYS * 86400000);
      return until > new Date() ? until : null;
    };
    const updateNameHint = () => {
      const saved = (customer && customer.name) || '';
      const n = (customer && customer.name_change_count) || 0;
      const until = nameLockedUntil();
      nameInput.readOnly = Boolean(until);
      let text = t('nameRule');
      let warn = false;
      if (until) {
        text = t('nameLocked', { date: fmtDate(until) });
      } else if (saved) {
        const editing = nameInput.value.trim() !== saved;
        if (editing && n + 1 >= NAME_FREE) { text = t('nameWarn'); warn = true; }   // 이번에 바꾸면 60일 기다려야 함
        else if (!editing && n < NAME_FREE) text = t('nameLeft', { n: NAME_FREE - n });
      }
      nameHint.textContent = text;
      nameHint.classList.toggle('is-warn', warn);
    };
    nameInput.addEventListener('input', updateNameHint);
    PM.onLang(updateNameHint);
    const showText = (form, text) => {
      const box = form.querySelector('[data-err]');
      box.textContent = text;
      box.hidden = !text;
    };

    const setHello = () => {
      const n = customer && customer.name;
      helloEl.textContent = n ? t('hello', { name: n }) : t('helloNoName');
    };
    PM.onLang(setHello);

    const openMy = async () => {
      const u = A.user();
      if (!u) return;
      show('my');
      const F = infoForm.elements;
      F.email.value = u.email || '';
      showErr(infoForm, null);
      try { customer = await A.getCustomer(); } catch (err) { customer = null; showErr(infoForm, err); }
      firstBox.hidden = Boolean(customer);
      if (customer) {
        ['name', 'phone', 'zip', 'addr', 'addr2'].forEach((k) => { F[k].value = customer[k] || ''; });
        F.marketing.checked = Boolean(customer.marketing_consent);
      } else if (!F.name.value) {
        const m = u.user_metadata || {};   // 앱에서 정한 이름이 있으면 미리 채움
        F.name.value = String(m.display_name || m.full_name || m.name || '').slice(0, 40);
      }
      updateNameHint();
      setHello();
    };
    const openLogin = () => { show('login'); showErr(loginForm, null); };
    const goNext = () => { const n = nextUrl(); if (n) { location.href = n; return true; } return false; };
    A.onChange((u) => (u ? openMy() : openLogin()));
    const verify = setupVerify(async () => { goNext(); });

    A.ready.then((u) => {
      if (u && nextUrl()) { location.replace(nextUrl()); return; }
      if (u) openMy(); else openLogin();
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(loginForm, null);
      if (!loginCheck.validate()) return;
      const email = val(loginForm, 'email');
      busy(loginForm, true);
      try {
        await A.signIn(email, loginForm.elements.password.value);
        loginForm.reset();
        PM.toast(t('loggedIn'));
        goNext();
      } catch (err) {
        if (A.errorKey(err) === 'errNotConfirmed') {
          /* 가입 확인을 안 마친 계정: 코드를 다시 보내고 입력 화면으로 */
          try { await A.resendSignup(email); } catch (e2) { /* 방금 보낸 코드가 있으면 그대로 사용 */ }
          verify.open(email);
        } else {
          showErr(loginForm, err);
        }
      } finally {
        busy(loginForm, false);
      }
    });

    infoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(infoForm, null);
      if (!infoCheck.validate()) return;
      if (!firstBox.hidden && !firstAgree.ok()) return;
      busy(infoForm, true);
      try {
        await A.saveCustomer({
          name: val(infoForm, 'name'), phone: val(infoForm, 'phone'), zip: val(infoForm, 'zip'),
          addr: val(infoForm, 'addr'), addr2: val(infoForm, 'addr2'), marketing: infoForm.elements.marketing.checked,
          ...(firstBox.hidden ? {} : firstAgree.values()),
        });
        customer = await A.getCustomer();
        firstBox.hidden = Boolean(customer);
        updateNameHint();
        setHello();
        PM.toast(t('saved'));
      } catch (err) {
        const locked = /name_locked:(\S+)/.exec(String((err && err.message) || ''));
        if (locked) {
          showText(infoForm, t('nameLocked', { date: fmtDate(new Date(locked[1])) }));
          try { customer = await A.getCustomer(); } catch (e2) { /* 그대로 */ }
          if (customer) nameInput.value = customer.name || '';
          updateNameHint();
        } else {
          showErr(infoForm, err);
        }
      } finally {
        busy(infoForm, false);
      }
    });

    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(pwForm, null);
      if (!pwCheck.validate()) return;
      busy(pwForm, true);
      try {
        await A.updatePassword(pwForm.elements.password.value);
        pwForm.reset();
        PM.toast(t('pwChanged'));
      } catch (err) {
        showErr(pwForm, err);
      } finally {
        busy(pwForm, false);
      }
    });

    root.querySelector('[data-logout]').addEventListener('click', async () => {
      try {
        await A.signOut();
        customer = null;
        infoForm.reset();
        PM.toast(t('loggedOut'));
        window.scrollTo(0, 0);
      } catch (err) {
        PM.toast(t(A.errorKey(err) || 'errNetwork'));
      }
    });
  };

  /* ---------- /account/signup/ : 회원가입 → 코드 입력 ---------- */
  const signup = () => {
    const form = root.querySelector('[data-signup]');
    const check = FORM.bind(form);
    const agree = FORM.bindAgree(form.querySelector('[data-agree-box]'));
    const done = () => { setTimeout(() => { location.href = nextUrl() || '/account/'; }, 700); };
    const verify = setupVerify(done);
    A.ready.then((u) => { if (u) location.replace(nextUrl() || '/account/'); });   // 이미 로그인 상태

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(form, null);
      if (!check.validate() || !agree.ok()) return;
      const v = agree.values();
      const email = val(form, 'email');
      busy(form, true);
      try {
        const r = await A.signUp(email, form.elements.password.value, {
          name: val(form, 'name'), phone: val(form, 'phone'),
          zip: val(form, 'zip'), addr: val(form, 'addr'), addr2: val(form, 'addr2'),
          marketing: Boolean(v.marketing), terms: Boolean(v.terms), privacy: Boolean(v.privacy), age14: Boolean(v.age14),
        });
        if (r.confirm) verify.open(email);
        else { PM.toast(t('welcome')); done(); }
      } catch (err) {
        showErr(form, err);
      } finally {
        busy(form, false);
      }
    });
  };

  /* ---------- /account/reset/ : 코드 받기 → 코드 + 새 비밀번호 ---------- */
  const reset = () => {
    const reqForm = root.querySelector('[data-reset]');
    const codeForm = root.querySelector('[data-newpw]');
    const text = root.querySelector('[data-sent-text]');
    const reqCheck = FORM.bind(reqForm);
    const codeCheck = FORM.bind(codeForm);
    let email = '';
    const setText = () => { text.textContent = t('resetCodeText', { email }); };
    PM.onLang(() => { if (email) setText(); });
    show('request');

    reqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(reqForm, null);
      if (!reqCheck.validate()) return;
      busy(reqForm, true);
      try {
        await A.sendReset(val(reqForm, 'email'));
        email = val(reqForm, 'email');
        codeForm.reset();
        codeCheck.clear();
        setText();
        show('code');
        codeForm.elements.code.focus();
      } catch (err) {
        showErr(reqForm, err);
      } finally {
        busy(reqForm, false);
      }
    });

    codeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(codeForm, null);
      if (!codeCheck.validate()) return;
      busy(codeForm, true);
      try {
        await A.resetWithCode(email, val(codeForm, 'code'), codeForm.elements.password.value);
        PM.toast(t('pwChanged'));
        setTimeout(() => { location.href = '/account/'; }, 900);
      } catch (err) {
        showErr(codeForm, err);
        busy(codeForm, false);
      }
    });
    resendButton(root.querySelector('[data-view="code"] [data-resend]'), () => A.sendReset(email));
  };

  ({ home, signup, reset })[page]();
})();
