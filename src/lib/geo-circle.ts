// Olympus Mont Systems LLC - ControlMiles
// src/lib/geo-circle.ts
//
// A MapLibre `circle` layer's circle-radius is in SCREEN PIXELS, not
// meters -- it visually shrinks/grows as the viewer zooms instead of
// representing a fixed real-world radius. This generates the actual
// geodesic circle as a polygon (standard destination-point-given-
// bearing-and-distance formula, walked around 360 degrees), the same
// technique GIS tools use, so a zone always covers the same ground
// regardless of zoom. Shared between geofence-map-inner.tsx (drawing/
// editing zones) and fleet-map-inner.tsx (read-only overlay on the live
// map) so both render a 500m zone identically.

const EARTH_RADIUS_M = 6371000;

export function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
  points = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const centerLatRad = (centerLat * Math.PI) / 180;
  const centerLngRad = (centerLng * Math.PI) / 180;
  const angularDistance = radiusMeters / EARTH_RADIUS_M;

  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const bearing = (i / points) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin(centerLatRad) * Math.cos(angularDistance) +
        Math.cos(centerLatRad) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const lng =
      centerLngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatRad),
        Math.cos(angularDistance) - Math.sin(centerLatRad) * Math.sin(lat),
      );
    coords.push([(lng * 180) / Math.PI, (lat * 180) / Math.PI]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}
