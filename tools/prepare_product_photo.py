#!/usr/bin/env python3
"""PLANT MATTER — 상품 사진 준비 도구

사진마다 다른 흰 배경의 밝기·색감(구석 그늘, 위아래 그늘, 누런/푸른 기)을
같은 순백(#ffffff)으로 고르게 맞추고 (식물·화분·그림자의 밝기와 결은 그대로 — 흰 화분도 날아가지 않음), 모든 식물이 화면에서 같은 비율로 보이도록
흰 여백을 늘리거나 줄여 세로 3:4(750×1000) JPG로 저장합니다. 아래쪽 그라데이션은 사이트(CSS)가 모든 사진에 똑같이 넣습니다.

사용법:
    python3 tools/prepare_product_photo.py 원본.jpg assets/img/products/식물이름.jpg
    (선택) --fx 0.45  : 가로 위치를 직접 지정 (0=왼쪽 … 1=오른쪽, 기본은 식물 위치 자동)
    (선택) --zoom 1.25: 식물을 더 크게 (1보다 크면 확대, 가장자리는 잘릴 수 있음)
                      --zoom 0.7 처럼 1보다 작으면 축소하고 순백 여백을 더함
    (선택) --fy 0.52  : 확대할 때 세로 위치를 직접 지정 (0=위 … 1=아래)
    (선택) --size 1.15: 자동 맞춤은 그대로 두고 이 식물만 조금 크게(1.15 = 가로·세로 15%) / 작게(0.9)
    (선택) --bg f4f4f2 : 순백 대신 이 색의 단색 배경 (화분·협업 제품용, 아주 밝은 회색)
                      순백으로 고른 뒤 사진 전체에 이 색을 곱함 → 배경은 정확히 이 색, 제품 색은 거의 그대로(4% 정도)
                      이렇게 만든 제품은 products.js 에 plain: true 를 넣어 사이트의 아래쪽 그라데이션도 빼 주세요
    (선택) --match-tone : 검은 화분 · 금색(놋쇠) 태그 · 손(피부)의 톤을 아래 POT_TONE · BRASS_TONE · SKIN_TONE 기준으로 맞춤
                      — 여러 사진의 블랙 · 금색 · 피부색을 통일. 배경은 그대로, 경계는 부드럽게 (--pot-tone 도 같은 뜻)
    옵션 없이 실행하면 자동으로 크기·위치를 맞춥니다 (권장). 옵션을 주면 그 값대로 직접 자릅니다.

필요한 것: Python 3, Pillow, NumPy  (pip install pillow numpy)
"""
import argparse
import warnings
import numpy as np
from PIL import Image, ImageFilter

GRID = 32          # 배경 밝기를 재는 칸 수 (세로 기준)
KNEE = (238, 248)  # 이 사이 밝기는 순백 쪽으로 부드럽게 올림, 248 이상은 순백 (식물 색인 238 미만은 그대로)
OUT_W, OUT_H = 750, 1000
# 기본 모드: 모든 식물이 '피커스 sp. 무룽 라야' 사진과 같은 비율로 보이도록 크기를 맞춤
#   → 식물(잎·줄기)이 화면에서 차지하는 면적을 무룽 라야와 같게 하고, 같은 자리에 둠
FIT_COVER = 0.085           # 무룽 라야: 식물이 화면의 8.5%를 차지 (2026-11 한 단계 축소, 이전 10.4%)
FIT_CX, FIT_CY = 0.50, 0.51 # 무룽 라야: 식물 중심이 가로 50%, 세로 51% 지점
# --match-tone 기준 — THICHIのBUCOTSU鉢 BOWL LONG-4 · MID-4 · MID-5 세 사진의 평균 (2026-11). 새 화분 사진도 이 톤에 맞춰짐
#   POT_TONE  : 검은 화분 면의 밝기(Y) 10% · 50% · 90% 지점과 색 기운(Cb, Cr)
#   BRASS_TONE: 금색(놋쇠) 태그의 밝기 10% · 50% · 90% 지점과 색 기운
#   SKIN_TONE : 빛을 받은 피부(밝기 150 이상)의 평균 밝기와 색 기운 — 그늘진 손바닥은 같은 비율로 따라감
POT_TONE = {'y10': 18.0, 'y50': 33.0, 'y90': 65.3, 'cb': -0.55, 'cr': 0.98}
BRASS_TONE = {'y10': 83.3, 'y50': 113.0, 'y90': 158.3, 'cb': -25.68, 'cr': 18.08}
SKIN_TONE = {'y': 203.0, 'cb': -17.24, 'cr': 21.18}   # 원래(노란 기운) 와 붉게 고친 값의 딱 중간 (2026-11 요청)


