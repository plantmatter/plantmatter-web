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

- 상단 바: PLANT MATTER 워드마크 · PLANT / MATTER / COLLABORATION / CONTACT 탭 · 검색 / 내 정보 / 장바구니 아이콘
- 홈: 사진 4장이 6초마다 자동으로 넘어가는 슬라이드 (아래 가는 막대를 누르면 그 사진으로, 휴대폰은 손가락으로 밀어서 넘김)
  - 사진 바꾸기: `assets/img/hero/`의 `hero-1~4.jpg`와 `.webp`를 같은 이름으로 교체 (PC·모바일 두 저장소 모두)
  - 넘어가는 간격: `assets/js/main.js`의 `SLIDE_INTERVAL` (밀리초, 기본 6000)
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

> **지금은 관리자 페이지(/admin/)에서 제품을 올리고 고칩니다.** 아래 products.js 는 예비 목록입니다.
>
> **가격 기준:** 제품을 올릴 때는 네이버 스마트스토어 **https://smartstore.naver.com/plant_matter** 의 판매가를 그대로 씁니다.
> 운영자가 따로 금액 정정을 요청한 경우에만 그 금액으로 바꿉니다. 스토어에 아직 없는 제품은 `price: null` ('가격 문의').

1. 사진을 도구로 정리합니다 — 흰 배경의 밝기·색감을 모든 사진이 같은 순백이 되도록 맞추고, **식물 크기와 위치를 '피커스 sp. 무룽 라야' 사진과 같은 비율로** 맞춰(흰 여백을 늘리거나 줄임) 세로 3:4(750×1000)로 저장합니다.
   ```bash
   python3 tools/prepare_product_photo.py 원본사진.jpg assets/img/products/new-plant.jpg
   ```
   (Python과 `pip install pillow numpy` 필요. 아래쪽 그라데이션은 사이트가 모든 사진에 똑같이 넣으므로 사진에는 넣지 않습니다.)
   화분째 찍은 사진도 화분·식물·그림자의 밝기와 결은 그대로 두고 바깥 배경만 순백으로 고릅니다(흰 화분이 날아가지 않음).
   특정 식물만 조금 크게/작게 보이게 하려면 끝에 `--size 1.15`(15% 크게) 또는 `--size 0.9`(10% 작게)를 붙입니다. 트리코카르파는 `--size 1.15`, 스페클리니아 그로비 #1·#2는 `--size 1.2`·`--size 1.07`로 만들었습니다.
2. `assets/js/products.js`에 한 묶음을 추가합니다 — 분류, 이름(한·영·일), 학명, 가격(원, 미정이면 `null` → "가격 문의"), 판매 상태(`available` / `soldout`), 사진 경로.
3. PC·모바일 두 저장소에 똑같이 올립니다.
- 지금 등록된 식물: 피커스 sp. ‘무룽 라야’ (₩22,000), 피커스 푼타타 Ficus punctata (₩60,000), 피커스 트리코카르파 Ficus trichocarpa (₩120,000), 스페클리니아 그로비 #1·#2 Specklinia grobyi (Orchid, 동일 상품 배송, 각 ₩110,000)

## 제품 상세 · 주문/결제

- 제품 상세: `/product/?id=식물id` (예: `/product/?id=ficus-trichocarpa`). 목록의 식물 사진·이름, 검색 결과를 누르면 이 페이지로 갑니다.
  - 왼쪽 큰 사진 · 오른쪽 이름 · 학명 · 가격 · 수량 · 총 금액 · 장바구니에 담기 / 구매하기 · 제품 정보, 맨 아래 경로(HOME / PLANT / 분류 / 이름) — 탬버린즈·무지개맨션 참고
  - `products.js`에 `images: ['…', '…']`(사진 여러 장), `desc: { ko, en, ja }`(설명), `stock`(최대 수량)을 넣으면 함께 보입니다.
- 주문/결제: `/checkout/?id=식물id&qty=수량` — 주문자 정보, 배송지(카카오 우편번호 찾기), 결제 수단(토스페이먼츠 결제위젯), 주문 금액 (바로 구매)
  - `/checkout/?from=cart` — 장바구니에 담긴 식물을 한 번에 주문 (주문명은 '첫 식물 외 n건')
