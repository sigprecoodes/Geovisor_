export function getStyle(props) {
  const estado = props && props.estado ? props.estado : 'Pendiente';
  const tieneNovedadActiva =
    props && (
      props.novedad_activa === true ||
      props.novedad_activa === 1 ||
      props.novedad_activa === '1' ||
      String(props.novedad_activa || '').toLowerCase() === 'true'
    );

  const colors = {
    'Pendiente': '#374151',
    'En proceso': '#f5f10b',
    'Ejecutado': '#16a34a',
    'Ejecutado con novedad': '#ea580c',
    'No ejecutado con novedad': '#640099'
  };

  return {
    color: tieneNovedadActiva ? '#ff0000' : (colors[estado] || '#6b7280'),
    weight: tieneNovedadActiva ? 3 : 2,
    fillOpacity: tieneNovedadActiva ? 0.35 : 0.2
  };
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function inferCuadrillaFromPath(path) {
  const filename = String(path || '').split('/').pop() || '';
  const match = filename.match(/cuadrilla[_\s-]?(\d+)/i);
  return match ? `Cuadrilla_${match[1]}` : 'Cuadrilla';
}

export function extractQuadrillaNumber(value) {
  const match = String(value || '').match(/(\d+)/);
  return match ? match[1] : '';
}

export function matchesStateFilter(estado, filters) {
  return filters.has(estado || 'Pendiente');
}

export function matchesSearchTerm(props, searchTerm) {
  const term = normalizeText(searchTerm);
  if (!term) return true;

  const microrruta = normalizeText(
    props.microrruta ??
    props.Microruta ??
    props.MICRORRUTA ??
    ''
  );

  const lote = normalizeText(
    props.lote ??
    props.Lote ??
    props.No_Lote ??
    props.NO_LOTE ??
    ''
  );

  return microrruta.includes(term) || lote.includes(term);
}

export function formatDateValue(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('es-CO');
}

export function stateSortWeight(estado) {
  const order = {
    'En proceso': 0,
    'Pendiente': 1,
    'Ejecutado con novedad': 2,
    'No ejecutado con novedad': 3,
    'Ejecutado': 4
  };

  return order[estado] ?? 99;
}

export function slugifyState(value) {
  return String(value || 'pendiente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
