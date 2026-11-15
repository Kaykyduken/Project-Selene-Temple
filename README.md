# Lunar Landing Site Navigator

Project for the **NASA Space Apps Challenge 2026** (Sorocaba local event), challenge **Lunar Landing Site Navigator**.

A web platform to compare landing sites and dates at the lunar south pole. For each site it shows where the **Sun** and the **Earth** are relative to that site's **real horizon** (derived from terrain data). That answers two practical questions: when the site gets sunlight for solar power, and when it has direct line of sight to Earth for communication.

The same calculations serve two modes:

- **Educational mode**: guided, plain-language explanations of light, shadow and Earth visibility at the pole.
- **Expert mode**: a data panel with the time series, the horizon profile, the parameters used and the exact JPL Horizons query, downloadable as CSV and JSON.

> **Status:** planning finished, code not started yet. See [`docs/decisions.md`](docs/decisions.md) and [`docs/milestones.md`](docs/milestones.md).

## Team

| Member | Role |
|---|---|
| Kayky (team owner) | All programming: front end, API, data pipeline |
| Alisson | Calculation specification (math and physics) and review |
| Felipe | Validation reference values from JPL Horizons |
| Raphaela | Data, sources, licenses and content for both modes |

## Planned stack

| Layer | Choice |
|---|---|
| Front end | Vite + TypeScript |
| 2D polar map | Leaflet + Proj4Leaflet (south polar stereographic) |
| 3D globe (extra) | Three.js + NASA CGI Moon Kit |
| API | FastAPI (Python) |
| Data | Pre-computed JSON and Cloud Optimized GeoTIFF (COG) |
| Hosting | Static hosting for the site; the demo does not depend on live APIs |

## Repository layout (planned)

```
frontend/      Vite + TypeScript app (map, panels, modes)
backend/       FastAPI app (/health, /horizons proxy; API keys stay in .env)
pipeline/      Python scripts: fetch Horizons data, compute horizons from LOLA, build JSON
data/raw/      Large downloads (not versioned)
docs/          Planning, decisions, data sources and project page text
```

## Data sources

Full list, licenses and verification status in [`docs/data-sources.md`](docs/data-sources.md).

- LOLA polar digital elevation models (NASA PGDA / PDS), south pole 20 m LDEM
- JPL Horizons ephemerides (Sun and Earth positions seen from the lunar surface)
- NASA PGDA product 69 (average illumination and Earth visibility), used for validation
- USGS grids of the 9 Artemis III candidate regions
- LROC WAC 100 m mosaic (base map)
- NASA CGI Moon Kit (3D globe textures)

## Use of AI

In line with the Space Apps rules, this team uses AI as a tool, not as the author of the idea. The solution concept was created by the team.

- **Claude (Anthropic)** helps with planning documents, code drafts on request, code review and explanations.
- **Google Stitch** was used by Kayky for interface prototyping: it turned the team's paper sketches into high-fidelity mockups that guided the layout and visual style. The mockups are design references only; the values shown in them are placeholders and are not used as data. See [`docs/design-process.md`](docs/design-process.md).
- Every source file with AI-generated code carries a header comment saying so (`AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.`). Files so far: everything under `frontend/src/`, `frontend/vite.config.ts`, `backend/app/main.py` and everything under `pipeline/`.
- Content marked **"FICTITIOUS DATA"** is placeholder data; missing values are shown as "no data".

## Local setup

Requirements: Node.js 20.19+ (or 22.12+) and Python 3.10+.

**1. Front end** (map in the browser)

```bash
cd frontend
npm install
npm run dev          # opens on http://localhost:5173
```

**2. API** (optional; the site also works without it)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000           # docs on http://localhost:8000/docs
```

With the API running, clicking any point south of 80°S on the map computes its horizon and visibility live
(`GET /analyze`). This needs the pipeline packages (`pip install -r ../pipeline/requirements.txt`), the DEM in
`data/raw/dem/LDEM_80S_20M.JP2` and internet access to JPL Horizons. The published static site does not include it.

**3. Data pipeline** (needs the raw files in `data/raw/`, see `data/README.md`)

```bash
cd pipeline
pip install -r requirements.txt
python open_dem.py ../data/raw/dem/LDEM_85S_20M.JP2          # inspect the DEM
python prepare_basemap.py ../data/raw/moonkit/lroc_color_2k.jpg   # build the web base map (or the WAC polar mosaic)
```

API keys (for example the api.nasa.gov key) go in a local `.env` file, which is never committed. See `.env.example`.

Code comments are written in Portuguese so the whole team can follow the logic; identifiers and user-facing text are in English.
