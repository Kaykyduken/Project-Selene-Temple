# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# Prepara a textura da Lua 3D (modo Educational).
#
# O mapa de cores global do NASA SVS (CGI Moon Kit) tem só 2048 x 1024 pixels:
# perto do polo cada pixel cobre ~15 km e a imagem fica borrada, justo onde estão
# as regiões candidatas. Este script cria uma textura 4096 x 2048 que:
#   1. usa o mapa de cores global (ampliado) em todo o globo;
#   2. abaixo de 60°S mistura o detalhe do mosaico LROC WAC polar (o mesmo mapa-base
#      do site, ~0,9 km por pixel), sem perder a cor do mapa global:
#         resultado = cor_global * (WAC / WAC_suavizado)
#      ou seja, só o relevo e o brilho local vêm do WAC; a cor continua a da NASA.
#
# A projeção do mapa-base é a estereográfica polar sul. Como o sentido dos eixos
# do PNG é fácil de errar, o script testa as 8 orientações possíveis e fica com a
# que mais se parece com o mapa global na faixa de 62°S a 72°S (correlação).
#
# Uso (dentro da pasta pipeline/):
#     python prepare_globe_texture.py ../data/raw/moonkit/lroc_color_2k.jpg
# Saída: ../frontend/public/data/globe/moon_globe_4k.jpg

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from common.moon import MOON_RADIUS_M

ROOT = Path(__file__).resolve().parent.parent
BASEMAP_DIR = ROOT / "frontend" / "public" / "data" / "basemap"
OUT_DEFAULT = ROOT / "frontend" / "public" / "data" / "globe" / "moon_globe_4k.jpg"
WIDTH, HEIGHT = 4096, 2048
BLEND_START_LAT = -60.5   # onde o WAC começa a entrar
BLEND_FULL_LAT = -66.0    # a partir daqui o WAC entra por inteiro
BLUR_RADIUS_PX = 7        # suavização usada para separar "cor" de "detalhe"


def bilinear(image: np.ndarray, rows: np.ndarray, cols: np.ndarray) -> np.ndarray:
    """Amostra uma imagem (2D) em posições fracionárias; fora da imagem dá 0."""
    h, w = image.shape
    r0 = np.floor(rows).astype(int)
    c0 = np.floor(cols).astype(int)
    fr = rows - r0
    fc = cols - c0
    out = np.zeros(rows.shape, dtype=np.float64)
    for dr, wr in ((0, 1 - fr), (1, fr)):
        for dc, wc in ((0, 1 - fc), (1, fc)):
            r, c = r0 + dr, c0 + dc
            ok = (r >= 0) & (r < h) & (c >= 0) & (c < w)
            vals = np.zeros(rows.shape)
            vals[ok] = image[r[ok], c[ok]]
            out += vals * wr * wc
    return out


def blur(array: np.ndarray, radius: float) -> np.ndarray:
    """Desfoque gaussiano de uma matriz de 0 a 1 (via PIL, em 8 bits)."""
    img = Image.fromarray(np.clip(array * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float64) / 255.0


def pearson(a: np.ndarray, b: np.ndarray) -> float:
    a = a - a.mean()
    b = b - b.mean()
    return float((a * b).sum() / math.sqrt((a * a).sum() * (b * b).sum() + 1e-12))


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the 4k texture of the 3D Moon.")
    parser.add_argument("color_map", type=Path, help="global equirectangular color map (CGI Moon Kit)")
    parser.add_argument("--out", type=Path, default=OUT_DEFAULT)
    args = parser.parse_args()

    meta = json.loads((BASEMAP_DIR / "wac_south.json").read_text(encoding="utf-8"))
    half = meta["bounds_m"][2]  # metade do lado do mapa-base, em metros
    rgba = Image.open(BASEMAP_DIR / meta["image"]).convert("RGBA")
    size = rgba.size[0]
    wac = np.asarray(rgba.convert("L"), dtype=np.float64) / 255.0
    alpha = np.asarray(rgba.split()[3], dtype=np.float64) / 255.0

    base_img = Image.open(args.color_map).convert("RGB").resize((WIDTH, HEIGHT), Image.BICUBIC)
    base = np.asarray(base_img, dtype=np.float64) / 255.0
    luminance = base @ np.array([0.299, 0.587, 0.114])

    # Faixa de linhas abaixo de 60°S (até o polo).
    first_row = int((90 + BLEND_START_LAT) / 180 * HEIGHT)
    rows_idx = np.arange(first_row, HEIGHT)
    lat = 90 - (rows_idx + 0.5) * 180 / HEIGHT                  # graus, negativo
    lon = -180 + (np.arange(WIDTH) + 0.5) * 360 / WIDTH         # graus, leste positivo
    LAT, LON = np.meshgrid(np.radians(lat), np.radians(lon), indexing="ij")
    rho = 2 * MOON_RADIUS_M * np.tan((math.pi / 2 - np.abs(LAT)) / 2)   # estereográfica: r = 2R tan((90°-|lat|)/2)

    def sample(order: str, sx: int, sy: int) -> tuple[np.ndarray, np.ndarray]:
        a, b = (np.sin(LON), np.cos(LON)) if order == "sin_cos" else (np.cos(LON), np.sin(LON))
        x, y = sx * rho * a, sy * rho * b
        cols = (x + half) / (2 * half) * size - 0.5
        rows = (half - y) / (2 * half) * size - 0.5
        return bilinear(wac, rows, cols), bilinear(alpha, rows, cols)

    # Escolhe a orientação que mais combina com o mapa global entre 62°S e 72°S.
    band = (lat < -62) & (lat > -72)
    reference = blur(luminance[first_row:], 4)[band]
    best = None
    for order in ("sin_cos", "cos_sin"):
        for sx in (1, -1):
            for sy in (1, -1):
                w, _ = sample(order, sx, sy)
                score = pearson(blur(w, 4)[band], reference)
                print(f"  orientação {order} sx={sx:+d} sy={sy:+d}: correlação {score:+.3f}")
                if best is None or score > best[0]:
                    best = (score, order, sx, sy)
    score, order, sx, sy = best
    print(f"Escolhida: {order} sx={sx:+d} sy={sy:+d} (correlação {score:+.3f})")
    if score < 0.3:
        print("Correlação baixa: confira a imagem antes de usar.", file=sys.stderr)

    w, a = sample(order, sx, sy)
    # A potência 0,65 suaviza o contraste: o mapa-base do site foi esticado para o mapa 2D e fica duro na esfera.
    ratio = np.clip(w / np.maximum(blur(w, BLUR_RADIUS_PX), 0.04), 0.35, 2.5) ** 0.65
    weight = np.clip((BLEND_START_LAT - lat) / (BLEND_START_LAT - BLEND_FULL_LAT), 0, 1)
    weight = (weight * weight * (3 - 2 * weight))[:, None] * a      # suave nas bordas e fora do mapa-base

    detailed = np.clip(base[first_row:] * ratio[..., None], 0, 1)
    base[first_row:] = base[first_row:] * (1 - weight[..., None]) + detailed * weight[..., None]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((base * 255 + 0.5).astype(np.uint8)).save(args.out, quality=88)
    print(f"Salvo em {args.out} ({args.out.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
