# Lunar Landing Site Navigator
# AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
#
# Constantes da Lua usadas por todo o pipeline.
# IMPORTANTE: a projeção aqui tem que ser IGUAL à de frontend/src/config.ts.

from pyproj import CRS

# Raio médio da Lua em metros (raio de referência dos produtos LOLA).
MOON_RADIUS_M = 1_737_400.0

# Coordenadas geográficas (latitude/longitude em graus) numa esfera do tamanho da Lua.
# Sem o +R, o pyproj assumiria que estamos na Terra.
MOON_GEOGRAPHIC = CRS.from_proj4(f"+proj=longlat +R={MOON_RADIUS_M:.0f} +no_defs")

# Estereográfica polar sul: a mesma projeção que o mapa do site usa.
SOUTH_POLAR_STEREO_PROJ4 = (
    f"+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R={MOON_RADIUS_M:.0f} +units=m +no_defs"
)
MOON_SOUTH_POLAR_STEREO = CRS.from_proj4(SOUTH_POLAR_STEREO_PROJ4)
