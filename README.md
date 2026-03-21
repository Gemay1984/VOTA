# E-14 Electoral Comparison Dashboard (Serverless Version)

Este Dashboard permite comparar las proyecciones de votantes de un archivo Excel contra los resultados reales de los formularios E-14, procesando todo **directamente en el navegador**.

## 🚀 Acceso Rápido (GitHub Pages)

Puedes usar la aplicación directamente aquí:  
**[https://Gemay1984.github.io/VOTA/](https://Gemay1984.github.io/VOTA/)**

## ✨ Características Especiales
- **Privacidad Total**: Los datos de tus archivos Excel nunca salen de tu computadora. Todo el cruce y el análisis se hace en la memoria de tu navegador.
- **Emparejamiento Inteligente**: Sistema de búsqueda aproximada para encontrar puestos de votación con nombres abreviados.
- **Visualización Gráfica**: Gráfico de rosca para efectividad general y listado de votantes por mesa.

## 🛠️ Cómo Usar

1. **Abre la App**: Ve al enlace de GitHub Pages mencionado arriba.
2. **Carga los Archivos**:
   - Pulsa el botón azul para cargar tu archivo de **Día D (Proyecciones)**.
   - Pulsa el botón verde para cargar tu archivo de **Resultados E-14 (OCR)**.
3. **Analiza**: Selecciona un líder y un candidato para ver el desglose inmediato.

## 💻 Desarrollo Local (Node.js)

Si prefieres usar el extractor de PDFs o correr el servidor localmente:

1. **Instala dependencias**: `npm install`
2. **Configura el API**: Crea un archivo `.env` con tu `GEMINI_API_KEY`.
3. **Extrae datos**: `node gemini_extractor.js`
4. **Dashboard Local**: Abre `index.html` directamente en tu navegador o usa un live server.

> [!IMPORTANT]
> Este repositorio NO contiene datos reales. Debes cargar tus propios archivos Excel para ver resultados.