- 장바구니: 상단 가방 아이콘을 누르면 오른쪽에서 열림 (탬버린즈 참고) — `assets/js/cart.js`
  - 목록 카드의 가방 버튼, 제품 상세의 **장바구니에 담기**로 담음 → 장바구니가 바로 열리고 아이콘에 개수 표시
  - 수량 변경(+/− 또는 숫자 직접 입력) · 삭제 · 합계 · 주문하기. 결제가 끝나면 주문한 식물은 장바구니에서 빠짐
  - 제품 상세·장바구니 수량은 숫자를 직접 입력할 수도 있음 (최대 `shop.js`의 `maxQty`, 지금 9개). 한 개체뿐인 식물(`stock: 1`)은 1개까지만 담기고 입력 칸 없음. 품절·가격 미정이 되면 장바구니에 표시만 되고 주문에서 빠짐
  - 지금은 그 기기·브라우저에만 저장됨 (`localStorage` 'pm-cart'). 회원 기기 간 동기화는 아직 없음
- 결제 결과: `/checkout/success/`, `/checkout/fail/`
- 설정은 `assets/js/shop.js` 맨 위 (`clientKey`, `confirmUrl`, `shippingFee`, `freeShippingOver`, `maxQty`)

### 지금은 테스트 결제 모드

`shop.js`의 키가 토스페이먼츠 개발 문서의 공용 테스트 키(`test_gck_docs_…`)라서 결제 화면은 실제와 같지만 **돈이 나가지 않고 주문도 접수되지 않습니다.** 페이지에 '테스트 결제 모드' 표시가 나옵니다.

### 실제 판매를 시작하려면

1. 사업자등록 · 통신판매업 신고
2. 토스페이먼츠 가맹 계약(심사) → 상점관리자 > 개발 정보의 **결제위젯 연동 키** 중 클라이언트 키(`live_gck_…`)를 `shop.js`의 `clientKey`에 넣기
3. **결제 승인 서버** 만들기 → 주소를 `confirmUrl`에 넣기. 결제창이 끝나면 이 서버가 시크릿 키로 토스페이먼츠 승인 API를 호출하고(10분 안에), 금액이 상품 가격과 맞는지 확인하고, 주문(주문자·배송지)을 저장합니다. 시크릿 키(`live_gsk_…`)는 **서버에만** 두고 사이트에는 절대 넣지 않습니다.
4. 하단에 사업자 정보(상호, 대표자, 사업자등록번호, 통신판매업 신고번호, 주소, 연락처)와 이용약관 · 개인정보처리방침 · 배송/교환/환불 안내 추가 (전자상거래법, 토스페이먼츠 심사에 필요)

## 로그인 · 회원 (/account/)

- **PLANT MATTER 앱(plantmatter/plantmatter-app)과 같은 Supabase 프로젝트·같은 계정**을 씁니다. 앱에서 이메일로 가입한 계정으로 웹에 로그인되고, 웹에서 가입한 계정으로 앱에도 로그인됩니다.
  - 연결 값(Project URL · Publishable key)은 `assets/js/auth.js` 맨 위 `CONFIG` — 앱의 `.env`(EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY)와 **같은 값**이어야 합니다. 시크릿·service_role 키는 절대 넣지 않습니다.
  - 가입 확인 · 비밀번호 찾기는 앱과 같이 **메일로 받은 6자리 코드**를 입력합니다 (앱 README 1-5의 메일 템플릿).
  - 앱에서 Apple로만 가입한 계정은 비밀번호가 없어서, 웹에서는 '비밀번호 찾기'로 비밀번호를 만든 뒤 로그인합니다.
  - 이름·휴대폰·배송지·동의 기록은 `shop_customers` 테이블에 저장되고 **본인만** 읽을 수 있습니다. 앱의 테이블은 건드리지 않습니다.
- 페이지: `/account/`(로그인 ↔ 마이페이지), `/account/signup/`(회원가입 → 코드 입력), `/account/reset/`(코드 + 새 비밀번호)
- 상단의 사람 아이콘 → `/account/`. 주문/결제에서 로그인하면 저장된 정보가 자동으로 채워집니다(비회원 주문도 가능).
- 파일: `assets/js/auth.js`(연결), `account.js`(화면), `form.js`(입력 검사), `postcode.js`(주소 찾기), `assets/vendor/supabase-2.118.0.js`(Supabase 라이브러리)

### 처음 한 번 해야 할 설정 (앱이 쓰는 Supabase 프로젝트에서)

