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
    args = ap.parse_args()
    img = Image.open(args.src).convert('RGB')
    flat = flatten_background(img)
    manual = args.fx is not None or args.fy is not None or args.zoom != 1.0
    out = crop_3x4(flat, args.fx, args.zoom, args.fy) if manual else fit_3x4(flat, args.size)
    if args.bg:
        out = tint_background(out, args.bg)
    out.save(args.dst, quality=84, optimize=True, progressive=True)
    print(f'saved {args.dst} ({out.size[0]}x{out.size[1]})')


if __name__ == '__main__':
    main()
