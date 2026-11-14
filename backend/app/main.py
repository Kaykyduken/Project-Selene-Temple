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
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Pasta dos dados: <raiz do repositório>/frontend/public/data
DATA_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data"

# Um id de região só pode ter letras minúsculas, números e hífen. Isso impede
# que alguém peça "../../outro-arquivo" e leia arquivos fora da pasta de dados.
SITE_ID_PATTERN = re.compile(r"^[a-z0-9-]+$")

app = FastAPI(
    title="Lunar Landing Site Navigator API",
    version="0.2.0",
    description="Sun and Earth visibility over the real horizon of lunar south pole sites.",
)

# CORS: permite que o site rodando no Vite (porta 5173) chame a API diretamente.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
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
