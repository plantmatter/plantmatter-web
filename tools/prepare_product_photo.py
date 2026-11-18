#!/usr/bin/env python3
"""PLANT MATTER — 상품 사진 준비 도구

사진마다 다른 흰 배경의 밝기·색감(구석 그늘, 위아래 그늘, 누런/푸른 기)을
같은 순백(#ffffff)으로 고르게 맞추고, 모든 식물이 화면에서 같은 비율로 보이도록
흰 여백을 늘리거나 줄여 세로 3:4(750×1000) JPG로 저장합니다. 아래쪽 그라데이션은 사이트(CSS)가 모든 사진에 똑같이 넣습니다.

사용법:
    python3 tools/prepare_product_photo.py 원본.jpg assets/img/products/식물이름.jpg
    (선택) --fx 0.45  : 가로 위치를 직접 지정 (0=왼쪽 … 1=오른쪽, 기본은 식물 위치 자동)
    (선택) --zoom 1.25: 식물을 더 크게 (1보다 크면 확대, 가장자리는 잘릴 수 있음)
                      --zoom 0.7 처럼 1보다 작으면 축소하고 순백 여백을 더함
    (선택) --fy 0.52  : 확대할 때 세로 위치를 직접 지정 (0=위 … 1=아래)
    옵션 없이 실행하면 자동으로 크기·위치를 맞춥니다 (권장). 옵션을 주면 그 값대로 직접 자릅니다.

필요한 것: Python 3, Pillow, NumPy  (pip install pillow numpy)
"""
import argparse
import warnings
import numpy as np
from PIL import Image

GRID = 32          # 배경 밝기를 재는 칸 수 (세로 기준)
KNEE = (238, 248)  # 이 사이 밝기는 순백 쪽으로 부드럽게 올림, 248 이상은 순백 (식물 색인 238 미만은 그대로)
OUT_W, OUT_H = 750, 1000
# 기본 모드: 모든 식물이 '피커스 sp. 무룽 라야' 사진과 같은 비율로 보이도록 크기를 맞춤
#   → 식물(잎·줄기)이 화면에서 차지하는 면적을 무룽 라야와 같게 하고, 같은 자리에 둠
FIT_COVER = 0.104           # 무룽 라야: 식물이 화면의 10.4%를 차지
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


def flatten_background(img):
    a = np.asarray(img).astype(np.float32)
    H, W, _ = a.shape
    lum = a.mean(axis=2)
    chroma = a.max(axis=2) - a.min(axis=2)
    bg = (lum > 185) & (chroma < 28)                     # 밝고 색이 거의 없는 곳 = 배경
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
        return img
    grid = _blur(_fill_missing(grid), passes=2)
    field = np.stack([np.asarray(Image.fromarray(grid[..., c]).resize((W, H), Image.BILINEAR))
                      for c in range(3)], axis=2)
    gain = np.clip(255.0 / np.maximum(field, 1), 1.0, 1.6)   # 어둡게는 하지 않음
    out = np.clip(a * gain, 0, 255)
    lo, hi = KNEE                                         # 남은 얼룩·질감을 순백으로 정리
    knee = (out > lo) & (out < 255)
    out[knee] = np.minimum(255, lo + (out[knee] - lo) * (255 - lo) / (hi - lo))
    return Image.fromarray(out.astype(np.uint8))


def fit_3x4(img):
    """식물이 차지하는 면적을 무룽 라야와 같게 키우거나 줄이고, 남는 곳은 순백 여백으로 채움."""
    W, H = img.size
    a = np.asarray(img.convert('L'))
    ys, xs = np.where(a < 200)
    if not len(xs):
        return crop_3x4(img)
    x1, x2 = np.percentile(xs, [0.5, 99.5])                 # 작은 티끌은 무시
    y1, y2 = np.percentile(ys, [0.5, 99.5])
    fw = (0.75 * len(xs) / FIT_COVER) ** 0.5                # 식물 면적 ÷ 화면 면적 = FIT_COVER 가 되는 화면 폭
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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--fx', type=float, default=None)
    ap.add_argument('--zoom', type=float, default=1.0)
    ap.add_argument('--fy', type=float, default=None)
    args = ap.parse_args()
    img = Image.open(args.src).convert('RGB')
    flat = flatten_background(img)
    manual = args.fx is not None or args.fy is not None or args.zoom != 1.0
    out = crop_3x4(flat, args.fx, args.zoom, args.fy) if manual else fit_3x4(flat)
    out.save(args.dst, quality=84, optimize=True, progressive=True)
    print(f'saved {args.dst} ({out.size[0]}x{out.size[1]})')


if __name__ == '__main__':
    main()