1. **SQL Editor**에서 `supabase/web01_shop_customers.sql` 전체를 붙여 넣고 실행 → 회원 정보 테이블과 저장 기능이 생깁니다.
   이어서 `supabase/web02_name_change_limit.sql`도 실행 → 회원 이름 변경 제한(처음 정한 이름 제외, 2번까지는 바로, 그 뒤로는 마지막 변경 후 60일).
   그리고 `supabase/web03_shop_addresses.sql`도 실행 → 추가 배송지(기본 배송지 외 2곳, 본인만 보기·서버에서 2곳 제한).
   마지막으로 `supabase/web04_member_id_identity.sql` 실행 → '이름'이 '아이디'(2~20자, 겹치지 않게)로 바뀌고, 본인인증으로 채울 이름·생년월일·성별 칸이 생깁니다. 주민등록번호는 저장하지 않고 생년월일·성별로 `900101-1******` 모양만 보여 줍니다(개인정보 보호법 제24조의2).
2. 메일 발송 서버(SMTP)와 코드 메일 템플릿은 앱 설정(앱 README 1-5, 1-6)을 그대로 함께 씁니다.

- 아직 없는 것: 회원 탈퇴(앱 계정도 함께 지워지므로 안내와 함께 따로 만들 예정), 주문 내역(결제 승인 서버 연결 후)

## 관리자 페이지 (/admin/) — 제품 · 재고 · 문의 관리

- 관리자 계정으로 로그인 → **마이페이지 아래 [관리자 페이지]** 또는 `/admin/` (검색엔진 비노출)
  - 관리자 = 앱과 같은 관리자 명단 `public.app_admins` (지금: plantmatter.biz@gmail.com). 앱의 MATTER 행사 · 매장 등록 권한도 같음
  - 관리자 추가: Supabase SQL Editor 에서
    `insert into public.app_admins (user_id) select id from auth.users where lower(email) = lower('이메일') on conflict do nothing;`
- **PRODUCTS**: 가격 · 재고 · 상태(판매 중 / 품절 / 숨김)를 고치고 그 줄의 [저장] → 사이트에 바로 반영
  - 재고 0 = SOLD OUT, 비우면 수량 관리 안 함, 재고가 있으면 한 번에 그 수까지만 구매 가능
  - ↑ ↓ 로 목록 순서, [편집] 으로 이름(한·영·일) · 구분(PLANT 분류 / COLLABORATION) · 학명 또는 모델명 · 동일 상품 배송 · 단색 배경 · 설명 · 사진
  - **+ 새 제품**: 사진은 세로 3:4(750×1000)로 가운데 기준 자동 맞춤만 됨 → 배경 정리 · 톤 보정은 `tools/prepare_product_photo.py` 로 한 사진을 올리기
  - 지우기 대신 '숨김'을 권장 (주문 기록과 맞추기 위해)
- **B2B · COLLAB**: 도매 문의 · 협업 제안 목록 (메일 발송 실패도 표시), 사업자등록증 열기(2분짜리 임시 링크), 지우기
- 데이터: Supabase `shop_products` 표 · `product-images` 공개 버킷 (`supabase/web08_admin_products.sql`)
  - 사이트는 이 표를 읽고(약 0.1~0.3초), 못 읽으면 `assets/js/products.js` 의 예비 목록을 씀
  - 권한은 서버(RLS)가 확인: 누구나 읽기(숨김 제외), 고치기 · 문의 보기는 관리자만
- 아직 없음: 결제 완료 시 재고 자동 차감 · 주문 관리 → 실결제(토스 가맹 + 결제 승인 서버) 붙일 때 함께

## PRODUCT (/products/)

- 상단 탭 순서: PLANT · **PRODUCT** · COLLAB · CONTACT · MATTER (COLLAB 페이지 주소는 그대로 `/collaboration/`)
- PLANT 와 같은 형식: 상단 **PRODUCT** 탭의 아래로 열리는 메뉴(BASE Series · ORIGIN) + `/products/` 페이지(ALL · 각 항목 탭, 옆으로 넘기는 애니메이션)
  (제품 상세는 `/product/?id=…` 라서 목록 페이지 주소는 복수형 `/products/`)
- 항목은 `assets/js/layout.js` 의 `PRODUCT_LINES`, 제품은 관리자 페이지에서 **구분 → PRODUCT › BASE Series / ORIGIN** 으로 등록 (표의 `line` 칸 — `supabase/web09_product_lines.sql`)
- ALL 은 모든 PRODUCT 제품. 제품이 없으면 '제품을 준비하고 있습니다'

## MATTER (/matter/)

- 지금은 하위 항목 없음 (BASE Series · ORIGIN 은 PRODUCT 로 옮김). 상단 MATTER 탭은 내려오는 메뉴 없이 `/matter/` 로 바로 이동하고, 페이지는 제목 MATTER · '준비하고 있습니다'
- `assets/js/layout.js` 의 `MATTERS` 에 항목을 넣으면 내려오는 메뉴와 페이지 탭이 다시 생김 (제품은 관리자 페이지 구분 → MATTER, 표의 `matter` 칸)
- PRODUCT · MATTER · COLLABORATION 페이지는 같은 스크립트 `assets/js/group.js` 를 씀 (`<main data-group="product | matter | collab">`)

