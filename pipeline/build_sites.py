# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# Monta a lista de regiões (frontend/public/data/sites.json) a partir das grades
# de navegação de 1 km do USGS para as 9 regiões candidatas da Artemis III.
#
# Cada shapefile é uma grade de quadradinhos de 1 km cobrindo a região. Aqui:
#   1. juntamos todos os quadradinhos num polígono só (o contorno da região)
#   2. pegamos o centro geométrico (centroide) desse polígono
#   3. convertemos tudo da projeção do USGS para latitude/longitude
#
# ATENÇÃO: o centro calculado é o centro da ÁREA da grade. Não é um ponto de
# pouso escolhido pela NASA. O site deixa isso escrito.
#
# Uso (dentro da pasta pipeline/):  python build_sites.py
# Espera os arquivos em data/raw/regions/<Regiao>/<Regiao>_PolarLGRS_ACC_1km_S_Grid.*

import argparse
import json
import sys
from pathlib import Path

import shapefile  # biblioteca "pyshp"
from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely.ops import unary_union

from common.moon import MOON_GEOGRAPHIC

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REGIONS = ROOT / "data" / "raw" / "regions"
OUT_FILE = ROOT / "frontend" / "public" / "data" / "sites.json"

# Pasta do USGS → (id usado no site, nome oficial do anúncio da NASA de 28/10/2024)
REGIONS = {
    "Peak_Near_Cabeus_B": ("peak-near-cabeus-b", "Peak near Cabeus B"),
    "Haworth": ("haworth", "Haworth"),
    "Malapert_Massif": ("malapert-massif", "Malapert Massif"),
    "Mons_Mouton_Plateau": ("mons-mouton-plateau", "Mons Mouton Plateau"),
    "Mons_Mouton": ("mons-mouton", "Mons Mouton"),
    "Nobile_Rim_1": ("nobile-rim-1", "Nobile Rim 1"),
    "Nobile_Rim_2": ("nobile-rim-2", "Nobile Rim 2"),
    "de_Gerlache_Rim_2": ("de-gerlache-rim-2", "de Gerlache Rim 2"),
    "Slater_Plain": ("slater-plain", "Slater Plain"),
}

SOURCE = ("Area centroid computed from the USGS 1 km navigational grids of the down-selected "
          "Artemis III candidate landing regions (doi:10.5066/P1MEQ6UK, CC0)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build sites.json from the USGS Artemis III grids.")
    parser.add_argument("--regions", type=Path, default=DEFAULT_REGIONS, help="Folder with one subfolder per region")
    args = parser.parse_args()

    sites = []
    for folder, (site_id, name) in REGIONS.items():
        base = args.regions / folder / f"{folder}_PolarLGRS_ACC_1km_S_Grid"
        if not base.with_suffix(".shp").exists():
            print(f"FALTANDO: {base}.shp")
            return 1

        # A projeção do arquivo vem do .prj (estereográfica polar do sistema LGRS,
        # com deslocamento de 500 km e fator de escala 0,994: diferente da do site!).
        crs = CRS.from_wkt(base.with_suffix(".prj").read_text())
        to_lonlat = Transformer.from_crs(crs, MOON_GEOGRAPHIC, always_xy=True)

        # 1) junta os quadradinhos de 1 km num polígono só
        reader = shapefile.Reader(str(base))
        cells = [shape(s.__geo_interface__) for s in reader.shapes()]
        area = unary_union(cells)
        if area.geom_type != "Polygon":
            area = area.convex_hull  # se vier em pedaços, usa o contorno externo

        # 2) centro e contorno, 3) convertidos para longitude/latitude
        lon, lat = to_lonlat.transform(area.centroid.x, area.centroid.y)
        outline = [
            [round(la, 4), round(lo, 4)]
            for lo, la in (to_lonlat.transform(x, y) for x, y in area.simplify(1.0).exterior.coords)
        ]

        sites.append({
            "id": site_id, "name": name,
            "lat_deg": round(lat, 4), "lon_deg": round(lon, 4),
            "area_km2": round(area.area / 1e6),  # área na grade do USGS (células de 1 km)
            "outline": outline,  # lista de [lat, lon] do contorno da região
        })
        print(f"{name:22s} {lat:9.4f} {lon:10.4f}  {len(cells):5d} células  {sites[-1]['area_km2']} km²")

    catalog = {
        "contract_version": "0.1",
        "note": "Region names: NASA news release, 2024-10-28. Each position is the centroid of the region's "
                "USGS grid area, not a NASA-selected landing point.",
        "sites": sites,
        "coordinate_origin": {"source": SOURCE, "class": "model", "verified": True},
    }
    OUT_FILE.write_text(json.dumps(catalog, indent=1), encoding="utf-8")
    print(f"Salvo em {OUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
