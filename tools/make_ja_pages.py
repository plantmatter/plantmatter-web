#!/usr/bin/env python3
"""PLANT MATTER — 일본어 주소(/ja/…) 페이지 만들기

일본어로 보다가 링크를 공유하면 미리보기(카카오톡 · LINE · 인스타그램 등)에 일본어 문구가 나오도록,
모든 페이지를 ja/ 폴더에 한 벌 더 만듭니다. 내용은 똑같고 공유 미리보기 글(제목 · 소개 문구 · 언어)만 일본어입니다.
한국어 · 영어는 원래 주소(/plant/ 등) 그대로이고, 일본어로 볼 때만 주소가 /ja/plant/ 처럼 바뀝니다 (assets/js/layout.js).

▸ 페이지(HTML)를 고치거나 새로 만든 뒤에는 꼭 다시 실행하세요. ja/ 폴더는 이 스크립트가 통째로 새로 씁니다(직접 고치지 마세요).
    python3 tools/make_ja_pages.py
  PC(plantmatter-web)와 모바일(plantmatter-mobile) 저장소에 같은 파일이 있으니 각 저장소에서 실행해 주세요.

▸ 일본어 소개 문구를 바꾸려면 아래 JA_TAGLINE 을 고치고(한국어 · 영어는 각 페이지의 og:description),
  assets/js/i18n.js 의 ja → description 도 같게 맞춰 주세요.
"""
import os
import re
import shutil
import sys

JA_TAGLINE = '他にはない希少な植物と、他にはない多彩な素材'
JA_SITE = 'PLANT MATTER プラントマター'

# 페이지 제목(한국어) → 일본어. 영어 제목(PLANT — PLANT MATTER 등)은 그대로
TITLES = {
    'PLANT MATTER 플랜트매터': JA_SITE,
    '로그인 — PLANT MATTER': 'ログイン — PLANT MATTER',
    '회원가입 — PLANT MATTER': '会員登録 — PLANT MATTER',
    '비밀번호 찾기 — PLANT MATTER': 'パスワード再設定 — PLANT MATTER',
    '주문/결제 — PLANT MATTER': 'ご注文手続き — PLANT MATTER',
    '결제 결과 — PLANT MATTER': '決済結果 — PLANT MATTER',
}
SKIP_DIRS = {'.git', '.github', 'ja', 'assets', 'tools', 'supabase', 'node_modules'}
SKIP_FILES = {'404.html'}   # 없는 주소는 모두 이 한 장 (/ja/… 이면 일본어로 보임)
SITES = ('https://plantmatter.kr', 'https://m.plantmatter.kr')

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
is_pc = open(os.path.join(root, 'CNAME'), encoding='utf-8').read().strip() == 'plantmatter.kr'


def page_path(rel):
    """'plant/index.html' → '/plant/'"""
    d = os.path.dirname(rel).replace(os.sep, '/')
    return '/' + (d + '/' if d else '')


def to_ja_url(m):
    return m.group(1) + '/ja' + m.group(2)


def hreflang(path):
    """검색엔진에 '같은 페이지의 일본어판은 /ja/…' 라고 알려 줌 (PC 사이트만 · 모바일은 PC 주소를 대표로 씀)"""
    base = SITES[0] + path
    ja = SITES[0] + '/ja' + path
    return (f'  <link rel="alternate" hreflang="ko" href="{base}">\n'
            f'  <link rel="alternate" hreflang="en" href="{base}">\n'
            f'  <link rel="alternate" hreflang="ja" href="{ja}">\n'
            f'  <link rel="alternate" hreflang="x-default" href="{base}">\n')


def set_hreflang(html, path):
    html = re.sub(r'  <link rel="alternate" hreflang="[^"]+" href="[^"]*">\n', '', html)
    if not is_pc:
        return html
    m = re.search(r'  <link rel="canonical" href="[^"]*">\n', html)
    if not m:
        return html
    return html[:m.end()] + hreflang(path) + html[m.end():]


def make_ja(html):
    html = html.replace('<html lang="ko">', '<html lang="ja">', 1)
    # 대표 주소 · 공유 주소 · PC↔모바일 연결 주소 → /ja/…
    for attr in (r'<link rel="canonical" href="', r'<meta property="og:url" content="', r'<link rel="alternate" media="[^"]*" href="'):
        html = re.sub(r'(' + attr + r'(?:' + '|'.join(map(re.escape, SITES)) + r'))(/[^"]*)', to_ja_url, html)
    # 소개 문구
    html = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + f'{JA_SITE} — {JA_TAGLINE}', html)
    html = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m.group(1) + JA_TAGLINE, html)
    # 제목
    for ko, ja in TITLES.items():
        html = html.replace(f'<title>{ko}</title>', f'<title>{ja}</title>')
        html = html.replace(f'<meta property="og:title" content="{ko}">', f'<meta property="og:title" content="{ja}">')
    # 언어 표시: 일본어가 기본, 한국어 · 영어가 다른 언어
    html = html.replace('<meta property="og:locale" content="ko_KR">', '<meta property="og:locale" content="ja_JP">')
    html = html.replace('<meta property="og:locale:alternate" content="ja_JP">', '<meta property="og:locale:alternate" content="ko_KR">')
    return html


def main():
    out_root = os.path.join(root, 'ja')
    if os.path.isdir(out_root):
        shutil.rmtree(out_root)
    pages = []
    for d, dirs, files in os.walk(root):
        rel_d = os.path.relpath(d, root)
        if rel_d == '.':
            dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if not f.endswith('.html') or (rel_d == '.' and f in SKIP_FILES):
                continue
            pages.append(os.path.normpath(os.path.join(rel_d, f)))
    for rel in sorted(pages):
        src = os.path.join(root, rel)
        html = open(src, encoding='utf-8').read()
        path = page_path(rel)
        html = set_hreflang(html, path)
        open(src, 'w', encoding='utf-8').write(html)
        ja = set_hreflang(make_ja(html), path)
        dst = os.path.join(out_root, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, 'w', encoding='utf-8').write(ja)
        print('ja/' + rel.replace(os.sep, '/'))

    # 검색엔진용 사이트 목록에 일본어 첫 페이지 추가 (PC만 · 이미 있으면 그대로)
    sm = os.path.join(root, 'sitemap.xml')
    if is_pc and os.path.exists(sm):
        s = open(sm, encoding='utf-8').read()
        loc = '<loc>https://plantmatter.kr/ja/</loc>'
        if loc not in s:
            m = re.search(r'  <url>\n    <loc>https://plantmatter\.kr/</loc>\n(    <lastmod>[^<]*</lastmod>\n)?  </url>\n', s)
            entry = f'  <url>\n    {loc}\n' + ((m.group(1) or '') if m else '') + '  </url>\n'
            s = s.replace('</urlset>', entry + '</urlset>')
            open(sm, 'w', encoding='utf-8').write(s)
    print(f'{len(pages)} pages → ja/', file=sys.stderr)


if __name__ == '__main__':
    main()