## COLLABORATION (/collaboration/)

- PLANT 와 같은 형식: 상단 **COLLABORATION** 탭에 마우스를 올리면(모바일은 누르면) 아래로 메뉴가 열리고, 탭을 누르면 `/collaboration/` 페이지
- 페이지: 제목 · 분류 탭(ALL · 각 협업) · 옆으로 넘기는 애니메이션 — `assets/js/group.js`
  - ALL: 협업 카드 목록 / 각 협업(`/collaboration/?c=gecko-in-the-library`): 지금은 '소개를 준비하고 있습니다'
- 항목(이름 · 메뉴 썸네일 3:4)은 `assets/js/layout.js` 의 `COLLABS` 에서 추가·수정 (PC·모바일 두 저장소 모두)
  - 지금: GECKO IN THE LIBRARY (사진 없음 → 회색 칸), THICHI YUIITSUMUNI (메뉴 사진 = BOWL LONG - 4)
- 각 협업의 제품: `products.js` 에 `collab: 'thichi-yuiitsumuni'` 로 추가 → 그 탭에 PLANT 와 같은 카드로 나옴 (PLANT 목록에는 안 나옴)
  - 둘째 줄은 학명 대신 `sub` (예: 'BOWL LONG - 4'), 상세의 정보에는 '모델' · '협업'
  - 사진: 단색 아주 밝은 회색 배경 · 그라데이션 없음 → `python3 tools/prepare_product_photo.py 원본.jpg assets/img/products/이름.jpg --zoom 1.0 --fy 0.5 --match-tone --bg f4f4f2` 후 `plain: true`
    (`--zoom 1.0` = 확대 없이 원본 가로 전체를 쓰고 3:4 에 맞게 위아래 빈 배경만 조금 자름 · `--match-tone` = 검은 화분 · 금색 태그 · 손(피부) 톤을 THICHI 3점 평균(POT_TONE · BRASS_TONE · SKIN_TONE)에 맞춤, 배경은 그대로)

## CONTACT · B2B(도매) 문의 · COLLAB(협업 제안) (/contact/)

- 분류 탭 **B2B** (`/contact/?c=b2b`) · **COLLAB** (`/contact/?c=collab`) — PLANT 목록의 분류 탭과 같은 모양
- **COLLAB 협업 제안**: 업체 또는 개인명, 이메일, 협업 유형, 제안 내용, 관련 링크(선택), 개인정보 동의(필수)
  → 표 `collab_proposals` 에 저장(`supabase/web07_collab_proposals.sql`) + 메일 "[협업 제안] 이름 · 유형" (답장 → 제안한 분).
    받는 주소는 `WHOLESALE_TO`, 협업 제안만 다른 곳으로 받으려면 Secrets 에 `COLLAB_TO` 추가
- 아래는 **B2B 도매 문의** 설명입니다.


- 상단 **CONTACT** 탭 → 도매 문의 양식: 업체명, 담당자 성함, 이메일, 휴대폰 번호, 업종(선택), 문의 내용(선택), **사업자등록증 파일**(PDF·JPG·PNG·HEIC·WEBP, 10MB 이하), 개인정보 수집·이용 동의(필수)
- 보내면 → Supabase Edge Function `wholesale-inquiry` (`supabase/functions/wholesale-inquiry/index.ts`)가
  1. 내용을 다시 확인하고 (같은 곳에서 1시간 5건까지, 자동 프로그램 걸러 냄)
  2. 사업자등록증(사업자 확인은 이 첨부로)을 비공개 저장소 `wholesale-docs`, 내용을 표 `wholesale_inquiries`에 저장 (사이트 공개 키로는 읽기·쓰기 불가)
  3. **운영자에게 메일** (`noreply@plantmatter.kr` → `WHOLESALE_TO`, 사업자등록증 첨부). 메일에 **답장하면 문의한 분에게** 바로 갑니다.
  4. 1년 지난 문의·파일은 새 문의가 들어올 때 지웁니다 (동의 문구의 보유 기간과 같음)
- 저장된 문의 보기: Supabase 대시보드 › Table Editor › `wholesale_inquiries`, 파일은 Storage › `wholesale-docs`. 메일이 안 갔으면 `email_error` 칸에 이유가 남습니다.
- 양식 위에 연락처(이메일·전화·카카오톡·인스타그램·응대 시간)를 함께 보이려면 `assets/js/contact.js` 맨 위 `CONTACT`에 넣기 (비워 두면 안 보임)

