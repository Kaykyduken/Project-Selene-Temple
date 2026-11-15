# Data contract v0.1

The JSON format shared by the pipeline (Python), the API and the site. The TypeScript definition is the reference: [`frontend/src/data/contract.ts`](../frontend/src/data/contract.ts).

| File | Content |
|---|---|
| `frontend/public/data/sites.json` | List of regions (`id`, `name`, `lat_deg`, `lon_deg`) and the origin of the coordinates |
| `frontend/public/data/summary.json` | Sun %, Earth % and longest period without Sun of every region, for the comparison list (`pipeline/build_summary.py`) |
| `frontend/public/data/sites/<id>.json` | One site: `site`, `period`, `horizon` (360 elevation values), `series` (Sun and Earth azimuth, elevation and `visible` per time step), `metrics`, `sources`, `fictitious` |

## Rules

- **`fictitious: true`** forces the interface to show the "FICTITIOUS DATA" banner. Mock data can never look real.
- **No data** is `value: null` with `class: "no_data"`. The interface shows "no data", never zero.
- Every metric carries a provenance `class` (`observed`, `model`, `estimate`, `hypothesis`, `no_data`) and a `source`.
- `visible` means the body is above the terrain horizon at its azimuth. The criterion (`disc_center` or `any_part_of_disc`) is recorded in `horizon.visibility_criterion`.

## Current state

All nine site files hold **real** results (`pipeline/build_site.py`, 2027-01-01, 30 days, hourly, observer 2 m above ground at each region centre). `make_mock_data.py` is kept only for interface tests and would overwrite them. The region positions and outlines are real: they come from the USGS 1 km grids (`pipeline/build_sites.py`).

## API routes

| Route | Returns |
|---|---|
| `GET /health` | API status |
| `GET /sites` | `sites.json` |
| `GET /visibility?site=<id>` | The site file |
| `GET /analyze?lat=&lon=&height=` | Live computation for any point south of 80°S, same format and same period as the regions (needs the DEM and Horizons) |
