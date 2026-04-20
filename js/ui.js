import { STATE } from './state.js';
import { abrirGestion, abrirReporteNovedad } from './actions.js';
import { CONFIG } from '../config.js';
import {
  matchesStateFilter,
  stateSortWeight,
  matchesSearchTerm,
  slugifyState
} from './utils.js';

/* =========================
   Helpers
========================= */

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

/* =========================
   Context fetch
========================= */

function buildContextUrl({ microrruta, cuadrilla, lote }) {
  const callback = `ctx_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const url = new URL(CONFIG.WEBAPP_URL);

  url.searchParams.set('callback', callback);
  url.searchParams.set('api', '1');
  url.searchParams.set('action', 'contextoReporte');
  url.searchParams.set('microrruta', microrruta || '');
  url.searchParams.set('cuadrilla', cuadrilla || '');
  url.searchParams.set('lote', lote || '');

  return { url: url.toString(), callback };
}

function fetchMicrorrutaContext({ microrruta, cuadrilla, lote }) {
  return new Promise((resolve, reject) => {
    if (!microrruta || !cuadrilla) {
      resolve(null);
      return;
    }

    const { url, callback } = buildContextUrl({ microrruta, cuadrilla, lote });
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

/* =========================
   Render detalle novedad
========================= */

function renderNovedadActiva(detalle) {
  const registro = detalle?.registro || {};
  const activa = registro?.novedad_activa || null;

  if (!activa) {
    return `
      <div class="detail-item full-width">
        <span class="detail-label">Novedad activa reportada</span>
        <span class="detail-value">Sin novedad activa</span>
      </div>
    `;
  }

  return `
    <div class="detail-item full-width detail-alert">
      <span class="detail-label">Tipo de novedad activa</span>
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

  const microrruta = obtenerMicrorruta(props);
  const cuadrilla = obtenerCuadrilla(props);
  const lote = obtenerLote(props);
  const requestKey = `${microrruta}|${cuadrilla}|${feature.id || ''}`;
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
    abrirGestion({ microrruta, cuadrilla, lote });
  });

  document.getElementById('btn-report-novedad')?.addEventListener('click', () => {
    abrirReporteNovedad({ microrruta, cuadrilla, lote });
  });

  fetchMicrorrutaContext({ microrruta, cuadrilla, lote })
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

      container.innerHTML = `
        <div class="detail-item full-width">
          <span class="detail-label">Novedad reportada activa</span>
          <span class="detail-value">No fue posible cargar el detalle.</span>
        </div>
      `;
    });
}

/* =========================
   Lista y zoom
========================= */

function getVisibleFeatures() {
  return STATE.microrrutasData
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
}

function zoomToFirstVisibleResult() {
  const visible = getVisibleFeatures();
  if (!visible.length || !STATE.geojsonLayer || !STATE.map) return;

  const firstFeature = visible[0];

  STATE.geojsonLayer.eachLayer((layer) => {
    if (layer.feature?.id === firstFeature.id) {
      const bounds = layer.getBounds?.();
      if (bounds?.isValid?.()) {
        STATE.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
      } else if (layer.getLatLng) {
        STATE.map.flyTo(layer.getLatLng(), 18);
      }
    }
  });
}

export function renderLayersList() {
  const list = document.getElementById('layers-list');
  if (!list) return;

  const visible = getVisibleFeatures();

  if (!visible.length) {
    list.innerHTML = '<div class="empty-list">No hay resultados con los filtros actuales.</div>';
    return;
  }

  list.innerHTML = visible.map((feature) => {
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
  }).join('');

  list.querySelectorAll('[data-feature-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const feature = STATE.microrrutasData.find(
        (item) => String(item.id) === btn.dataset.featureId
      );

      if (!feature) return;

      STATE.selectedFeatureId = feature.id;
      renderInfoPanel(feature);

      if (STATE.geojsonLayer) {
        STATE.geojsonLayer.eachLayer((layer) => {
          if (layer.feature?.id === feature.id) {
            const bounds = layer.getBounds?.();
            if (bounds?.isValid?.()) {
              STATE.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
            } else if (layer.getLatLng) {
              STATE.map.flyTo(layer.getLatLng(), 18);
            }
          }
        });
      }

      renderLayersList();
    });
  });
}

/* =========================
   Stats
========================= */

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

/* =========================
   UI events
========================= */

export function setupUI(renderApp) {
  document.getElementById('refresh-data')?.addEventListener('click', () => {
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

  searchInput?.addEventListener('input', (e) => {
    STATE.searchTerm = e.target.value || '';
    renderApp();
    syncClearButton();

    if (STATE.searchTerm.trim()) {
      zoomToFirstVisibleResult();
    }
  });

  clearSearch?.addEventListener('click', () => {
    if (!searchInput) return;

    searchInput.value = '';
    STATE.searchTerm = '';
    renderApp();
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

      renderApp();

      if (STATE.searchTerm.trim()) {
        zoomToFirstVisibleResult();
      }
    });
  });
}

