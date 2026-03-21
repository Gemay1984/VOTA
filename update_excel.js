const path = require('path');
const XLSX = require('xlsx');

const BASE_DIR = 'C:/Users/PC/OneDrive/Escritorio/quindio';
const fileName = 'Resultados_E14_Gemini_Final.xlsx';
const filePath = path.join(BASE_DIR, fileName);

try {
    console.log("Leyendo el archivo Excel...");
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Parse to JSON array
    let data = XLSX.utils.sheet_to_json(sheet);
    let updated = false;

    // Find the row for E14_LV MESA 17.pdf and update it
    for (let i = 0; i < data.length; i++) {
        if (data[i]["Archivo"] === "E14_LV MESA 17.pdf") {
            console.log("¡Fila encontrada! Actualizando datos...");
            data[i]["Mesa"] = "017";
            data[i]["Partido de la U (Solo Partido)"] = "1";
            data[i]["Partido de la U (Cand 6)"] = "3";
            data[i]["Conservador (Solo Partido)"] = "1";
            data[i]["Conservador (Cand 11)"] = "1";
            updated = true;
            break;
        }
    }

    if (updated) {
        // Build new sheet and save
        const newSheet = XLSX.utils.json_to_sheet(data);
        workbook.Sheets[sheetName] = newSheet;
        XLSX.writeFile(workbook, filePath);
        console.log("¡Archivo Excel actualizado exitosamente con la última mesa!");
    } else {
        console.log("Advertencia: No se encontró la fila correspondiente a 'E14_LV MESA 17.pdf'.");
    }
} catch (error) {
    console.error("Error al actualizar el Excel:", error.message);
}
