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
- 홈: 사진 3장이 5초마다 자동으로 넘어가는 슬라이드 (아래 가는 막대를 누르면 그 사진으로, 휴대폰은 손가락으로 밀어서 넘김)
  - 사진 바꾸기: `assets/img/hero/`의 `hero-1~3.jpg`와 `.webp`를 같은 이름으로 교체 (PC·모바일 두 저장소 모두)
  - 넘어가는 간격: `assets/js/main.js`의 `SLIDE_INTERVAL` (밀리초, 기본 5000)
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

## PLANT 메뉴 (Tropical Plant · Orchid · Fern · Caudex)

- PC: PLANT에 마우스를 올리거나 누르면 아래로 펼쳐집니다. 모바일: 누르면 펼쳐지고 한 번 더 누르면 닫힙니다.
- 사진: `assets/img/menu/`에 세로 4:5 사진을 `orchid.jpg`, `fern.jpg`, `caudex.jpg`로 올리고, `index.html`의 해당 `<span class="mega__img"></span>` 안에 `<img src="assets/img/menu/파일명.jpg" alt="">`를 넣으면 됩니다. (PC·모바일 두 저장소 모두)
- 각 항목 페이지가 생기면 `href="#"`를 실제 주소로 바꾸고 `data-soon="…"`을 지우면 됩니다.

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