def _fill_missing(grid):
    """배경이 거의 없는 칸(식물·흙)은 주변 칸 값으로 채움."""
    g = grid.copy()
    for _ in range(200):
        nan = np.isnan(g[..., 0])
        if not nan.any():
            break
        padded = np.pad(g, ((1, 1), (1, 1), (0, 0)), constant_values=np.nan)
        neigh = np.stack([padded[1 + dy:1 + dy + g.shape[0], 1 + dx:1 + dx + g.shape[1]]
                          for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx])
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)   # 주변이 전부 비어 있는 칸은 다음 차례에 채움
            mean = np.nanmean(neigh, axis=0)
        g[nan] = mean[nan]
    return g


def _blur(grid, passes=3):
    g = grid
    for _ in range(passes):
        p = np.pad(g, ((1, 1), (1, 1), (0, 0)), mode='edge')
        g = sum(p[1 + dy:1 + dy + g.shape[0], 1 + dx:1 + dx + g.shape[1]]
                for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0
    return g


def _subject_box(lum, chroma, W, H):
    """식물·화분·그림자가 있는 범위(약간 여유) — 이 안은 배경 밝기를 재지 않음."""
    obj = (lum < 215) | (chroma > 28)
    ys, xs = np.where(obj)
    box = np.zeros((H, W), bool)
    if len(xs):
        x1, x2 = np.percentile(xs, [0.5, 99.5])
        y1, y2 = np.percentile(ys, [0.5, 99.5])
        px, py = 0.04 * W, 0.04 * H
        box[int(max(0, y1 - py)):int(min(H, y2 + py)), int(max(0, x1 - px)):int(min(W, x2 + px))] = True
    return box


def _surface(points, values, W, H):
    """칸마다 잰 배경 밝기를 매끄러운 3차 곡면으로 이어 붙임 (튀는 칸은 빼고 다시 맞춤)."""
    def design(x, y):
        return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y, x ** 3, y ** 3, x * x * y, x * y * y], axis=-1)
    A = design(points[:, 0], points[:, 1])
    keep = np.ones(len(points), bool)
    for _ in range(3):
        coef, *_ = np.linalg.lstsq(A[keep], values[keep], rcond=None)
        err = np.abs(A @ coef - values).max(axis=1)
        keep = err < max(3.0, np.percentile(err[keep], 90))
    yy, xx = np.mgrid[0:H, 0:W]
    return design((xx + .5) / W, (yy + .5) / H) @ coef


