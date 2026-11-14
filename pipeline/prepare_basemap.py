# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# Prepara o mapa-base do site (a imagem de fundo do polo sul) a partir de uma
# imagem OFICIAL da Lua. Aceita dois tipos de entrada:
#
#   A) Mapa global "equiretangular" (largura = 2x altura), como o do NASA SVS
#      CGI Moon Kit. Cada pixel é um par longitude/latitude; o centro da imagem
#      é a longitude 0°. Esses arquivos não trazem projeção gravada dentro.
#        python prepare_basemap.py ../data/raw/moonkit/lroc_color_2k.jpg
#
#   B) Raster já georreferenciado (GeoTIFF/IMG com projeção), como o mosaico
#      LROC WAC do polo sul.
#        python prepare_basemap.py ../data/raw/wac/WAC_GLOBAL_P900S0000_100M.TIF
#
# Nos dois casos o script:
#   1. lê uma versão reduzida da imagem (sem carregar tudo na memória)
#   2. reprojeta para a MESMA projeção do mapa do site (estereográfica polar sul)
#   3. ajusta o contraste e salva um PNG
#   4. salva um JSON dizendo onde a imagem fica no mapa (limites em metros)
#
# Saída: frontend/public/data/basemap/wac_south.png e wac_south.json

import argparse
import json
import math
import sys
import warnings
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.errors import NotGeoreferencedWarning
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds

from common.moon import MOON_GEOGRAPHIC, MOON_RADIUS_M, MOON_SOUTH_POLAR_STEREO, SOUTH_POLAR_STEREO_PROJ4

DEFAULT_OUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data" / "basemap"

# Texto de crédito mostrado no canto do mapa, conforme o tipo de entrada.
CREDIT_EQUIRECT = "Moon color map: NASA's Scientific Visualization Studio (CGI Moon Kit, LRO/LROC data)"
CREDIT_GEOREF = "LROC WAC mosaic: NASA/GSFC/Arizona State University"

# Latitude da borda do mapa-base quando a entrada é global.
EDGE_LAT_DEG = -60.0


