# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# API do projeto (FastAPI). Na M1 ela só tem a rota /health, que responde
# "estou no ar". As rotas de dados (/sites, /visibilidade, ...) chegam na M2.
#
# Como rodar (dentro da pasta backend/):
#     uvicorn app.main:app --reload --port 8000
# Depois abra http://localhost:8000/docs para ver a documentação automática.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Lunar Landing Site Navigator API",
    version="0.1.0",
    description="Sun and Earth visibility over the real horizon of lunar south pole sites.",
)

# CORS: permite que o site rodando no Vite (porta 5173) chame a API diretamente.
# Em desenvolvimento o Vite já repassa /api para cá (ver frontend/vite.config.ts),
# mas deixamos liberado para testes manuais no navegador.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Responde se a API está no ar. O front usa isso para mostrar 'API: online'."""
    return {"status": "ok", "version": app.version}
