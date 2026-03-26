const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const XLSX = require('xlsx');

require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable not found.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const BASE_DIR = 'C:/Users/PC/OneDrive/Escritorio/quindio';

function getPdfFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (file !== 'pdf_processor') { 
                getPdfFiles(filePath, fileList);
            }
        } else if (filePath.toLowerCase().endsWith('.pdf')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

async function extractFromPdf(filePath) {
    try {
        const pdfBytes = fs.readFileSync(filePath);
        
        const prompt = `
Mira las imágenes de este PDF (Formulario E-14 de Colombia) y extrae EXACTAMENTE estos datos:
1. Departamento (ej: QUINDIO)
2. Municipio (ej: ARMENIA)
3. Zona (número de 2 dígitos)
4. Puesto (número de 2 dígitos)
5. Mesa (número de 3 dígitos)
6. Lugar (Puesto de votación, ej: IE INSTITUTO TECNICO INDUSTRIAL)
7. Votos SOLO POR LA LISTA del PARTIDO DE LA U
8. Votos para el candidato número 7 del PARTIDO DE LA U
9. Votos SOLO POR LA LISTA del PARTIDO CONSERVADOR
10. Votos para el candidato número 11 del PARTIDO CONSERVADOR

Responde SOLAMENTE con un objeto JSON (sin markdown, sin texto extra) con esta estructura:
{
  "Departamento": "texto",
  "Municipio": "texto",
  "Zona": "numero",
  "Puesto": "numero",
  "Mesa": "numero",
  "Lugar": "texto",
  "U_SoloLista": "numero",
  "U_7": "numero",
  "Con_SoloLista": "numero",
  "Con_11": "numero"
}`;

        const imageParts = [
            {
                inlineData: {
                    data: pdfBytes.toString("base64"),
                    mimeType: "application/pdf"
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        let text = result.response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        return JSON.parse(text.trim());
    } catch (e) {
        console.error(`Error procesando ${filePath}:`, e.message);
        return { Departamento: "Error", Municipio: "Error", Zona: "Error", Puesto: "Error", Mesa: "Error", Lugar: "Error", U_SoloLista: "Error", U_7: "Error", Con_SoloLista: "Error", Con_11: "Error" };
    }
}

async function main() {
    console.log("Buscando archivos PDF E-14...");
    let pdfs = getPdfFiles(BASE_DIR);
    const initialTotalCount = pdfs.length;
    const globalBatchStartTime = Date.now();
    
    let results = [];
    const outputFileName = "Resultados_E14_Gemini_Final.xlsx";
    const outputPath = path.join(BASE_DIR, outputFileName);
    
    if (fs.existsSync(outputPath)) {
        try {
            console.log("Leyendo progreso anterior...");
            const workbook = XLSX.readFile(outputPath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            results = XLSX.utils.sheet_to_json(sheet);
            results = results.filter(r => r["Mesa"] !== "Error");
            const procesados = new Set(results.map(r => r["Archivo"]));
            pdfs = pdfs.filter(file => !procesados.has(path.basename(file)));
            console.log(`Saltando ${initialTotalCount - pdfs.length} archivos ya procesados.`);
        } catch(e) {
            console.error("No se pudo leer el archivo previo.");
        }
    }

    console.log(`Pendientes: ${pdfs.length} archivos. Iniciando...`);
    
    if (pdfs.length === 0) {
        console.log("¡Todo procesado!");
        return;
    }
    
    const CHUNK_SIZE = 15;
    for (let i = 0; i < pdfs.length; i += CHUNK_SIZE) {
        const chunk = pdfs.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(chunk.map(async (file) => {
            const data = await extractFromPdf(file);
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
                "Zona Carpeta": path.dirname(file).replace(BASE_DIR, '')
            };
        }));
        
        results.push(...chunkResults);
        
        // Progress Logging
        const completed = results.length;
        const total = initialTotalCount;
        const percent = ((completed / total) * 100).toFixed(1);
        const elapsed = (Date.now() - globalBatchStartTime) / 1000;
        const itemsPerSec = completed / (elapsed || 1);
        const remaining = total - completed;
        const etaMin = Math.ceil((remaining / (itemsPerSec || 0.1)) / 60);

        try {
            fs.writeFileSync(path.join(__dirname, 'progress.json'), JSON.stringify({
                completed, total, percent, etaMin, 
                lastFile: chunkResults[chunkResults.length-1]?.Archivo || '',
                status: 'Running'
            }));
        } catch(e) {}

        console.log(`[>>] Avance: ${percent}% (${completed}/${total})`);
        try {
            const ws = XLSX.utils.json_to_sheet(results);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Resultados E-14");
            XLSX.writeFile(wb, outputPath);
        } catch(e) {}
    }

    try {
        fs.writeFileSync(path.join(__dirname, 'progress.json'), JSON.stringify({
            completed: results.length, total: results.length, percent: 100, etaMin: 0, status: 'Finished'
        }));
    } catch(e) {}
}

main();
