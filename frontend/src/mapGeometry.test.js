import { describe, expect, it } from 'vitest';
import { normalizeCoordinates, normalizeGeometry, toFeatureCollection } from './mapGeometry';

describe('map geometry', () => {
  it('accepts valid saved latitude and longitude, including zero', () => {
    expect(normalizeCoordinates('-23.5', '-46.6')).toEqual([-23.5, -46.6]);
    expect(normalizeCoordinates(0, 0)).toEqual([0, 0]);
  });

  it('rejects incomplete or out-of-range map coordinates', () => {
    expect(normalizeCoordinates('', -46.6)).toBeNull();
    expect(normalizeCoordinates(91, -46.6)).toBeNull();
    expect(normalizeCoordinates(-23.5, 181)).toBeNull();
  });

  it('converts legacy latitude/longitude points into a closed GeoJSON polygon', () => {
    const geometry = normalizeGeometry([
      { lat: -23.5, lng: -46.6 },
      { lat: -23.4, lng: -46.6 },
      { lat: -23.4, lng: -46.5 },
    ]);

    expect(geometry.geometry.coordinates[0]).toEqual([
      [-46.6, -23.5],
      [-46.6, -23.4],
      [-46.5, -23.4],
      [-46.6, -23.5],
    ]);
  });

  it('accepts a valid GeoJSON feature collection', () => {
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [-46.6, -23.5] },
    };

    expect(toFeatureCollection(feature)).toEqual({ type: 'FeatureCollection', features: [feature] });
  });

  it('rejects coordinates outside longitude and latitude limits', () => {
    const invalidGeometry = {
      type: 'Point',
      coordinates: [181, -23.5],
    };

    expect(() => toFeatureCollection(invalidGeometry)).toThrow('coordenada inválida');
  });
});