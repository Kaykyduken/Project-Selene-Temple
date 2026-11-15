# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# M4: máscara de horizonte de um ponto da Lua.
#
# A IDEIA: parado num ponto, gire 360°. Em cada direção (azimute), o relevo em
# volta tapa o céu até uma certa altura angular. Essa altura, para cada direção,
# é o "horizonte real" do local. O Sol (ou a Terra) só aparece quando a elevação
# dele é MAIOR que o horizonte naquela direção.
#
# COMO CALCULAMOS, para cada azimute (0°, 1°, ..., 359°):
#   1. andamos em linha reta sobre a esfera, do observador para fora, em passos
#   2. em cada passo lemos a altura do terreno no DEM
#   3. calculamos o ângulo com que o observador vê aquele ponto do terreno,
#      levando em conta a CURVATURA da Lua (o chão "cai" com a distância)
#   4. guardamos o maior ângulo: esse é o horizonte naquela direção
#
# A GEOMETRIA (triângulo centro da Lua – observador – ponto do terreno):
#   r0 = R + altura do observador      r1 = R + altura do terreno
#   theta = distância / R              (ângulo no centro da Lua entre os dois)
#   elevação = atan2( r1*cos(theta) - r0 ,  r1*sin(theta) )
# Num terreno perfeitamente liso o resultado é NEGATIVO: quem está 2 m acima do
# chão vê o horizonte ~0,09° abaixo do plano horizontal. Do alto de uma montanha
# esse valor é bem mais negativo, e é por isso que montanhas veem mais Sol.
#
# Uso (dentro da pasta pipeline/):
#     python horizon.py --site malapert-massif
#     python horizon.py --lat -89.5 --lon 0 --dem ../data/raw/dem/LDEM_875S_20M.JP2

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.windows import Window, from_bounds

from common.moon import MOON_GEOGRAPHIC, MOON_RADIUS_M
from common.pds import read_height_scale

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DEM = ROOT / "data" / "raw" / "dem" / "LDEM_80S_20M.JP2"
SITES_FILE = ROOT / "frontend" / "public" / "data" / "sites.json"

NEAR_RADIUS_M = 12_000    # até aqui usamos o DEM em resolução total (20 m)
FAR_PIXEL_M = 100         # daqui para fora, uma versão reduzida (~100 m por pixel)


def march_distances(max_radius_m: float, first_step_m: float = 20.0, growth: float = 0.004) -> np.ndarray:
    """Distâncias onde o relevo é amostrado em cada direção.

    Perto do observador os passos são de 20 m (um pixel do DEM). Longe, crescem
    aos poucos (0,4% da distância): um morro a 100 km não precisa de passos de 20 m.
    """
    distances, d = [], first_step_m
    while d <= max_radius_m:
        distances.append(d)
        d += max(first_step_m, d * growth)
    return np.array(distances)


def destination(lat_deg: float, lon_deg: float, azimuth_deg: np.ndarray, distance_m: np.ndarray):
    """Ponto de chegada andando 'distance_m' na direção 'azimuth_deg' sobre a esfera.

    É a fórmula clássica de navegação em círculo máximo. Fazemos na esfera (e não
    em linha reta no mapa) porque no mapa polar uma reta não é o caminho mais curto.
    """
    lat1, lon1, az = np.radians(lat_deg), np.radians(lon_deg), np.radians(azimuth_deg)
    theta = distance_m / MOON_RADIUS_M
    lat2 = np.arcsin(np.sin(lat1) * np.cos(theta) + np.cos(lat1) * np.sin(theta) * np.cos(az))
    lon2 = lon1 + np.arctan2(np.sin(az) * np.sin(theta) * np.cos(lat1),
                             np.cos(theta) - np.sin(lat1) * np.sin(lat2))
    return np.degrees(lat2), np.degrees(lon2)


