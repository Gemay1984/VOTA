/**
 * Google Apps Script UNIFICADO para el Dashboard Electoral (VERSIÓN TRUNCADA/LIMPIA)
 * Maneja ambos archivos (Día D y E-14) en un solo script.
 */

const ID_DIA_D = "1778ou7qmVONTRw_jP7d64RdRN8n0gjlDOAEKEhBIicU";
const ID_E14   = "1K5IB7SxWbq9b2s29Tblta4QLjpYrdTPc-2_6BVNYRww";

function doGet(e) {
  try {
    const resDiaD = getSheetData(ID_DIA_D);
    const resE14  = getSheetData(ID_E14);
    return ContentService.createTextOutput(JSON.stringify({diad: resDiaD, e14: resE14}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(id) {
  const ss = SpreadsheetApp.openById(id);
  const data = ss.getSheets()[0].getDataRange().getValues();
  // Limpiamos los encabezados de espacios accidentales
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => { 
      // Protegemos contra filas cortas
      obj[h] = (row[i] !== undefined) ? row[i] : ""; 
    });
    return obj;
  });
}
