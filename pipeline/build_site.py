# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# M4/M5: gera o arquivo de dados REAL de uma região, no formato do contrato v0.1.
# Junta as duas metades do cálculo:
#   horizon.py  → o horizonte real do local (relevo do LOLA)
#   horizons.py → onde o Sol e a Terra estão no céu a cada hora (JPL Horizons)
# e decide, hora a hora:  visível  ⇔  elevação do astro > horizonte naquele azimute
#
# Precisa de internet (consulta o Horizons) e do DEM em data/raw/dem/.
#
# Uso (dentro da pasta pipeline/):
#     python build_site.py --site malapert-massif
#     python build_site.py --all --start 2027-01-01 --days 30
#
# Saída: frontend/public/data/sites/<id>.json com "fictitious": false

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

import horizon as hz
import horizons as jpl

OUT_DIR = hz.ROOT / "frontend" / "public" / "data" / "sites"


def longest_run_hours(flags: list[bool], step_min: int) -> float:
    """Maior sequência seguida de 'True', convertida em horas."""
    longest = run = 0
    for flag in flags:
        run = run + 1 if flag else 0
        longest = max(longest, run)
    return round(longest * step_min / 60, 1)


def build(site: dict, origin: dict, dem: Path, start: str, days: int, step_min: int,
          observer_height_m: float, radius_km: float, fetch_series=jpl.sun_earth_series) -> dict:
    lat, lon = site["lat_deg"], site["lon_deg"]

    # 1) Horizonte real do local
    sampler = hz.DemSampler(dem, lat, lon, radius_km * 1000)
    ground = sampler.ground_height()
    if np.isnan(ground):
        raise ValueError(f"{site['name']}: o ponto está fora da área coberta por {dem.name}")
    mask = hz.compute_horizon(sampler.heights, lat, lon, ground, observer_height_m, radius_km * 1000)

    # 2) Posições do Sol e da Terra (a altitude do observador entra em km)
    stop = (datetime.fromisoformat(start) + timedelta(days=days)).strftime("%Y-%m-%d")
    ephem = fetch_series(lat, lon, start, stop, step_min, (ground + observer_height_m) / 1000)

    # 3) Visibilidade: compara a elevação do astro com o horizonte no MESMO azimute
    series = []
    for row in ephem["series"]:
        point = {"t_utc": row["t_utc"]}
        for body in ("sun", "earth"):
            az, el = row[body]["az_deg"], row[body]["el_deg"]
            limit = float(hz.horizon_at(mask["elevation_deg"], az))
            point[body] = {"az_deg": round(az, 3), "el_deg": round(el, 3),
                           "horizon_deg": round(limit, 3),          # altura do relevo naquela direção
                           "visible": bool(el > limit)}
        series.append(point)

    # 4) Métricas
    sun = [p["sun"]["visible"] for p in series]
    earth = [p["earth"]["visible"] for p in series]

    def metric(value):
        # "estimate": vale para ESTE período e ESTA altura de observador.
        return {"value": value, "class": "estimate", "source": "lola+horizons"}

    return {
        "contract_version": "0.1",
        "site": {**{k: v for k, v in site.items() if k != "outline"},
                 "observer_height_m": observer_height_m,
                 "ground_height_m": round(ground, 1),
                 "coordinate_origin": origin},
        "period": {"start_utc": series[0]["t_utc"], "end_utc": series[-1]["t_utc"], "step_min": step_min},
        "horizon": {
            "azimuth_step_deg": 1,
            "elevation_deg": [round(float(v), 3) for v in mask["elevation_deg"]],
            "blocker_distance_km": [round(float(v) / 1000, 2) for v in mask["blocker_distance_m"]],
            "dem": {"product": sampler.product, "version": "PDS LOLA GDR", "resolution_m": sampler.pixel_m},
            "max_radius_km": radius_km,
            # Em algumas direções o DEM acaba antes do raio pedido (borda em 80°S).
            "min_data_reach_km": round(float(mask["data_reach_m"].min()) / 1000, 1),
            "visibility_criterion": "disc_center",
        },
        "series": series,
        "metrics": {
            "sun_time_pct": metric(round(100 * sum(sun) / len(sun), 1)),
            "earth_time_pct": metric(round(100 * sum(earth) / len(earth), 1)),
            "longest_no_sun_h": metric(longest_run_hours([not v for v in sun], step_min)),
            "mean_slope_deg": {"value": None, "class": "no_data", "source": None},
        },
        "queries": ephem["queries"],   # as consultas exatas ao Horizons, para reprodução
        "sources": [
            {"id": "lola", "name": f"LOLA polar DEM {sampler.product} (NASA PDS, LRO/LOLA)",
             "url": "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/", "version": None, "license": "NASA PDS, public"},
            {"id": "horizons", "name": "JPL Horizons ephemerides (NASA/JPL)",
             "url": "https://ssd.jpl.nasa.gov/horizons/", "version": None, "license": "NASA/JPL, public"},
        ],
        "fictitious": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the real data file of one or all regions.")
    parser.add_argument("--site", help="Region id from sites.json")
    parser.add_argument("--all", action="store_true", help="Build all regions")
    parser.add_argument("--dem", type=Path, default=hz.DEFAULT_DEM)
    parser.add_argument("--start", default="2027-01-01", help="Start date, UTC")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--step-min", type=int, default=60)
    parser.add_argument("--height", type=float, default=2.0, help="Observer height above ground, metres")
    parser.add_argument("--radius-km", type=float, default=150.0)
    args = parser.parse_args()

    catalog = json.loads(hz.SITES_FILE.read_text(encoding="utf-8"))
    sites = catalog["sites"] if args.all else [s for s in catalog["sites"] if s["id"] == args.site]
    if not sites:
        print("Informe --site <id> (um id de sites.json) ou --all.")
        return 1

    failed = 0
    for site in sites:
        try:
            data = build(site, catalog["coordinate_origin"], args.dem, args.start, args.days,
                         args.step_min, args.height, args.radius_km)
        except Exception as err:
            print(f"{site['name']}: FALHOU ({err})")
            failed += 1
            continue
        (OUT_DIR / f"{site['id']}.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        m = data["metrics"]
        print(f"{site['name']:22s} chão {data['site']['ground_height_m']:8.1f} m | Sol {m['sun_time_pct']['value']:5.1f}% | "
              f"Terra {m['earth_time_pct']['value']:5.1f}% | maior período sem Sol {m['longest_no_sun_h']['value']} h")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
