let rawData = { status: 'pending', leaders: {}, leaderNames: [] };
let donutChart = null;
let dataDiaD = null;
let dataE14 = null;
let e14ByMesa = {};

const STOP_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'ie', 'col', 'colegio', 'institucion', 'educativa', 'educativo', 'instituto', 'escuela', 'sede', 'puesto', 'and', 'the', 'num', 'no']);

const ABBREV_EXPAND = {
    'lv': 'laura vicuna', 'l v': 'laura vicuna', 'cam': 'cam', 'eam': 'escuela administracion mercadotecnia',
    'iti': 'instituto tecnico industrial', 'esap': 'escuela superior administracion publica', 'imet': 'imet',
    'madre marcelina': 'madre marcelina', 'medre marcelina': 'madre marcelina', 'estadio': 'estadio centenario',
    'ciudad sur': 'ciudadela del sur', 'ciudadela del sur': 'ciudadela del sur', 'zuldemaida': 'zuldemayda',
    'quindos': 'los quindos', 'i e juan xxiii': 'juan xxiii', 'juan xxiii': 'juan xxiii', 'gustavo matamoros': 'gustavo matamoros'
};

function initDashboard() {
    setupEventListeners();
    initDonutChart();
    
    // Load saved URLs if any
    const savedDiaD = localStorage.getItem('urlDiaD');
    const savedE14 = localStorage.getItem('urlE14');
    if (savedDiaD) document.getElementById('urlDiaD').value = savedDiaD;
    if (savedE14) document.getElementById('urlE14').value = savedE14;

    // Auto-sync on load
    syncData();
}

function initDonutChart() {
    const ctx = document.getElementById('donutChart').getContext('2d');
    donutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cubiertas 🟢', 'Parciales 🟡', 'Sin votos 🔴', 'Sin datos ⚪'],
            datasets: [{
                data: [0, 0, 0, 1],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#475569'],
                borderColor: ['#064e3b', '#78350f', '#7f1d1d', '#1e293b'],
                borderWidth: 2, hoverOffset: 6
            }]
        },
        options: {
            cutout: '70%',
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            animation: { animateRotate: true, duration: 600 }
        }
    });
}

function updateDonutChart(green, yellow, red, gray) {
    donutChart.data.datasets[0].data = [green, yellow, red, gray];
    donutChart.update();
}

function setupEventListeners() {
    document.getElementById('btnSync').addEventListener('click', syncData);
    document.getElementById('leaderSelect').addEventListener('change', renderDashboard);
    document.getElementById('candidateSelect').addEventListener('change', renderDashboard);
    document.getElementById('includePartyToggle').addEventListener('change', renderDashboard);
}

function toCsvUrl(url) {
    if (!url.includes('docs.google.com')) return url;
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/gid=([0-9]+)/);
    if (!idMatch) return url;
    const id = idMatch[1];
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

async function syncData() {
    const urlDiaD = document.getElementById('urlDiaD').value.trim();
    const urlE14 = document.getElementById('urlE14').value.trim();
    
    if (!urlDiaD || !urlE14) return;

    localStorage.setItem('urlDiaD', urlDiaD);
    localStorage.setItem('urlE14', urlE14);

    setStatus('Sincronizando...', 'yellow', true);

    try {
        const [resDiaD, resE14] = await Promise.all([
            fetch(toCsvUrl(urlDiaD)).then(r => r.ok ? r.text() : Promise.reject('Error Día D')),
            fetch(toCsvUrl(urlE14)).then(r => r.ok ? r.text() : Promise.reject('Error E-14'))
        ]);

        dataDiaD = parseCSV(resDiaD);
        dataE14 = parseCSV(resE14);

        processData();
        setStatus('Datos Listos', 'green', false);
    } catch (err) {
        console.error(err);
        setStatus('Error de Conexión', 'red', false);
        alert('Error: Asegúrate de que las hojas de cálculo estén "Publicadas en la Web" o que "Cualquier persona con el enlace pueda ver".');
    }
}

