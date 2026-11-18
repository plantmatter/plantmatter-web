/* PLANT MATTER — 로그인 (Supabase Auth)
   앱(plant-matter-field)과 같은 Supabase 프로젝트·같은 계정을 씁니다 → 앱 계정으로도 웹에 로그인됩니다.
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요.

   ▸ 여기에는 공개용 Project URL 과 Publishable key 만 넣습니다.
     service_role 키나 시크릿 키는 절대 넣지 마세요 (사이트 파일은 누구나 볼 수 있습니다).
   ▸ 회원 정보(이름·휴대폰·배송지·동의 기록)는 shop_customers 테이블에 본인만 읽을 수 있게 저장됩니다
     → supabase/web01_shop_customers.sql 을 Supabase SQL Editor 에서 한 번 실행해야 합니다.
   ▸ 가입 확인·비밀번호 재설정 메일의 링크가 이 사이트로 돌아오려면
     Supabase > Authentication > URL Configuration > Redirect URLs 에
     https://plantmatter.kr/** 와 https://m.plantmatter.kr/** 를 추가해야 합니다. */
(() => {
  const CONFIG = {
    url: 'https://gjtgjnylemhtbjlzzrgv.supabase.co',
    key: 'sb_publishable_5PGyKKQa2ELuivoVToKo5w_2ToujiLO',
  };

  /* 메일 링크로 돌아온 경우(#access_token=…&type=signup|recovery 또는 #error=…)를 라이브러리가 지우기 전에 기억 */
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const link = {
    type: hash.get('type') || '',
    error: hash.get('error_code') || hash.get('error') || query.get('error_code') || query.get('error') || '',
  };

  let client = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(CONFIG.url, CONFIG.key, {
        auth: {
          persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
          flowType: 'implicit',          // 메일 링크를 다른 기기·브라우저에서 열어도 동작
          storageKey: 'pm-web-auth',
        },
      });
    }
  } catch (e) { console.error(e); }

  let user = null;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });

  const ready = (async () => {
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      user = (data.session && data.session.user) || null;
    } catch (e) {
      console.warn('auth session', e);
      if (!link.error) link.error = 'link';
      user = null;
    }
    client.auth.onAuthStateChange((event, session) => {
      const next = (session && session.user) || null;
      if (event === 'PASSWORD_RECOVERY') link.type = 'recovery';
      if ((next && next.id) !== (user && user.id)) { user = next; emit(); } else user = next;
    });
    return user;
  })();

  const need = () => { if (!client) throw Object.assign(new Error('network'), { code: 'network' }); return client; };
  const here = (path) => `${location.origin}${path}`;

  const api = {
    link,
    ready,
    available: () => Boolean(client),
    user: () => user,
    onChange: (fn) => listeners.push(fn),

    async signIn(email, password) {
      const { data, error } = await need().auth.signInWithPassword({ email, password });
      if (error) throw error;
      user = data.user; emit();
      return user;
    },
    /* shop: { name, phone, zip, addr, addr2, marketing, terms, privacy, age14 } → 가입 직후 shop_customers 로 복사됨 (SQL 트리거) */
    async signUp(email, password, shop) {
      const { data, error } = await need().auth.signUp({
        email, password, options: { data: { shop }, emailRedirectTo: here('/account/') },
      });
      if (error) throw error;
      /* 확인 메일을 쓰는 프로젝트에서 이미 가입된 메일이면 identities 가 빈 채로 옴 */
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw Object.assign(new Error('exists'), { code: 'user_already_exists' });
      }
      if (data.session) { user = data.user; emit(); }
      return { confirm: !data.session };
    },
    async signOut() {
      const { error } = await need().auth.signOut();
      if (error) throw error;
      user = null; emit();
    },
    async sendReset(email) {
      const { error } = await need().auth.resetPasswordForEmail(email, { redirectTo: here('/account/reset/') });
      if (error) throw error;
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
      if (code === 'weak_password' || /password should/i.test(msg)) return 'errWeakPw';
      if (code === 'same_password') return 'errSamePw';
      if (/rate_limit|over_.*limit/.test(code) || /rate limit|security purposes/i.test(msg)) return 'errRate';
      if (/consent required/i.test(msg)) return 'errAgree';
      if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205' || /shop_customers|save_shop_customer|schema cache/i.test(msg)) return 'errSetup';
      if (code === 'network' || /failed to fetch|network|load failed/i.test(msg)) return 'errNetwork';
      if (code === 'otp_expired' || code === 'link' || /expired|invalid.*(link|token)/i.test(msg)) return 'errLink';
      return '';
    },
  };
  window.PM_AUTH = api;
})();
