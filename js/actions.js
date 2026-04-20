import { buildAppUrl } from './api.js';

export function abrirGestion({ microrruta, cuadrilla, lote }) {
  const url = buildAppUrl({ page: 'gestion', microrruta, cuadrilla, lote });
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function abrirReporteNovedad({ microrruta, cuadrilla, lote }) {
  const url = buildAppUrl({ page: 'reporte', microrruta, cuadrilla, lote });
  window.open(url, '_blank', 'noopener,noreferrer');
}





