/**
 * Google Apps Script para el Dashboard Electoral
 * Pgalo en: Extensiones -> Apps Script
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; // Lee la primera hoja
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convertir a Arreglo de Objetos
    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });

    // Retornar JSON con CORS habilitado
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
