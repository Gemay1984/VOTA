const XLSX = require('xlsx');

const diaDPath = 'C:/Users/PC/OneDrive/Escritorio/quindio/dia d (9).xlsx';
const e14Path = 'C:/Users/PC/OneDrive/Escritorio/quindio/Resultados_E14_Gemini_Final.xlsx';

try {
    const wb1 = XLSX.readFile(diaDPath);
    const sheet1 = wb1.Sheets[wb1.SheetNames[0]];
    const json1 = XLSX.utils.sheet_to_json(sheet1, { header: 1 });
    console.log("=== COLUMNAS DÍA D 9 ===");
    console.log(json1[0]); // Header row
    console.log("Primera fila de datos:", json1[1]);

    const wb2 = XLSX.readFile(e14Path);
    const sheet2 = wb2.Sheets[wb2.SheetNames[0]];
    const json2 = XLSX.utils.sheet_to_json(sheet2, { header: 1 });
    console.log("\n=== COLUMNAS E-14 (GEMINI) ===");
    console.log(json2[0]);
} catch(e) {
    console.error(e);
}
