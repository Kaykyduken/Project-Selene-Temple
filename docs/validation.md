# Validation log

## V1: Sun and Earth positions (JPL Horizons)

Reference values returned by the Horizons API on 2026-11-14 for the Malapert Massif region centre
(85.9872°S, 359.7632°E, altitude 0 km on the 1737.4 km sphere; frame MEAN_ME, ephemeris DE441).
Quantity 4: apparent azimuth and elevation, airless. `pipeline/horizons.py` must reproduce these.

| UTC | Sun az (°) | Sun el (°) | Earth az (°) | Earth el (°) |
|---|---|---|---|---|
| 2027-01-01 00:00 | 263.298098 | 0.547306 | 7.386126 | -2.270186 |
| 2027-01-01 08:00 | 259.253799 | 0.261487 | 7.202268 | -2.475885 |
| 2027-01-01 16:00 | 255.208617 | -0.020530 | 6.990032 | -2.646957 |
| 2027-01-02 00:00 | 251.162385 | -0.297377 | 6.751473 | -2.783307 |

Command: `python horizons.py --site malapert-massif --start 2027-01-01 --stop 2027-01-02 --step-min 480`

Status: syntax confirmed (`CENTER='coord@301'`, `SITE_COORD='E-lon,lat,alt_km'`, body codes 10 / 399 / 301).
Pending: run the script on a machine with access to the API and compare; Felipe's independent table (track F2).

Note: elevation is measured from the plane perpendicular to the local zenith, not from the terrain.
A body slightly below 0° can still be visible from a mountain top, because the real horizon there dips below 0°.
That is decided by the horizon mask (M4), not by Horizons.

## V2 / V5: horizon mask

Analytic checks of `pipeline/horizon.py` (2026-11-14):

| Case | Computed | Expected |
|---|---|---|
| Smooth sphere, observer 2 m above ground | -0.08694° | -acos(R/(R+2)) = -0.08694° |
| Smooth sphere, observer 5000 m above ground | -4.34163° | -acos(R/(R+5000)) = -4.34163° |
| 1000 m wall 10 km to the north, observer at 0 m | 5.536° at azimuth 0°, -0.0003° at 180° | 5.544° (10.00 km), sampled at 10.01 km |

Real DEM (`LDEM_85S_20M`), Malapert Massif region centre: ground at 4802 m, horizon between -4.13° and 4.99°.
The centre lies on a slope: the terrain 100 m to the north rises to 3.6°, which hides the Earth (azimuth ~7°).
A region centre is not necessarily the best point of the region.

Known limits: nearest-pixel sampling; far terrain read at ~100 m; the 80°S DEM ends 30 to 150 km away
depending on site and direction (`horizon.min_data_reach_km` records it); "visible" uses the disc centre.

## V1, second check: Felipe's table (2026-11-15)

Felipe sent two tables. The first (six Apollo sites) has no values: every angle is marked `n.a.`.
The second has values for two points at 1969-07-20 20:17:40 UTC, altitude 0 km. They were compared with
the Horizons API for the same inputs (`CENTER='coord@301'`, quantity 4, airless):

| Point (lat, E lon) | Quantity | Felipe's table | Horizons API | Difference |
|---|---|---|---|---|
| 0.78740°, 21.51055° | Sun azimuth | 88.83° | 88.806870° | 0.02° |
| | Sun elevation | 8.44° | 8.743662° | 0.30° |
| | Earth azimuth | 264.80° | 272.100673° | 7.30° |
| | Earth elevation | 61.06° | 61.197171° | 0.14° |
| 2.77438°, 16.72172° | Sun azimuth | 88.90° | 88.890521° | 0.01° |
| | Sun elevation | 3.69° | 3.997236° | 0.31° |
| | Earth azimuth | 259.39° | 267.929991° | 8.54° |
| | Earth elevation | 65.55° | 66.007097° | 0.46° |

Result: **not accepted as a reference.** Six of the eight values differ by more than the 0.1° tolerance, and the
Earth azimuths by 7° to 9°. The table has no raw Horizons output attached, so the origin of its values could not
be confirmed. Pending: Felipe re-runs the queries in the Horizons web interface and sends the raw text output.

Command to reproduce the API values with the project script:
`python3 horizons.py --lat 0.78740 --lon 21.51055 --start '1969-07-20 20:17:40' --stop '1969-07-20 20:18:40' --step-min 1`

## V1, third check: raw output of the Horizons web interface (2026-11-15)

Felipe ran the query in the Horizons web application and sent the raw text output, kept in
[`validation/horizons_web_sun_malapert_2026-11-15.txt`](validation/horizons_web_sun_malapert_2026-11-15.txt).

- Target: Sun (10). Centre: Moon (301), user-defined site 359.7632°E, -85.9872°, altitude 0 km
  (Malapert Massif region centre). Frame MEAN_ME, ephemeris DE441, airless.
- Period: 2026-11-15 to 2026-12-15, one row per day (31 rows).

Compared with the Horizons API using the query format of `pipeline/horizons.py`
(`CENTER='coord@301'`, `SITE_COORD='359.7632,-85.9872,0'`, quantity 4): **all 31 rows are identical to the
sixth decimal place** in azimuth and elevation (maximum difference 0.000000°).

Result: **accepted** for the Sun. Pending: the same web query for the Earth (399), and running
`python3 horizons.py --site malapert-massif --start 2026-11-15 --stop 2026-12-15 --step-min 1440`
to confirm that the script prints the same rows.
