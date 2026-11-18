/* PLANT MATTER — 판매 식물 목록
   여기에 한 줄(중괄호 한 묶음)씩 추가하면 PLANT 목록 페이지에 나타납니다.
   PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 둘 다 고쳐 주세요.

   category : 'tropical' | 'orchid' | 'fern' | 'caudex'   (layout.js 의 CATEGORIES 와 같은 이름)
   name     : 화면에 보이는 이름 (한국어 / English / 日本語)
   sci      : 학명 [이탤릭으로 쓸 부분, 나머지]   예) ['Ficus', 'sp. ‘Murung Raya’']
   price    : 원 단위 숫자 (예: 32000). 아직 정하지 않았으면 null → '가격 문의'로 표시
   status   : 'available'(판매 중) | 'soldout'(품절)
   image    : 세로 3:4 사진 (assets/img/products/ 에 올린 파일)
   shade    : 사진 아래쪽에 옅은 그라데이션을 자동으로 넣습니다. 사진 자체에 이미 그늘이 있으면 false
 */
window.PM_PRODUCTS = [
  {
    id: 'ficus-murung-raya',
    category: 'tropical',
    name: { ko: '피커스 sp. ‘무룽 라야’', en: 'Ficus sp. ‘Murung Raya’', ja: 'フィカス sp.「ムルン・ラヤ」' },
    sci: ['Ficus', 'sp. ‘Murung Raya’'],
    price: 22000,
    status: 'available',
    image: '/assets/img/products/ficus-murung-raya.jpg',
    shade: false                   /* 사진에 이미 아래쪽 그늘이 있음 */
  },
  {
    id: 'ficus-punctata',
    category: 'tropical',
    name: { ko: '피커스 푼타타', en: 'Ficus punctata', ja: 'フィカス・プンクタタ' },
    sci: ['Ficus punctata', ''],
    price: 60000,
    status: 'available',
    image: '/assets/img/products/ficus-punctata.jpg'
  }
];
