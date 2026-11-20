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
  /* '주민등록번호' 칸: 본인인증으로 받은 생년월일·성별로 900101-1****** 모양만 만듦 (실제 주민등록번호는 받지도 저장하지도 않음) */
  const maskRrn = (birth, gender, foreigner) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birth || ''));
    if (!m || (gender !== 'M' && gender !== 'F')) return '';
    const base = Number(m[1]) >= 2000 ? (foreigner ? 7 : 3) : (foreigner ? 5 : 1);
    return `${m[1].slice(2)}${m[2]}${m[3]}-${base + (gender === 'F' ? 1 : 0)}******`;
  };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
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

    /* ---------- 마이페이지 칸: 제목을 눌러 접기·펼치기 (닫힌 칸 안은 Tab 으로도 들어가지 않음) ---------- */
    const secs = [...root.querySelectorAll('[data-view="my"] .my__sec')];
    const setOpen = (sec, open) => {
      sec.classList.toggle('is-open', open);
      sec.querySelector('.my__toggle').setAttribute('aria-expanded', String(open));
      const inner = sec.querySelector('.my__inner');
      if (open) inner.removeAttribute('inert'); else inner.setAttribute('inert', '');
    };
    secs.forEach((sec) => sec.querySelector('.my__toggle').addEventListener('click', () => setOpen(sec, !sec.classList.contains('is-open'))));

    /* ---------- 배송지: 기본 배송지(회원 정보에 저장, 받는 분 = 회원) + 추가 배송지 2곳(서버에서도 2곳 제한 — supabase/web03) ---------- */
    const ADDR_MAX = 2;
    const addrTitle = (el) => el.querySelector('[data-addr-form-title]');
    const extraFields = root.querySelector('[data-addr-extra-fields]');
    const book = root.querySelector('[data-addr-book]');
    const listEl = book.querySelector('[data-addr-list]');
    const addBtn = book.querySelector('[data-addr-add]');
    const addrForm = book.querySelector('[data-addr-form]');
    const addrCheck = FORM.bind(addrForm);
    let addresses = [];
    let editing = null;          // null · 'default'(기본 배송지) · 'new' · 추가 배송지 id
    let bookError = '';
    const renderBook = () => {
      if (bookError) {
        listEl.innerHTML = `<li class="addr-empty">${esc(t(bookError))}</li>`;
        addBtn.hidden = true;
        return;
      }
      const c = customer;
      const def = c && c.addr
        ? `<li class="addr-item addr-item--default" data-id="default">
          <div class="addr-item__text">
            <span class="addr-item__label">${esc(t('addrDefault'))}</span>
            ${c.real_name || c.phone ? `<span>${esc([c.real_name, c.phone].filter(Boolean).join(' · '))}</span>` : ''}
            <span>(${esc(c.zip)}) ${esc(c.addr)} ${esc(c.addr2 || '')}</span>
          </div>
          <div class="addr-item__act"><button class="link-btn" type="button" data-addr-edit>${esc(t('addrEdit'))}</button></div>
        </li>`
        : `<li class="addr-item addr-item--default" data-id="default">
          <div class="addr-item__text">
            <span class="addr-item__label">${esc(t('addrDefault'))}</span>
            <span>${esc(t('addrDefaultEmpty'))}</span>
          </div>
          <div class="addr-item__act"><button class="link-btn" type="button" data-addr-edit>${esc(t('addrRegister'))}</button></div>
        </li>`;
      listEl.innerHTML = def + addresses.map((a, i) => `<li class="addr-item" data-id="${esc(a.id)}">
          <div class="addr-item__text">
            <span class="addr-item__label">${esc(a.label || t('addrNoLabel', { n: i + 1 }))}</span>
            <span>${esc(a.name)} · ${esc(a.phone)}</span>
            <span>(${esc(a.zip)}) ${esc(a.addr)} ${esc(a.addr2 || '')}</span>
          </div>
          <div class="addr-item__act">
            <button class="link-btn" type="button" data-addr-edit>${esc(t('addrEdit'))}</button>
            <button class="link-btn" type="button" data-addr-del>${esc(t('addrDelete'))}</button>
          </div>
        </li>`).join('');
      addBtn.hidden = addresses.length >= ADDR_MAX || editing !== null;
    };
    const loadBook = async () => {
      bookError = '';
      try { addresses = await A.listAddresses(); } catch (err) { addresses = []; bookError = A.errorKey(err) || 'errNetwork'; }
      renderBook();
    };
    const closeAddrForm = () => {
      editing = null;
      addrForm.reset();
      addrCheck.clear();
      showErr(addrForm, null);
      addrForm.hidden = true;
      renderBook();
    };
    const openAddrForm = (a) => {
      if (a === 'default' && !customer) {   // 기본 배송지는 회원 정보(동의 포함)를 먼저 저장해야 함
        PM.toast(t('saveInfoFirst'));
        setOpen(infoForm, true);
        return;
      }
      editing = a === 'default' ? 'default' : a ? a.id : 'new';
      addrForm.reset();
      addrCheck.clear();
      showErr(addrForm, null);
      const F = addrForm.elements;
      extraFields.hidden = editing === 'default';   // 기본 배송지는 받는 분이 회원 본인이라 주소만
      if (editing === 'default') ['zip', 'addr', 'addr2'].forEach((k) => { F[k].value = customer[k] || ''; });
      else if (a) ['label', 'name', 'phone', 'zip', 'addr', 'addr2'].forEach((k) => { F[k].value = a[k] || ''; });
      addrTitle(book).textContent = t(editing === 'default' ? 'addrDefault' : editing === 'new' ? 'addrNewTitle' : 'addrEditTitle');
      addrForm.hidden = false;
      renderBook();
      (editing === 'default' ? F.zip : F.label).focus();
    };
    addBtn.addEventListener('click', () => openAddrForm(null));
    addrForm.querySelector('[data-addr-cancel]').addEventListener('click', closeAddrForm);
    listEl.addEventListener('click', async (e) => {
      const item = e.target.closest('.addr-item');
      if (!item) return;
      if (item.dataset.id === 'default') { if (e.target.closest('[data-addr-edit]')) openAddrForm('default'); return; }
      const a = addresses.find((x) => String(x.id) === item.dataset.id);
      if (!a) return;
      if (e.target.closest('[data-addr-edit]')) { openAddrForm(a); return; }
      const del = e.target.closest('[data-addr-del]');
      if (!del) return;
      if (!del.dataset.armed) {   // 한 번 더 눌러야 삭제
        del.dataset.armed = '1';
        del.textContent = t('addrDeleteConfirm');
        del.classList.add('is-armed');
        setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = t('addrDelete'); del.classList.remove('is-armed'); } }, 3500);
        return;
      }
      del.disabled = true;
      try {
        await A.deleteAddress(a.id);
        if (editing === a.id) closeAddrForm();
        await loadBook();
        PM.toast(t('addrDeleted'));
      } catch (err) {
        PM.toast(t(A.errorKey(err) || 'errNetwork'));
        del.disabled = false;
      }
    });
    addrForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(addrForm, null);
      if (!addrCheck.validate()) return;
      const F = addrForm.elements;
      const data = { label: F.label.value, name: F.name.value, phone: F.phone.value, zip: F.zip.value, addr: F.addr.value, addr2: F.addr2.value };
      busy(addrForm, true);
      try {
        if (editing === 'default') {
          await A.saveCustomer({ name: customer.name, phone: customer.phone, zip: data.zip, addr: data.addr, addr2: data.addr2,
            marketing: Boolean(customer.marketing_consent) });
          customer = await A.getCustomer();
        } else if (editing === 'new') await A.addAddress(data);
        else await A.updateAddress(editing, data);
        closeAddrForm();
        await loadBook();
        PM.toast(t('addrSaved'));
      } catch (err) {
        showErr(addrForm, err);
      } finally {
        busy(addrForm, false);
      }
    });
    PM.onLang(renderBook);

    const setHello = () => {
      const n = customer && (customer.real_name || customer.name);   // 본인인증 실명이 있으면 실명, 없으면 아이디
      helloEl.textContent = n ? t('hello', { name: n }) : t('helloNoName');
    };
    PM.onLang(setHello);

    /* 관리자 계정이면 마이페이지 아래에 '관리자 페이지' 버튼 (로그인할 때마다 확인) */
    const showAdminLink = async () => {
      const foot = root.querySelector('.my__foot');
      const link = foot && foot.querySelector('[data-admin-link]');
      const ok = A.isAdmin ? await A.isAdmin() : false;
      if (ok && foot && !link) foot.insertAdjacentHTML('afterbegin', '<a class="btn-line" href="/admin/" data-admin-link>관리자 페이지</a>');
      if (!ok && link) link.remove();
    };
    const openMy = async () => {
      showAdminLink();
      const u = A.user();
      if (!u) return;
      show('my');
      const F = infoForm.elements;
      F.email.value = u.email || '';
      showErr(infoForm, null);
      try { customer = await A.getCustomer(); } catch (err) { customer = null; showErr(infoForm, err); }
      firstBox.hidden = Boolean(customer);
      if (!customer) setOpen(infoForm, true);   // 웹을 처음 쓰는 회원: 정보·동의 입력이 필요하니 펼쳐 둠
      const verified = Boolean(customer && customer.identity_verified_at);
      F.realname.value = (customer && customer.real_name) || '';
      F.rrn.value = customer ? maskRrn(customer.birth_date, customer.gender, customer.foreigner) : '';
      F.phone.readOnly = verified;   // 본인인증한 번호는 고정 (서버에서도 고정)
      root.querySelector('[data-phone-hint]').textContent = verified ? t('phoneVerified') : '';
      nameInput.dataset.keep = (customer && customer.name) || '';
      if (customer) {
        ['name', 'phone'].forEach((k) => { F[k].value = customer[k] || ''; });
        F.marketing.checked = Boolean(customer.marketing_consent);
      } else if (!F.name.value) {
        const m = u.user_metadata || {};   // 앱에서 정한 이름이 있으면 미리 채움
        const guess = String(m.display_name || '').trim();
        if (/^[가-힣A-Za-z0-9._-]{2,20}$/.test(guess)) F.name.value = guess;   // 앱 표시 이름이 아이디 형식이면 미리 채움
      }
      updateNameHint();
      setHello();
      closeAddrForm();
      loadBook();
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
          name: val(infoForm, 'name'), phone: val(infoForm, 'phone'),
          zip: (customer && customer.zip) || '', addr: (customer && customer.addr) || '', addr2: (customer && customer.addr2) || '',   // 기본 배송지는 '배송지' 칸에서
          marketing: infoForm.elements.marketing.checked,
          ...(firstBox.hidden ? {} : firstAgree.values()),
        });
        customer = await A.getCustomer();
        firstBox.hidden = Boolean(customer);
        updateNameHint();
        setHello();
        renderBook();   // 기본 배송지 카드의 이름·휴대폰도 새로
        PM.toast(t('saved'));
      } catch (err) {
        const locked = /name_locked:(\S+)/.exec(String((err && err.message) || ''));
        const idKey = A.errorKey(err);
        if (idKey === 'errIdTaken' || idKey === 'errIdFormat') {
          infoCheck.setErr(nameInput, idKey);
          nameInput.focus();
        } else if (locked) {
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
        addresses = [];
        closeAddrForm();
        secs.forEach((sec) => setOpen(sec, false));
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
      /* 아이디가 이미 쓰이고 있으면 가입 전에 알려 줌 (서버에 못 물어보면 그냥 진행 — 가입 후 마이페이지에서 정함) */
      const free = await A.idAvailable(val(form, 'name'));
      if (free === false) {
        check.setErr(form.elements.name, 'errIdTaken');
        form.elements.name.focus();
        busy(form, false);
        return;
      }
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
