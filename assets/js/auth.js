/* PLANT MATTER — 로그인 (Supabase Auth)
   PLANT MATTER 앱(plantmatter/plantmatter-app)과 같은 Supabase 프로젝트·같은 계정을 씁니다
   → 앱에서 이메일로 가입한 계정으로 웹에 로그인되고, 웹에서 가입한 계정으로 앱에도 로그인됩니다.
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요.

   ▸ CONFIG 에는 앱의 .env 와 같은 값(Project URL · Publishable key)만 넣습니다.
     service_role 키나 시크릿 키는 절대 넣지 마세요 (사이트 파일은 누구나 볼 수 있습니다).
   ▸ 가입 확인 · 비밀번호 재설정은 앱처럼 메일로 받은 6자리 코드를 입력하는 방식입니다
     (Supabase 메일 템플릿이 링크 대신 {{ .Token }} 코드를 보냄 — 앱 README 1-5).
   ▸ 회원 정보(이름·휴대폰·배송지·동의 기록)는 shop_customers 테이블에 본인만 읽을 수 있게 저장됩니다
     → supabase/web01_shop_customers.sql 을 같은 프로젝트의 SQL Editor 에서 한 번 실행해야 합니다. */
(() => {
  const CONFIG = {
    url: 'https://qssrtzvipwvxcfszxomo.supabase.co',
    key: 'sb_publishable_qJhjHRcc95Ew7bYRs3Qt4A_N0nQw9hu',
  };

  let client = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(CONFIG.url, CONFIG.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'pm-web-auth' },
      });
    }
  } catch (e) { console.error(e); }

  let user = null;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });
  const setUser = (next) => {
    const changed = (next && next.id) !== (user && user.id);
    user = next;
    if (changed) emit();
  };

  const ready = (async () => {
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      user = (data.session && data.session.user) || null;
    } catch (e) {
      console.warn('auth session', e);
      user = null;
    }
    client.auth.onAuthStateChange((event, session) => setUser((session && session.user) || null));
    return user;
  })();

  const need = () => { if (!client) throw Object.assign(new Error('network'), { code: 'network' }); return client; };

  const api = {
    ready,
    available: () => Boolean(client),
    user: () => user,
    onChange: (fn) => listeners.push(fn),

    async signIn(email, password) {
      const { data, error } = await need().auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user);
      return user;
    },
    /* shop: { name, phone, zip, addr, addr2, marketing, terms, privacy, age14 } → 가입 직후 shop_customers 로 복사됨 (SQL 트리거)
       반환 confirm=true 이면 메일로 받은 코드를 verifySignup() 으로 확인해야 로그인됨 */
    async signUp(email, password, shop) {
      const { data, error } = await need().auth.signUp({ email, password, options: { data: { shop } } });
      if (error) throw error;
      /* 확인 메일을 쓰는 프로젝트에서 이미 가입된 메일이면 identities 가 빈 채로 옴 */
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw Object.assign(new Error('exists'), { code: 'user_already_exists' });
      }
      if (data.session) setUser(data.user);
      return { confirm: !data.session };
    },
    /* 가입 확인 코드 (앱과 같은 방식: 'email' → 안 되면 'signup') */
    async verifySignup(email, code) {
      const c = need();
      let r = await c.auth.verifyOtp({ email, token: code, type: 'email' });
      if (r.error) r = await c.auth.verifyOtp({ email, token: code, type: 'signup' });
      if (r.error) throw r.error;
      setUser(r.data.user);
    },
    async resendSignup(email) {
      const { error } = await need().auth.resend({ type: 'signup', email });
      if (error) throw error;
    },
    /* 비밀번호 찾기: 코드 받기 → 코드 확인 + 새 비밀번호 */
    async sendReset(email) {
      const { error } = await need().auth.resetPasswordForEmail(email);
      if (error) throw error;
    },
    async resetWithCode(email, code, password) {
      const c = need();
      const r = await c.auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (r.error) throw r.error;
      const u = await c.auth.updateUser({ password });
      if (u.error) throw u.error;
      setUser(r.data.user);
    },
    async signOut() {
      const { error } = await need().auth.signOut();
      if (error) throw error;
      setUser(null);
    },
    async updatePassword(password) {
      const { error } = await need().auth.updateUser({ password });
      if (error) throw error;
    },
    async getCustomer() {
      if (!user) return null;
      const { data, error } = await need().from('shop_customers').select('*').eq('id', user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async saveCustomer(c) {
      const { error } = await need().rpc('save_shop_customer', {
        p_name: c.name, p_phone: c.phone, p_zip: c.zip, p_addr: c.addr, p_addr2: c.addr2,
        p_marketing: Boolean(c.marketing),
        p_accept_terms: Boolean(c.terms), p_accept_privacy: Boolean(c.privacy), p_confirm_age: Boolean(c.age14),
      });
      if (error) throw error;
    },

    /* 오류 → 화면 문구 키 (assets/js/i18n.js) */
    errorKey(err) {
      const code = String((err && (err.code || err.error_code)) || '');
      const msg = String((err && err.message) || err || '');
      if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'errLogin';
      if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'errNotConfirmed';
      if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(msg)) return 'errExists';
      if (code === 'otp_expired' || code === 'otp_invalid' || /token has expired|otp|invalid.*token/i.test(msg)) return 'errCode';
      if (code === 'weak_password' || /password should/i.test(msg)) return 'errWeakPw';
      if (code === 'same_password') return 'errSamePw';
      if (/rate_limit|over_.*limit/.test(code) || /rate limit|security purposes/i.test(msg)) return 'errRate';
      if (/consent required/i.test(msg)) return 'errAgree';
      if (/name_locked/.test(msg)) return 'errNameLocked';
      if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205' || /shop_customers|save_shop_customer|schema cache/i.test(msg)) return 'errSetup';
      if (code === 'network' || /failed to fetch|network|load failed/i.test(msg)) return 'errNetwork';
      return '';
    },
  };
  window.PM_AUTH = api;
})();
