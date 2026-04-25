import { STATE } from './state.js';
import { abrirGestion, abrirReporteNovedad } from './actions.js';
import { CONFIG } from '../config.js';
import {
  matchesStateFilter,
  stateSortWeight,
  matchesSearchTerm,
  slugifyState
} from './utils.js';

const MAX_RENDER_LIST = 100;
const DETAIL_CACHE = new Map();


function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function valorSeguro(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return escapeHtml(value);
}

function formatDateOnly(value) {
  if (!value) return '-';

  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;

  return d.toLocaleDateString('es-CO');
}

function obtenerMicrorruta(props) {
  return props.microrruta || props.Microruta || '';
}

function obtenerCuadrilla(props) {
  return props.cuadrilla || props.Cuadrilla || '';
}

function obtenerLote(props) {
  return props.lote || props.No_Lote || props.no_lote || '';
}

function obtenerFrecuencia(props) {
  return props.frecuencia || props.Frecuencia || props.FRECUENCIA || '';
}

function obtenerSemana(props) {
  return props.semana || props.Semana || props.SEMANA || '';
}

function obtenerDiasEjecucion(props) {
  return (
    props.dias_ejecucion ||
    props['Día_de_ej'] ||
    props['Dia_de_ej'] ||
    props.dia_de_ej ||
    props.DIA_DE_EJ ||
    props.dias ||
    props.DIAS ||
    ''
  );
}

function obtenerQuincena(props) {
  return props.quincena || props.Quincena || props.QUINCENA || '';
}

function esNovedadEjecucion(props) {
  const estado = String(props?.estado || '').trim();
  return estado === 'Ejecutado con novedad' || estado === 'No ejecutado con novedad';
}

function esNovedadActiva(value) {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    String(value || '').trim().toLowerCase() === 'true'
  );
}

function getDetailCacheKey({ microrruta, cuadrilla, lote, quincena }) {
  return [
    String(microrruta || '').trim().toUpperCase(),
    String(cuadrilla || '').trim().toUpperCase(),
    String(lote || '').trim().toUpperCase(),
    String(quincena || '').trim().toUpperCase()
  ].join('|');
}

function invalidateVisibleCache() {
  STATE._visibleCache = null;
  STATE._visibleCacheKey = '';
}

export function limpiarCacheDetalle() {
  DETAIL_CACHE.clear();
}

function getLayerByFeatureId(featureId) {
  if (!featureId) return null;

  if (STATE.layerIndex && STATE.layerIndex[featureId]) {
    return STATE.layerIndex[featureId];
  }

  if (!STATE.geojsonLayer) return null;

  let found = null;

  STATE.geojsonLayer.eachLayer((layer) => {
    if (!found && String(layer.feature?.id) === String(featureId)) {
      found = layer;
    }
  });

  return found;
}

function zoomToFeature(feature) {
  if (!feature || !STATE.map) return;

  const layer = getLayerByFeatureId(feature.id);
  if (!layer) return;

  const bounds = layer.getBounds?.();

  if (bounds?.isValid?.()) {
    STATE.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
  } else if (layer.getLatLng) {
    STATE.map.flyTo(layer.getLatLng(), 18);
  }
}

/* =========================
   Context fetch
========================= */

