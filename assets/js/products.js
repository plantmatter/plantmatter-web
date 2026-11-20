/* PLANT MATTER — 판매 식물 목록
   여기에 한 줄(중괄호 한 묶음)씩 추가하면 PLANT 목록 페이지에 나타납니다.
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요.

   category : 'tropical' | 'orchid' | 'fern' | 'caudex'   (layout.js 의 CATEGORIES 와 같은 이름)
   name     : 화면에 보이는 이름 (한국어 / English / 日本語)
   sci      : 학명 [이탤릭으로 쓸 부분, 나머지]   예) ['Ficus', 'sp. ‘Murung Raya’']
   price    : 원 단위 숫자 (예: 32000). 아직 정하지 않았으면 null → '가격 문의'로 표시
   status   : 'available'(판매 중) | 'soldout'(품절)
   image    : 세로 3:4 사진 — PC 저장소의 tools/prepare_product_photo.py 로 만든 파일
              (흰 배경을 같은 순백으로 고르고, 식물 크기를 '무룽 라야' 사진과 같은 비율로 맞춤.
               아래쪽 그라데이션은 사이트가 모든 사진에 똑같이 넣음)
   (선택) images : 제품 상세에서 차례로 보일 사진 여러 장  예) ['/assets/img/products/a.jpg', '/assets/img/products/a-2.jpg']
   (선택) desc   : 제품 상세의 설명 문구 { ko: '…', en: '…', ja: '…' }
   (선택) stock  : 한 번에 살 수 있는 최대 수량 (없으면 shop.js 의 maxQty). 한 개체뿐이면 1
   (선택) exact  : true 이면 '동일 상품 배송' — 사진 속 바로 그 식물을 보냄 (목록·상세에 표시)
   ── 식물이 아닌 협업 제품 (화분 등) ──
   collab   : layout.js 의 COLLABS 이름 (예: 'thichi-yuiitsumuni') → COLLABORATION 페이지 그 탭에 나옴. category 는 넣지 않음 (PLANT 목록에서 빠짐)
   sub      : 이름 아래 둘째 줄 (학명 대신, 이탤릭 아님)  예) 'BOWL LONG - 4'
   plain    : true 이면 사진 아래쪽 그라데이션 없음 — 사진은 tools/prepare_product_photo.py --bg f4f4f2 (단색 아주 밝은 회색)
   팔리면 status 를 'soldout' 으로 바꿔 주세요.
   제품 상세 주소: /product/?id=아래의 id
 */
window.PM_PRODUCTS = [
  {
    id: 'ficus-murung-raya',
    category: 'tropical',
    name: { ko: '피커스 sp. ‘무룽 라야’', en: 'Ficus sp. ‘Murung Raya’', ja: 'フィカス sp.「ムルン・ラヤ」' },
    sci: ['Ficus', 'sp. ‘Murung Raya’'],
    price: 22000,
    status: 'available',
    image: '/assets/img/products/ficus-murung-raya.jpg?v=3'
  },
  {
    id: 'ficus-punctata',
    category: 'tropical',
    name: { ko: '피커스 푼타타', en: 'Ficus punctata', ja: 'フィカス・プンクタタ' },
    sci: ['Ficus punctata', ''],
    price: 60000,
    status: 'available',
    image: '/assets/img/products/ficus-punctata.jpg?v=6'
  },
  {
    id: 'ficus-trichocarpa',
    category: 'tropical',
    name: { ko: '피커스 트리코카르파', en: 'Ficus trichocarpa', ja: 'フィカス・トリコカルパ' },
    sci: ['Ficus trichocarpa', ''],
    price: 120000,
    status: 'available',
    image: '/assets/img/products/ficus-trichocarpa.jpg?v=3'
  },
  {
    id: 'specklinia-grobyi-1',
    category: 'orchid',
    name: { ko: '스페클리니아 그로비 #1', en: 'Specklinia grobyi #1', ja: 'スペクリニア・グロビー #1' },
    sci: ['Specklinia grobyi', ''],
    price: 110000,
    status: 'available',
    stock: 1,
    exact: true,
    image: '/assets/img/products/specklinia-grobyi-1.jpg?v=2'
  },
  {
    id: 'specklinia-grobyi-2',
    category: 'orchid',
    name: { ko: '스페클리니아 그로비 #2', en: 'Specklinia grobyi #2', ja: 'スペクリニア・グロビー #2' },
    sci: ['Specklinia grobyi', ''],
    price: 110000,
    status: 'available',
    stock: 1,
    exact: true,
    image: '/assets/img/products/specklinia-grobyi-2.jpg?v=2'
  },
  /* ───── COLLABORATION · THICHI YUIITSUMUNI — 협업 화분 (식물이 아니라 PLANT 목록에는 나오지 않음) ───── */
  {
    id: 'thichi-bucotsu-bowl-long-4',
    collab: 'thichi-yuiitsumuni',
    name: { ko: 'THICHIのBUCOTSU鉢', en: 'THICHIのBUCOTSU鉢', ja: 'THICHIのBUCOTSU鉢' },
    sub: 'BOWL LONG - 4',
    price: null,
    status: 'available',
    stock: 1,
    exact: true,
    plain: true,
    image: '/assets/img/products/thichi-bucotsu-bowl-long-4.jpg?v=1'
  },
  {
    id: 'thichi-bucotsu-bowl-mid-4',
    collab: 'thichi-yuiitsumuni',
    name: { ko: 'THICHIのBUCOTSU鉢', en: 'THICHIのBUCOTSU鉢', ja: 'THICHIのBUCOTSU鉢' },
    sub: 'BOWL MID - 4',
    price: null,
    status: 'available',
    stock: 1,
    exact: true,
    plain: true,
    image: '/assets/img/products/thichi-bucotsu-bowl-mid-4.jpg?v=1'
  },
  {
    id: 'thichi-bucotsu-bowl-mid-5',
    collab: 'thichi-yuiitsumuni',
    name: { ko: 'THICHIのBUCOTSU鉢', en: 'THICHIのBUCOTSU鉢', ja: 'THICHIのBUCOTSU鉢' },
    sub: 'BOWL MID - 5',
    price: null,
    status: 'available',
    stock: 1,
    exact: true,
    plain: true,
    image: '/assets/img/products/thichi-bucotsu-bowl-mid-5.jpg?v=1'
  }
];
