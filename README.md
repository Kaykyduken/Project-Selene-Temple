# Lunar Landing Site Navigator

Project for the **NASA Space Apps Challenge 2026** (Sorocaba local event), challenge **Lunar Landing Site Navigator**.

A web platform to compare landing sites and dates at the lunar south pole. For each site it shows where the **Sun** and the **Earth** are relative to that site's **real horizon** (derived from terrain data). That answers two practical questions: when the site gets sunlight for solar power, and when it has direct line of sight to Earth for communication.

The same calculations serve two modes:

- **Educational mode**: guided, plain-language explanations of light, shadow and Earth visibility at the pole.
- **Expert mode**: a data panel with the time series, the horizon profile, the parameters used and the exact JPL Horizons query, downloadable as CSV and JSON.

> **Status:** working prototype with real data for the nine Artemis III candidate regions (one 30-day period). See [`docs/milestones.md`](docs/milestones.md) for progress, [`docs/validation.md`](docs/validation.md) for the checks against JPL Horizons and [`docs/project-page.md`](docs/project-page.md) for the submission text.

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

## Live site-analysis tool (custom points)

Besides the nine pre-computed regions, the site can analyse **any point south of 80°S**: click the map and the tool
computes that point's terrain horizon and the visibility of the Sun and the Earth over the same period used for the
regions, so the comparison is fair. The result opens in the same panels (Educational or Expert) and can be kept in
**Favorites**. This tool runs only on a machine prepared as below; **the published static site does not include it**
and shows "API: offline (static mode)".

**What the tool needs**

| Requirement | Detail |
|---|---|
| Local API running | `uvicorn app.main:app --port 8000` (see step 2 below). The front end reaches it through the `/api` proxy of `npm run dev` |
| Python packages | `pip install -r backend/requirements.txt -r pipeline/requirements.txt` (adds numpy, rasterio, pyproj, Pillow, pyshp, shapely) |
| Terrain data (DEM) | `data/raw/dem/LDEM_80S_20M.JP2` **and its `.LBL` label file in the same folder**. The label holds the scale factor (0.5) that turns pixel values into metres; without it all heights come out doubled. Download both from the [LOLA GDR polar archive](https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE) (PDS), or set another path with the environment variable `LLSN_DEM` |
| Internet access | Each new point queries the JPL Horizons API (Sun and Earth positions). Results are cached in `data/cache/`, so repeating a point is fast |
| Allowed area | Latitude from −90° to −80° (the 80°S DEM ends there). Points outside return a clear message instead of a result |
| Fixed parameters | Observer height 2 m, scan radius 150 km, horizon every 1° of azimuth, period read from the pre-computed region files |
| Time | A new point takes several seconds (up to 90 s on a slow connection) |
| Not committed | `data/raw/` and `data/cache/` stay out of Git (large files); `data/favorites.json` is created by the API |

**Behaviour when something is missing**

- No DEM file: the API answers "DEM file not found" and the site keeps working with the regions.
- No internet or JPL Horizons down: the point is not computed and the message says Horizons could not be reached.
- API not running: the badge shows "API: offline (static mode)", clicking the map does not compute points, and Favorites
  are kept in the browser only.

## Deployment (Vercel)

`vercel.json` at the repository root deploys the site as one Vercel project with a single service, `frontend`
(Vite, folder `frontend/`), served at `/`. The site is fully static: the region results are pre-computed JSON in
`frontend/public/data`, so the public site needs no server. The FastAPI backend and the `pipeline/` scripts are **not**
deployed: the live analysis tool needs the 20 m terrain file, which is too large for a serverless function, and the
API stores Favorites in a local file. On the public site the badge reads "API: offline (static mode)" and Favorites
use the browser's local storage.

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
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r ../pipeline/requirements.txt
uvicorn app.main:app --reload --port 8000           # docs on http://localhost:8000/docs
```

The live analysis tool (section above) needs this API. Without it the site still works in static mode.

**3. Data pipeline** (needs the raw files in `data/raw/`, see `data/README.md`)

```bash
cd pipeline
pip install -r requirements.txt
python open_dem.py ../data/raw/dem/LDEM_85S_20M.JP2          # inspect the DEM
python prepare_basemap.py ../data/raw/moonkit/lroc_color_2k.jpg   # build the web base map (or the WAC polar mosaic)
```

API keys (for example the api.nasa.gov key) go in a local `.env` file, which is never committed. See `.env.example`.

Code comments are written in Portuguese so the whole team can follow the logic; identifiers and user-facing text are in English.