function buildContextUrl({ microrruta, cuadrilla, lote, quincena }) {
  const callback = `ctx_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const url = new URL(CONFIG.WEBAPP_URL);

  url.searchParams.set('callback', callback);
  url.searchParams.set('api', '1');
  url.searchParams.set('action', 'contextoReporte');
  url.searchParams.set('microrruta', microrruta || '');
  url.searchParams.set('cuadrilla', cuadrilla || '');
  url.searchParams.set('lote', lote || '');
  url.searchParams.set('quincena', quincena || '');

  return { url: url.toString(), callback };
}

function fetchMicrorrutaContext({ microrruta, cuadrilla, lote, quincena }) {
  return new Promise((resolve, reject) => {
    if (!microrruta || !cuadrilla) {
      resolve(null);
      return;
    }

    const { url, callback } = buildContextUrl({ microrruta, cuadrilla, lote, quincena });
    const script = document.createElement('script');

    window[callback] = (res) => {
      try {
        delete window[callback];
      } catch (_) {}

      script.remove();

      if (res?.meta?.status && Number(res.meta.status) >= 400) {
        reject(new Error(res.meta.message || 'No fue posible cargar el contexto'));
        return;
      }

      resolve(res?.data || null);
    };

    script.onerror = () => {
      try {
        delete window[callback];
      } catch (_) {}

      script.remove();
      reject(new Error('No fue posible cargar el detalle de la microrruta'));
    };

    script.src = url;
    document.body.appendChild(script);
  });
}

function fetchMicrorrutaContextCached(params) {
  const key = getDetailCacheKey(params);

  if (DETAIL_CACHE.has(key)) {
    return Promise.resolve(DETAIL_CACHE.get(key));
  }

  return fetchMicrorrutaContext(params).then((data) => {
    DETAIL_CACHE.set(key, data);
    return data;
  });
}

/* =========================
   Render detalle novedad
========================= */

function renderNovedadItem(activa, index = 0) {
  const titulo = index > 0 ? `Tipo de novedad activa ${index + 1}` : 'Tipo de novedad activa';

  return `
    <div class="detail-item full-width detail-alert">
      <span class="detail-label">${titulo}</span>
      <span class="detail-value">${valorSeguro(activa.tipo_novedad || 'Sin tipo')}</span>
    </div>

    <div class="detail-item">
      <span class="detail-label">Fecha reporte novedad</span>
      <span class="detail-value">${valorSeguro(formatDateOnly(activa.fecha_reporte_novedad))}</span>
    </div>

    <div class="detail-item">
      <span class="detail-label">Estado novedad</span>
      <span class="detail-value">${valorSeguro(activa.estado_novedad || 'REPORTADA')}</span>
    </div>

    <div class="detail-item">
      <span class="detail-label">Inicio subsanación</span>
      <span class="detail-value">${valorSeguro(formatDateOnly(activa.fecha_inicio_subsanacion))}</span>
    </div>

    <div class="detail-item">
      <span class="detail-label">Fin subsanación</span>
      <span class="detail-value">${valorSeguro(formatDateOnly(activa.fecha_fin_subsanacion))}</span>
    </div>
  `;
}

function renderNovedadActiva(detalle) {
  const registro = detalle?.registro || {};
  const activasLista = Array.isArray(detalle?.novedades_activas) ? detalle.novedades_activas : [];
  const activaRegistro = registro?.novedad_activa || null;

  let activas = [];

  if (activasLista.length) {
    activas = activasLista;
  } else if (activaRegistro) {
    activas = [activaRegistro];
  }

  if (!activas.length) {
    return `
      <div class="detail-item full-width">
        <span class="detail-label">Novedad activa reportada</span>
        <span class="detail-value">Sin novedad activa</span>
      </div>
    `;
  }

  return activas
    .map((activa, index) => renderNovedadItem(activa, index))
    .join('');
}

/* =========================
   Popup
========================= */

export function createPopup(props) {
  return `
    <div class="popup-card">
      <strong>${valorSeguro(obtenerMicrorruta(props))}</strong><br>
      <span>Frecuencia: ${valorSeguro(obtenerFrecuencia(props))}</span><br>
      <span>Semana: ${valorSeguro(obtenerSemana(props))}</span><br>
      <span>Días: ${valorSeguro(obtenerDiasEjecucion(props))}</span>
    </div>
  `;
}

/* =========================
   Panel detalle
========================= */

export function renderInfoPanel(feature) {
  const props = feature.properties || {};
  const panel = document.getElementById('info-panel');
  const content = document.getElementById('panel-content');

  if (!panel || !content) return;

  const microrruta = obtenerMicrorruta(props);
  const cuadrilla = obtenerCuadrilla(props);
  const lote = obtenerLote(props);
  const quincena = obtenerQuincena(props);
  const requestKey = `${microrruta}|${cuadrilla}|${lote}|${quincena}|${feature.id || ''}`;
  const mostrarNovedadEjecucion = esNovedadEjecucion(props);

  content.dataset.requestKey = requestKey;
  content.innerHTML = `
    <div class="detail-card">
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Microrruta</span>
          <span class="detail-value">${valorSeguro(microrruta)}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Cuadrilla</span>
          <span class="detail-value">${valorSeguro(props.cuadrilla_display || cuadrilla)}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Lote</span>
          <span class="detail-value">${valorSeguro(lote)}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Estado lote</span>
          <span class="status-chip status-${slugifyState(props.estado)}">
            ${valorSeguro(props.estado || 'Pendiente')}
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Frecuencia</span>
          <span class="detail-value">${valorSeguro(obtenerFrecuencia(props))}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Semana</span>
          <span class="detail-value">${valorSeguro(obtenerSemana(props))}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Quincena</span>
          <span class="detail-value">${valorSeguro(quincena || '-')}</span>
        </div>

        <div class="detail-item full-width">
          <span class="detail-label">Días de ejecución</span>
          <span class="detail-value">${valorSeguro(obtenerDiasEjecucion(props))}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Fecha inicio ejecución</span>
          <span class="detail-value">${valorSeguro(formatDateOnly(props.fecha_inicio))}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Fecha fin ejecución</span>
          <span class="detail-value">${valorSeguro(formatDateOnly(props.fecha_fin))}</span>
        </div>

        <div class="detail-item full-width ${mostrarNovedadEjecucion ? 'detail-alert' : ''}">
          <span class="detail-label">Novedad de ejecución</span>
          <span class="detail-value">
            ${mostrarNovedadEjecucion
              ? valorSeguro(props.tipo_novedad_ejecucion || 'Sin tipo')
              : 'Sin novedad en la ejecución'}
          </span>
        </div>

        <div id="panel-novedad-extra" class="full-width">
          <div class="detail-item full-width">
            <span class="detail-label">Novedad activa reportada</span>
            <span class="detail-value">Cargando detalle...</span>
          </div>
        </div>
      </div>

      <div class="readonly-banner">
        <i class="fas fa-eye"></i>
        Este visor es de solo lectura.
      </div>

      <div class="panel-actions panel-actions-double">
        <button id="btn-open-editor" class="btn-primary">
          <i class="fas fa-pen"></i>Modificar
        </button>

        <button id="btn-report-novedad" class="btn-secondary">
          <i class="fas fa-bullhorn"></i>Reportar novedad
        </button>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');

  document.getElementById('btn-open-editor')?.addEventListener('click', () => {
    abrirGestion({ microrruta, cuadrilla, lote, quincena });
  });

  document.getElementById('btn-report-novedad')?.addEventListener('click', () => {
    abrirReporteNovedad({ microrruta, cuadrilla, lote, quincena });
  });

  fetchMicrorrutaContextCached({ microrruta, cuadrilla, lote, quincena })
    .then((detalle) => {
      if (content.dataset.requestKey !== requestKey) return;

      const container = document.getElementById('panel-novedad-extra');
      if (!container) return;

      container.innerHTML = renderNovedadActiva(detalle);
    })
    .catch(() => {
      if (content.dataset.requestKey !== requestKey) return;

      const container = document.getElementById('panel-novedad-extra');
      if (!container) return;

      const hayNovedadActiva = esNovedadActiva(props.novedad_activa);

      container.innerHTML = hayNovedadActiva
        ? `
          <div class="detail-item full-width detail-alert">
            <span class="detail-label">Novedad activa reportada</span>
            <span class="detail-value">Hay una novedad activa registrada, pero no fue posible cargar el detalle.</span>
          </div>
        `
        : `
          <div class="detail-item full-width">
            <span class="detail-label">Novedad activa reportada</span>
            <span class="detail-value">Sin novedad activa</span>
          </div>
        `;
    });
}

