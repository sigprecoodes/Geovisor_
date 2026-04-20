import { CONFIG } from '../config.js';

export function fetchSheetData() {
  return new Promise((resolve) => {
    const callback = 'cb_' + Date.now();

    window[callback] = (res) => {
      delete window[callback];
      script.remove();
      resolve(res?.data || []);
    };

    const script = document.createElement('script');
    script.src = `${CONFIG.APPS_SCRIPT_URL}?callback=${callback}`;
    script.onerror = () => {
      delete window[callback];
      script.remove();
      console.error('No fue posible cargar los datos del Apps Script');
      resolve([]);
    };
    document.body.appendChild(script);
  });
}

export function buildAppUrl({ page, microrruta, cuadrilla, lote }) {
  const url = new URL(CONFIG.WEBAPP_URL);
  url.searchParams.set('page', page || 'gestion');
  url.searchParams.set('microrruta', microrruta || '');
  url.searchParams.set('cuadrilla', cuadrilla || '');
  url.searchParams.set('lote', lote || '');
  return url.toString();
}





