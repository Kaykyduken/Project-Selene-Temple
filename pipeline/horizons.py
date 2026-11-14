# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# M3: posição do Sol e da Terra no céu de um ponto da Lua, usando o JPL Horizons
# (o serviço oficial de efemérides da NASA/JPL).
#
# O que pedimos ao Horizons: "para um observador parado neste ponto da superfície
# da Lua, qual o AZIMUTE e a ELEVAÇÃO do Sol (ou da Terra) a cada X minutos?"
#   - azimute: direção na bússola, em graus (0 = norte, 90 = leste, 180 = sul, 270 = oeste)
#   - elevação: ângulo acima do horizonte "plano" (negativo = abaixo dele)
#
# IMPORTANTE: o Horizons NÃO conhece o relevo. Ele diz onde o astro está no céu;
# se uma montanha tapa o astro é a nossa máscara de horizonte que decide (M4).
#
# Uso (dentro da pasta pipeline/):
#     python horizons.py --site malapert-massif --start 2027-01-01 --stop 2027-01-02 --step-min 480
#     python horizons.py --lat -85.9872 --lon -0.2368 --start 2027-01-01 --stop 2027-01-02
#
# Só usa a biblioteca padrão do Python.

import argparse
import hashlib
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Códigos dos corpos no Horizons.
SUN = "10"
EARTH = "399"
MOON = "301"

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "cache" / "horizons"
SITES_FILE = ROOT / "frontend" / "public" / "data" / "sites.json"

MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}


def build_url(body: str, lat_deg: float, lon_deg: float, alt_km: float,
              start: str, stop: str, step_min: int) -> str:
    """Monta a consulta ao Horizons. Guardamos essa URL junto com o resultado,
    para que qualquer pessoa possa repetir exatamente a mesma consulta."""
    params = {
        "format": "text",
        "COMMAND": f"'{body}'",            # o astro observado (Sol ou Terra)
        "OBJ_DATA": "'NO'",                # sem a ficha técnica do astro
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",        # tabela "vista por um observador"
        "CENTER": f"'coord@{MOON}'",       # observador = coordenadas que eu informo, na Lua
        "COORD_TYPE": "'GEODETIC'",
        # Ordem exigida: longitude LESTE (0 a 360°), latitude, altitude em km.
        # Longitude oeste vira 360 - valor (ex.: 23°W → 337).
        "SITE_COORD": f"'{lon_deg % 360:.4f},{lat_deg:.4f},{alt_km:.4f}'",
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step_min}m'",
        "QUANTITIES": "'4'",               # 4 = azimute e elevação aparentes
        "CSV_FORMAT": "'YES'",
    }
    # safe="'@,:" mantém esses caracteres legíveis; espaços viram %20.
    return API_URL + "?" + urllib.parse.urlencode(params, safe="'@,:", quote_via=urllib.parse.quote)


def fetch(url: str, use_cache: bool = True) -> str:
    """Baixa a resposta do Horizons, guardando uma cópia em data/cache/horizons/.
    Repetir a mesma consulta lê do disco: mais rápido e não sobrecarrega o JPL."""
    cache_file = CACHE_DIR / (hashlib.sha256(url.encode()).hexdigest()[:24] + ".txt")
    if use_cache and cache_file.exists():
        return cache_file.read_text(encoding="utf-8")
    request = urllib.request.Request(url, headers={"User-Agent": "lunar-landing-site-navigator (hackathon)"})
    with urllib.request.urlopen(request, timeout=120) as response:
        text = response.read().decode("utf-8")
    if "$$SOE" in text:  # só guarda respostas válidas
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(text, encoding="utf-8")
    return text


