require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const BASE_DIR = 'C:/Users/PC/OneDrive/Escritorio/quindio';
const EXCEL_FILE = path.join(BASE_DIR, 'Consolidado_Votos_E14.xlsx');

const PROMPT = `Extrae de este formulario E-14 (acta de escrutinio):
1. 'Departamento'
2. 'Municipio'
3. 'Zona'
4. 'Puesto' (numerico)
5. 'Mesa' (numerico)
6. 'Lugar' (Nombre del puesto de votación)
7. Clave 'U_SoloLista' (votos SOLO POR LA LISTA del PARTIDO DE LA U)
8. Clave 'U_7' (votos de YANETH ALVAREZ RUIZ)
9. Clave 'Con_SoloLista' (votos SOLO POR LA LISTA del PARTIDO CONSERVADOR)
10. Clave 'Con_11' (votos de JUAN CARLOS CORTES)

Devuelve JSON estricto: {Departamento, Municipio, Zona, Puesto, Mesa, Lugar, U_SoloLista, U_7, Con_SoloLista, Con_11}`;

async function extractFromPdf(filePath) {
    try {
        const pdfBytes = fs.readFileSync(filePath);
        const result = await model.generateContent([
            PROMPT,
            { inlineData: { data: pdfBytes.toString("base64"), mimeType: "application/pdf" } }
        ]);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        console.error(`Error en ${path.basename(filePath)}: ${e.message}`);
        return null;
    }
}

const getAllPdfs = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.resolve(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(getAllPdfs(fullPath));
        } else if (fullPath.endsWith('.pdf')) {
            results.push(fullPath);
        }
    });
    return results;
};

async function main() {
    console.log("--- RECONSTRUCCIÓN DE BASE DE DATOS E-14 ---");
    
    // 1. Obtener todos los PDFs reales en disco
    const allPdfs = getAllPdfs(BASE_DIR);
    console.log(`Paso 1: Detectados ${allPdfs.length} PDFs físicos.`);

    // 2. Cargar Excel actual (si existe) para no repetir trabajo
    let existingDataMap = new Map();
    if (fs.existsSync(EXCEL_FILE)) {
        const wb = XLSX.readFile(EXCEL_FILE);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        rows.forEach(r => {
            // Usar combinación de Carpeta + Archivo como llave única
            const key = path.join(r['Zona Carpeta'] || '', r['Archivo']).toLowerCase();
            existingDataMap.set(key, r);
        });
        console.log(`Paso 2: Excel actual tiene ${existingDataMap.size} registros únicos.`);
    }

    // 3. Identificar faltantes
    const missingPdfs = allPdfs.filter(p => !existingDataMap.set(p.toLowerCase(), existingDataMap.get(p.toLowerCase())));
    // Corregir lógica de filtrado anterior
    const pending = allPdfs.filter(p => !existingDataMap.has(p.toLowerCase()));
    console.log(`Paso 3: Faltan ${pending.length} archivos por extraer.`);

    // 4. Procesar faltantes en bloques
    const CHUNK_SIZE = 10;
    const finalResults = Array.from(existingDataMap.values());

    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
        const chunk = pending.slice(i, i + CHUNK_SIZE);
        console.log(`\nExtrayendo bloque ${Math.floor(i/CHUNK_SIZE) + 1}... (${i}/${pending.length})`);
        
        const results = await Promise.all(chunk.map(async (file) => {
            const data = await extractFromPdf(file);
            if (data) {
                return {
                    "Archivo": path.basename(file),
                    "Departamento": data.Departamento,
                    "Municipio": data.Municipio,
                    "Zona": data.Zona,
                    "Puesto": data.Puesto,
                    "Mesa": data.Mesa,
                    "Lugar (Puesto de Votación)": data.Lugar,
                    "Votos SOLO POR LA LISTA (U)": data.U_SoloLista,
                    "Partido de la U (Cand 7)": data.U_7,
                    "Votos SOLO POR LA LISTA (Conservador)": data.Con_SoloLista,
                    "Conservador (Cand 11)": data.Con_11,
                    "Zona Carpeta": path.dirname(file)
                };
            }
            return null;
        }));

        results.filter(r => r !== null).forEach(r => finalResults.push(r));
        
    }

    // Guardar el Excel final con los 1768 registros
    console.log(`\nGuardando Excel final con ${finalResults.length} registros...`);
    const cleanResults = finalResults.filter(r => r !== null && typeof r === 'object');
    const newWs = XLSX.utils.json_to_sheet(cleanResults);
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newWs, "E14 Final");
    XLSX.writeFile(newWb, EXCEL_FILE);

    console.log(`\n--- FINALIZADO ---`);
    console.log(`Total registros en Excel: ${finalResults.length}`);
}

main().catch(console.error);
