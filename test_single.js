const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const filePath = 'C:/Users/PC/OneDrive/Escritorio/quindio/armenia/zona 1/ZONA 1/IE. LAURA VICUÑA/E14_LV MESA 17.pdf';

async function main() {
    try {
        console.log("Analizando archivo:", filePath);
        const pdfBytes = fs.readFileSync(filePath);
        
        const prompt = `
Mira este formulario E-14 y dime los 5 números que ves:
1. "Mesa"
2. Votos "Solo por el partido" del PARTIDO DE LA U
3. Votos candidato 6 del PARTIDO DE LA U
4. Votos "Solo por el partido" del PARTIDO CONSERVADOR
5. Votos candidato 11 del PARTIDO CONSERVADOR

Escribe los números claramente, aunque tengas dudas.`;

        const imageParts = [
            {
                inlineData: {
                    data: pdfBytes.toString("base64"),
                    mimeType: "application/pdf"
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        console.log("\n==== RESPUESTA CRUDA ====\n");
        console.log(result.response.text());
        console.log("\n=========================\n");
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main();
