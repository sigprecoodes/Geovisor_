import { STATE } from './state.js';
import { getStyle, matchesStateFilter, matchesSearchTerm } from './utils.js';
import { createPopup, renderInfoPanel } from './ui.js';

export function initMap() {
  STATE.map = L.map('map').setView([6.2, -75.57], 12);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  });

  const satelital = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles &copy; Esri' }
  );

  osm.addTo(STATE.map);
  L.control.layers({ 'OpenStreetMap': osm, 'Imagen satelital': satelital }, null, { collapsed: false }).addTo(STATE.map);
  STATE.baseLayers = { osm, satelital };
}

export function renderMap() {
  if (STATE.geojsonLayer) {
    STATE.map.removeLayer(STATE.geojsonLayer);
  }

  const visibleFeatures = STATE.microrrutasData.filter((feature) => {
    const props = feature.properties || {};
    return (
      matchesStateFilter(props.estado, STATE.activeFilters) &&
      matchesSearchTerm(props, STATE.searchTerm)
    );
  });

  if (!visibleFeatures.length) {
    STATE.geojsonLayer = null;
    return;
  }

  STATE.geojsonLayer = L.geoJSON(visibleFeatures, {
    style: (feature) => getStyle(feature.properties || {}),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(createPopup(feature.properties));
      layer.on({
        click: () => {
          STATE.selectedFeatureId = feature.id;
          renderInfoPanel(feature);
        }
      });
    }
  }).addTo(STATE.map);

  const bounds = STATE.geojsonLayer.getBounds();
  if (bounds.isValid()) {
    STATE.map.fitBounds(bounds, { padding: [20, 20] });
  }
}
