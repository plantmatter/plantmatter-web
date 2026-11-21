/* PLANT MATTER — 관리자 페이지 (/admin/)
   관리자 명단(public.app_admins, 앱과 같음)에 있는 계정으로 로그인하면 열립니다.
   - 제품: 가격 · 재고 · 판매 상태(판매 중 / 품절 / 숨김) 바로 고치기, 순서 바꾸기, 새 제품 등록 · 수정 · 삭제(사진 올리기 포함)
   - B2B 도매 문의 · COLLAB 협업 제안: 목록 보기, 사업자등록증 열기, 지우기
   고친 내용은 Supabase 의 shop_products 표에 바로 저장되고 사이트에 바로 반영됩니다 (supabase/web08_admin_products.sql).
   읽기·쓰기 권한은 서버(RLS)가 관리자인지 다시 확인하므로, 이 화면을 흉내 내도 관리자가 아니면 아무것도 바뀌지 않습니다.
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요. */
(() => {
  const PM = window.PM;
  const A = window.PM_AUTH;
  if (!PM || !A) return;

  const IMG_BUCKET = 'product-images';
  const OUT_W = 750;
  const OUT_H = 1000;
  const STATUS = { available: '판매 중', soldout: '품절', hidden: '숨김' };
  const TABS = { products: 'PRODUCTS', b2b: 'B2B', collab: 'COLLAB' };
  const B2B_TYPES = { shop: '식물 매장·꽃집', space: '카페·쇼룸 등 공간', landscape: '조경·인테리어', online: '온라인 판매', other: '기타' };

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const won = (n) => (n == null ? '가격 문의' : `₩ ${Number(n).toLocaleString('ko-KR')}`);
  const when = (iso) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const phoneFmt = (p) => (p && p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p || '');
  const cats = () => window.PM_CATEGORIES || [];
  const collabs = () => window.PM_COLLABS || [];
  const lines = () => window.PM_PRODUCT_LINES || [];
  const matters = () => window.PM_MATTERS || [];
  const where = (p) => {
    const c = cats().find((x) => x.id === p.category);
    if (c) return `PLANT · ${c.name}`;
    const k = collabs().find((x) => x.id === p.collab);
    if (k) return `COLLABORATION · ${k.name}`;
    const l = lines().find((x) => x.id === p.line);
    if (l) return `PRODUCT · ${l.name}`;
    const m = matters().find((x) => x.id === p.matter);
    return m ? `MATTER · ${m.name}` : '—';
  };
  const secondLine = (p) => (p.sub ? esc(p.sub) : p.sci ? `<i>${esc(p.sci[0] || '')}</i>${p.sci[1] ? ' ' + esc(p.sci[1]) : ''}` : '');

  const stateEl = $('[data-adm-state]');
  const app = $('[data-adm-app]');
  const titleEl = $('[data-adm-title]');
  let db = null;
  let products = [];

  const setState = (html) => { stateEl.innerHTML = html; stateEl.hidden = !html; };
  const errText = (err) => (err && (err.message || err.error_description)) || String(err || '');

  /* ---------- 탭 ---------- */
  let tab = 'products';
  const showTab = (next) => {
    tab = TABS[next] ? next : 'products';
    document.querySelectorAll('[data-adm-tab]').forEach((a) => {
      const on = a.dataset.admTab === tab;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-adm-panel]').forEach((p) => { p.hidden = p.dataset.admPanel !== tab; });
    titleEl.textContent = TABS[tab];
    document.title = `ADMIN · ${TABS[tab]} — PLANT MATTER`;
    if (tab === 'b2b') loadB2B();
    if (tab === 'collab') loadCollab();
  };
  document.querySelectorAll('[data-adm-tab]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    history.replaceState(null, '', a.dataset.admTab === 'products' ? '/admin/' : `/admin/?t=${a.dataset.admTab}`);
    showTab(a.dataset.admTab);
  }));

  /* ---------- 제품 목록 ---------- */
  const listEl = $('[data-adm-products]');
  const loadProducts = async () => {
    const { data, error } = await db.from('shop_products').select('*').order('sort', { ascending: true }).order('id', { ascending: true });
    if (error) { listEl.innerHTML = `<p class="adm__err">제품을 불러오지 못했습니다. ${esc(errText(error))}</p>`; return; }
    products = data || [];
    renderProducts();
  };
  const rowHtml = (p, i) => `<li class="adm-row${p.status === 'hidden' ? ' is-hidden' : ''}" data-id="${esc(p.id)}">
      <span class="adm-row__img${p.plain ? ' is-plain' : ''}">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}</span>
      <span class="adm-row__text">
        <a class="adm-row__name" href="/product/?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${esc((p.name && p.name.ko) || p.id)}</a>
        <span class="adm-row__sub">${secondLine(p)}</span>
        <span class="adm-row__where">${esc(where(p))}${p.exact ? ' · 동일 상품 배송' : ''}</span>
      </span>
      <label class="adm-row__field"><span>가격 (원)</span><input name="price" inputmode="numeric" value="${p.price ?? ''}" placeholder="가격 문의"></label>
      <label class="adm-row__field"><span>재고</span><input name="stock" inputmode="numeric" value="${p.stock ?? ''}" placeholder="관리 안 함"></label>
      <label class="adm-row__field"><span>상태</span><span class="select"><select name="status">${Object.entries(STATUS).map(([v, l]) => `<option value="${v}"${p.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select><svg class="select__chev" viewBox="0 0 14 8" aria-hidden="true"><path d="M1 1l6 6 6-6"/></svg></span></label>
      <span class="adm-row__btns">
        <button class="adm-icon" type="button" data-move="-1" aria-label="위로"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="adm-icon" type="button" data-move="1" aria-label="아래로"${i === products.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="btn-line adm-row__edit" type="button" data-edit>편집</button>
        <button class="btn-buy adm-row__save" type="button" data-save hidden>저장</button>
      </span>
    </li>`;
  const renderProducts = () => {
    $('[data-adm-count]').textContent = `${products.length}개의 제품 · 판매 중 ${products.filter((p) => p.status === 'available' && p.stock !== 0).length}`;
    listEl.innerHTML = products.length ? `<ul class="adm-list">${products.map(rowHtml).join('')}</ul>` : '<p class="adm__empty">제품이 없습니다.</p>';
  };
  const numOrNull = (v) => { const d = String(v).replace(/[^\d]/g, ''); return d === '' ? null : Number(d); };

  /* 칸을 바꾸면 그 줄에 '저장' 버튼 */
  listEl.addEventListener('input', (e) => {
    const li = e.target.closest('.adm-row');
    if (!li) return;
    if (e.target.name === 'price' || e.target.name === 'stock') {
      const d = e.target.value.replace(/[^\d]/g, '');
      if (d !== e.target.value) e.target.value = d;
    }
    li.querySelector('[data-save]').hidden = false;
  });
  listEl.addEventListener('change', (e) => { const li = e.target.closest('.adm-row'); if (li) li.querySelector('[data-save]').hidden = false; });
  listEl.addEventListener('click', async (e) => {
    const li = e.target.closest('.adm-row');
    if (!li) return;
    const p = products.find((x) => x.id === li.dataset.id);
    if (!p) return;
    if (e.target.closest('[data-edit]')) { openEditor(p); return; }
    if (e.target.closest('[data-save]')) {
      const btn = e.target.closest('[data-save]');
      const patch = { price: numOrNull(li.querySelector('[name=price]').value), stock: numOrNull(li.querySelector('[name=stock]').value), status: li.querySelector('[name=status]').value };
      btn.disabled = true;
      const { error } = await db.from('shop_products').update(patch).eq('id', p.id);
      btn.disabled = false;
      if (error) { PM.toast(`저장하지 못했습니다: ${errText(error)}`); return; }
      Object.assign(p, patch);
      PM.toast('저장했습니다');
      renderProducts();
      return;
    }
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const i = products.indexOf(p);
      const j = i + Number(mv.dataset.move);
      if (j < 0 || j >= products.length) return;
      [products[i], products[j]] = [products[j], products[i]];
      /* 순서 번호를 10, 20, 30 … 으로 다시 매겨 바뀐 것만 저장 */
      const changes = products.map((x, k) => ({ x, sort: (k + 1) * 10 })).filter(({ x, sort }) => x.sort !== sort);
      renderProducts();
      const results = await Promise.all(changes.map(({ x, sort }) => db.from('shop_products').update({ sort }).eq('id', x.id)));
      const bad = results.find((r) => r.error);
      if (bad) { PM.toast(`순서를 저장하지 못했습니다: ${errText(bad.error)}`); loadProducts(); return; }
      changes.forEach(({ x, sort }) => { x.sort = sort; });
    }
  });

  /* ---------- 제품 편집 · 새 제품 (오른쪽에서 열리는 창) ---------- */
  const editor = $('[data-adm-editor]');
  const form = $('[data-adm-form]');
  const F = form.elements;
  const editTitle = $('[data-adm-editor-title]');
  const imgPreview = $('[data-adm-img]');
  const formErr = $('[data-adm-form-err]');
  const delBtn = $('[data-adm-delete]');
  let editing = null;      // 고치는 제품 (새 제품이면 null)
  let pendingImage = null; // 새로 고른 사진 (750×1000 JPEG Blob)

  /* 구분 칸: PLANT 분류 · PRODUCT · (MATTER) · COLLABORATION 목록 (layout.js) */
  F.where.innerHTML = `<optgroup label="PLANT">${cats().map((c) => `<option value="category:${esc(c.id)}">${esc(c.name)}</option>`).join('')}</optgroup>`
    + `<optgroup label="PRODUCT">${lines().map((c) => `<option value="line:${esc(c.id)}">${esc(c.name)}</option>`).join('')}</optgroup>`
    + (matters().length ? `<optgroup label="MATTER">${matters().map((c) => `<option value="matter:${esc(c.id)}">${esc(c.name)}</option>`).join('')}</optgroup>` : '')
    + `<optgroup label="COLLABORATION">${collabs().map((c) => `<option value="collab:${esc(c.id)}">${esc(c.name)}</option>`).join('')}</optgroup>`;

  const setEditor = (open) => {
    editor.classList.toggle('is-open', open);
    editor.setAttribute('aria-hidden', String(!open));
    if (PM.lockScroll) PM.lockScroll();
    if (open) setTimeout(() => (editing ? F.name_ko : F.id).focus({ preventScroll: true }), 300);
  };
  editor.querySelectorAll('[data-adm-close]').forEach((el) => el.addEventListener('click', () => setEditor(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && editor.classList.contains('is-open')) setEditor(false); });

  const showPreview = (src) => { imgPreview.innerHTML = src ? `<img src="${esc(src)}" alt="">` : '<span>사진 없음</span>'; };
  const openEditor = (p) => {
    editing = p || null;
    pendingImage = null;
    form.reset();
    formErr.hidden = true;
    delBtn.hidden = !p;
    delBtn.dataset.armed = '';
    delBtn.textContent = '제품 삭제';
    editTitle.textContent = p ? '제품 편집' : '새 제품';
    F.id.readOnly = Boolean(p);
    if (p) {
      F.id.value = p.id;
      F.name_ko.value = (p.name && p.name.ko) || '';
      F.name_en.value = (p.name && p.name.en) || '';
      F.name_ja.value = (p.name && p.name.ja) || '';
      F.where.value = p.category ? `category:${p.category}` : p.collab ? `collab:${p.collab}` : p.line ? `line:${p.line}` : p.matter ? `matter:${p.matter}` : F.where.options[0].value;
      F.sci_i.value = (p.sci && p.sci[0]) || '';
      F.sci_r.value = (p.sci && p.sci[1]) || '';
      F.sub.value = p.sub || '';
      F.price.value = p.price ?? '';
      F.stock.value = p.stock ?? '';
      F.status.value = p.status || 'available';
      F.exact.checked = Boolean(p.exact);
      F.plain.checked = Boolean(p.plain);
      F.desc_ko.value = (p.description && p.description.ko) || '';
      F.desc_en.value = (p.description && p.description.en) || '';
      F.desc_ja.value = (p.description && p.description.ja) || '';
    }
    showPreview(p && p.image);
    setEditor(true);
  };
  $('[data-adm-new]').addEventListener('click', () => openEditor(null));

  /* 영문 이름으로 ID 자동 제안 (새 제품) */
  F.name_en.addEventListener('input', () => {
    if (editing || F.id.dataset.touched) return;
    F.id.value = F.name_en.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  });
  F.id.addEventListener('input', () => { F.id.dataset.touched = '1'; });
  ['price', 'stock'].forEach((k) => F[k].addEventListener('input', () => { const d = F[k].value.replace(/[^\d]/g, ''); if (d !== F[k].value) F[k].value = d; }));

  /* 사진: 세로 3:4 (750×1000) 로 가운데를 기준으로 맞춰 JPEG 로 */
  const toCover = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = OUT_W; c.height = OUT_H;
      const s = Math.max(OUT_W / im.naturalWidth, OUT_H / im.naturalHeight);
      const w = im.naturalWidth * s; const h = im.naturalHeight * s;
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, OUT_W, OUT_H);
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, (OUT_W - w) / 2, (OUT_H - h) / 2, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/jpeg', 0.88);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    im.src = url;
  });
  F.photo.addEventListener('change', async () => {
    const file = F.photo.files && F.photo.files[0];
    if (!file) return;
    try {
      pendingImage = await toCover(file);
      showPreview(URL.createObjectURL(pendingImage));
      if (!formErr.hidden && /사진/.test(formErr.textContent)) formErr.hidden = true;
    } catch (e) {
      pendingImage = null;
      PM.toast('이 사진을 열 수 없습니다. JPG · PNG 사진을 골라 주세요.');
    }
  });

  const showFormErr = (text) => { formErr.textContent = text; formErr.hidden = !text; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showFormErr('');
    const id = F.id.value.trim();
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) { showFormErr('ID 는 영문 소문자 · 숫자 · - 로 2자 이상 써 주세요. (예: ficus-punctata)'); F.id.focus(); return; }
    if (!editing && products.some((p) => p.id === id)) { showFormErr('이미 있는 ID 입니다. 다른 ID 를 써 주세요.'); F.id.focus(); return; }
    if (!F.name_ko.value.trim()) { showFormErr('이름(한국어)을 써 주세요.'); F.name_ko.focus(); return; }
    if (!editing && !pendingImage) { showFormErr('제품 사진을 골라 주세요. (맨 위 [사진 고르기])'); imgPreview.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const [kind, place] = F.where.value.split(':');
    const nm = { ko: F.name_ko.value.trim() };
    if (F.name_en.value.trim()) nm.en = F.name_en.value.trim();
    if (F.name_ja.value.trim()) nm.ja = F.name_ja.value.trim();
    const desc = {};
    ['ko', 'en', 'ja'].forEach((l) => { if (F[`desc_${l}`].value.trim()) desc[l] = F[`desc_${l}`].value.trim(); });
    const row = {
      id,
      category: kind === 'category' ? place : null,
      collab: kind === 'collab' ? place : null,
      line: kind === 'line' ? place : null,
      matter: kind === 'matter' ? place : null,
      name: nm,
      sci: F.sci_i.value.trim() || F.sci_r.value.trim() ? [F.sci_i.value.trim(), F.sci_r.value.trim()] : null,
      sub: F.sub.value.trim() || null,
      price: numOrNull(F.price.value),
      stock: numOrNull(F.stock.value),
      status: F.status.value,
      exact: F.exact.checked,
      plain: F.plain.checked,
      description: Object.keys(desc).length ? desc : null,
    };
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = '저장하는 중…';
    try {
      if (pendingImage) {
        const path = `${id}/${Date.now()}.jpg`;
        const up = await db.storage.from(IMG_BUCKET).upload(path, pendingImage, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        row.image = db.storage.from(IMG_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      let res;
      if (editing) res = await db.from('shop_products').update(row).eq('id', editing.id);
      else res = await db.from('shop_products').insert({ ...row, sort: (products.reduce((m, p) => Math.max(m, p.sort || 0), 0)) + 10 });
      if (res.error) throw res.error;
      PM.toast(editing ? '저장했습니다' : '새 제품을 등록했습니다');
      setEditor(false);
      await loadProducts();
    } catch (err) {
      showFormErr(`저장하지 못했습니다: ${errText(err)}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '저장';
    }
  });

  /* 삭제: 한 번 더 눌러야 지워짐 (숨김으로 두는 것을 권장) */
  delBtn.addEventListener('click', async () => {
    if (!editing) return;
    if (!delBtn.dataset.armed) {
      delBtn.dataset.armed = '1';
      delBtn.textContent = '한 번 더 누르면 삭제됩니다';
      setTimeout(() => { delBtn.dataset.armed = ''; delBtn.textContent = '제품 삭제'; }, 4000);
      return;
    }
    const { error } = await db.from('shop_products').delete().eq('id', editing.id);
    if (error) { showFormErr(`삭제하지 못했습니다: ${errText(error)}`); return; }
    PM.toast('삭제했습니다');
    setEditor(false);
    loadProducts();
  });

  /* ---------- B2B 도매 문의 ---------- */
  const b2bEl = $('[data-adm-b2b]');
  const loadB2B = async () => {
    b2bEl.innerHTML = '<p class="adm__empty">불러오는 중…</p>';
    const { data, error } = await db.from('wholesale_inquiries').select('*').order('created_at', { ascending: false });
    if (error) { b2bEl.innerHTML = `<p class="adm__err">불러오지 못했습니다. ${esc(errText(error))}</p>`; return; }
    b2bEl.innerHTML = data.length ? `<ul class="adm-cards">${data.map((q) => `<li class="adm-card" data-id="${esc(q.id)}" data-doc="${esc(q.doc_path || '')}">
        <p class="adm-card__top"><span>${esc(when(q.created_at))}</span>${q.email_error ? '<span class="adm-card__warn">메일 발송 실패</span>' : ''}</p>
        <p class="adm-card__title">${esc(q.company)} · ${esc(q.contact_name)}</p>
        <dl class="adm-card__dl">
          <div><dt>이메일</dt><dd><a href="mailto:${esc(q.email)}">${esc(q.email)}</a></dd></div>
          <div><dt>휴대폰</dt><dd><a href="tel:${esc(q.phone)}">${esc(phoneFmt(q.phone))}</a></dd></div>
          <div><dt>업종</dt><dd>${esc(B2B_TYPES[q.biz_type] || '—')}</dd></div>
          ${q.biz_no ? `<div><dt>사업자번호</dt><dd>${esc(q.biz_no.replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3'))}</dd></div>` : ''}
          ${q.items ? `<div><dt>관심 식물</dt><dd class="adm-card__msg">${esc(q.items)}</dd></div>` : ''}
          ${q.region ? `<div><dt>지역 · 시기</dt><dd>${esc(q.region)}</dd></div>` : ''}
          <div><dt>문의 내용</dt><dd class="adm-card__msg">${esc(q.message || '—')}</dd></div>
        </dl>
        <div class="adm-card__btns">
          ${q.doc_path ? '<button class="btn-line" type="button" data-doc-open>사업자등록증 보기</button>' : ''}
          <button class="btn-line adm-card__del" type="button" data-del>삭제</button>
        </div>
      </li>`).join('')}</ul>` : '<p class="adm__empty">아직 도매 문의가 없습니다.</p>';
  };
  b2bEl.addEventListener('click', async (e) => {
    const li = e.target.closest('.adm-card');
    if (!li) return;
    if (e.target.closest('[data-doc-open]')) {
      const win = window.open('', '_blank');   // 팝업 차단을 피하려고 누르는 즉시 창을 열고 주소는 뒤에
      const { data, error } = await db.storage.from('wholesale-docs').createSignedUrl(li.dataset.doc, 120);
      if (error || !data) { if (win) win.close(); PM.toast(`파일을 열 수 없습니다: ${errText(error)}`); return; }
      if (win) win.location = data.signedUrl; else location.href = data.signedUrl;
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = '한 번 더 누르면 삭제'; setTimeout(() => { del.dataset.armed = ''; del.textContent = '삭제'; }, 4000); return; }
      if (li.dataset.doc) await db.storage.from('wholesale-docs').remove([li.dataset.doc]);
      const { error } = await db.from('wholesale_inquiries').delete().eq('id', li.dataset.id);
      if (error) { PM.toast(`삭제하지 못했습니다: ${errText(error)}`); return; }
      li.remove();
      if (!b2bEl.querySelector('.adm-card')) loadB2B();
    }
  });

  /* ---------- COLLAB 협업 제안 ---------- */
  const collabEl = $('[data-adm-collab]');
  const loadCollab = async () => {
    collabEl.innerHTML = '<p class="adm__empty">불러오는 중…</p>';
    const { data, error } = await db.from('collab_proposals').select('*').order('created_at', { ascending: false });
    if (error) { collabEl.innerHTML = `<p class="adm__err">불러오지 못했습니다. ${esc(errText(error))}</p>`; return; }
    collabEl.innerHTML = data.length ? `<ul class="adm-cards">${data.map((q) => `<li class="adm-card" data-id="${esc(q.id)}">
        <p class="adm-card__top"><span>${esc(when(q.created_at))}</span>${q.email_error ? '<span class="adm-card__warn">메일 발송 실패</span>' : ''}</p>
        <p class="adm-card__title">${esc(q.name)} · ${esc(q.collab_type)}</p>
        <dl class="adm-card__dl">
          <div><dt>이메일</dt><dd><a href="mailto:${esc(q.email)}">${esc(q.email)}</a></dd></div>
          <div><dt>관련 링크</dt><dd>${q.link && /^https?:\/\//.test(q.link) ? `<a href="${esc(q.link)}" target="_blank" rel="noopener">${esc(q.link)}</a>` : '—'}</dd></div>
          <div><dt>제안 내용</dt><dd class="adm-card__msg">${esc(q.message)}</dd></div>
        </dl>
        <div class="adm-card__btns"><button class="btn-line adm-card__del" type="button" data-del>삭제</button></div>
      </li>`).join('')}</ul>` : '<p class="adm__empty">아직 협업 제안이 없습니다.</p>';
  };
  collabEl.addEventListener('click', async (e) => {
    const li = e.target.closest('.adm-card');
    const del = e.target.closest('[data-del]');
    if (!li || !del) return;
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = '한 번 더 누르면 삭제'; setTimeout(() => { del.dataset.armed = ''; del.textContent = '삭제'; }, 4000); return; }
    const { error } = await db.from('collab_proposals').delete().eq('id', li.dataset.id);
    if (error) { PM.toast(`삭제하지 못했습니다: ${errText(error)}`); return; }
    li.remove();
    if (!collabEl.querySelector('.adm-card')) loadCollab();
  });

  /* ---------- 시작: 로그인 · 관리자 확인 ---------- */
  const start = async () => {
    app.hidden = true;
    if (!A.available()) { setState('<p>로그인 서버에 연결하지 못했습니다. 잠시 후 새로고침해 주세요.</p>'); return; }
    const u = await A.ready;
    if (!u) {
      setState(`<p>관리자 계정으로 로그인해 주세요.</p><a class="btn-buy" href="/account/?next=${encodeURIComponent('/admin/' + location.search)}">로그인</a>`);
      return;
    }
    setState('<p>관리자 확인 중…</p>');
    if (!(await A.isAdmin())) {
      setState(`<p>관리자 계정이 아닙니다. (${esc(u.email || '')})</p><a class="btn-line" href="/account/">마이페이지</a>`);
      return;
    }
    db = A.client();
    setState('');
    app.hidden = false;
    await loadProducts();
    showTab(new URLSearchParams(location.search).get('t'));
  };
  A.onChange(() => start());
  start();
})();
