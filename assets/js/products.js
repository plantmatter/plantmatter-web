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
  }
];
