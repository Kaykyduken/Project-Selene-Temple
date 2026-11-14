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
