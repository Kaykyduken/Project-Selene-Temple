# Project page text (English)

Draft for the Space Apps submission form. Each section below is one field of the form.
Items in [brackets] must be filled or confirmed before submitting.
AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.

## Project Name

Lunar Landing Site Navigator

## High-Level Project Summary

Lunar Landing Site Navigator is a web platform that compares candidate landing sites at the lunar south pole.
For each site it shows where the Sun and the Earth are, hour by hour, against that site's real terrain horizon
computed from NASA LOLA elevation data and JPL Horizons ephemerides. That answers two questions that decide
whether a lander can live there: when does the site get sunlight for solar power, and when does it have a direct
line of sight to Earth for communication?
The same calculations power two modes. Educational mode explains light, shadow and Earth visibility in plain
language. Expert mode shows the time series, the horizon profile, the parameters used and the exact JPL Horizons
query, with data download. Every number carries its origin (observed, model, estimate or no data), and anything
missing is shown as "no data" instead of being invented.

## Link to Project Demo

[30-second video, public link]

## Link to Final Project

https://projeto-de-site-de-explora-o-lunar.vercel.app and the source code: https://github.com/Kaykyduken/Projeto-de-site-de-explora-o-lunar

## Detailed Project Description

**The problem.** At the lunar south pole the Sun stays within a few degrees of the horizon, so terrain decides
everything. A site on a crater rim can be lit for long periods, while a site a few kilometres away may be in shadow.
The Earth also hangs close to the horizon, and a ridge can cut the radio link. Choosing a site therefore means
comparing, for each place and date, how much of the time the Sun and the Earth are above that place's real horizon.

**What the platform does.**

- A south polar map (stereographic projection, 80°S to the pole) shows the nine Artemis III candidate regions
  over a NASA LROC image. A sortable list compares the regions by percentage of time with the Sun in view and with
  the Earth in view.
- Selecting a region opens its panel: a margin chart (body elevation minus terrain horizon at the same azimuth;
  above zero means visible) and a panorama of the horizon with the paths of the Sun and the Earth over the period.
- Clicking any point south of 80°S computes its horizon and visibility on demand (when the local API is running)
  and lets the user keep it in a Favorites list stored in a file.
- Educational mode also has a 3D Moon with the candidate regions and six historic landmarks (the Apollo landing sites),
  each with a gallery of NASA images and a history text with questions for study.
- Expert mode adds the parameters used, links that reproduce each JPL Horizons query, and a download tool where
  the user chooses which data to export (Sun and Earth positions from JPL Horizons, terrain horizon from LOLA,
  derived visibility, summary) as CSV or JSON.

**How it is computed.**

1. The terrain horizon is built from the LOLA 20 m digital elevation model of the south pole. For each azimuth
   (1° steps) the code marches outward from the site (to 150 km), computes the elevation angle of each terrain
   sample including the curvature of the Moon (radius 1737.4 km), and keeps the maximum.
2. The positions of the Sun and the Earth seen from the site come from the JPL Horizons API (airless apparent
   azimuth and elevation, observer on the lunar surface, observer height 2 m).
3. A body is counted as visible when its centre is above the horizon at the same azimuth.
4. Results for the regions are pre-computed and shipped as static JSON, so the published site works without any live
   service.

**Validation.** The positions used by the pipeline were compared with raw output of the JPL Horizons web interface
for Malapert Massif, 2026-11-15 to 2026-12-15: all 31 daily rows for the Sun are identical to the sixth decimal, and
all 31 rows for the Earth match within 0.0005°. The horizon calculation was also tested against analytic cases.
Details and raw files are in `docs/validation.md` and `docs/validation/`.

**Honest limits.** These are stated on the site and in the repository:

- Results cover one 30-day period (January 2027); date comparison needs more computed periods.
- The region marker is the centre of the area computed from the USGS grids, not a NASA-selected landing point, and
  it may not be the best point inside the region.
- The elevation data ends at 80°S, so large distances toward lower latitudes are not covered near the edge.
- The visibility criterion uses the centre of the disc; limb-based criteria are listed as future work.
- This is not a mission certification tool.

**Impact.** Educational mode makes the physics of the polar illumination understandable for students, while Expert
mode gives the same numbers with their provenance for people who want to check or reuse them.

**Statement.** Independent hackathon project. Not an official NASA product and not endorsed by NASA.

## Use of AI

AI was used as a tool to speed up the work, not to create the idea; the concept and the choice of what to build were
made by the team.

- **Claude (Anthropic)** helped with planning documents, first drafts of code, code review, explanations and test
  scripts. Every source file with AI-generated code carries the header "AI-assisted: first draft written by Claude
  (Anthropic), reviewed by the team." and the README lists them. The calculations were checked against JPL Horizons output.
  [Add "and reviewed by <name>" only if the review really happens; otherwise leave as is.]
- **Google Stitch** was used to turn the team's paper sketches into interface mockups that guided the layout and
  visual style. The mockups are design references only; values shown in them were placeholders and are not data.
- No AI-generated images or videos are used. [Confirm before submitting.]

## NASA Data

- LOLA digital elevation models of the lunar south pole (LDEM 20 m), NASA PGDA / PDS Geosciences Node.
- JPL Horizons System ephemerides (Sun and Earth positions seen from the lunar surface), NASA/JPL Solar System
  Dynamics.
- LROC WAC mosaic (Lunar Reconnaissance Orbiter Camera, Arizona State University / NASA), used as the base map.
- NASA PGDA product 69 (average illumination and Earth visibility), used as a validation reference.
- NASA SVS CGI Moon Kit color map (texture of the 3D Moon).
- NASA Image and Video Library (images of the Apollo landings, loaded live in the historic landmarks).
- NASA NSSDCA Apollo landing site coordinates (historic landmarks).

## Space Agency Partner Data and Other References

- USGS Astrogeology: grids of the nine Artemis III candidate regions (centroids and outlines were derived from them).
- Software: Leaflet and Proj4Leaflet (maps), Proj4js / PROJ (projection), Vite and TypeScript, FastAPI, NumPy,
  rasterio, pyproj, Pillow, pyshp, Shapely.
- Typeface: Montserrat (SIL Open Font License) for Educational mode; Calibri, with Arial as fallback, for Expert mode.
- Complete list with licenses and verification status: `docs/data-sources.md`.

## Before submitting

- [ ] Fill the demo and final project links and open both in a private window.
- [ ] Educational texts are drafts until Raphaela reviews them; confirm they are in English and say what the data shows.
- [ ] Confirm the Moon Kit line and the "no AI-generated images" line.
- [ ] Confirm the period, the 150 km radius and the 2 m observer height with Alisson, or state them as the team's choices.
- [ ] Add 2 or 3 screenshots (map with the region list, a margin chart, the Expert panel); no people in the images.
