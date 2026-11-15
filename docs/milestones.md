# Milestones and backlog

Milestones in sequence, without fixed hours: only the order matters. Kayky is the only programmer, so his programming hours (~19 h in total) are what limits scope. Budgets are estimates, not measurements, and assume Claude writes first drafts that Kayky reviews and runs.

## Progress (2026-11-14)

- M1: done with the real WAC mosaic and LOLA DEM
- M2: done; region positions are real (USGS grids), visibility numbers still fictitious
- M3: Horizons client validated on Kayky's machine against the reference table; Felipe's independent table still pending
- M4: horizon mask (`pipeline/horizon.py`) tested with analytic cases and the real 85°S DEM; `pipeline/build_site.py` writes real site files. Real data generated for the 9 regions (2027-01-01, 30 days, hourly). Pending: Alisson's review
- Custom points: live analysis through the local API (`/analyze`), for demos on the team's machine; the static site shows "no data"
- M6 (in progress): Educational / Expert toggle with the same numbers; region list doubles as an all-region comparison (sortable Sun % and Earth %); side-by-side comparison of two regions; CSV and JSON download in Expert mode. Educational texts are drafts pending Raphaela's review. Comparing dates is not implemented
- M5: site panel shows real data with two charts (margin above the terrain over time; 360° terrain panorama with Sun and Earth paths)

## Anchors (relative to the deadline, Sunday 2026-11-15, 22:00 Brasília)

| Anchor | When | What happens |
|---|---|---|
| Feature freeze | 6 h before the deadline (~16:00) | Nothing new goes in. Only fixes, text, pitch |
| Final freeze | 1 h 30 before the deadline (~20:30) | Deploy, test on another device, submit |
| Submission | 22:00 Sunday | Internal deadline |

**Cut rule:** if a milestone goes past 50% of its budget, stop and use its "If late" column.

## Team tracks (no code, in parallel)

| ID | Track | Owner | Done when |
|---|---|---|---|
| F1 | Calculation specification: formulas, pseudocode, parameters (scan radius, azimuth step, lunar curvature with R = 1737.4 km, "visible" criterion, observer height, spherical area), 2 hand-computed test cases | Alisson | Kayky can implement without asking questions |
| F2 | Validation reference: at least 5 site/date combinations with Sun and Earth azimuth/elevation from the Horizons web interface, settings recorded | Felipe | Code output can be compared line by line |
| F3 | Data and sources: downloads organized, spreadsheet with version, size, license and attribution; center coordinates of the 9 regions with source | Raphaela | Shared folder and spreadsheet complete |
| F4 | Content for both modes: screen texts, physics explanations, glossary, tour questions | Raphaela, Alisson | Ready to become JSON |
| F5 | Pitch, 30 s video, English project page | Everyone | Ready and rehearsed |

## Programming milestones (Kayky)

| Milestone | Goal | Budget | Depends on | Done when | If late |
|---|---|---|---|---|---|
| M0 | Alignment: scope, stack, data contract, roles | 0 h | — | Plan approved | — |
| **M1** | **Technical foundation:** repository and environment; polar map with WAC (Leaflet test); open the DEM in Python | 1.5 h | M0, F3 | Map shows and DEM opens | If Leaflet fails, custom click-based drawing |
| M2 | Map, regions, minimal API: data contract v0.1; 9 regions on the map; click → lat/lon; list selection; `/sites`; panel with labeled **FICTITIOUS** data | 2.5 h | M1 | Choosing a region opens the panel with the "FICTITIOUS DATA" banner | Fewer regions at first (e.g. 3) |
| M3 | Sun and Earth positions per point and date | 1 h | M1, F2 | **Matches Felipe's reference (F2)** | Cache results; SPICE offline if Horizons limits |
| M4 | Horizon of 1 point, visibility and metrics | 2 h | M3, F1 | 360° profile and metrics; **Alisson reviews** | Start without curvature, add later, document it |
| M5 | Vertical slice: 1 **real** region end to end | 2 h | M2, M4 | **Central milestone.** Works without mocks | If not done at ~55% of time spent, **cut all P1** |
| M6 | Scale and comparison: 9 regions pre-computed, side-by-side, Educational/Expert toggle, provenance labels, non-certification notice | 2.5 h | M5, F4 | Same numbers in both modes | Fewer regions; fewer Educational texts |
| M7 | Validation against F2 and PGDA 69 | 1 h | M6 | Within agreed tolerance | Declare the difference on the site |
| M8 | Finishing and static deploy | 1.5 h | M7 | Opens on another device and on mobile | Cut polish before validation |

P0 total: ~14 h. About 5 h left for P1 and surprises.

## Gates

| Gate | When | Question | If it fails |
|---|---|---|---|
| G1 | End of M5 | Is 1 real region working end to end? | Cut all P1; focus on M6, M7, M8 |
| G2 | 6 h before the deadline | Are all P0 items green? | Freeze: no P1 |

## P1 extras, in the chosen order

1. P1-07 Expert data panel with CSV/JSON download (1 h)
2. P1-05 3D globe, Three.js + CGI Moon Kit (2.5 h, only after M5)
3. P1-01 Guided educational tour (1 h)
4. P1-06 **Site interface in English** (0.5 h, mandatory by the submission rules, done together with M6)

Probably left as PLANNED: favorable-window calendar, landing suitability index, polygon tool, live Horizons query.
