const express = require('express');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public_dashboard')));

const BASE_DIR = 'C:/Users/PC/OneDrive/Escritorio/quindio';
const diaDPath = path.join(BASE_DIR, 'dia d (9).xlsx');
const e14Path = path.join(BASE_DIR, 'Consolidado_Votos_E14.xlsx');

// Stop words: too common to help identify a specific venue
const STOP_WORDS = new Set([
    'de', 'del', 'la', 'las', 'los', 'el', 'en', 'ie', 'col', 'colegio',
    'institucion', 'educativa', 'educativo', 'instituto', 'escuela',
    'sede', 'puesto', 'and', 'the', 'num', 'no'
]);

// Abbreviation expansion: translate short codes to full names BEFORE keyword split
// This ensures single-letter codes like L.V. are not silently dropped
const ABBREV_EXPAND = {
    'lv':   'laura vicuna',
    'l v':  'laura vicuna',
    'cam':  'centro administrativo municipal',
    'eam':  'escuela administracion mercadotecnia',
    'iti':  'instituto tecnico industrial',
    'esap': 'escuela superior administracion publica',
    'imet': 'imet',
    'madre marcelina': 'madre marcelina',
    'medre marcelina': 'madre marcelina',
    'estadio': 'estadio centenario',
    'ciudad sur': 'ciudadela del sur',
    'ciudadela del sur': 'ciudadela del sur',
    'zuldemaida': 'zuldemayda',
    'quindos': 'los quindos',
    'i e juan xxiii': 'juan xxiii',
    'juan xxiii': 'juan xxiii',
    'gustavo matamoros': 'gustavo matamoros'
};

function expandAbbrev(raw) {
    if (!raw) return raw;
    // Normalize: lowercase, strip accents, strip punctuation
    const clean = raw.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ').trim();
    // Check for exact match in expansion table
    if (ABBREV_EXPAND[clean]) return ABBREV_EXPAND[clean];
    return clean;
}