def parse_time(text: str) -> str:
    """'2027-Jan-01 08:00' → '2027-01-01T08:00:00Z' (formato do nosso contrato)."""
    date, clock = text.split()
    year, month, day = date.split("-")
    parts = [int(float(p)) for p in clock.split(":")] + [0]
    moment = datetime(int(year), MONTHS[month], int(day), parts[0], parts[1], parts[2], tzinfo=timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_table(text: str) -> list[dict]:
    """Extrai as linhas de dados, que ficam entre os marcadores $$SOE e $$EOE.

    Cada linha é: data, marcador de luz solar, marcador extra, azimute, elevação.
    Para não depender da posição exata das colunas, pegamos a data (1º campo)
    e os dois ÚLTIMOS campos numéricos (azimute e elevação).
    """
    if "$$SOE" not in text or "$$EOE" not in text:
        # Sem tabela = o Horizons devolveu uma mensagem de erro; mostramos o final dela.
        raise ValueError("Resposta do Horizons sem tabela de dados:\n" + text.strip()[-800:])
    rows = []
    for line in text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines():
        fields = [f.strip() for f in line.split(",")]
        numbers = []
        for field in fields[1:]:
            try:
                numbers.append(float(field))
            except ValueError:
                pass  # campo vazio ou marcador ('*', 'm', ...)
        if len(numbers) < 2:
            raise ValueError(f"Linha inesperada na resposta do Horizons: {line!r}")
        rows.append({"t_utc": parse_time(fields[0]), "az_deg": numbers[-2], "el_deg": numbers[-1]})
    return rows


def sun_earth_series(lat_deg: float, lon_deg: float, start: str, stop: str,
                     step_min: int = 60, alt_km: float = 0.0, use_cache: bool = True) -> dict:
    """Série do Sol e da Terra para um ponto. Devolve as linhas e as duas URLs usadas."""
    urls = {name: build_url(code, lat_deg, lon_deg, alt_km, start, stop, step_min)
            for name, code in (("sun", SUN), ("earth", EARTH))}
    sun = parse_table(fetch(urls["sun"], use_cache))
    earth = parse_table(fetch(urls["earth"], use_cache))
    if [r["t_utc"] for r in sun] != [r["t_utc"] for r in earth]:
        raise ValueError("As tabelas do Sol e da Terra vieram com horários diferentes.")
    series = [
        {"t_utc": s["t_utc"],
         "sun": {"az_deg": s["az_deg"], "el_deg": s["el_deg"]},
         "earth": {"az_deg": e["az_deg"], "el_deg": e["el_deg"]}}
        for s, e in zip(sun, earth)
    ]
    return {"series": series, "queries": urls}


def main() -> int:
    parser = argparse.ArgumentParser(description="Sun and Earth azimuth/elevation at a lunar surface point (JPL Horizons).")
    parser.add_argument("--site", help="Region id from sites.json (e.g. malapert-massif)")
    parser.add_argument("--lat", type=float, help="Latitude in degrees (south is negative)")
    parser.add_argument("--lon", type=float, help="East longitude in degrees (west is negative)")
    parser.add_argument("--alt-m", type=float, default=0.0, help="Height above the 1737.4 km reference sphere, in metres")
    parser.add_argument("--start", required=True, help="Start, UTC (e.g. 2027-01-01 or '2027-01-01 12:00')")
    parser.add_argument("--stop", required=True, help="Stop, UTC")
    parser.add_argument("--step-min", type=int, default=60, help="Step in minutes")
    parser.add_argument("--no-cache", action="store_true", help="Ignore cached responses")
    args = parser.parse_args()

    if args.site:
        sites = {s["id"]: s for s in json.loads(SITES_FILE.read_text(encoding="utf-8"))["sites"]}
        if args.site not in sites:
            print(f"Região desconhecida: {args.site}. Opções: {', '.join(sites)}")
            return 1
        args.lat, args.lon = sites[args.site]["lat_deg"], sites[args.site]["lon_deg"]
    if args.lat is None or args.lon is None:
        print("Informe --site ou --lat e --lon.")
        return 1

    try:
        result = sun_earth_series(args.lat, args.lon, args.start, args.stop,
                                  args.step_min, args.alt_m / 1000, not args.no_cache)
    except Exception as err:  # rede fora do ar, erro do Horizons, etc.
        print(f"Falhou: {err}")
        return 1

    print(f"Ponto: lat {args.lat}°, lon {args.lon}° (leste), altura {args.alt_m} m")
    print(f"{'UTC':20s} {'Sol az':>9s} {'Sol el':>8s} {'Terra az':>9s} {'Terra el':>9s}")
    for row in result["series"]:
        print(f"{row['t_utc']:20s} {row['sun']['az_deg']:9.3f} {row['sun']['el_deg']:8.3f} "
              f"{row['earth']['az_deg']:9.3f} {row['earth']['el_deg']:9.3f}")
    print("\nConsultas feitas (abra no navegador para conferir):")
    for name, url in result["queries"].items():
        print(f"  {name}: {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
