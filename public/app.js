let allPdfs = [];
let results = [];
let tesseractWorker = null;

const startBtn = document.getElementById('startBtn');
const exportBtn = document.getElementById('exportBtn');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const currentFileText = document.getElementById('currentFileText');
const resultsTable = document.getElementById('resultsTable');
const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Initialize Tesseract worker
async function initTesseract() {
    tesseractWorker = await Tesseract.createWorker('spa');
    // configure for faster scanning
    await tesseractWorker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });
}

// Extract specific fields using regular expressions
function extractData(text) {
    const data = { mesa: 'No encontrada', u6: 'No encontrado', con11: 'No encontrado' };
    
    // Try to find Mesa number
    const mesaMatch = text.match(/(?:(?:M|N)ESA|meses|\b(IM|M)\[?E(S|5)A\b)(?:\s*(?:N(?:o|O)?\.?|#|NUMERO|numero))?\s*:?\s*(\d{1,3})/i);
    if (mesaMatch) data.mesa = mesaMatch[3] || mesaMatch[2]; // get the capture group with the digits

    // Try to find Partido de la U Candidate 6 and Conservador 11. 
    // This is a naive attempt; forms are complex. We look for '6' and '11' with some surrounding digits.
    // In an actual scenario, finding exactly the position might require bounding box extraction.
    // Let's grab some context so the user can verify.
    const uMatch = text.match(/(?:PARTIDO\s+DE\s+LA\s+U|LA\s+U).*?6\s*[-\.\:\b]?\s*(\d{1,3})/is);
    if (uMatch) data.u6 = uMatch[1];
    else {
        // Fallback simple search: line starting with 6 and some digits
        let lines = text.split('\n');
        for (let l of lines) {
            if (l.match(/^[\s\.\-\|]*6[\s\.\-\|\:]+(\d{1,3})/)) {
                data.u6 = l.match(/^[\s\.\-\|]*6[\s\.\-\|\:]+(\d{1,3})/)[1] + " (?)";
                break;
            }
        }
    }

    const cMatch = text.match(/(?:CONSERVADOR|PARTIDO\s+CONSERVADOR).*?1(1|I|l)\s*[-\.\:\b]?\s*(\d{1,3})/is);
    if (cMatch) data.con11 = cMatch[2];
    else {
        // Fallback simple search: line starting with 11 and some digits
        let lines = text.split('\n');
        for (let l of lines) {
            if (l.match(/^[\s\.\-\|]*(?:11|II|ll)[\s\.\-\|\:]+(\d{1,3})/i)) {
                data.con11 = l.match(/^[\s\.\-\|]*(?:11|II|ll)[\s\.\-\|\:]+(\d{1,3})/i)[1] + " (?)";
                break;
            }
        }
    }
    
    return data;
}

// Convert PDF page to Canvas and run OCR
async function processPdfPage(pdf, pageNum) {
    const page = await pdf.getPage(pageNum);
    // Use lower scale to speed up OCR if possible, but high enough to read font. 
    // 1.5 is usually a good balance for scanning.
    const viewport = page.getViewport({ scale: 1.5 });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Convert to Image Data URL
    const imgData = canvas.toDataURL('image/png');
    
    // Run OCR
    const { data: { text } } = await tesseractWorker.recognize(imgData);
    return text;
}

// Main logic to process all PDFs
async function startProcessing() {
    startBtn.disabled = true;
    startBtn.classList.add('opacity-50', 'cursor-not-allowed');
    startBtn.innerText = "⏳ Inicializando AI (OCRg)...";
    
    if (!tesseractWorker) await initTesseract();

    startBtn.innerText = "⚙️ Procesando archivos...";
    
    // Fetch list of PDFs
    try {
        const response = await fetch('/api/pdfs');
        allPdfs = await response.json();
    } catch(e) {
        alert("Error al cargar la lista de PDFs del servidor local");
        return;
    }
    
    if (allPdfs.length === 0) {
        alert("No se encontraron PDFs en la carpeta de Quindio.");
        startBtn.innerText = "Iniciar Extracción";
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
    }

    resultsTable.innerHTML = '';
    results = [];
    
    for (let i = 0; i < allPdfs.length; i++) {
        const pdfFile = allPdfs[i];
        currentFileText.innerText = `Leyendo: ${pdfFile}...`;
        progressText.innerText = `${i + 1} / ${allPdfs.length}`;
        progressBar.style.width = `${((i + 1) / allPdfs.length) * 100}%`;
        
        let rowHtml = `<tr class="border-b"><td class="py-2 px-4 truncate max-w-xs" title="${pdfFile}">${pdfFile}</td>`;
        
        try {
            // Load PDF from local express server
            const loadingTask = pdfjsLib.getDocument(`/data/${encodeURI(pdfFile)}`);
            const pdfDocument = await loadingTask.promise;
            
            let fullText = "";
            // We usually care only about pages with results. 
            // We will scan all pages (could be slow) or maybe just first 3 pages if E-14 forms are short.
            const pagesToScan = Math.min(pdfDocument.numPages, 3);
            
            for (let pg = 1; pg <= pagesToScan; pg++) {
                currentFileText.innerText = `Leyendo: ${pdfFile} (Página ${pg}/${pdfDocument.numPages})...`;
                const text = await processPdfPage(pdfDocument, pg);
                fullText += "\n" + text;
            }
            
            const extracted = extractData(fullText);
            
            rowHtml += `<td class="py-2 px-4 font-mono font-bold">${extracted.mesa}</td>`;
            rowHtml += `<td class="py-2 px-4 font-mono text-blue-700 font-bold">${extracted.u6}</td>`;
            rowHtml += `<td class="py-2 px-4 font-mono text-green-700 font-bold">${extracted.con11}</td>`;
            rowHtml += `<td class="py-2 px-4 text-green-600 font-bold">✔️ OK</td>`;
            
            results.push({
                "Archivo": pdfFile,
                "Mesa (Encontrada)": extracted.mesa,
                "Partido de la U (Candidato 6)": extracted.u6,
                "Partido Conservador (Candidato 11)": extracted.con11,
                "Texto OCR (Opcional - Debug)": fullText.substring(0, 500) // snippet for debug
            });
            
        } catch (err) {
            console.error(err);
            rowHtml += `<td class="py-2 px-4 font-mono text-red-500">Error</td>`;
            rowHtml += `<td class="py-2 px-4 font-mono text-red-500">Error</td>`;
            rowHtml += `<td class="py-2 px-4 font-mono text-red-500">Error</td>`;
            rowHtml += `<td class="py-2 px-4 text-red-600 font-bold">❌ Falló</td>`;
            
            results.push({
                "Archivo": pdfFile,
                "Mesa (Encontrada)": "Error",
                "Partido de la U (Candidato 6)": "Error",
                "Partido Conservador (Candidato 11)": "Error",
                "Texto OCR (Opcional - Debug)": err.toString()
            });
        }
        
        rowHtml += `</tr>`;
        resultsTable.insertAdjacentHTML('beforeend', rowHtml);
    }
    
    currentFileText.innerText = `¡Proceso finalizado! Escaneados ${allPdfs.length} archivos.`;
    exportBtn.disabled = false;
    exportBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    
    startBtn.innerText = "Reintentar Extracción";
    startBtn.disabled = false;
    startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

function exportExcel() {
    if (results.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos E-14");
    XLSX.writeFile(wb, "Resultados_E14_Quindio.xlsx");
}

startBtn.addEventListener('click', startProcessing);
exportBtn.addEventListener('click', exportExcel);