def elevation_angle_deg(observer_h_m: float, terrain_h_m: np.ndarray, distance_m: np.ndarray) -> np.ndarray:
    """Ângulo (graus) com que o observador vê um ponto do terreno, com curvatura."""
    r0 = MOON_RADIUS_M + observer_h_m
    r1 = MOON_RADIUS_M + terrain_h_m
    theta = distance_m / MOON_RADIUS_M
    return np.degrees(np.arctan2(r1 * np.cos(theta) - r0, r1 * np.sin(theta)))


class DemSampler:
    """Lê do DEM só o pedaço em volta do local, em duas resoluções:
    um recorte pequeno em 20 m (perto) e um recorte grande reduzido (longe).
    Assim não carregamos o arquivo inteiro (centenas de MB) na memória."""

    def __init__(self, dem_path: Path, lat_deg: float, lon_deg: float, max_radius_m: float):
        self.ds = rasterio.open(dem_path)
        # Fator de escala das alturas vem do rótulo .LBL (ver common/pds.py).
        self.scale = read_height_scale(dem_path) or self.ds.scales[0]
        self.to_map = Transformer.from_crs(MOON_GEOGRAPHIC, self.ds.crs, always_xy=True)
        self.x0, self.y0 = self.to_map.transform(lon_deg, lat_deg)
        self.product = dem_path.stem
        self.pixel_m = self.ds.res[0]
        self.near = self._read(NEAR_RADIUS_M, 1)
        self.far = self._read(max_radius_m, max(1, round(FAR_PIXEL_M / self.pixel_m)))

    def _read(self, radius_m: float, factor: int):
        """Lê um quadrado de lado 2*radius em volta do local, reduzido 'factor' vezes."""
        window = from_bounds(self.x0 - radius_m, self.y0 - radius_m, self.x0 + radius_m, self.y0 + radius_m,
                             self.ds.transform).round_offsets().round_lengths()
        # Corta a janela para dentro do arquivo (perto da borda do DEM).
        try:
            window = window.intersection(Window(0, 0, self.ds.width, self.ds.height))
        except rasterio.errors.WindowError as err:  # o recorte inteiro caiu fora do arquivo
            raise ValueError(f"The point is outside the area covered by {self.product}") from err
        shape = (max(1, int(window.height // factor)), max(1, int(window.width // factor)))
        data = self.ds.read(1, window=window, out_shape=shape).astype("float32") * self.scale
        if self.ds.nodata is not None:
            data[data == self.ds.nodata * self.scale] = np.nan
        left, bottom, right, top = rasterio.windows.bounds(window, self.ds.transform)
        return {"data": data, "left": left, "top": top,
                "px_x": (right - left) / shape[1], "px_y": (top - bottom) / shape[0]}

    @staticmethod
    def _lookup(grid, x, y):
        """Altura no pixel que contém (x, y); NaN se cair fora do recorte."""
        col = np.floor((x - grid["left"]) / grid["px_x"]).astype(int)
        row = np.floor((grid["top"] - y) / grid["px_y"]).astype(int)
        inside = (row >= 0) & (row < grid["data"].shape[0]) & (col >= 0) & (col < grid["data"].shape[1])
        out = np.full(x.shape, np.nan, dtype="float32")
        out[inside] = grid["data"][row[inside], col[inside]]
        return out

    def heights(self, lat_deg: np.ndarray, lon_deg: np.ndarray) -> np.ndarray:
        """Altura do terreno (m) em cada ponto: recorte fino quando existe, senão o reduzido."""
        x, y = self.to_map.transform(lon_deg, lat_deg)
        h = self._lookup(self.near, x, y)
        missing = np.isnan(h)
        h[missing] = self._lookup(self.far, x[missing], y[missing])
        return h

    def ground_height(self) -> float:
        return float(self._lookup(self.near, np.array([self.x0]), np.array([self.y0]))[0])


def compute_horizon(heights_fn, lat_deg: float, lon_deg: float, ground_h_m: float,
                    observer_height_m: float = 2.0, max_radius_m: float = 150_000,
                    azimuth_step_deg: float = 1.0) -> dict:
    """Máscara de horizonte: para cada azimute, o maior ângulo de elevação do relevo.

    heights_fn(lat, lon) devolve a altura do terreno; recebe matrizes numpy.
    (É um parâmetro para podermos testar com terrenos inventados.)
    """
    azimuths = np.arange(0, 360, azimuth_step_deg)
    distances = march_distances(max_radius_m)
    # Matriz [azimute, distância]: todas as direções de uma vez (numpy faz o laço).
    az_grid, d_grid = np.meshgrid(azimuths, distances, indexing="ij")
    lat, lon = destination(lat_deg, lon_deg, az_grid, d_grid)
    terrain = heights_fn(lat, lon)

    angles = elevation_angle_deg(ground_h_m + observer_height_m, terrain, d_grid)
    angles[np.isnan(terrain)] = -np.inf           # sem dado não tapa nada
    best = np.argmax(angles, axis=1)              # posição do ponto mais "alto" em cada direção
    rows = np.arange(len(azimuths))

    # Até que distância havia dado em cada direção (o DEM acaba na latitude 80°S).
    has_data = ~np.isnan(terrain)
    reach = np.where(has_data.any(axis=1), distances[has_data.shape[1] - 1 - np.argmax(has_data[:, ::-1], axis=1)], 0.0)

    return {
        "azimuth_deg": azimuths,
        "elevation_deg": angles[rows, best],
        "blocker_distance_m": distances[best],    # a que distância está o relevo que define o horizonte
        "data_reach_m": reach,
    }


def horizon_at(horizon_elevation_deg: np.ndarray, azimuth_deg) -> np.ndarray:
    """Horizonte num azimute qualquer, interpolando entre os valores vizinhos
    (com 'period=360' para o 359° emendar no 0°)."""
    step = 360 / len(horizon_elevation_deg)
    return np.interp(np.asarray(azimuth_deg) % 360, np.arange(0, 360, step), horizon_elevation_deg, period=360)


def main() -> int:
    parser = argparse.ArgumentParser(description="Horizon mask of a lunar surface point from a LOLA DEM.")
    parser.add_argument("--site", help="Region id from sites.json")
    parser.add_argument("--lat", type=float)
    parser.add_argument("--lon", type=float)
    parser.add_argument("--dem", type=Path, default=DEFAULT_DEM)
    parser.add_argument("--height", type=float, default=2.0, help="Observer height above the ground, metres")
    parser.add_argument("--radius-km", type=float, default=150.0, help="How far to scan the terrain")
    args = parser.parse_args()

    if args.site:
        sites = {s["id"]: s for s in json.loads(SITES_FILE.read_text(encoding="utf-8"))["sites"]}
        args.lat, args.lon = sites[args.site]["lat_deg"], sites[args.site]["lon_deg"]
    if args.lat is None or args.lon is None:
        print("Informe --site ou --lat e --lon.")
        return 1

    sampler = DemSampler(args.dem, args.lat, args.lon, args.radius_km * 1000)
    ground = sampler.ground_height()
    if np.isnan(ground):
        print("O ponto está fora da área coberta por este DEM.")
        return 1
    h = compute_horizon(sampler.heights, args.lat, args.lon, ground, args.height, args.radius_km * 1000)

    print(f"Ponto: lat {args.lat}°, lon {args.lon}°  |  chão a {ground:.1f} m  |  observador {args.height} m acima")
    print(f"DEM: {sampler.product}, {sampler.pixel_m:.0f} m/pixel, varredura até {args.radius_km:.0f} km")
    print(f"Horizonte: mínimo {h['elevation_deg'].min():.2f}°, máximo {h['elevation_deg'].max():.2f}°, média {h['elevation_deg'].mean():.2f}°")
    print(f"Cobertura do DEM: de {h['data_reach_m'].min() / 1000:.0f} a {h['data_reach_m'].max() / 1000:.0f} km conforme a direção")
    print("\n Azimute  Horizonte  Relevo que tapa (km)")
    for az in range(0, 360, 30):
        i = int(az / (360 / len(h["azimuth_deg"])))
        print(f"   {az:3d}°   {h['elevation_deg'][i]:7.2f}°   {h['blocker_distance_m'][i] / 1000:8.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
