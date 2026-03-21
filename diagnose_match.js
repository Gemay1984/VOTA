const XLSX = require('xlsx');

const ABBREV_MAP = {
    'lv':       'laura vicuna',
    'lv':       'laura vicuna',
    'cam':      'centro administrativo municipal',
    'casd':     'centro administrativo',
    'eam':      'escuela de administracion',
    'iti':      'instituto tecnico industrial',
};

function normalizeStr(str) {
    if (!str) return '';
    let s = str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[^a-z0-9 ]/g, ''); // dots, periods stripped here -> l.v. becomes lv
    if (ABBREV_MAP[s]) s = ABBREV_MAP[s];
    return s;
}

// Test the inputs
const tests = ['L.V.', 'I.E laura Vicuña', 'EAM ', 'Cam ', 'I.E CRISTOBAL COLON', '  EAM  '];
console.log("=== NORMALIZED TEST INPUTS ===");
tests.forEach(t => console.log(`"${t}" -> "${normalizeStr(t)}"`));

// Test E14 folder names
const wbE14 = XLSX.readFile('C:/Users/PC/OneDrive/Escritorio/quindio/Resultados_E14_Gemini_Final.xlsx');
const dataE14 = XLSX.utils.sheet_to_json(wbE14.Sheets[wbE14.SheetNames[0]]);
const zonasUniq = [...new Set(dataE14.map(r => r['Zona']))];
const mesaFolders = zonasUniq.map(z => {
    const parts = z.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
});

console.log("\n=== NORMALIZED E14 FOLDER NAMES (matching 'laura') ===");
mesaFolders.filter(f => normalizeStr(f).includes('laura')).forEach(f => {
    console.log(`"${f}" -> "${normalizeStr(f)}"`);
});

console.log("\n=== NORMALIZED E14 FOLDER NAMES (matching 'administrativo' or 'cam') ===");
mesaFolders.filter(f => normalizeStr(f).includes('administrativo') || normalizeStr(f).includes('cam')).forEach(f => {
    console.log(`"${f}" -> "${normalizeStr(f)}"`);
});

console.log("\n=== NORMALIZED E14 FOLDER NAMES (matching 'administracion' - EAM) ===");
mesaFolders.filter(f => normalizeStr(f).includes('administracion')).forEach(f => {
    console.log(`"${f}" -> "${normalizeStr(f)}"`);
});
