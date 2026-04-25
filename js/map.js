import { STATE } from './state.js';
import { getStyle, matchesStateFilter, matchesSearchTerm } from './utils.js';
import { createPopup, renderInfoPanel } from './ui.js';

export function initMap() {
  STATE.map = L.map('map', {
    preferCanvas: true
  }).setView([6.2, -75.57], 12);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  });

  const satelital = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles &copy; Esri'
    }
  );

  osm.addTo(STATE.map);

  L.control
    .layers(
      {
        OpenStreetMap: osm,
        'Imagen satelital': satelital
      },
      null,
      { collapsed: false }
    )
    .addTo(STATE.map);

  STATE.baseLayers = { osm, satelital };
  STATE.layerIndex = {};
}

function getVisibleFeaturesForMap() {
  return (STATE.microrrutasData || []).filter((feature) => {
    const props = feature.properties || {};

    return (
      matchesStateFilter(props.estado, STATE.activeFilters) &&
      matchesSearchTerm(props, STATE.searchTerm)
    );
  });
}

function clearGeoJsonLayer() {
  if (STATE.geojsonLayer && STATE.map) {
    STATE.map.removeLayer(STATE.geojsonLayer);
  }

  STATE.geojsonLayer = null;
  STATE.layerIndex = {};
}

function registerLayer(feature, layer) {
  if (!STATE.layerIndex) {
    STATE.layerIndex = {};
  }

  if (feature?.id !== undefined && feature?.id !== null) {
    STATE.layerIndex[feature.id] = layer;
  }
}

function handleFeatureClick(feature) {
  STATE.selectedFeatureId = feature.id;
  renderInfoPanel(feature);
}

export function renderMap(options = {}) {
  const shouldFitBounds = options.fitBounds !== false;

  if (!STATE.map) return;

  clearGeoJsonLayer();

  const visibleFeatures = getVisibleFeaturesForMap();

  if (!visibleFeatures.length) {
    return;
  }

  STATE.geojsonLayer = L.geoJSON(visibleFeatures, {
    style: (feature) => getStyle(feature.properties || {}),

    onEachFeature: (feature, layer) => {
      registerLayer(feature, layer);

      layer.bindPopup(createPopup(feature.properties || {}));

      layer.on('click', () => {
        handleFeatureClick(feature);
      });
    }
  }).addTo(STATE.map);

  if (shouldFitBounds) {
    const bounds = STATE.geojsonLayer.getBounds();

    if (bounds.isValid()) {
      STATE.map.fitBounds(bounds, { padding: [20, 20] });
    }
  }
}
