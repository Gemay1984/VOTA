const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// The base directory containing all the municipality folders
const BASE_DIR = 'C:/Users/PC/OneDrive/Escritorio/quindio';

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the base directory directly so the frontend can download the PDFs
app.use('/data', express.static(BASE_DIR));

// API endpoint to list all PDFs in the quindio directory
app.get('/api/pdfs', (req, res) => {
    try {
        const files = fs.readdirSync(BASE_DIR, { recursive: true });
        const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf')).map(f => f.replace(/\\/g, '/'));
        res.json(pdfFiles);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error reading directory' });
    }
});

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor listo!`);
    console.log(`👉 Abre tu navegador y entra a: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});
