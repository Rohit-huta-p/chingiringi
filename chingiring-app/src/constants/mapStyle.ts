// Custom Mapbox style — pastel grid look matching Figma offline-stores design.
//
// We use Mapbox's `streets-v8` vector tileset (covers India fully) but
// override every layer's paint to a minimal pastel palette and hide all
// labels — only our custom React markers are visible on top.
//
// Pass this object to <Map mapStyle={MAP_STYLE} /> from react-map-gl.

const PALETTE = {
  bg: '#F4F8F6',          // soft mint background
  land: '#F4F8F6',
  park: '#DCEDD4',        // pastel green parks
  water: '#D4E4F7',       // pale blue water
  road: '#FFFFFF',        // white roads (look like grid)
  roadCasing: '#E8EFE8',  // faint grey casing under roads
  building: '#E5EDFA',    // faint blue buildings (barely visible)
};

export const MAP_STYLE = {
  version: 8,
  name: 'Chingi Pastel',
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
  sources: {
    composite: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8',
    },
  },
  layers: [
    // Background (everywhere)
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': PALETTE.bg },
    },
    // Land
    {
      id: 'land',
      type: 'fill',
      source: 'composite',
      'source-layer': 'landuse',
      paint: { 'fill-color': PALETTE.land },
    },
    // Parks (pastel green)
    {
      id: 'park',
      type: 'fill',
      source: 'composite',
      'source-layer': 'landuse',
      filter: ['in', 'class', 'park', 'cemetery', 'pitch', 'wood', 'grass'],
      paint: { 'fill-color': PALETTE.park, 'fill-opacity': 0.85 },
    },
    // Water (pale blue)
    {
      id: 'water',
      type: 'fill',
      source: 'composite',
      'source-layer': 'water',
      paint: { 'fill-color': PALETTE.water },
    },
    // Buildings (very faint)
    {
      id: 'building',
      type: 'fill',
      source: 'composite',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-color': PALETTE.building,
        'fill-opacity': 0.5,
      },
    },
    // Road casing (subtle grey under roads — gives soft border)
    {
      id: 'road-casing',
      type: 'line',
      source: 'composite',
      'source-layer': 'road',
      filter: [
        'in',
        'class',
        'motorway',
        'trunk',
        'primary',
        'secondary',
        'tertiary',
        'street',
        'street_limited',
      ],
      paint: {
        'line-color': PALETTE.roadCasing,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 0.8,
          14, 3,
          18, 14,
        ],
      },
    },
    // Roads (white grid lines)
    {
      id: 'road',
      type: 'line',
      source: 'composite',
      'source-layer': 'road',
      filter: [
        'in',
        'class',
        'motorway',
        'trunk',
        'primary',
        'secondary',
        'tertiary',
        'street',
        'street_limited',
        'service',
      ],
      paint: {
        'line-color': PALETTE.road,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 0.5,
          14, 2,
          18, 10,
        ],
      },
    },
  ],
} as const;

export const MAP_PALETTE = PALETTE;
