import { STATE } from './state.js';
import { fetchSheetData } from './api.js';
import {
  normalizeText,
  inferCuadrillaFromPath,
  extractQuadrillaNumber
} from './utils.js';

function normalizarBoolean(value) {
  const raw = String(value ?? '').trim().toLowerCase();

  return (
    value === true ||
    value === 1 ||
    raw === '1' ||
    raw === 'true' ||
    raw === 'si' ||
    raw === 'sí'
  );
}

function obtenerLoteSeguro(value) {
  return String(value ?? '').trim();
}

function claveRegistro(microrruta, cuadrilla, lote = '') {
  return `${normalizeText(microrruta)}|${normalizeText(cuadrilla)}|${normalizeText(lote)}`;
}

function claveMicrorrutaLote(microrruta, lote = '') {
  return `${normalizeText(microrruta)}|${normalizeText(lote)}`;
}

function mapRow(row) {
  const microrruta = row.microrruta || row.Microruta || row.MICRORRUTA || '';
  const cuadrilla = row.cuadrilla || row.Cuadrilla || row.CUADRILLA || '';
  const lote = obtenerLoteSeguro(
    row.lote ||
    row.Lote ||
    row.No_Lote ||
    row.NO_LOTE ||
    row.no_lote ||
    ''
  );

  return {
    cuadrilla,
    microrruta,
    lote,

    estado: row.estado || row.ESTADO || 'Pendiente',
    fecha_inicio: row.fecha_inicio || row.FECHA_INICIO || '',
    fecha_fin: row.fecha_fin || row.FECHA_FIN || '',
    tipo_novedad_ejecucion:
      row.tipo_novedad_ejecucion ||
      row.tipo_novedad ||
      row.TIPO ||
      '',

    novedad_activa: normalizarBoolean(
      row.novedad_activa !== undefined ? row.novedad_activa : row.novedad
    ),

    // =========================
    // NOVEDAD ACTIVA DESDE BACKEND
    // =========================
    tipo_novedad_activa: row.tipo_novedad_activa || '',
    fecha_reporte_novedad_activa: row.fecha_reporte_novedad_activa || '',
    estado_novedad_activa: row.estado_novedad_activa || '',
    fecha_inicio_subsanacion_activa: row.fecha_inicio_subsanacion_activa || '',
    fecha_fin_subsanacion_activa: row.fecha_fin_subsanacion_activa || '',

    usuario: row.usuario || row.USUARIO || '',
    rol: row.rol || row.ROL || '',
    frecuencia: row.frecuencia || row.FRECUENCIA || '',
    semana: row.semana || row.SEMANA || '',
    dia: row.dia || row.DÍA || row.DIA || '',
    quincena: row.quincena || row.QUINCENA || '',
    quincenas_disponibles: Array.isArray(row.quincenas_disponibles)
      ? row.quincenas_disponibles
      : [],

    cuadrillaNumber: extractQuadrillaNumber(cuadrilla || '')
  };
}

function construirIndicesSheetData(rows) {
  const byFullKey = new Map();
  const byMicLote = new Map();

  (rows || []).forEach((rawRow) => {
    const row = mapRow(rawRow);

    if (!row.microrruta || !row.cuadrilla) return;

    byFullKey.set(
      claveRegistro(row.microrruta, row.cuadrilla, row.lote),
      row
    );

    const micLoteKey = claveMicrorrutaLote(row.microrruta, row.lote);

    if (!byMicLote.has(micLoteKey)) {
      byMicLote.set(micLoteKey, []);
    }

    byMicLote.get(micLoteKey).push(row);
  });

  return {
    byFullKey,
    byMicLote
  };
}

function findSheetRow(indices, microrruta, cuadrilla, lote, cuadrillaNumber) {
  const direct = indices.byFullKey.get(
    claveRegistro(microrruta, cuadrilla, lote)
  );

  if (direct) return direct;

  const candidates =
    indices.byMicLote.get(claveMicrorrutaLote(microrruta, lote)) || [];

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (cuadrillaNumber) {
    const byNumber = candidates.find(
      (row) => row.cuadrillaNumber === cuadrillaNumber
    );

    if (byNumber) return byNumber;
  }

  const byCuadrilla = candidates.find(
    (row) => normalizeText(row.cuadrilla) === normalizeText(cuadrilla)
  );

  return byCuadrilla || null;
}

async function fetchGeoJsonFile(file) {
  const res = await fetch(file);

  if (!res.ok) {
    throw new Error(`No se pudo cargar ${file} (${res.status})`);
  }

  const geojson = await res.json();

  return {
    geojson,
    file
  };
}

async function loadGeoJSON() {
  const collections = await Promise.all(
    (STATE.geojsonFiles || []).map(fetchGeoJsonFile)
  );

  const indices = construirIndicesSheetData(STATE.sheetData);
  const features = [];

  collections.forEach(({ geojson, file }) => {
    const cuadrilla = inferCuadrillaFromPath(file);
    const cuadrillaNumber = extractQuadrillaNumber(cuadrilla);

    (geojson.features || []).forEach((feature, indexFeature) => {
      const props = feature.properties || {};

      const microrruta =
        props.Microruta ||
        props.microrruta ||
        props.MICRORRUTA ||
        '';

      const lote = obtenerLoteSeguro(
        props.No_Lote ||
        props.NO_LOTE ||
        props.Lote ||
        props.lote ||
        props.no_lote ||
        ''
      );

      const row = findSheetRow(
        indices,
        microrruta,
        cuadrilla,
        lote,
        cuadrillaNumber
      );

      features.push({
        ...feature,
        id: feature.id ?? `${cuadrilla}-${microrruta}-${lote || indexFeature}`,
        properties: {
          ...props,

          microrruta,
          lote,
          cuadrilla,
          cuadrilla_display: cuadrilla.replace('_', ' '),

          estado: row?.estado || 'Pendiente',
          fecha_inicio: row?.fecha_inicio || '',
          fecha_fin: row?.fecha_fin || '',
          tipo_novedad_ejecucion: row?.tipo_novedad_ejecucion || '',
          novedad_activa: normalizarBoolean(row?.novedad_activa),


          tipo_novedad_activa: row?.tipo_novedad_activa || '',
          fecha_reporte_novedad_activa:
            row?.fecha_reporte_novedad_activa || '',
          estado_novedad_activa:
            row?.estado_novedad_activa || '',
          fecha_inicio_subsanacion_activa:
            row?.fecha_inicio_subsanacion_activa || '',
          fecha_fin_subsanacion_activa:
            row?.fecha_fin_subsanacion_activa || '',

          usuario: row?.usuario || '',
          rol: row?.rol || '',
          frecuencia: row?.frecuencia || '',
          semana: row?.semana || '',
          dia: row?.dia || '',
          quincena: row?.quincena || '',
          quincenas_disponibles: row?.quincenas_disponibles || []
        }
      });
    });
  });

  STATE.microrrutasData = features;

  STATE._visibleCache = null;
  STATE._visibleCacheKey = '';
}

export async function loadAllData() {
  STATE.sheetData = await fetchSheetData();
  await loadGeoJSON();
}
