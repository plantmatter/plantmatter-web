/* PLANT MATTER — 계정 페이지
   /account/         로그인 ↔ 마이페이지(회원 정보 · 기본 배송지 · 비밀번호 변경 · 주문 내역 · 로그아웃)
   /account/signup/  회원가입 (이메일 · 비밀번호 · 이름 · 휴대폰 · 기본 배송지 · 약관 동의)
   /account/reset/   비밀번호 찾기 (메일로 링크 받기 → 새 비밀번호 설정)
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
  const show = (name) => {
    views.forEach((v) => { v.hidden = v.dataset.view !== name; });
    const h = root.querySelector(`[data-view="${name}"] h1`);
    if (h) document.title = `${h.textContent} — PLANT MATTER`;
  };
  PM.onLang(() => {
    const v = views.find((x) => !x.hidden);
    const h = v && v.querySelector('h1');
    if (h) document.title = `${h.textContent} — PLANT MATTER`;
  });

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
      }
      setHello();
    };
    const openLogin = (msgKey) => {
      show('login');
      showErr(loginForm, msgKey || null);
    };
    A.onChange((u) => (u ? openMy() : openLogin()));

    A.ready.then((u) => {
      const n = nextUrl();
      if (u && n) { location.replace(n); return; }
      if (u) {
        if (A.link.type === 'signup') PM.toast(t('welcome'));
        openMy();
      } else {
        openLogin(A.link.error ? (A.errorKey({ code: A.link.error }) || 'errLink') : null);
      }
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(loginForm, null);
      if (!loginCheck.validate()) return;
      busy(loginForm, true);
      try {
        await A.signIn(val(loginForm, 'email'), loginForm.elements.password.value);
        loginForm.reset();
        PM.toast(t('loggedIn'));
        const n = nextUrl();
        if (n) location.href = n;
      } catch (err) {
        showErr(loginForm, err);
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
        setHello();
        PM.toast(t('saved'));
      } catch (err) {
        showErr(infoForm, err);
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

  /* ---------- /account/signup/ : 회원가입 ---------- */
  const signup = () => {
    const form = root.querySelector('[data-signup]');
    const sentText = root.querySelector('[data-sent-text]');
    const check = FORM.bind(form);
    const agree = FORM.bindAgree(form.querySelector('[data-agree-box]'));
    let sentTo = '';
    PM.onLang(() => { if (sentTo) sentText.textContent = t('signupSentText', { email: sentTo }); });
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
        if (r.confirm) {
          sentTo = email;
          sentText.textContent = t('signupSentText', { email });
          show('sent');
          window.scrollTo(0, 0);
        } else {
          PM.toast(t('welcome'));
          location.href = nextUrl() || '/account/';
        }
      } catch (err) {
        showErr(form, err);
      } finally {
        busy(form, false);
      }
    });
  };

  /* ---------- /account/reset/ : 비밀번호 찾기 ---------- */
  const reset = () => {
    const reqForm = root.querySelector('[data-reset]');
    const newForm = root.querySelector('[data-newpw]');
    const sentText = root.querySelector('[data-sent-text]');
    const reqCheck = FORM.bind(reqForm);
    const newCheck = FORM.bind(newForm);
    let sentTo = '';
    PM.onLang(() => { if (sentTo) sentText.textContent = t('resetSentText', { email: sentTo }); });

    if (A.link.type === 'recovery') {
      A.ready.then((u) => {
        if (u) show('newpw');
        else { show('request'); showErr(reqForm, 'errLink'); }
      });
    } else {
      show('request');
      if (A.link.error) showErr(reqForm, A.errorKey({ code: A.link.error }) || 'errLink');
    }

    reqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(reqForm, null);
      if (!reqCheck.validate()) return;
      const email = val(reqForm, 'email');
      busy(reqForm, true);
      try {
        await A.sendReset(email);
        sentTo = email;
        sentText.textContent = t('resetSentText', { email });
        show('sent');
      } catch (err) {
        showErr(reqForm, err);
      } finally {
        busy(reqForm, false);
      }
    });

    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(newForm, null);
      if (!newCheck.validate()) return;
      busy(newForm, true);
      try {
        await A.updatePassword(newForm.elements.password.value);
        PM.toast(t('pwChanged'));
        setTimeout(() => { location.href = '/account/'; }, 900);
      } catch (err) {
        showErr(newForm, err);
        busy(newForm, false);
      }
    });
  };

  ({ home, signup, reset })[page]();
})();