### 처음 한 번 설정 (끝남)
1. `supabase/web05_wholesale_inquiries.sql` → `web06_wholesale_optional_fields.sql` 실행 — 표 · 비공개 버킷
2. 함수 배포: Management API `functions/deploy?slug=wholesale-inquiry`, `verify_jwt: false` (또는 `supabase functions deploy wholesale-inquiry --no-verify-jwt`)
3. Supabase 대시보드 › Edge Functions › **Secrets** (https://supabase.com/dashboard/project/qssrtzvipwvxcfszxomo/functions/secrets)
   - `RESEND_API_KEY` — Resend › API Keys › Create (Sending access, 도메인 plantmatter.kr)
   - `WHOLESALE_TO` — 문의를 받을 이메일 (여러 개면 쉼표). 받는 주소를 바꿀 때도 여기서만 바꾸면 됩니다.
   - 둘 중 하나라도 없으면 양식에 '지금은 온라인 문의를 받을 수 없습니다'가 나옵니다.

## 언어 (한국어 · English · 日本語)

- 하단 `VIEW IN …` → 언어 설정 창에서 바꿉니다. 고른 언어는 브라우저에 저장되고, PC ↔ 모바일로 이동해도 유지됩니다.
- 처음 방문하면 브라우저 언어를 따릅니다 (한국어 → 한국어, 일본어 → 일본어, 그 외 → 영어).
- 화면 문구는 `assets/js/i18n.js`에 모여 있습니다. **PC·모바일 두 저장소의 파일이 같아야 하니 둘 다 고쳐 주세요.**
- 일본어는 Noto Sans JP, 한국어는 Noto Sans KR로 표시됩니다.
- 주소 끝에 `?lang=en`, `?lang=ja`, `?lang=ko`를 붙이면 그 언어로 바로 열리는 링크가 됩니다.

### 일본어 주소 (/ja/…) · 공유 미리보기

- 링크를 공유할 때 미리보기(카카오톡 · LINE · 인스타그램 등)에 나오는 글은 앱이 **주소마다** 페이지 안의 글을 읽어 가는 것이라,
  화면 언어만 바꿔서는 바뀌지 않습니다. 그래서 일본어로 볼 때는 주소 앞에 `/ja`가 붙습니다 (`plantmatter.kr/ja/plant/`).
  - 한국어 · 영어: 원래 주소 · 미리보기 글 **Different Plants and Matter**
  - 일본어: `/ja/…` 주소 · 미리보기 글 **他にはない希少な植物と、他にはない多彩な素材** (제목은 PLANT MATTER プラントマター)
- `/ja/…` 링크로 들어오면 일본어로 열리고, 언어를 바꾸면 주소의 `/ja`도 함께 붙거나 떨어집니다 (`assets/js/layout.js` 맨 위).
- `ja/` 폴더의 페이지는 **`python3 tools/make_ja_pages.py` 가 만듭니다** — 페이지(HTML)를 고친 뒤에는 PC · 모바일 저장소에서 각각 꼭 다시 실행하세요.
  `ja/` 폴더는 직접 고치지 마세요(실행할 때마다 통째로 새로 씀). 일본어 문구는 그 파일 맨 위 `JA_TAGLINE`.
- 일본 쪽에 직접 알릴 때는 `https://plantmatter.kr/ja/` 주소를 쓰면 됩니다.

## 디자인 기준

- 앱과 같은 톤: 흰 배경, `#171717` 모노톤, 얇은 선, 각진 모서리, 대문자 라벨, 이탤릭 학명
- 로고: 앱의 PLANT MATTER 워드마크 원본(배경만 투명 처리), 파비콘은 워드마크의 `P`
- 서체: 영문·숫자 Figtree (300 / 700 / 큰 숫자 800), 한글 Noto Sans KR (300 / 700)

## 배포 (GitHub Pages, 저장소 2개)

> **고친 내용을 올릴 때마다** 모든 페이지의 `?v=` 값과 루트의 `version.txt`를 같은 새 값으로 바꿔 주세요.
> 페이지(HTML)를 고쳤다면 올리기 전에 `python3 tools/make_ja_pages.py` 도 실행해 일본어 주소 페이지(`ja/`)를 다시 만들어 주세요.
> 예전에 받아 둔 페이지를 브라우저가 잠깐 다시 쓰더라도, 페이지가 `version.txt`와 비교해 스스로 한 번 새로고침합니다 (`assets/js/layout.js` 맨 위). 결제 페이지는 제외.

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
