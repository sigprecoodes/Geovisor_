import { STATE } from './state.js';
import { fetchSheetData } from './api.js';
import { normalizeText, inferCuadrillaFromPath, extractQuadrillaNumber } from './utils.js';

function normalizarBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    String(value || '').trim().toLowerCase() === 'true' ||
    String(value || '').trim().toLowerCase() === 'si' ||
    String(value || '').trim().toLowerCase() === 'sí'
  );
}

function obtenerLoteSeguro(value) {
  return String(value == null ? '' : value).trim();
}

function claveRegistro(microrruta, cuadrilla, lote = '') {
  return `${normalizeText(microrruta)}|${normalizeText(cuadrilla)}|${normalizeText(lote)}`;
}

function construirIndiceSheetData(rows) {
  const index = new Map();

  (rows || []).forEach((row) => {
    const microrruta = row.microrruta || row.Microruta || row.MICRORRUTA || '';
    const cuadrilla = row.cuadrilla || row.Cuadrilla || row.CUADRILLA || '';
    const lote = obtenerLoteSeguro(
      row.lote || row.Lote || row.No_Lote || row.NO_LOTE || row.no_lote || ''
    );

    if (!microrruta || !cuadrilla) return;

    index.set(claveRegistro(microrruta, cuadrilla, lote), {
      cuadrilla: row.cuadrilla || row.Cuadrilla || row.CUADRILLA || '',
      microrruta: row.microrruta || row.Microruta || row.MICRORRUTA || '',
      lote,
      estado: row.estado || row.ESTADO || 'Pendiente',
      fecha_inicio: row.fecha_inicio || row.FECHA_INICIO || '',
      fecha_fin: row.fecha_fin || row.FECHA_FIN || '',
      tipo_novedad_ejecucion: row.tipo_novedad_ejecucion || row.tipo_novedad || row.TIPO || '',
      novedad_activa: normalizarBoolean(
        row.novedad_activa !== undefined ? row.novedad_activa : row.novedad
      ),
      usuario: row.usuario || row.USUARIO || '',
      rol: row.rol || row.ROL || '',
      frecuencia: row.frecuencia || row.FRECUENCIA || '',
      semana: row.semana || row.SEMANA || '',
      dia: row.dia || row.DÍA || row.DIA || '',
      quincena: row.quincena || row.QUINCENA || '',
      quincenas_disponibles: Array.isArray(row.quincenas_disponibles) ? row.quincenas_disponibles : []
    });
  });

  return index;
}

function findSheetRow(index, microrruta, cuadrilla, lote, cuadrillaNumber) {
  const loteNormalizado = normalizeText(lote);
  const direct = index.get(claveRegistro(microrruta, cuadrilla, lote));
  if (direct) return direct;

  for (const row of index.values()) {
    if (normalizeText(row.microrruta) !== normalizeText(microrruta)) continue;
    if (loteNormalizado && normalizeText(row.lote) !== loteNormalizado) continue;

    const rowNumber = extractQuadrillaNumber(row.cuadrilla || '');
    if (rowNumber && cuadrillaNumber && rowNumber === cuadrillaNumber) {
      return row;
    }
  }

  for (const row of index.values()) {
    if (normalizeText(row.microrruta) !== normalizeText(microrruta)) continue;
    if (normalizeText(row.cuadrilla) !== normalizeText(cuadrilla)) continue;
    if (loteNormalizado && normalizeText(row.lote) !== loteNormalizado) continue;
    return row;
  }

  return null;
}

async function loadGeoJSON() {
  const collections = await Promise.all(
    STATE.geojsonFiles.map(async (file) => {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`No se pudo cargar ${file} (${res.status})`);
      const geojson = await res.json();
      return { geojson, file };
    })
  );

  const index = construirIndiceSheetData(STATE.sheetData);

  STATE.microrrutasData = collections.flatMap(({ geojson, file }) => {
    const cuadrilla = inferCuadrillaFromPath(file);
    const cuadrillaNumber = extractQuadrillaNumber(cuadrilla);

    return (geojson.features || []).map((feature, indexFeature) => {
      const props = feature.properties || {};
      const microrruta = props.Microruta || props.microrruta || props.MICRORRUTA || '';
      const lote = obtenerLoteSeguro(
        props.No_Lote || props.NO_LOTE || props.Lote || props.lote || props.no_lote || ''
      );

      const row = findSheetRow(index, microrruta, cuadrilla, lote, cuadrillaNumber) || null;

      return {
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
          usuario: row?.usuario || '',
          rol: row?.rol || '',
          frecuencia: row?.frecuencia || '',
          semana: row?.semana || '',
          dia: row?.dia || '',
          quincena: row?.quincena || '',
          quincenas_disponibles: row?.quincenas_disponibles || []
        }
      };
    });
  });
}

export async function loadAllData() {
  STATE.sheetData = await fetchSheetData();
  await loadGeoJSON();
}