require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const EXCEL_FILE = path.join(__dirname, '../Resultados_E14_Gemini_Final.xlsx');
const BASE_DIR = path.join(__dirname, '../');

const PROMPT = `Extrae de este formulario E-14 (acta de escrutinio):
1. 'Departamento' (ej. 26 - QUINDIO)
2. 'Municipio' (ej. 001 - ARMENIA)
3. 'Zona' (ej. 01)
4. 'Puesto' (ej. 02, numero del puesto de votacion, sin el nombre, DEBE SER TIPO NUMERICO)
5. 'Mesa' (ej. 001, DEBE SER TIPO NUMERICO)
6. 'Lugar' (Nombre del puesto de votación, ej. COL NACIONAL, CARCEL DE MUJERES)
7. Los votos "SOLO POR LA LISTA" del PARTIDO DE LA U. (Sección PARTIDO DE LA U, casilla que solo dice "SOLO POR LA LISTA"). Guardalo en la clave 'U_SoloLista'.
8. Los votos de la candidata YANETH ALVAREZ RUIZ (Candidato numero 7 del PARTIDO DE LA U). Guardalo en la clave 'U_7'.
9. Los votos "SOLO POR LA LISTA" del PARTIDO CONSERVADOR COLOMBIANO. (Sección PARTIDO CONSERVADOR, casilla que dice "SOLO POR LA LISTA"). Guardalo en 'Con_SoloLista'.
10. Los votos del candidato JUAN CARLOS CORTES (Candidato 11 del PARTIDO CONSERVADOR). Guardalo en 'Con_11'.

Devuelve UNICAMENTE un objeto JSON estricto con estas claves: Departamento, Municipio, Zona, Puesto, Mesa, Lugar, U_SoloLista, U_7, Con_SoloLista, Con_11. SI ALGUNA NO EXISTE PON 0. NUNCA NADA MAS QUE EL JSON.`;

// Función para extraer con reintentos
async function extractFromPdf(filePath, retries = 3) {
    for (let attempts = 0; attempts < retries; attempts++) {
        try {
            const pdfBytes = fs.readFileSync(filePath);
            const prompt = PROMPT;

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: pdfBytes.toString("base64"),
                        mimeType: "application/pdf"
                    }
                }
            ]);

            const responseText = result.response.text();
            
            let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            cleanJson = cleanJson.replace(/^[^{]*/, '').replace(/[^}]*$/, '');

            return JSON.parse(cleanJson);
        } catch (error) {
            console.error(`Intento ${attempts+1} fallido en ${path.basename(filePath)}:`, error.message);
            if (attempts === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 4000));
        }
    }
}

async function fixErrors() {
    console.log("Iniciando reparación de errores de extracción...");
    
    if (!fs.existsSync(EXCEL_FILE)) {
        console.log("No se encontró el archivo Excel.");
        return;
    }

    const wb = XLSX.readFile(EXCEL_FILE);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    let fixedCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Identificar si la fila tiene Error o Puesto vacío/texto
        const needsFixing = 
            String(row['Lugar (Puesto de Votación)']).includes('Error') ||
            String(row['Departamento']).includes('Error') ||
            !row['Puesto'] ||
            String(row['Puesto']).includes('Error') ||
            String(row['Puesto']) === 'NaN' ||
            String(row['Lugar (Puesto de Votación)']) === 'NaN' ||
            String(row['Lugar (Puesto de Votación)']).includes('undefined');

        if (needsFixing) {
            // Construir la ruta al PDF
            const pdfPath = path.join(row['Zona Carpeta'], row['Archivo']);
            
            console.log(`\nRe-procesando archivo averiado: ${row['Archivo']} ...`);
            
            if (fs.existsSync(pdfPath)) {
                try {
                    const extracted = await extractFromPdf(pdfPath);
                    console.log(`Éxito al re-extraer ${row['Archivo']}. Actualizando fila...`);
                    
                    data[i] = {
                        "Archivo": row['Archivo'],
                        "Departamento": extracted.Departamento,
                        "Municipio": extracted.Municipio,
                        "Zona": extracted.Zona,
                        "Puesto": extracted.Puesto,
                        "Mesa": extracted.Mesa,
                        "Lugar (Puesto de Votación)": extracted.Lugar,
                        "Votos SOLO POR LA LISTA (U)": extracted.U_SoloLista,
                        "Partido de la U (Cand 7)": extracted.U_7,
                        "Votos SOLO POR LA LISTA (Conservador)": extracted.Con_SoloLista,
                        "Conservador (Cand 11)": extracted.Con_11,
                        "Zona Carpeta": row['Zona Carpeta']
                    };
                    fixedCount++;
                } catch (error) {
                    console.log(`Falló definitivamente: ${row['Archivo']}`);
                }
            } else {
                console.log(`No se encontró el PDF en disco: ${pdfPath}`);
            }
        }
    }

    if (fixedCount > 0) {
        console.log(`\nGuardando Excel con ${fixedCount} errores reparados...`);
        const newWs = XLSX.utils.json_to_sheet(data);
        const newWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWb, newWs, "E14 Totales Gemini");
        XLSX.writeFile(newWb, EXCEL_FILE);
        console.log("¡Reparación completada!");
    } else {
        console.log("\nNo se encontraron errores o no se pudo reparar ninguno.");
    }
}

fixErrors().catch(console.error);
