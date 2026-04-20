# Geovisor

Aplicación web estática para visualizar microrrutas en mapa, consultar su estado y abrir formularios de gestión y reporte de novedades.

## Estructura

- `index.html`: punto de entrada de la aplicación.
- `config.js`: rutas de archivos GeoJSON y URLs del backend en Google Apps Script.
- `styles/main.css`: estilos globales.
- `js/`: lógica de la aplicación.
- `data/`: archivos GeoJSON por cuadrilla.
- `assets/img/`: recursos gráficos.

## Cómo usar

1. Clona este repositorio.
2. Abre `index.html` en un navegador, o publícalo en GitHub Pages.
3. Verifica que las URLs en `config.js` apunten al Apps Script correcto.

## Publicación en GitHub Pages

1. Sube el contenido del repositorio a GitHub.
2. En el repositorio, ve a **Settings > Pages**.
3. En **Build and deployment**, selecciona la rama principal y la carpeta `/root`.
4. Guarda los cambios y espera la URL pública.

## Notas

- Este proyecto depende de servicios externos como Leaflet, Font Awesome y Google Fonts.
- También depende de un endpoint de Google Apps Script configurado en `config.js`.