def polar_radius_m(lat_deg: float) -> float:
    """Distância do polo sul, em metros no mapa, de um ponto na latitude dada.

    Fórmula da estereográfica polar: r = 2R * tan((90° - |lat|) / 2).
    Para -60° dá ~931 km.
    """
    return 2 * MOON_RADIUS_M * math.tan(math.radians((90 - abs(lat_deg)) / 2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the web base map of the lunar south pole.")
    parser.add_argument("image", type=Path, help="Global equirectangular image or georeferenced raster")
    parser.add_argument("--size", type=int, default=2048, help="Output image size in pixels (square)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR, help="Output folder")
    parser.add_argument("--credit", type=str, default=None, help="Attribution text (overrides the default)")
    args = parser.parse_args()

    if not args.image.exists():
        print(f"Arquivo não encontrado: {args.image}")
        return 1

    # JPG/TIF comuns não têm projeção; o rasterio avisa disso, mas aqui é esperado.
    warnings.simplefilter("ignore", NotGeoreferencedWarning)

    with rasterio.open(args.image) as src:
        bands = [1, 2, 3] if src.count >= 3 else [1]  # colorida ou tons de cinza

        if src.crs is None:
            # --- Caso A: mapa global equiretangular ---
            if abs(src.width / src.height - 2) > 0.01:
                print("A imagem não tem projeção e não é 2:1; não sei como posicioná-la.")
                return 1
            print(f"Entrada global equiretangular: {src.width} x {src.height} px")
            src_crs = MOON_GEOGRAPHIC
            # Só precisamos da faixa sul (de -90° até um pouco acima de -60°).
            # A imagem inteira vai de +90° (linha 0) a -90° (última linha).
            north_lat = EDGE_LAT_DEG + 2
            first_row = int((90 - north_lat) / 180 * src.height)
            window = rasterio.windows.Window(0, first_row, src.width, src.height - first_row)
            data = src.read(bands, window=window).astype("float32")
            # Posição desse recorte no mundo: longitude -180..180, latitude -90..north_lat.
            src_transform = from_bounds(-180, -90, 180, north_lat, data.shape[2], data.shape[1])
            r = polar_radius_m(EDGE_LAT_DEG)
            xmin, ymin, xmax, ymax = -r, -r, r, r
            credit = CREDIT_EQUIRECT
        else:
            # --- Caso B: raster georreferenciado ---
            print(f"Entrada georreferenciada: {src.width} x {src.height} px, CRS: {src.crs.to_proj4()}")
            src_crs = src.crs
            # Leitura reduzida (~2x o tamanho final) para não carregar centenas de MB.
            factor = max(1, int(np.ceil(max(src.width, src.height) / (args.size * 2))))
            shape = (src.height // factor, src.width // factor)
            data = src.read(bands, out_shape=(len(bands), *shape), masked=True,
                            resampling=Resampling.average).astype("float32").filled(np.nan)
            src_transform = src.transform * src.transform.scale(src.width / shape[1], src.height / shape[0])
            xmin, ymin, xmax, ymax = transform_bounds(src.crs, MOON_SOUTH_POLAR_STEREO, *src.bounds, densify_pts=101)
            credit = CREDIT_GEOREF

    # Reprojeção: para cada pixel da imagem de saída, o rasterio calcula de onde
    # ele vem na imagem de entrada e interpola a cor.
    dst_transform = from_bounds(xmin, ymin, xmax, ymax, args.size, args.size)
    dst = np.full((len(bands), args.size, args.size), np.nan, dtype="float32")
    for i in range(len(bands)):
        reproject(
            source=data[i], destination=dst[i],
            src_transform=src_transform, src_crs=src_crs, src_nodata=np.nan,
            dst_transform=dst_transform, dst_crs=MOON_SOUTH_POLAR_STEREO, dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )

    valid_mask = np.isfinite(dst).all(axis=0)
    if src_crs == MOON_GEOGRAPHIC:
        # Entrada global: corta em círculo na latitude da borda (fica redondo, não quadrado).
        ys, xs = np.mgrid[0:args.size, 0:args.size]
        px = xmin + (xs + 0.5) * (xmax - xmin) / args.size
        py = ymax - (ys + 0.5) * (ymax - ymin) / args.size
        valid_mask &= np.hypot(px, py) <= polar_radius_m(EDGE_LAT_DEG)
    if not valid_mask.any():
        print("A reprojeção não gerou nenhum pixel válido. Confira a imagem de entrada.")
        return 1

    # Contraste: os percentis 1% e 99% viram preto e branco. O mesmo ajuste vale
    # para os três canais, para não mudar as cores.
    low, high = np.percentile(dst[:, valid_mask], [1, 99])
    if high <= low:  # imagem toda de uma cor só: evita divisão por zero
        low, high = low - 1, low + 1
    scaled = np.nan_to_num(np.clip((dst - low) / (high - low), 0, 1), nan=0.0)
    rgb = (scaled * 255).astype("uint8")
    if len(bands) == 1:
        rgb = np.repeat(rgb, 3, axis=0)
    alpha = np.where(valid_mask, 255, 0).astype("uint8")  # fora da área fica transparente
    rgba = np.dstack([rgb[0], rgb[1], rgb[2], alpha])

    args.out.mkdir(parents=True, exist_ok=True)
    image_path = args.out / "wac_south.png"
    Image.fromarray(rgba, mode="RGBA").save(image_path, optimize=True)

    info = {
        "image": image_path.name,
        "bounds_m": [round(v, 3) for v in (xmin, ymin, xmax, ymax)],
        "crs": SOUTH_POLAR_STEREO_PROJ4,
        "source": args.credit or credit,
        "input_file": args.image.name,
        "fictitious": False,
    }
    (args.out / "wac_south.json").write_text(json.dumps(info, indent=2), encoding="utf-8")

    print(f"Mapa-base salvo em {image_path} ({image_path.stat().st_size / 1e6:.1f} MB)")
    print(f"Limites (km): x {xmin / 1000:.0f} a {xmax / 1000:.0f}, y {ymin / 1000:.0f} a {ymax / 1000:.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
