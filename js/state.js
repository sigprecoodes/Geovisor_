export const STATE = {
  map: null,
  geojsonLayer: null,
  baseLayers: null,
  geojsonFiles: [],
  microrrutasData: [],
  sheetData: [],
  activeFilters: new Set([
    'Pendiente',
    'En proceso',
    'Ejecutado',
    'Ejecutado con novedad',
    'No ejecutado con novedad',
    'Reportadas con novedad'
  ]),
  selectedFeatureId: null,
  searchTerm: ''
};
