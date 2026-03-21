/**
 * Google Apps Script UNIFICADO para el Dashboard Electoral
 * Maneja ambos archivos (Día D y E-14) en un solo script.
 */

const ID_DIA_D = "1778ou7qmVONTRw_jP7d64RdRN8n0gjlDOAEKEhBIicU";
const ID_E14   = "1K5IB7SxWbq9b2s29Tblta4QLjpYrdTPc-2_6BVNYRww";

function doGet(e) {
  try {
    // 1. Obtener datos de Día D
    const dataDiaD = getSheetDataAsJson(ID_DIA_D);
    
    // 2. Obtener datos de E-14
    const dataE14 = getSheetDataAsJson(ID_E14);
    
    // 3. Responder con el objeto combinado
    const response = {
      diad: dataDiaD,
      e14: dataE14,
      timestamp: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función auxiliar para leer cualquier hoja por ID y devolver JSON
 */
function getSheetDataAsJson(id) {
  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}
