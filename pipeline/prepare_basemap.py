# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# M1: prepara o mapa-base do site a partir do mosaico LROC WAC do polo sul.
#
# O arquivo original tem centenas de MB, grande demais para um site. Este script:
#   1. lê uma versão reduzida do raster (sem carregar tudo na memória)
#   2. reprojeta para a MESMA projeção do mapa do site (estereográfica polar sul)
#   3. ajusta o contraste e salva um PNG em tons de cinza
#   4. salva um JSON dizendo onde a imagem fica no mapa (limites em metros)
#
# Uso (dentro da pasta pipeline/):
#     python prepare_basemap.py ../data/raw/wac/WAC_GLOBAL_P900S0000_100M.TIF
#
# Saída: frontend/public/data/basemap/wac_south.png e wac_south.json

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds

from common.moon import MOON_SOUTH_POLAR_STEREO, SOUTH_POLAR_STEREO_PROJ4

DEFAULT_OUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data" / "basemap"
SOURCE_TEXT = "LROC WAC mosaic: NASA/GSFC/Arizona State University"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the web base map from the LROC WAC south polar mosaic.")
    parser.add_argument("wac", type=Path, help="Path to the WAC GeoTIFF / IMG")
    parser.add_argument("--size", type=int, default=2048, help="Output image size in pixels (square)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR, help="Output folder")
    args = parser.parse_args()

    if not args.wac.exists():
        print(f"Arquivo não encontrado: {args.wac}")
        return 1

    with rasterio.open(args.wac) as src:
        if src.crs is None:
            print("O arquivo não tem projeção definida; não dá para posicionar no mapa.")
            return 1
        print(f"Entrada: {src.width} x {src.height} px, CRS: {src.crs.to_proj4()}")

        # 1) Leitura reduzida: lemos ~2x o tamanho final, o suficiente para a
        #    reprojeção não perder nitidez. "average" faz a média dos pixels
        #    agrupados, que dá uma imagem reduzida mais limpa.
        factor = max(1, int(np.ceil(max(src.width, src.height) / (args.size * 2))))
        small_shape = (src.height // factor, src.width // factor)
        small = src.read(1, out_shape=small_shape, masked=True, resampling=Resampling.average)
        small_transform = src.transform * src.transform.scale(
            src.width / small_shape[1], src.height / small_shape[0]
        )

        # 2) Área de destino: os limites do arquivo convertidos para a nossa
        #    projeção, num quadrado de args.size x args.size pixels.
        xmin, ymin, xmax, ymax = transform_bounds(src.crs, MOON_SOUTH_POLAR_STEREO, *src.bounds, densify_pts=101)
        dst_transform = from_bounds(xmin, ymin, xmax, ymax, args.size, args.size)
        dst = np.full((args.size, args.size), np.nan, dtype="float32")

        reproject(
            source=small.filled(np.nan).astype("float32"),
            destination=dst,
            src_transform=small_transform,
            src_crs=src.crs,
            src_nodata=np.nan,
            dst_transform=dst_transform,
            dst_crs=MOON_SOUTH_POLAR_STEREO,
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )

    # 3) Contraste: os percentis 1% e 99% viram preto e branco. Isso evita que
    #    poucos pixels muito claros (ou muito escuros) deixem a imagem apagada.
    valid = dst[np.isfinite(dst)]
    if valid.size == 0:
        print("A reprojeção não gerou nenhum pixel válido. Confira a projeção do arquivo.")
        return 1
    low, high = np.percentile(valid, [1, 99])
    gray = np.clip((dst - low) / (high - low), 0, 1)
    gray = np.nan_to_num(gray, nan=0.0)
    alpha = np.where(np.isfinite(dst), 255, 0).astype("uint8")  # "sem dado" fica transparente
    rgba = np.dstack([(gray * 255).astype("uint8")] * 3 + [alpha])

    # 4) Salva a imagem e o JSON lido por frontend/src/map/basemap.ts.
    args.out.mkdir(parents=True, exist_ok=True)
    image_path = args.out / "wac_south.png"
    Image.fromarray(rgba, mode="RGBA").save(image_path, optimize=True)

    info = {
        "image": image_path.name,
        "bounds_m": [round(v, 3) for v in (xmin, ymin, xmax, ymax)],
        "crs": SOUTH_POLAR_STEREO_PROJ4,
        "source": SOURCE_TEXT,
        "input_file": args.wac.name,
        "fictitious": False,
    }
    (args.out / "wac_south.json").write_text(json.dumps(info, indent=2), encoding="utf-8")

    size_mb = image_path.stat().st_size / 1e6
    print(f"Mapa-base salvo em {image_path} ({size_mb:.1f} MB)")
    print(f"Limites (km): x {xmin / 1000:.0f} a {xmax / 1000:.0f}, y {ymin / 1000:.0f} a {ymax / 1000:.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
