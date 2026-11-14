# Decisions

Decisions the team has already made. Change this file only when the team agrees on a change.

Last updated: 2026-11-14.

## Scope and product

| Topic | Decision |
|---|---|
| Scope | Challenge core (Sun and Earth against the real horizon, comparison of sites and dates) plus extras |
| Site selection | List of regions + click on the map + polygon (polygon only if time allows) |
| Schedule | Milestones M0 to M8, no fixed hours. Feature freeze 6 h before the deadline |
| Core | The core does not change because of the 3D globe |
| Expert mode | Data panel with the series, horizon, parameters and the Horizons query; CSV and JSON download |
| Demo data | Pre-computed; the presentation does not depend on a live API |
| Fictitious data | Always labeled "FICTITIOUS DATA"; missing values appear as "no data" |

## Technology (confirmed 2026-11-14)

| Topic | Decision |
|---|---|
| Front end | Vite + TypeScript |
| 2D map | Leaflet + Proj4Leaflet, south polar stereographic |
| API | FastAPI |
| Data format | Pre-computed JSON and COG |
| Hosting | Static hosting |
| 3D globe | Three.js + CGI Moon Kit, lighting from the subsolar point, marker for the Earth direction. Only after milestone M5. Cesium dropped for now |
| Secrets | api.nasa.gov key only in `.env`, back end only, outside the repository |

## Delivery

| Topic | Decision |
|---|---|
| Demo format | Video of up to 30 seconds (Portuguese audio allowed with English subtitles) |
| Order of extras | 1. Expert data panel → 2. 3D globe → 3. Educational tour |
| Internal deadline | Sunday 2026-11-15, 22:00 (Brasília) |
| Official deadline | Sunday 2026-11-15, 23:59 local event time (to be confirmed with the Local Lead) |
