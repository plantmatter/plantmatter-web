# PLANT MATTER — 홈페이지 (PC / 모바일 분리)

| 사이트 | 폴더 | 주소 | GitHub 저장소 |
| --- | --- | --- | --- |
| PC | `plantmatter.kr/` | https://plantmatter.kr | `plantmatter/plantmatter-web` |
| 모바일 | `m.plantmatter.kr/` | https://m.plantmatter.kr | `plantmatter/plantmatter-mobile` |

- 휴대폰(아이폰·안드로이드 폰)으로 plantmatter.kr에 들어오면 → 자동으로 m.plantmatter.kr로 이동
- PC로 m.plantmatter.kr에 들어오면 → 자동으로 plantmatter.kr로 이동
- 아이패드·갤럭시탭 같은 태블릿은 PC 사이트를 봅니다
- 자동 이동은 실제 도메인에서만 동작합니다. `github.io` 주소나 내 컴퓨터에서 미리 볼 때는 이동하지 않습니다.

## 현재 구성 (홈 화면만)

- 상단 바: PLANT MATTER 워드마크 · PLANT / MATTER / CONTACT 탭 · 검색 / 내 정보 / 장바구니 아이콘
- 홈: 사진 3장이 8초마다 자동으로 넘어가는 슬라이드 (아래 가는 막대를 누르면 그 사진으로, 휴대폰은 손가락으로 밀어서 넘김)
  - 사진 바꾸기: `assets/img/hero/`의 `hero-1~3.jpg`와 `.webp`를 같은 이름으로 교체 (PC·모바일 두 저장소 모두)
  - 넘어가는 간격: `assets/js/main.js`의 `SLIDE_INTERVAL` (밀리초, 기본 8000)
  - 휴대폰에서 사진의 어느 부분을 가운데 둘지: `index.html`의 각 사진 `--fx` 값 (0%=왼쪽, 100%=오른쪽)
- 아직 없는 페이지와 기능(탭, 내 정보, 장바구니, 검색 결과)은 누르면 “준비 중입니다” 안내가 뜹니다.

### 페이지가 생기면 연결하는 법

두 사이트의 `index.html` 모두에서 해당 링크를 찾아 바꿉니다.

```html
<a href="#" data-soon="PLANT">PLANT</a>
```

```html
<a href="/plant/">PLANT</a>
```

`href`에 실제 주소를 넣고 `data-soon="…"`을 지우면 됩니다.

## 공통 틀 (모든 페이지)

- 상단 바 · PLANT 메뉴 · 하단 · 검색창 · 언어 창은 `assets/js/layout.js` 한 파일에 있습니다. 여기만 고치면 모든 페이지에 반영됩니다.
- PLANT 하위 분류(이름 · 순서 · 메뉴 썸네일)는 `layout.js` 맨 위의 `CATEGORIES`에서 바꿉니다. 썸네일은 세로 3:4, `assets/img/menu/`에 올립니다.

## PLANT 목록 페이지 (/plant/)

- 주소: `/plant/` (전체), `/plant/?c=tropical` · `?c=orchid` · `?c=fern` · `?c=caudex`
- PC: PLANT에 마우스를 올리면 메뉴가 펼쳐지고, PLANT를 누르면 전체 목록으로 갑니다. 모바일: PLANT를 누르면 메뉴가 펼쳐지고, 맨 아래 VIEW ALL로 전체 목록에 갑니다.
- 분류 탭을 누르면 새로고침 없이 목록이 바뀌고 주소도 같이 바뀝니다(뒤로 가기 가능).

### 식물 등록하기

1. 사진을 도구로 정리합니다 — 흰 배경의 밝기·색감을 모든 사진이 같은 순백이 되도록 맞추고, **식물 크기와 위치를 '피커스 sp. 무룽 라야' 사진과 같은 비율로** 맞춰(흰 여백을 늘리거나 줄임) 세로 3:4(750×1000)로 저장합니다.
   ```bash
   python3 tools/prepare_product_photo.py 원본사진.jpg assets/img/products/new-plant.jpg
   ```
   (Python과 `pip install pillow numpy` 필요. 아래쪽 그라데이션은 사이트가 모든 사진에 똑같이 넣으므로 사진에는 넣지 않습니다.)
   특정 식물만 조금 크게/작게 보이게 하려면 끝에 `--size 1.15`(15% 크게) 또는 `--size 0.9`(10% 작게)를 붙입니다. 트리코카르파는 `--size 1.15`로 만들었습니다.
2. `assets/js/products.js`에 한 묶음을 추가합니다 — 분류, 이름(한·영·일), 학명, 가격(원, 미정이면 `null` → "가격 문의"), 판매 상태(`available` / `soldout`), 사진 경로.
3. PC·모바일 두 저장소에 똑같이 올립니다.
- 지금 등록된 식물: 피커스 sp. ‘무룽 라야’ (₩22,000), 피커스 푼타타 Ficus punctata (₩60,000), 피커스 트리코카르파 Ficus trichocarpa (₩120,000)

## 제품 상세 · 주문/결제