function getVisibleFeatures() {
  const filtersKey = [...STATE.activeFilters].sort().join(',');
  const dataLength = Array.isArray(STATE.microrrutasData) ? STATE.microrrutasData.length : 0;
  const key = `${STATE.searchTerm || ''}|${filtersKey}|${dataLength}`;

  if (STATE._visibleCacheKey === key && Array.isArray(STATE._visibleCache)) {
    return STATE._visibleCache;
  }

  const result = (STATE.microrrutasData || [])
    .filter((feature) => {
      const props = feature.properties || {};
      return (
        matchesStateFilter(props.estado, STATE.activeFilters) &&
        matchesSearchTerm(props, STATE.searchTerm)
      );
    })
    .sort((a, b) => {
      const byState = stateSortWeight(a.properties.estado) - stateSortWeight(b.properties.estado);
      if (byState !== 0) return byState;

      const micA = String(obtenerMicrorruta(a.properties) || '');
      const micB = String(obtenerMicrorruta(b.properties) || '');
      return micA.localeCompare(micB);
    });

  STATE._visibleCache = result;
  STATE._visibleCacheKey = key;

  return result;
}

function zoomToFirstVisibleResult() {
  const visible = getVisibleFeatures();
  if (!visible.length) return;
  zoomToFeature(visible[0]);
}

function handleLayerListClick(event) {
  const btn = event.target.closest('[data-feature-id]');
  if (!btn) return;

  const feature = (STATE.microrrutasData || []).find(
    (item) => String(item.id) === String(btn.dataset.featureId)
  );

  if (!feature) return;

  STATE.selectedFeatureId = feature.id;
  renderInfoPanel(feature);
  zoomToFeature(feature);
  renderLayersList();
}

