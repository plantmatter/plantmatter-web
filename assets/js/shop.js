/* PLANT MATTER — 주문·결제 설정 (제품 상세 · 주문/결제 · 결제 결과 페이지가 함께 씀)
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요.

   ▸ 결제: 토스페이먼츠 결제위젯
     - clientKey 는 '클라이언트 키'(공개해도 되는 키)만 넣습니다. test_gck_… 또는 live_gck_…
     - 시크릿 키(test_gsk_… / live_gsk_…)는 절대 이 파일이나 사이트 어디에도 넣지 마세요.
     - 지금 키는 토스페이먼츠 개발 문서의 공용 테스트 키 → 결제 화면은 실제와 같지만 돈은 나가지 않습니다.
     - 실제 판매: 가맹 계약 후 상점관리자 > 개발 정보 > '결제위젯 연동 키'의 클라이언트 키로 교체하고,
       결제 승인 서버(confirmUrl)를 연결해야 결제가 최종 완료됩니다.
 */
(() => {
  const config = {
    clientKey: 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm',
    confirmUrl: '',          // 결제 승인 서버 주소 (만든 뒤 입력). 비어 있으면 '테스트 결제 완료' 안내만 보여 줌
    shippingFee: 0,          // 배송비(원). 0 이면 화면에 표시하지 않음
    freeShippingOver: null,  // 이 금액(원) 이상 구매 시 배송비 무료. 쓰지 않으면 null
    maxQty: 9,               // 한 번에 살 수 있는 최대 수량 (식물별로 products.js 의 stock 이 있으면 그 수만큼)
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const won = (n) => `₩ ${Number(n).toLocaleString('ko-KR')}`;
  const find = (id) => (window.PM_PRODUCTS || []).find((p) => p.id === id) || null;
  const nameOf = (p, lang) => (p.name && (p.name[lang] || p.name.ko)) || p.id;
  const category = (id) => (window.PM_CATEGORIES || []).find((c) => c.id === id) || null;
  const maxQty = (p) => Math.max(1, Math.min(config.maxQty, p && Number.isFinite(p.stock) ? p.stock : config.maxQty));
  const shippingFor = (subtotal) =>
    config.shippingFee > 0 && !(config.freeShippingOver != null && subtotal >= config.freeShippingOver) ? config.shippingFee : 0;
  const isTest = () => /^test_/.test(config.clientKey);
  /* 이름 아래 둘째 줄: 식물은 학명(앞부분 이탤릭), 협업 제품은 sub (예: BOWL LONG - 4) */
  const sciHtml = (p) => {
    if (p.sub) return esc(p.sub);
    const [italic = '', rest = ''] = p.sci || [];
    return `<i>${esc(italic)}</i>${rest ? ' ' + esc(rest) : ''}`;
  };
  const collabOf = (p) => (p && p.collab && (window.PM_COLLABS || []).find((c) => c.id === p.collab)) || null;
  /* 목록 카드 (PLANT 목록 · COLLABORATION 페이지 공통): 사진 · 이름 · 둘째 줄 · 가격 · 동일 상품 배송 · 가방 버튼 */
  const BAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8.5h15l-1.2 12h-12.6z"/><path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5"/></svg>';
  const cardHtml = (p, lang) => {
    const t = window.PM.t;
    const name = nameOf(p, lang);
    const sold = p.status === 'soldout';
    const canAdd = window.PM_CART && !sold && p.price != null;   // 가방 버튼 → 장바구니에 담기 (assets/js/cart.js)
    return `<li class="card${sold ? ' is-soldout' : ''}" id="p-${esc(p.id)}">
      <a class="card__link" href="/product/?id=${encodeURIComponent(p.id)}">
        <span class="card__img${p.plain ? ' is-plain' : ''}"><img src="${esc(p.image)}" alt="${esc(name)}" width="750" height="1000" loading="lazy"></span>
        ${sold ? `<span class="card__badge">${esc(t('soldOut'))}</span>` : ''}
        <span class="card__body">
          <span class="card__name">${esc(name)}</span>
          <span class="card__sci">${sciHtml(p)}</span>
          <span class="card__price">${esc(p.price == null ? t('priceAsk') : won(p.price))}</span>
          ${p.exact ? `<span class="card__note">${esc(t('exactShip'))}</span>` : ''}
        </span>
      </a>
      ${canAdd ? `<button class="card__cart" type="button" data-cart-add="${esc(p.id)}" aria-label="${esc(t('addToCartName', { name }))}">${BAG}</button>` : ''}
    </li>`;
  };
  /* 주문번호: PM + 날짜 + 무작위 8자 (토스페이먼츠 규칙: 영문·숫자·-·_ 6~64자) */
  const newOrderId = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => abc[b % abc.length]).join('');
    return `PM${ymd}-${rnd}`;
  };
  /* 주문/결제 → 결제 결과 페이지로 주문 내용을 넘기는 임시 보관 (이 탭에서만) */
  const ORDER_KEY = 'pm-order';
  const saveOrder = (o) => { try { sessionStorage.setItem(ORDER_KEY, JSON.stringify(o)); } catch (e) {} };
  const loadOrder = () => { try { return JSON.parse(sessionStorage.getItem(ORDER_KEY) || 'null'); } catch (e) { return null; } };

  window.PM_SHOP = { config, esc, won, find, nameOf, category, collabOf, maxQty, shippingFor, isTest, sciHtml, cardHtml, newOrderId, saveOrder, loadOrder };
})();