def _grid_field(a, bg):
    """예전 방식: 칸마다 배경 밝기 → 빈 칸 채우기 → 흐리게 (피사체가 화면을 거의 채운 사진용)."""
    H, W, _ = a.shape
    gh = GRID
    gw = max(1, round(GRID * W / H))
    grid = np.full((gh, gw, 3), np.nan, np.float32)
    for i in range(gh):
        for j in range(gw):
            ys = slice(i * H // gh, (i + 1) * H // gh)
            xs = slice(j * W // gw, (j + 1) * W // gw)
            m = bg[ys, xs]
            if m.mean() > 0.3:
                grid[i, j] = np.percentile(a[ys, xs][m], 85, axis=0)
    if np.isnan(grid).all():
        return None
    grid = _blur(_fill_missing(grid), passes=2)
    return np.stack([np.asarray(Image.fromarray(grid[..., c]).resize((W, H), Image.BILINEAR))
                     for c in range(3)], axis=2)


def flatten_background(img):
    """흰 배경의 밝기·색감을 순백으로 고름. 식물·화분·그림자의 밝기와 결은 그대로 둠.
    1) 배경 밝기는 식물·화분에서 떨어진 바깥 배경에서만 재고, 그 사이(화분 뒤 등)는 매끄러운 곡면으로 추정
       → 반투명한 흰 화분이 '배경'으로 오해받아 하얗게 날아가지 않음
    2) 남은 얼룩을 순백으로 정리하는 단계(KNEE)는 식물·화분·그림자 주변을 피해서만 적용"""
    a = np.asarray(img).astype(np.float32)
    H, W, _ = a.shape
    lum = a.mean(axis=2)
    chroma = a.max(axis=2) - a.min(axis=2)
    bg = (lum > 185) & (chroma < 28)                     # 밝고 색이 거의 없는 곳 = 배경 후보
    outside = bg & ~_subject_box(lum, chroma, W, H)
    gh = GRID
    gw = max(1, round(GRID * W / H))
    pts, vals = [], []
    for i in range(gh):
        for j in range(gw):
            ys = slice(i * H // gh, (i + 1) * H // gh)
            xs = slice(j * W // gw, (j + 1) * W // gw)
            m = outside[ys, xs]
            if m.mean() > 0.6:
                pts.append(((j + .5) / gw, (i + .5) / gh))
                vals.append(np.percentile(a[ys, xs][m], 85, axis=0))
    if len(pts) >= 20:
        field = _surface(np.array(pts), np.array(vals), W, H)
    else:                                                 # 피사체가 화면을 거의 채운 경우
        field = _grid_field(a, bg)
        if field is None:
            return img
    gain = np.clip(255.0 / np.maximum(field, 1), 1.0, 1.6)   # 어둡게는 하지 않음
    out = np.clip(a * gain, 0, 255)
    # 식물·화분·그림자와 그 주변은 순백 정리에서 제외 (부드럽게 경계)
    o_lum = out.mean(axis=2)
    o_chroma = out.max(axis=2) - out.min(axis=2)
    near = ((o_lum < 232) | (o_chroma > 16)).astype(np.uint8) * 255
    m = Image.fromarray(near).resize((max(1, W // 4), max(1, H // 4)), Image.BILINEAR)
    m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(4)).resize((W, H), Image.BILINEAR)
    protect = np.asarray(m).astype(np.float32)[..., None] / 255.0
    lo, hi = KNEE                                         # 남은 얼룩·질감을 순백으로 정리
    kneed = out.copy()
    k = (kneed > lo) & (kneed < 255)
    kneed[k] = np.minimum(255, lo + (kneed[k] - lo) * (255 - lo) / (hi - lo))
    res = kneed * (1 - protect) + out * protect
    return Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))


def fit_3x4(img, size=1.0):
    """식물이 차지하는 면적을 무룽 라야와 같게 키우거나 줄이고, 남는 곳은 순백 여백으로 채움."""
    W, H = img.size
    a = np.asarray(img.convert('L'))
    ys, xs = np.where(a < 200)
    if not len(xs):
        return crop_3x4(img)
    x1, x2 = np.percentile(xs, [0.5, 99.5])                 # 작은 티끌은 무시
    y1, y2 = np.percentile(ys, [0.5, 99.5])
    fw = (0.75 * len(xs) / FIT_COVER) ** 0.5 / size         # 식물 면적 ÷ 화면 면적 = FIT_COVER 가 되는 화면 폭 (size 로 개별 조정)
    fh = fw / 0.75
    x0 = int(round((x1 + x2) / 2 - fw * FIT_CX))
    y0 = int(round((y1 + y2) / 2 - fh * FIT_CY))
    canvas = Image.new('RGB', (int(fw), int(fh)), (255, 255, 255))
    canvas.paste(img, (-x0, -y0))
    return canvas.resize((OUT_W, OUT_H), Image.LANCZOS)


def crop_3x4(img, fx=None, zoom=1.0, fy=None):
    W, H = img.size
    a = np.asarray(img.convert('L'))
    ys, xs = np.where(a < 200)
    if zoom != 1 and len(xs):
        # zoom > 1: 식물 무게중심을 가운데 두고 확대 (가장자리 잘릴 수 있음)
        # zoom < 1: 식물을 가운데 두고 축소 — 모자란 부분은 순백 여백으로 채움
        cw = int(min(W, H * 0.75) / zoom)
        ch = int(cw / 0.75)
        if zoom > 1:
            cx = xs.mean() if fx is None else fx * W
            cy = ys.mean() if fy is None else fy * H
        else:
            x1, x2 = np.percentile(xs, [0.5, 99.5])
            y1, y2 = np.percentile(ys, [0.5, 99.5])
            cx = (x1 + x2) / 2 if fx is None else fx * W
            cy = (y1 + y2) / 2 if fy is None else fy * H
        x0 = int(round(cx - cw / 2))
        y0 = int(round(cy - ch * (0.5 if zoom > 1 else 0.47)))   # 축소 시 식물을 살짝 위에 (무룽 라야와 같은 자리)
        if zoom > 1:
            x0 = min(max(x0, 0), W - cw)
            y0 = min(max(y0, 0), H - ch)
        canvas = Image.new('RGB', (cw, ch), (255, 255, 255))
        canvas.paste(img, (-x0, -y0))
        return canvas.resize((OUT_W, OUT_H), Image.LANCZOS)
    if fx is None:
        if len(xs):
            x1, x2 = np.percentile(xs, [0.5, 99.5])           # 작은 티끌은 무시
            cx = (x1 + x2) / 2
        else:
            cx = W / 2
    else:
        cx = fx * W
    if W / H > 0.75:
        cw = int(H * 0.75)
        x0 = int(min(max(cx - cw / 2, 0), W - cw))
        img = img.crop((x0, 0, x0 + cw, H))
    else:
        ch = int(W / 0.75)
        y0 = (H - ch) // 2
        img = img.crop((0, y0, W, y0 + ch))
    return img.resize((OUT_W, OUT_H), Image.LANCZOS)


def _soft(mask, radius):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255


def _to_rgb(Y, Cb, Cr):
    ycc = np.stack([Y, Cb + 128, Cr + 128], axis=-1)
    return np.asarray(Image.fromarray(np.clip(np.round(ycc), 0, 255).astype(np.uint8), 'YCbCr').convert('RGB'), dtype=np.float32)


def match_tones(img):
    """검은 화분 · 금색 태그 · 피부 톤을 기준(POT_TONE · BRASS_TONE · SKIN_TONE)에 맞춤. 배경 픽셀은 그대로.
    - 화분: 어둡고 색이 없는 면 → 밝기 분포(10·50·90%)와 색 기운을 기준에 맞춤
    - 태그: 색이 있고 사방이 검은 화분에 둘러싸인 곳 (화분 위쪽 70% 안) → 밝기 분포와 색 기운
    - 피부: 그 밖의 색 있는 곳 → 빛 받은 피부의 평균 밝기(비율로 곱함)와 색 기운"""
    rgb = np.asarray(img, dtype=np.float32)
    ycc = np.asarray(img.convert('YCbCr'), dtype=np.float32)
    Y, Cb, Cr = ycc[..., 0], ycc[..., 1] - 128, ycc[..., 2] - 128
    chroma = np.hypot(Cb, Cr)
    pot = (Y < 95) & (chroma < 10)
    if pot.mean() < 0.01:
        return img
    out = rgb.copy()

    # 1) 검은 화분 — 화분 면이 모여 있는 곳만 (손가락 사이 그늘 같은 외딴 점 · 밝거나 색 있는 픽셀은 제외)
    w = np.clip((_soft(pot, 6) - 0.35) / 0.4, 0, 1) * np.clip((120 - Y) / 30, 0, 1) * np.clip((18 - chroma) / 8, 0, 1)
    t = POT_TONE
    p10, p50, p90 = np.percentile(Y[pot], [10, 50, 90])
    fixed = _to_rgb(np.interp(Y, [0, p10, p50, p90, 255], [0, t['y10'], t['y50'], t['y90'], 255]),
                    Cb + (t['cb'] - Cb[pot].mean()), Cr + (t['cr'] - Cr[pot].mean()))
    out += w[..., None] * (fixed - out)

    # 2) 금색 태그 — 사방(좌우 위아래)이 화분에 둘러싸인 색 있는 곳
    potd = _soft(pot, 6) > 0.35
    rows = np.where(potd.sum(1) > 0.2 * potd.sum(1).max())[0]
    top, bot = rows.min(), rows.max()
    inside = (np.maximum.accumulate(potd, axis=1) & np.maximum.accumulate(potd[:, ::-1], axis=1)[:, ::-1]
              & np.maximum.accumulate(potd, axis=0) & np.maximum.accumulate(potd[::-1], axis=0)[::-1]
              & (np.arange(Y.shape[0])[:, None] < top + 0.7 * (bot - top)))
    colored = (chroma >= 12) & (Y > 25) & (Y < 250)
    color_gate = np.clip((chroma - 6) / 6, 0, 1)            # 흰 배경 쪽으로는 번지지 않게
    brass = colored & inside & (Y > 60)
    if brass.mean() > 0.002:
        bw = np.clip((_soft(brass, 4) - 0.3) / 0.4, 0, 1) * color_gate
        t = BRASS_TONE
        p10, p50, p90 = np.percentile(Y[brass], [10, 50, 90])
        fixed = _to_rgb(np.interp(Y, [0, p10, p50, p90, 255], [0, t['y10'], t['y50'], t['y90'], 255]),
                        Cb + (t['cb'] - Cb[brass].mean()), Cr + (t['cr'] - Cr[brass].mean()))
        out += bw[..., None] * (fixed - out)
    else:
        bw = np.zeros_like(Y)

    # 3) 피부 — 태그가 아닌 색 있는 곳. 빛 받은 피부의 평균에 맞추고 그늘은 같은 비율로
    skin = colored & ~inside & (bw < 0.05)
    lit = skin & (Y > 150)
    if lit.sum() > 500:
        sw = np.clip((_soft(skin, 4) - 0.3) / 0.4, 0, 1) * color_gate * (1 - bw)
        t = SKIN_TONE
        gain = t['y'] / Y[lit].mean()
        fixed = _to_rgb(Y * gain, Cb + (t['cb'] - Cb[lit].mean()), Cr + (t['cr'] - Cr[lit].mean()))
        out += sw[..., None] * (fixed - out)

    return Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8))


match_pot_tone = match_tones   # 예전 이름


def tint_background(img, hex_color):
    """순백(#fff) 배경을 단색으로: 사진 전체에 그 색을 곱함 (흰색 → 그 색, 어두운 부분은 거의 그대로, 경계 번짐 없음)"""
    h = hex_color.lstrip('#')
    rgb = np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0
    a = np.asarray(img, dtype=np.float32) * rgb
    return Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--fx', type=float, default=None)
    ap.add_argument('--zoom', type=float, default=1.0)
    ap.add_argument('--fy', type=float, default=None)
    ap.add_argument('--size', type=float, default=1.0)
    ap.add_argument('--bg', default=None, help='단색 배경 (예: f4f4f2)')
    ap.add_argument('--match-tone', '--pot-tone', dest='match_tone', action='store_true', help='검은 화분 · 금색 태그 · 피부 톤을 기준으로 통일')
    args = ap.parse_args()
    img = Image.open(args.src).convert('RGB')
    flat = flatten_background(img)
    manual = args.fx is not None or args.fy is not None or args.zoom != 1.0
    out = crop_3x4(flat, args.fx, args.zoom, args.fy) if manual else fit_3x4(flat, args.size)
    if args.match_tone:
        out = match_tones(out)
    if args.bg:
        out = tint_background(out, args.bg)
    out.save(args.dst, quality=84, optimize=True, progressive=True)
    print(f'saved {args.dst} ({out.size[0]}x{out.size[1]})')


if __name__ == '__main__':
    main()
