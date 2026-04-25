import { buildAppUrl } from './api.js';

export function abrirGestion({ microrruta, cuadrilla, lote, quincena }) {
  const url = buildAppUrl({
    page: 'gestion',
    microrruta,
    cuadrilla,
    lote,
    quincena
  });

  window.open(url, '_blank', 'noopener,noreferrer');
}

export function abrirReporteNovedad({ microrruta, cuadrilla, lote, quincena }) {
  const url = buildAppUrl({
    page: 'reporte',
    microrruta,
    cuadrilla,
    lote,
    quincena
  });

  window.open(url, '_blank', 'noopener,noreferrer');
}





