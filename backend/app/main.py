# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# API do projeto (FastAPI). Na M2 ela só LÊ os mesmos JSON pré-calculados que
# o site usa (frontend/public/data). O cálculo ao vivo de pontos novos chega
# depois (M5). O site funciona mesmo com esta API desligada.
#
# Como rodar (dentro da pasta backend/):
#     uvicorn app.main:app --reload --port 8000
# Depois abra http://localhost:8000/docs para ver a documentação automática.

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Pasta dos dados: <raiz do repositório>/frontend/public/data
DATA_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data"

# O cálculo mora na pasta pipeline/ (os mesmos arquivos usados para gerar as
# regiões). Colocamos essa pasta no caminho de busca do Python para importá-los.
PIPELINE_DIR = Path(__file__).resolve().parents[2] / "pipeline"
sys.path.insert(0, str(PIPELINE_DIR))

# Arquivo de relevo usado no cálculo ao vivo. Dá para trocar com a variável de
# ambiente LLSN_DEM; o padrão é o mesmo das regiões.
DEM_PATH = Path(os.environ.get("LLSN_DEM", PIPELINE_DIR.parent / "data" / "raw" / "dem" / "LDEM_80S_20M.JP2"))

# Arquivo onde os pontos favoritos ficam guardados NESTA máquina.
# Fica em data/ (fora do Git): são escolhas de quem usa, não parte do projeto.
FAVORITES_FILE = PIPELINE_DIR.parent / "data" / "favorites.json"
MAX_FAVORITES = 12

# Um id de região só pode ter letras minúsculas, números e hífen. Isso impede
# que alguém peça "../../outro-arquivo" e leia arquivos fora da pasta de dados.
SITE_ID_PATTERN = re.compile(r"^[a-z0-9-]+$")

app = FastAPI(
    title="Lunar Landing Site Navigator API",
    version="0.4.0",
    description="Sun and Earth visibility over the real horizon of lunar south pole sites.",
)

# CORS: permite que o site rodando no Vite (porta 5173) chame a API diretamente.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "PUT"],
    allow_headers=["*"],
)


def read_json(path: Path) -> dict:
    """Lê um JSON da pasta de dados; se não existir, responde 404."""
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Data not found")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/health")
def health() -> dict[str, str]:
    """Responde se a API está no ar. O front usa isso para mostrar 'API: online'."""
    return {"status": "ok", "version": app.version}


@app.get("/sites")
def list_sites() -> dict:
    """Lista das regiões candidatas, com coordenadas e a origem delas."""
    return read_json(DATA_DIR / "sites.json")


@app.get("/visibility")
def visibility(site: str = Query(description="Site id, e.g. 'haworth'")) -> dict:
    """Série temporal, horizonte e métricas pré-calculados de uma região."""
    if not SITE_ID_PATTERN.fullmatch(site):
        raise HTTPException(status_code=400, detail="Invalid site id")
    return read_json(DATA_DIR / "sites" / f"{site}.json")


def reference_period() -> tuple[str, int, int]:
    """Período usado nas regiões (início, dias, passo), lido de um arquivo pronto.
    O ponto livre usa o MESMO período, para a comparação com as regiões ser justa."""
    for path in sorted((DATA_DIR / "sites").glob("*.json")):
        period = json.loads(path.read_text(encoding="utf-8"))["period"]
        start = datetime.fromisoformat(period["start_utc"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(period["end_utc"].replace("Z", "+00:00"))
        return start.strftime("%Y-%m-%d"), max(1, round((end - start).total_seconds() / 86400)), period["step_min"]
    return "2027-01-01", 30, 60


@app.get("/analyze")
def analyze(
    lat: float = Query(ge=-90, le=-80, description="Latitude in degrees (the DEM covers 80°S to the pole)"),
    lon: float = Query(ge=-180, le=360, description="East longitude in degrees"),
    height: float = Query(default=2.0, ge=0, le=100, description="Observer height above ground, metres"),
) -> dict:
    """Calcula AO VIVO o horizonte e a visibilidade de um ponto qualquer.

    Só funciona onde o arquivo de relevo está disponível (o computador da equipe)
    e com internet, porque consulta o JPL Horizons. Leva alguns segundos.
    """
    if not DEM_PATH.exists():
        raise HTTPException(status_code=503, detail=f"DEM file not found on this server: {DEM_PATH.name}")

    # Importa aqui dentro: assim /health e /sites funcionam mesmo numa máquina
    # sem numpy/rasterio instalados.
    import build_site

    start, days, step_min = reference_period()
    site = {"id": "custom-point", "name": "Custom point", "lat_deg": round(lat, 4), "lon_deg": round(lon, 4), "custom": True}
    origin = {"source": "Point selected by the user on the map", "class": "observed", "verified": True}
    try:
        return build_site.build(site, origin, DEM_PATH, start, days, step_min, height, 150.0)
    except ValueError as err:   # ponto fora do DEM, resposta inesperada do Horizons...
        raise HTTPException(status_code=422, detail=str(err)) from err
    except OSError as err:      # sem internet / Horizons fora do ar
        raise HTTPException(status_code=502, detail=f"Could not reach JPL Horizons: {err}") from err


@app.get("/favorites")
def get_favorites() -> list:
    """Pontos favoritos guardados no arquivo data/favorites.json. O site lê isto ao abrir."""
    if not FAVORITES_FILE.is_file():
        return []
    try:
        saved = json.loads(FAVORITES_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []  # arquivo corrompido: começa vazio em vez de quebrar o site
    return saved if isinstance(saved, list) else []


@app.put("/favorites")
def put_favorites(favorites: list[dict] = Body(max_length=MAX_FAVORITES)) -> dict:
    """Substitui a lista inteira de favoritos (o site manda a lista completa a cada mudança)."""
    for item in favorites:
        if not isinstance(item.get("site"), dict) or "id" not in item["site"]:
            raise HTTPException(status_code=422, detail="Each favorite must be a site data object")
    # Grava num arquivo temporário e troca de nome: se a gravação falhar no meio,
    # o arquivo antigo continua inteiro.
    FAVORITES_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp = FAVORITES_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(favorites, separators=(",", ":")), encoding="utf-8")
    temp.replace(FAVORITES_FILE)
    return {"saved": len(favorites)}
