# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# M1: "abrir o DEM em Python".
# Abre um modelo de elevação (DEM) do LOLA e mostra o que tem dentro:
# projeção, tamanho, resolução, estatísticas e a altura num ponto escolhido.
# Serve para confirmar que o arquivo baixado está bom ANTES de calcular horizonte.
#
# Uso (dentro da pasta pipeline/):
#     python open_dem.py ../data/raw/dem/LDEM_85S_20M.JP2
#     python open_dem.py ../data/raw/dem/arquivo.tif --lat -89.5 --lon 45
#
# Aceita GeoTIFF (.tif, produtos do PGDA) e GeoJPEG2000 (.JP2, produtos do PDS).

import argparse
import sys
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer

from common.moon import MOON_GEOGRAPHIC, MOON_RADIUS_M

# Para arquivos grandes, as estatísticas são calculadas numa versão reduzida
# (no máximo este número de pixels de largura). Ler 1 GB inteiro só para ver o
# mínimo e o máximo seria lento e gastaria muita memória.
MAX_PREVIEW_PX = 2048


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect a LOLA DEM file.")
    parser.add_argument("dem", type=Path, help="Path to the DEM file (.tif or .JP2)")
    parser.add_argument("--lat", type=float, default=-89.5, help="Test point latitude (deg)")
    parser.add_argument("--lon", type=float, default=0.0, help="Test point longitude (deg)")
    args = parser.parse_args()

    if not args.dem.exists():
        print(f"Arquivo não encontrado: {args.dem}")
        return 1

    try:
        ds = rasterio.open(args.dem)
    except rasterio.errors.RasterioIOError as err:
        # O erro mais comum com .JP2 é o GDAL instalado não ter o driver JPEG2000.
        print(f"Não consegui abrir o arquivo: {err}")
        print("Se for .JP2, tente a versão .tif/.IMG do mesmo produto.")
        return 1

    with ds:
        print("=== Arquivo ===")
        print(f"Driver (formato):     {ds.driver}")
        print(f"Tamanho:              {ds.width} x {ds.height} pixels, {ds.count} banda(s)")
        print(f"Tipo de dado:         {ds.dtypes[0]}")
        print(f"Valor 'sem dado':     {ds.nodata}")
        # Alguns produtos guardam números inteiros que precisam ser convertidos:
        # altura_real = valor * escala + deslocamento. O GDAL lê isso do arquivo
        # quando disponível; se aparecer 1.0 e 0.0, o valor já está pronto.
        print(f"Escala / deslocamento: {ds.scales[0]} / {ds.offsets[0]}")

        print("\n=== Projeção ===")
        print(f"CRS: {ds.crs.to_proj4() if ds.crs else 'SEM PROJEÇÃO (problema!)'}")
        res_x, res_y = ds.res
        print(f"Resolução: {res_x:.2f} m x {res_y:.2f} m por pixel")
        b = ds.bounds
        print(f"Limites (m): x {b.left:.0f} a {b.right:.0f}, y {b.bottom:.0f} a {b.top:.0f}")

        if ds.crs is None:
            print("\nSem projeção não dá para localizar pontos. Confira o arquivo .LBL/.aux.")
            return 1

        # Confere se o raio da esfera do arquivo é o da Lua.
        radius = ds.crs.to_dict().get("R") or ds.crs.to_dict().get("a")
        if radius and abs(float(radius) - MOON_RADIUS_M) > 1:
            print(f"ATENÇÃO: raio do arquivo = {radius} m, esperado {MOON_RADIUS_M:.0f} m")

        # --- Estatísticas numa versão reduzida do raster ---
        factor = max(1, int(np.ceil(max(ds.width, ds.height) / MAX_PREVIEW_PX)))
        out_shape = (ds.height // factor, ds.width // factor)
        data = ds.read(1, out_shape=out_shape, masked=True).astype("float64")
        data = data * ds.scales[0] + ds.offsets[0]

        print(f"\n=== Valores (amostra reduzida {factor}x) ===")
        valid = data.compressed()
        if valid.size == 0:
            print("Nenhum valor válido na amostra.")
        else:
            print(f"Mínimo: {valid.min():.1f}   Máximo: {valid.max():.1f}   Média: {valid.mean():.1f}")
            print(f"Pixels sem dado na amostra: {100 * data.mask.mean():.1f}%")
            print("Unidade: confira a documentação do produto (geralmente metros em relação")
            print(f"à esfera de {MOON_RADIUS_M / 1000:.1f} km; alguns produtos PDS usam km).")

        # --- Altura num ponto específico ---
        # 1) converte latitude/longitude para metros na projeção do arquivo
        # 2) converte metros para linha/coluna do raster
        # 3) lê só aquele pixel (janela de 1x1), sem carregar o arquivo todo
        to_file = Transformer.from_crs(MOON_GEOGRAPHIC, ds.crs, always_xy=True)
        x, y = to_file.transform(args.lon, args.lat)
        row, col = ds.index(x, y)

        print(f"\n=== Ponto de teste ({args.lat}°, {args.lon}°) ===")
        print(f"Na projeção: x = {x:.0f} m, y = {y:.0f} m  →  linha {row}, coluna {col}")
        if 0 <= row < ds.height and 0 <= col < ds.width:
            window = rasterio.windows.Window(col, row, 1, 1)
            raw = ds.read(1, window=window, masked=True)[0, 0]
            if np.ma.is_masked(raw):
                print("Altura: sem dado nesse pixel")
            else:
                print(f"Altura: {float(raw) * ds.scales[0] + ds.offsets[0]:.1f}")
        else:
            print("O ponto está fora da área coberta por este arquivo.")

    print("\nDEM aberto com sucesso. ✔")
    return 0


if __name__ == "__main__":
    sys.exit(main())