export function renderLayersList() {
  const list = document.getElementById('layers-list');
  if (!list) return;

  if (!list.dataset.listenerAttached) {
    list.addEventListener('click', handleLayerListClick);
    list.dataset.listenerAttached = 'true';
  }

  const allVisible = getVisibleFeatures();
  const visible = allVisible.slice(0, MAX_RENDER_LIST);

  if (!allVisible.length) {
    list.innerHTML = '<div class="empty-list">No hay resultados con los filtros actuales.</div>';
    return;
  }

  const extraCount = allVisible.length - visible.length;

  list.innerHTML = `
    ${visible.map((feature) => {
      const props = feature.properties || {};
      const selected = STATE.selectedFeatureId === feature.id ? ' selected' : '';
      const etiqueta = esNovedadActiva(props.novedad_activa)
        ? 'Novedad activa'
        : (props.tipo_novedad_ejecucion || props.estado || 'Pendiente');

      return `
        <button class="route-item${selected}" data-feature-id="${feature.id}">
          <span class="route-title">${valorSeguro(obtenerMicrorruta(props))}</span>
          <span class="route-meta">
            ${valorSeguro(props.cuadrilla_display || obtenerCuadrilla(props))} ·
            Lote ${valorSeguro(obtenerLote(props))}
          </span>
          <span class="route-status">${valorSeguro(etiqueta)}</span>
        </button>
      `;
    }).join('')}

    ${extraCount > 0
      ? `<div class="empty-list">Mostrando ${visible.length} de ${allVisible.length} resultados. Usa la búsqueda para filtrar.</div>`
      : ''}
  `;
}

export function updateStats() {
  const data = STATE.microrrutasData || [];

  const pendientes = data.filter(
    (feature) => String(feature.properties?.estado || 'Pendiente') === 'Pendiente'
  ).length;

  const enProceso = data.filter(
    (feature) => String(feature.properties?.estado || '') === 'En proceso'
  ).length;

  const ejecutadas = data.filter(
    (feature) => String(feature.properties?.estado || '').includes('Ejecutado')
  ).length;

  const reportadasConNovedad = data.filter((feature) => {
    const value = feature.properties?.novedad_activa;
    return (
      value === true ||
      value === 1 ||
      value === '1' ||
      String(value || '').trim().toLowerCase() === 'true'
    );
  }).length;

  const pendingEl = document.getElementById('pending-routes');
  const processEl = document.getElementById('in-progress');
  const completedEl = document.getElementById('completed');
  const reportedEl = document.getElementById('reported-issues');

  if (pendingEl) pendingEl.textContent = pendientes;
  if (processEl) processEl.textContent = enProceso;
  if (completedEl) completedEl.textContent = ejecutadas;
  if (reportedEl) reportedEl.textContent = reportadasConNovedad;
}

export function setupUI(renderApp) {
  document.getElementById('refresh-data')?.addEventListener('click', () => {
    invalidateVisibleCache();
    limpiarCacheDetalle();
    location.reload();
  });

  document.getElementById('close-panel')?.addEventListener('click', () => {
    document.getElementById('info-panel')?.classList.add('hidden');
    STATE.selectedFeatureId = null;
    renderLayersList();
  });

  const searchInput = document.getElementById('search-input');
  const clearSearch = document.getElementById('clear-search');

  function syncClearButton() {
    if (!clearSearch || !searchInput) return;

    if ((searchInput.value || '').trim()) {
      clearSearch.classList.remove('hidden');
    } else {
      clearSearch.classList.add('hidden');
    }
  }

  let searchTimeout;

  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      STATE.searchTerm = e.target.value || '';
      invalidateVisibleCache();

      renderApp({ fitBounds: false });
      syncClearButton();

      if (STATE.searchTerm.trim()) {
        zoomToFirstVisibleResult();
      }
    }, 300);
  });

  clearSearch?.addEventListener('click', () => {
    if (!searchInput) return;

    clearTimeout(searchTimeout);
    searchInput.value = '';
    STATE.searchTerm = '';
    invalidateVisibleCache();

    renderApp({ fitBounds: false });
    syncClearButton();
    searchInput.focus();
  });

  syncClearButton();

  document.querySelectorAll('.filter-options input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        STATE.activeFilters.add(checkbox.value);
      } else {
        STATE.activeFilters.delete(checkbox.value);
      }

      invalidateVisibleCache();
      renderApp({ fitBounds: false });

      if (STATE.searchTerm.trim()) {
        zoomToFirstVisibleResult();
      }
    });
  });
}
