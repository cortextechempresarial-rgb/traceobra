export function normalizeGeometry(polygon) {
  if (!polygon) return null;
  if (polygon.type === 'FeatureCollection' || polygon.type === 'Feature') return polygon;
  if (polygon.type && polygon.coordinates) {
    return { type: 'Feature', properties: {}, geometry: polygon };
  }

  if (Array.isArray(polygon)) {
    const coordinates = polygon.map((point) => {
      if (Array.isArray(point)) return point;
      if (Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))) {
        return [Number(point.lng), Number(point.lat)];
      }
      return null;
    }).filter(Boolean);

    if (coordinates.length >= 3) {
      coordinates.push(coordinates[0]);
      return {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coordinates] },
      };
    }
  }

  return null;
}

export function normalizeCoordinates(latitude, longitude) {
  if (latitude === '' || longitude === '' || latitude == null || longitude == null) return null;
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)
    || Math.abs(parsedLatitude) > 90 || Math.abs(parsedLongitude) > 180) return null;
  return [parsedLatitude, parsedLongitude];
}

export function toFeatureCollection(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('O arquivo precisa conter uma geometria GeoJSON.');
  }

  const featureCollection = data.type === 'FeatureCollection'
    ? data
    : data.type === 'Feature'
      ? { type: 'FeatureCollection', features: [data] }
      : data.type && data.coordinates
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: data }] }
        : null;

  if (!featureCollection?.features?.length) {
    throw new Error('O arquivo precisa conter uma geometria GeoJSON.');
  }

  const supportedTypes = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']);
  const validCoordinates = (coordinates) => {
    if (!Array.isArray(coordinates) || !coordinates.length) return false;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      const [longitude, latitude] = coordinates;
      return Number.isFinite(longitude) && Number.isFinite(latitude)
        && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90;
    }
    return coordinates.every(validCoordinates);
  };

  for (const feature of featureCollection.features) {
    if (!supportedTypes.has(feature.geometry?.type) || !validCoordinates(feature.geometry.coordinates)) {
      throw new Error('O arquivo contém uma geometria ou coordenada inválida.');
    }
  }

  return featureCollection;
}