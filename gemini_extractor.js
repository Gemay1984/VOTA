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
Eres un experto en lectura de datos electorales colombianos (formularios E-14).
Mira las imágenes de este PDF y extrae EXACTAMENTE estos 5 datos estadísticos:
1. El número de la "Mesa" (en la cabecera).
2. Los votos "Solo por el partido" del PARTIDO DE LA U.
3. Los votos para el candidato número 7 del PARTIDO DE LA U.
4. Los votos "Solo por el partido" del PARTIDO CONSERVADOR.
5. Los votos para el candidato número 11 del PARTIDO CONSERVADOR.

Devuelve ESTRICTAMENTE un JSON con esta estructura exacta y sin formato extra:
{
  "Mesa": "numero o No encontrada",
  "U_SoloPartido": "numero o No encontrado",
  "U_7": "numero o No encontrado",
  "Con_SoloPartido": "numero o No encontrado",
  "Con_11": "numero o No encontrado"
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
        
        // Extract just the JSON part using Regex in case Gemini adds conversational text like "Aquí está:"
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        return JSON.parse(text.trim());
    } catch (e) {
        // En cuenta de paga, los errores serán mínimos, pero capturamos por si acaso
        console.error(`Error procesando ${filePath}:`, e.message);
        return { Departamento: "Error", Municipio: "Error", Zona: "Error", Puesto: "Error", Mesa: "Error", Lugar: "Error", U_SoloLista: "Error", U_7: "Error", Con_SoloLista: "Error", Con_11: "Error" };
    }
}

async function main() {
    console.log("Buscando archivos PDF E-14...");
    let pdfs = getPdfFiles(BASE_DIR);
    
    let results = [];
    const outputFileName = "Resultados_E14_Gemini_Final.xlsx";
    const outputPath = path.join(BASE_DIR, outputFileName);
    
    // Resume logic: Read existing Excel file to see what we already did
    if (fs.existsSync(outputPath)) {
        try {
            console.log("Leyendo progreso anterior de " + outputFileName + "...");
            const workbook = XLSX.readFile(outputPath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            results = XLSX.utils.sheet_to_json(sheet);
            
            // Only keep successful results in memory, so errors get re-run and overwritten
            const initialCount = results.length;
            results = results.filter(r => r["Mesa"] !== "Error");
            
            const procesados = new Set(results.map(r => r["Archivo"]));
            
            const pdfsInicial = pdfs.length;
            pdfs = pdfs.filter(file => !procesados.has(path.basename(file)));
            
            console.log(`Descubierto Excel previo: se saltarán ${pdfsInicial - pdfs.length} archivos ya procesados.`);
        } catch(e) {
            console.error("No se pudo leer el archivo Excel previo. Puede estar dañado o abierto.", e);
        }
    }

    console.log(`Encontrados ${pdfs.length} archivos PDF PENDIENTES. Iniciando procesamiento en paralelo (Cuenta Paga API)...`);
    
    if (pdfs.length === 0) {
        console.log("¡Todos los archivos ya fueron procesados!");
        return;
    }
    
    // Chunk array function
    const CHUNK_SIZE = 15; // Process 15 files at the exact same time
    
    for (let i = 0; i < pdfs.length; i += CHUNK_SIZE) {
        const chunk = pdfs.slice(i, i + CHUNK_SIZE);
        console.log(`[Lote ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(pdfs.length/CHUNK_SIZE)}] Procesando archivos ${i+1} a ${i + chunk.length}...`);
        
        // Ejecutar promesas en paralelo
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
        
        console.log(`[>>] Guardando Excel con ${results.length} resultados hasta el momento...`);
        try {
            const ws = XLSX.utils.json_to_sheet(results);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Resultados E-14");
            XLSX.writeFile(wb, outputPath);
        } catch(e) { 
            console.error(`\n[!!!] ERROR GUARDANDO EXCEL: Por favor CIERRA el archivo ${outputFileName} si lo tienes abierto.\n`); 
        }
    }

    console.log(`\n=================================================`);
    console.log(`¡Proceso Finalizado Exitosamente en tiempo récord!`);
    console.log(`Archivo guardado: ${outputFileName}`);
    console.log(`=================================================\n`);
}

main();