function parseCSV(csvText) {
    const workbook = XLSX.read(csvText, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
}

function setStatus(text, color, anim) {
    const b = document.getElementById('statusBadge');
    b.className = `mt-4 md:mt-0 px-4 py-2 rounded-full badge-${color} text-sm font-medium flex items-center gap-2`;
    b.innerHTML = `<span class="relative flex h-3 w-3">
        ${anim ? '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-'+color+'-400 opacity-75"></span>' : ''}
        <span class="relative inline-flex rounded-full h-3 w-3 bg-${color}-500"></span>
    </span> ${text}`;
}

function processData() {
    // Index E14 by Mesa
    e14ByMesa = {};
    dataE14.forEach(row => {
        const mesa = parseInt(row['Mesa']) || 0;
        const zona = row['Zona'] || '';
        const parts = zona.replace(/\\/g, '/').split('/');
        const folderWords = getKeyWords((parts[parts.length - 1] || '') + ' ' + (parts[parts.length-2] || ''));
        if (!e14ByMesa[mesa]) e14ByMesa[mesa] = [];
        e14ByMesa[mesa].push({ folderWords, row });
    });

    const leaderMapTmp = {};
    dataDiaD.forEach(row => {
        const lider = (row['usuario'] || 'DESCONOCIDO').toString().trim();
        const puesto = (row['Puesto de Votacion '] || '').toString().trim();
        const mesa = parseInt(row['Mesa']) || 0;
        if (!leaderMapTmp[lider]) leaderMapTmp[lider] = {};
        if (!leaderMapTmp[lider][puesto]) leaderMapTmp[lider][puesto] = {};
        if (!leaderMapTmp[lider][puesto][mesa]) leaderMapTmp[lider][puesto][mesa] = { voters: [] };
        leaderMapTmp[lider][puesto][mesa].voters.push({
            nombre: (row['Nombres y Apellidos'] || '').toString().trim(),
            cedula: (row['Cedula'] || '').toString().trim()
        });
    });

    const leaderResults = {};
    for (const [lider, puestos] of Object.entries(leaderMapTmp)) {
        leaderResults[lider] = { mesas: [] };
        for (const [puesto, mesasObj] of Object.entries(puestos)) {
            for (const [mesa, data] of Object.entries(mesasObj)) {
                const e14Match = findE14Match(puesto, mesa);
                leaderResults[lider].mesas.push({
                    puesto, mesa: parseInt(mesa), voters: data.voters, proyectados: data.voters.length,
                    e14: e14Match ? {
                        uSoloPartido: parseInt(e14Match['Partido de la U (Solo Partido)']) || 0,
                        uCand6: parseInt(e14Match['Partido de la U (Cand 6)']) || 0,
                        conSoloPartido: parseInt(e14Match['Conservador (Solo Partido)']) || 0,
                        conCand11: parseInt(e14Match['Conservador (Cand 11)']) || 0,
                        zona: e14Match['Zona']
                    } : null
                });
            }
        }
    }

    const mesaLeaderIdx = {};
    dataDiaD.forEach(r => {
        const key = `${r['Puesto de Votacion '].toString().trim()}|${parseInt(r['Mesa'])}`;
        if (!mesaLeaderIdx[key]) mesaLeaderIdx[key] = new Set();
        mesaLeaderIdx[key].add(r['usuario'].toString().trim());
    });
    for (const [lid, res] of Object.entries(leaderResults)) {
        res.mesas.forEach(m => {
            const all = mesaLeaderIdx[`${m.puesto}|${m.mesa}`] ? [...mesaLeaderIdx[`${m.puesto}|${m.mesa}`]] : [];
            m.sharedLeaders = all.filter(l => l !== lid);
        });
    }

    rawData = { status: 'success', leaders: leaderResults, leaderNames: Object.keys(leaderResults).sort() };
    populateLeaders();
}

function getKeyWords(str) {
    if (!str) return [];
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const expanded = ABBREV_EXPAND[clean] || clean;
    return expanded.split(' ').filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function findE14Match(puesto, mesa) {
    const candidates = e14ByMesa[parseInt(mesa)] || [];
    const puestoWords = getKeyWords(puesto);
    if (!puestoWords.length || !candidates.length) return null;
    let best = null, bestScore = 0;
    candidates.forEach(c => {
        let score = 0;
        puestoWords.forEach(w => { c.folderWords.forEach(fw => { if (fw.includes(w) || w.includes(fw)) score++; }); });
        if (score > bestScore) { bestScore = score; best = c; }
    });
    return bestScore >= 1 ? best.row : null;
}

function populateLeaders() {
    const s = document.getElementById('leaderSelect');
    const current = s.value;
    s.innerHTML = '<option value="">Selecciona un líder...</option>';
    rawData.leaderNames.forEach(l => {
        const o = document.createElement('option'); o.value = l; o.textContent = l; s.appendChild(o);
    });
    if (rawData.leaders[current]) s.value = current;
    renderDashboard();
}

function getVotesFromE14(e14, candidateId, includeParty) {
    if (!e14) return null;
    let cv = 0, pv = 0;
    if (candidateId === 'U_6') { cv = e14.uCand6; pv = e14.uSoloPartido; }
    else if (candidateId === 'U_Solo') { pv = e14.uSoloPartido; }
    else if (candidateId === 'Con_11') { cv = e14.conCand11; pv = e14.conSoloPartido; }
    else if (candidateId === 'Con_Solo') { pv = e14.conSoloPartido; }
    return cv + (includeParty ? pv : 0);
}

function renderDashboard() {
    const leader = document.getElementById('leaderSelect').value;
    const cid = document.getElementById('candidateSelect').value;
    const incP = document.getElementById('includePartyToggle').checked;
    const tb = document.getElementById('resultsTableBody');
    if (!leader) { tb.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-slate-500 italic">Cargando datos de Google Sheets...</td></tr>'; return; }
    
    const lData = rawData.leaders[leader];
    let tMeta = 0, tReal = 0, g=0, y=0, r=0, gr=0, sc=0, mCub=0;
    let rows = '';

    lData.mesas.forEach(m => {
        tMeta += m.proyectados;
        const rv = getVotesFromE14(m.e14, cid, incP);
        const real = rv === null ? 0 : rv;
        if (rv !== null) tReal += real;

        let bc, it, el;
        if (rv === null) { bc='text-slate-400 bg-slate-800 border-slate-700'; it='⚪ Sin datos'; el='No encontrado'; gr++; }
        else if (real >= m.proyectados) { bc='text-emerald-400 bg-emerald-900/40 border-emerald-800'; it='🟢 Cubierta'; el=`${((real/m.proyectados)*100).toFixed(0)}%`; g++; mCub++; }
        else if (real > 0) { bc='text-amber-400 bg-amber-900/40 border-amber-800'; it='🟡 Parcial'; el=`${((real/m.proyectados)*100).toFixed(0)}%`; y++; }
        else { bc='text-red-400 bg-red-900/40 border-red-800'; it='🔴 Sin votos'; el='0%'; r++; }

        let sh = '—';
        if (m.sharedLeaders && m.sharedLeaders.length) { sc++; sh = `<div class="flex flex-col gap-1">${m.sharedLeaders.map(l => `<span class="text-xs badge-yellow px-2 py-0.5 rounded-md">⚠️ ${l}</span>`).join('')}</div>`; }

        const vHtml = m.voters.map(v => `<div class="flex items-center gap-2 py-0.5"><div class="text-slate-200 text-xs">${v.nombre} (CC: ${v.cedula})</div></div>`).join('');
        
        rows += `<tr class="hover:bg-slate-800/40 border-b border-slate-800">
            <td class="py-4 px-6 align-top"><div class="font-semibold text-slate-200 text-sm">${m.puesto}</div></td>
            <td class="py-4 px-4 text-center align-top"><span class="font-bold text-white text-base">M ${m.mesa}</span></td>
            <td class="py-4 px-4 align-top"><div class="max-h-28 overflow-y-auto">${vHtml}</div></td>
            <td class="py-4 px-4 text-center align-top border-l border-slate-700 bg-slate-900/40"><div class="text-3xl font-bold text-blue-400">${rv !== null ? real : '—'}</div></td>
            <td class="py-4 px-4 text-center align-top"><span class="px-3 py-1.5 text-xs font-bold rounded-full border ${bc}">${it}</span><div class="text-slate-500 text-xs mt-1">${el}</div></td>
            <td class="py-4 px-4 align-top">${sh}</td>
        </tr>`;
    });

    tb.innerHTML = rows;
    document.getElementById('kpiMeta').innerText = tMeta;
    document.getElementById('kpiReal').innerText = tReal;
    document.getElementById('kpiShared').innerText = sc;
    document.getElementById('kpiAciertos').innerText = `${mCub} / ${lData.mesas.length}`;
    document.getElementById('tableCount').innerText = `${lData.mesas.length} Mesas`;
    updateDonutChart(g, y, r, gr);
}

document.addEventListener('DOMContentLoaded', initDashboard);