// Extract significant keywords from a venue name string
function getKeyWords(str) {
    if (!str) return [];
    const expanded = expandAbbrev(str);
    return expanded
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ').trim()
        .split(' ')
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

app.get('/api/data', (req, res) => {
    try {
        const wbDiaD = XLSX.readFile(diaDPath);
        const dataDiaD = XLSX.utils.sheet_to_json(wbDiaD.Sheets[wbDiaD.SheetNames[0]]);

        const wbE14 = XLSX.readFile(e14Path);
        const dataE14 = XLSX.utils.sheet_to_json(wbE14.Sheets[wbE14.SheetNames[0]]);

        // Build E14 index grouped by mesa number for fast fuzzy lookup
        const e14ByMesa = {};
        dataE14.forEach(row => {
            if (!row['Zona'] || !row['Mesa']) return;
            const parts = row['Zona'].replace(/\\/g, '/').split('/');
            // Use last 2 path segments for richer context (e.g. "ZONA 1 / IE LAURA VICUÑA")
            const seg1 = (parts[parts.length - 1] || '').trim();
            const seg2 = (parts[parts.length - 2] || '').trim();
            const folderWords = getKeyWords(seg1 + ' ' + seg2);
            const mesaNum = parseInt(row['Mesa']) || 0;
            if (!e14ByMesa[mesaNum]) e14ByMesa[mesaNum] = [];
            e14ByMesa[mesaNum].push({ folderWords, folderRaw: seg1, row });
        });

        // Smart fuzzy match: score based on how many keywords from the Día D
        // puesto name appear inside any E14 folder name (same mesa number).
        // The candidate with the highest score wins. Minimum score = 1.
        function findE14Match(puesto, mesa) {
            const candidates = e14ByMesa[parseInt(mesa) || 0] || [];
            if (!candidates.length) return null;
            const puestoWords = getKeyWords(puesto);
            if (!puestoWords.length) return null;
            let best = null, bestScore = 0;
            for (const c of candidates) {
                let score = 0;
                for (const w of puestoWords) {
                    for (const fw of c.folderWords) {
                        // Partial substring match in either direction
                        if (fw.includes(w) || w.includes(fw)) score++;
                    }
                }
                if (score > bestScore) { bestScore = score; best = c; }
            }
            // Require at least 1 matching keyword
            return bestScore >= 1 ? best.row : null;
        }

        // Build leader map: leader -> puesto -> mesa -> { voters }
        const leaderMap = {};
        dataDiaD.forEach(row => {
            const lider   = (row['usuario']              || 'DESCONOCIDO').toString().trim();
            const nombre  = (row['Nombres y Apellidos']  || '').toString().trim();
            const cedula  = (row['Cedula']               || '').toString().trim();
            const puesto  = (row['Puesto de Votacion ']  || '').toString().trim();
            const mesa    = parseInt(row['Mesa']) || 0;
            if (!leaderMap[lider])         leaderMap[lider] = {};
            if (!leaderMap[lider][puesto]) leaderMap[lider][puesto] = {};
            if (!leaderMap[lider][puesto][mesa]) leaderMap[lider][puesto][mesa] = { voters: [] };
            leaderMap[lider][puesto][mesa].voters.push({ nombre, cedula });
        });

        // Build result objects per leader, attaching E14 data via smart matching
        const leaderResults = {};
        for (const [lider, puestos] of Object.entries(leaderMap)) {
            leaderResults[lider] = { totalVoters: 0, mesas: [] };
            for (const [puesto, mesasObj] of Object.entries(puestos)) {
                for (const [mesa, data] of Object.entries(mesasObj)) {
                    const e14Row = findE14Match(puesto, mesa);
                    leaderResults[lider].totalVoters += data.voters.length;
                    leaderResults[lider].mesas.push({
                        puesto,
                        mesa: parseInt(mesa),
                        voters: data.voters,
                        proyectados: data.voters.length,
                        matchedFolder: e14Row ? e14Row['Zona'].split('\\').pop() : null,
                        e14: e14Row ? {
                            archivo:       e14Row['Archivo'],
                            zona:          e14Row['Zona'],
                            mesa:          e14Row['Mesa'],
                            uSoloPartido:  parseInt(e14Row['Votos SOLO POR LA LISTA (U)'])      || 0,
                            uCand7:        parseInt(e14Row['Partido de la U (Cand 7)'])        || 0,
                            conSoloPartido:parseInt(e14Row['Votos SOLO POR LA LISTA (Conservador)']) || 0,
                            conCand11:     parseInt(e14Row['Conservador (Cand 11)'])           || 0,
                        } : null
                    });
                }
            }
        }

        // Detect shared mesas (multiple leaders projected in same puesto+mesa)
        const mesaLeaderIndex = {};
        dataDiaD.forEach(row => {
            const lider  = (row['usuario']             || '').toString().trim();
            const puesto = (row['Puesto de Votacion '] || '').toString().trim();
            const mesa   = parseInt(row['Mesa']) || 0;
            const key    = `${puesto}|${mesa}`;
            if (!mesaLeaderIndex[key]) mesaLeaderIndex[key] = new Set();
            mesaLeaderIndex[key].add(lider);
        });

        for (const [liderKey, leader] of Object.entries(leaderResults)) {
            for (const mesaEntry of leader.mesas) {
                const key = `${mesaEntry.puesto}|${mesaEntry.mesa}`;
                const all = mesaLeaderIndex[key] ? [...mesaLeaderIndex[key]] : [];
                mesaEntry.sharedLeaders = all.filter(l => l !== liderKey);
            }
        }

        res.json({
            status: 'success',
            leaders: leaderResults,
            leaderNames: Object.keys(leaderResults).sort()
        });
    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`📊 Dashboard Electoral v4 - Fuzzy Match Listo!`);
    console.log(`👉 Abre tu navegador en: http://localhost:${PORT}`);
    console.log(`==================================================\n`);
});