- 제품 상세: `/product/?id=식물id` (예: `/product/?id=ficus-trichocarpa`). 목록의 식물 사진·이름, 검색 결과를 누르면 이 페이지로 갑니다.
  - 왼쪽 큰 사진 · 오른쪽 이름 · 학명 · 가격 · 수량 · 총 금액 · 구매하기 · 제품 정보, 맨 아래 경로(HOME / PLANT / 분류 / 이름) — 탬버린즈·무지개맨션 참고
  - `products.js`에 `images: ['…', '…']`(사진 여러 장), `desc: { ko, en, ja }`(설명), `stock`(최대 수량)을 넣으면 함께 보입니다.
- 주문/결제: `/checkout/?id=식물id&qty=수량` — 주문자 정보, 배송지(카카오 우편번호 찾기), 결제 수단(토스페이먼츠 결제위젯), 주문 금액
- 결제 결과: `/checkout/success/`, `/checkout/fail/`
- 설정은 `assets/js/shop.js` 맨 위 (`clientKey`, `confirmUrl`, `shippingFee`, `freeShippingOver`, `maxQty`)

### 지금은 테스트 결제 모드

`shop.js`의 키가 토스페이먼츠 개발 문서의 공용 테스트 키(`test_gck_docs_…`)라서 결제 화면은 실제와 같지만 **돈이 나가지 않고 주문도 접수되지 않습니다.** 페이지에 '테스트 결제 모드' 표시가 나옵니다.

### 실제 판매를 시작하려면

1. 사업자등록 · 통신판매업 신고
2. 토스페이먼츠 가맹 계약(심사) → 상점관리자 > 개발 정보의 **결제위젯 연동 키** 중 클라이언트 키(`live_gck_…`)를 `shop.js`의 `clientKey`에 넣기
3. **결제 승인 서버** 만들기 → 주소를 `confirmUrl`에 넣기. 결제창이 끝나면 이 서버가 시크릿 키로 토스페이먼츠 승인 API를 호출하고(10분 안에), 금액이 상품 가격과 맞는지 확인하고, 주문(주문자·배송지)을 저장합니다. 시크릿 키(`live_gsk_…`)는 **서버에만** 두고 사이트에는 절대 넣지 않습니다.
4. 하단에 사업자 정보(상호, 대표자, 사업자등록번호, 통신판매업 신고번호, 주소, 연락처)와 이용약관 · 개인정보처리방침 · 배송/교환/환불 안내 추가 (전자상거래법, 토스페이먼츠 심사에 필요)

## 언어 (한국어 · English · 日本語)

- 하단 `VIEW IN …` → 언어 설정 창에서 바꿉니다. 고른 언어는 브라우저에 저장되고, PC ↔ 모바일로 이동해도 유지됩니다.
- 처음 방문하면 브라우저 언어를 따릅니다 (한국어 → 한국어, 일본어 → 일본어, 그 외 → 영어).
- 화면 문구는 `assets/js/i18n.js`에 모여 있습니다. **PC·모바일 두 저장소의 파일이 같아야 하니 둘 다 고쳐 주세요.**
- 일본어는 Noto Sans JP, 한국어는 Noto Sans KR로 표시됩니다.
- 주소 끝에 `?lang=en`, `?lang=ja`, `?lang=ko`를 붙이면 그 언어로 바로 열리는 링크가 됩니다.

## 디자인 기준

- 앱과 같은 톤: 흰 배경, `#171717` 모노톤, 얇은 선, 각진 모서리, 대문자 라벨, 이탤릭 학명
- 로고: 앱의 PLANT MATTER 워드마크 원본(배경만 투명 처리), 파비콘은 워드마크의 `P`
- 서체: 영문·숫자 Figtree (300 / 700 / 큰 숫자 800), 한글 Noto Sans KR (300 / 700)

## 배포 (GitHub Pages, 저장소 2개)

### 1. PC 사이트
1. GitHub에서 새 저장소 `plantmatter-web` (Public) 생성
2. **uploading an existing file** → `plantmatter.kr` 폴더 **안의** 파일과 폴더를 모두 올리고 **Commit changes**
3. **Settings → Pages** → `Deploy from a branch` → `main` / `(root)` → Save
4. **Custom domain**에 `plantmatter.kr`이 들어 있는지 확인 (없으면 입력 후 Save)

### 2. 모바일 사이트
1. 새 저장소 `plantmatter-mobile` (Public) 생성
2. `m.plantmatter.kr` 폴더 **안의** 파일과 폴더를 모두 올리고 **Commit changes**
3. **Settings → Pages** → `Deploy from a branch` → `main` / `(root)` → Save
4. **Custom domain**에 `m.plantmatter.kr`이 들어 있는지 확인

### 3. 도메인 업체 DNS 설정
기본으로 들어 있는 주차(파킹) 페이지용 A 레코드나 웹 포워딩이 있으면 먼저 지우거나 끕니다. 그다음 아래 레코드를 추가합니다.

| 타입 | 호스트 | 값 |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | plantmatter.github.io |
| CNAME | m | plantmatter.github.io |

CNAME 값 끝에 점을 붙이라는 안내가 있으면 `plantmatter.github.io.`로 입력하세요.

### 4. HTTPS
DNS 반영(수 분 ~ 최대 하루) 후 두 저장소 모두 **Settings → Pages**에서 **Enforce HTTPS**를 켭니다.

## 내 컴퓨터에서 미리 보기

```bash
cd plantmatter.kr
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 을 엽니다. 모바일 사이트는 `m.plantmatter.kr` 폴더에서 같은 방법으로 실행하고, 브라우저 개발자 도구의 휴대폰 화면 모드로 보면 됩니다.
