# 🗳️ E-14 Electoral Analytics Dashboard

Este proyecto es una herramienta avanzada de analítica para el cruce de datos electorales. Compara proyecciones de votantes (**Día D**) con resultados reales extraídos de formularios **E-14** mediante IA (Gemini Pro Vision).

### 🚀 **App En Vivo**: [https://Gemay1984.github.io/VOTA/](https://Gemay1984.github.io/VOTA/)

---

## ✨ Características Principales

*   **Sincronización en Directo**: Se conecta directamente a tus Google Sheets.
*   **Emparejamiento Inteligente (Fuzzy Matching)**: Algoritmo que asocia automáticamente puestos de votación con carpetas de E-14, incluso con abreviaturas (ej: "L.V." → "Laura Vicuña").
*   **Privacidad Total (Serverless)**: Los archivos se procesan 100% en el navegador del usuario. Tus datos de votantes nunca salen de tu computadora.
*   **Visualización de Impacto**: 
    *   📊 Gráfico de rosca dinámico para efectividad por mesa.
    *   🚦 Semáforos de cumplimiento (Verde/Amarillo/Rojo).
    *   ⚠️ Detección de mesas compartidas entre múltiples líderes.

## 🛠️ Configuración (Backend con Apps Script)

Para una experiencia profesional y privada, usa la integración con **Google Apps Script** incluida en este repo (`Code.gs`):

1.  En tu Google Sheet, ve a **Extensiones > Apps Script**.
2.  Pega el contenido del archivo **[Code.gs](https://github.com/Gemay1984/VOTA/blob/main/Code.gs)**.
3.  **Implementar > Nueva implementación > Aplicación Web**.
4.  Configura "Quién tiene acceso" como **"Cualquier persona"**.
5.  Copia la URL generada y pégala en el Dashboard.

## 💻 Ejecución Local

Si deseas realizar la extracción de PDFs desde tu máquina:

1.  Clona el repositorio.
2.  `npm install`
3.  Crea un `.env` con tu `GEMINI_API_KEY`.
4.  Extrae datos: `node gemini_extractor.js`.
5.  Visualiza: Abre `index.html` o usa un Live Server.

---
> [!IMPORTANT]
> **Privacidad**: Este software no almacena datos en servidores externos. Todo el procesamiento de información sensible (nombres, cédulas) ocurre únicamente en el cliente (navegador).
