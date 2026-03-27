let rawData = { status: 'pending', leaders: {}, leaderNames: [] };
let donutChart = null;
let dataDiaD = null;
let dataE14 = null;
let e14ByMesa = {};

const STOP_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'ie', 'col', 'colegio', 'institucion', 'educativa', 'educativo', 'instituto', 'escuela', 'sede', 'puesto', 'and', 'the', 'num', 'no', 'mesa', 'urna', 'sd', 'principal', 'nuestra', 'senora', 'juan', 'maria', 'jose', 'santa', 'san', 'santander', 'normal', 'superior']);

const ABBREV_EXPAND = {
    'lv': 'laura vicuna', 'l v': 'laura vicuna', 'cam': 'centro administrativo municipal', 'eam': 'escuela administracion mercadotecnia',
    'iti': 'instituto tecnico industrial', 'esap': 'escuela superior administracion publica', 'imet': 'imet',
    'madre marcelina': 'madre marcelina', 'medre marcelina': 'madre marcelina', 'estadio': 'estadio centenario',
    'ciudad sur': 'ciudadela del sur', 'ciudadela del sur': 'ciudadela del sur', 'zuldemayda': 'zuldemayda',
    'zuldemaida': 'zuldemayda', 'zuldemaida': 'zuldemayda', 'zuldemaida': 'zuldemayda',
    'quindos': 'los quindos', 'i e juan xxiii': 'juan xxiii', 'juan xxiii': 'juan xxiii', 'gustavo matamoros': 'gustavo matamoros',
    'casd': 'casd', 'inem': 'inem', 'mutis': 'mutis', 'sena': 'sena', 'uniquindio': 'universidad del quindio',
    'u q': 'universidad del quindio', 'udq': 'universidad del quindio', 'universidad del quindio': 'universidad del quindio',
    'la adiela': 'la adiela', 'la cecilia': 'la cecilia', 'la patria': 'la patria', 'occidente': 'occidente',
    'jesus maria ocampo': 'jesus maria ocampo', 'nacional': 'nacional', 'cristobal colon': 'cristobal colon',
    'marcelino': 'marcelino champagnat', 'champagnat': 'marcelino champagnat', 'centro': 'rufino centro',
    'rufino': 'rufino', 'belen': 'belen', 'teresita': 'teresita montes', 'montes': 'teresita montes'
};

function initDashboard() {
    setupEventListeners();
    initDonutChart();
    
    // Load saved API URL if any
    const savedApiUrl = localStorage.getItem('apiUrl');
    if (savedApiUrl) document.getElementById('apiUrl').value = savedApiUrl;

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
    const total = green + yellow + red;
    const pct = total > 0 ? ((green / total) * 100).toFixed(0) + '%' : '0%';
    
    document.getElementById('lblGreen').innerText = green;
    document.getElementById('lblYellow').innerText = yellow;
    document.getElementById('lblRed').innerText = red;
    document.getElementById('lblGray').innerText = gray;
    document.getElementById('donutPct').innerText = pct;

    donutChart.data.datasets[0].data = [green, yellow, red, gray];
    donutChart.update();
}

function setupEventListeners() {
    document.getElementById('btnSync').addEventListener('click', syncData);
    document.getElementById('leaderSelect').addEventListener('change', renderDashboard);
    document.getElementById('candidateSelect').addEventListener('change', renderDashboard);
    document.getElementById('includePartyToggle').addEventListener('change', renderDashboard);
}

async function syncData() {
    const apiUrl = document.getElementById('apiUrl').value.trim();
    if (!apiUrl) return;

    localStorage.setItem('apiUrl', apiUrl);
    setStatus('Sincronizando...', 'yellow', true);

    try {
        const res = await fetch(apiUrl).then(r => r.ok ? r.json() : Promise.reject('Error de conexión con el script'));

        if (res.error) throw new Error(res.error);
        if (!res.diad || !res.e14) throw new Error('Respuesta del script incompleta');

        dataDiaD = res.diad;
        dataE14 = res.e14;

        processData();
        setStatus('Datos Listos', 'green', false);
    } catch (err) {
        console.error('Error de Sincronización:', err);
        setStatus('Error de Conexión', 'red', false);
        alert('Error: ' + err.message + '\n\nPosibles causas:\n1. El script no está implementado como "Cualquier persona".\n2. Los IDs de los archivos en el script son incorrectos.\n3. Los archivos no tienen permiso de lectura para el script.');
    }
}

function setStatus(text, color, anim) {
    const b = document.getElementById('statusBadge');
    b.className = `mt-4 md:mt-0 px-4 py-2 rounded-full badge-${color} text-sm font-medium flex items-center gap-2`;
    b.innerHTML = `<span class="relative flex h-3 w-3">
        ${anim ? '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>' : ''}
        <span class="relative inline-flex rounded-full h-3 w-3 bg-${color}-500"></span>
    </span> ${text}`;
}

function processData() {
    if (!dataE14 || !dataDiaD) return;
    // Index E14 by Mesa
    e14ByMesa = {};
    dataE14.forEach(row => {
        if (!row) return;
        const mesa = parseInt(row['Mesa']) || 0;
        const lugar = row['Lugar (Puesto de Votación)'] || row['Lugar'] || '';
        const zona = row['Zona'] || row['Zona Carpeta'] || '';
        const folderWords = getKeyWords(String(lugar) + ' ' + String(zona));
        if (!e14ByMesa[mesa]) e14ByMesa[mesa] = [];
        e14ByMesa[mesa].push({ folderWords, row });
    });

    const leaderMapTmp = {};
    dataDiaD.forEach(row => {
        if (!row) return;
        const lider = String(row['usuario'] || 'DESCONOCIDO').trim();
        const puesto = String(row['Puesto de Votacion'] || row['Puesto de Votacion '] || '').trim();
        const mesa = parseInt(row['Mesa']) || 0;
        if (!mesa) return;
        if (!leaderMapTmp[lider]) leaderMapTmp[lider] = {};
        if (!leaderMapTmp[lider][puesto]) leaderMapTmp[lider][puesto] = {};
        if (!leaderMapTmp[lider][puesto][mesa]) leaderMapTmp[lider][puesto][mesa] = { voters: [] };
        leaderMapTmp[lider][puesto][mesa].voters.push({
            nombre: String(row['Nombres y Apellidos'] || '').trim(),
            cedula: String(row['Cedula'] || '').trim()
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
                        uSoloLista: parseInt(e14Match['Votos SOLO POR LA LISTA (U)']) || 0,
                        uCand7: parseInt(e14Match['Partido de la U (Cand 7)']) || 0,
                        conSoloLista: parseInt(e14Match['Votos SOLO POR LA LISTA (Conservador)']) || 0,
                        conCand11: parseInt(e14Match['Conservador (Cand 11)']) || 0,
                        zona: e14Match['Zona'] || e14Match['Zona Carpeta']
                    } : null
                });
            }
        }
    }

    const mesaLeaderIdx = {};
    dataDiaD.forEach(r => {
        if (!r) return;
        const p = String(r['Puesto de Votacion'] || r['Puesto de Votacion '] || '').trim();
        const m = parseInt(r['Mesa']);
        if (!m) return;
        const key = `${p}|${m}`;
        if (!mesaLeaderIdx[key]) mesaLeaderIdx[key] = new Set();
        mesaLeaderIdx[key].add(String(r['usuario']).trim());
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
    // Convert to string and clean
    let s = String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Remove "MESA XX" suffix and similar noise
    s = s.replace(/\bmesa\s+\d+\b/g, '').replace(/\burna\s+\d+\b/g, '');
    // Standardize variants
    s = s.replace(/\bi\.e\.?\b/g, 'ie').replace(/\bi\s+e\b/g, 'ie').replace(/\bsd\b/g, 'sede');
    // Final clean of special chars
    s = s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Expand abbreviations and then split into words
    return s.split(' ').map(w => ABBREV_EXPAND[w] || w).join(' ').split(' ').filter(w => w.length >= 3 && !STOP_WORDS.has(w));
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
    if (candidateId === 'U_7') { cv = e14.uCand7; pv = e14.uSoloLista; }
    else if (candidateId === 'U_Solo') { pv = e14.uSoloLista; }
    else if (candidateId === 'Con_11') { cv = e14.conCand11; pv = e14.conSoloLista; }
    else if (candidateId === 'Con_Solo') { pv = e14.conSoloLista; }
    return cv + (includeParty ? pv : 0);
}

function renderDashboard() {
    const leader = document.getElementById('leaderSelect').value;
    const cid = document.getElementById('candidateSelect').value;
    const incP = document.getElementById('includePartyToggle').checked;
    const tb = document.getElementById('resultsTableBody');

    if (!dataE14 || !dataDiaD) return;

    // 1. GLOBAL Candidate Total (Across ALL E14 records)
    let globalE14 = 0;
    dataE14.forEach(row => {
        let cv = 0, pv = 0;
        if (cid === 'U_7') { cv = parseInt(row['Partido de la U (Cand 7)']) || 0; pv = parseInt(row['Votos SOLO POR LA LISTA (U)']) || 0; }
        else if (cid === 'U_Solo') { pv = parseInt(row['Votos SOLO POR LA LISTA (U)']) || 0; }
        else if (cid === 'Con_11') { cv = parseInt(row['Conservador (Cand 11)']) || 0; pv = parseInt(row['Votos SOLO POR LA LISTA (Conservador)']) || 0; }
        else if (cid === 'Con_Solo') { pv = parseInt(row['Votos SOLO POR LA LISTA (Conservador)']) || 0; }
        globalE14 += cv + (incP ? pv : 0);
    });
    document.getElementById('kpiGlobal').innerText = globalE14.toLocaleString();

    // 2. Global / Leader Logic Switch
    let tMeta=0, tReal=0, g=0, y=0, r=0, gr=0, sc=0, mCub=0;
    let rows = '';

    if (!leader) {
        tb.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-slate-500 italic">Sincronización Exitosa. Selecciona un líder para ver detalles individuales.</td></tr>';
        
        // Calculate Global Effectiveness (for ALL leaders)
        Object.values(rawData.leaders).forEach(l => {
            l.mesas.forEach(m => {
                const rv = getVotesFromE14(m.e14, cid, incP);
                if (rv === null) gr++;
                else {
                    if (rv >= m.proyectados) g++;
                    else if (rv > 0) y++;
                    else r++;
                }
            });
        });
        document.getElementById('kpiMeta').innerText = "VOTACIÓN";
        document.getElementById('kpiReal').innerText = "GLOBAL";
        document.getElementById('kpiCumple').innerText = "100%";
        document.getElementById('kpiAciertos').innerText = "Resumen General";
        updateDonutChart(g, y, r, gr);
        return;
    }
    
    const lData = rawData.leaders[leader];

    lData.mesas.forEach(m => {
        tMeta += m.proyectados;
        const rv = getVotesFromE14(m.e14, cid, incP);
        const real = rv === null ? 0 : rv;
        if (rv !== null) tReal += real;

        let bc, it, el;
        if (rv === null) { bc='text-slate-400 bg-slate-800 border-slate-700'; it='⚪ No hay E14'; el='Pendiente'; gr++; }
        else if (real >= m.proyectados) { bc='text-emerald-400 bg-emerald-900/40 border-emerald-800'; it='🟢 Cumplida'; el=`${((real/m.proyectados)*100).toFixed(0)}%`; g++; mCub++; }
        else if (real > 0) { bc='text-amber-400 bg-amber-900/40 border-amber-800'; it='🟡 Parcial'; el=`${((real/m.proyectados)*100).toFixed(0)}%`; y++; }
        else { bc='text-red-400 bg-red-900/40 border-red-800'; it='🔴 Sin votos'; el='0%'; r++; }

        let sh = '—';
        if (m.sharedLeaders && m.sharedLeaders.length) { sc++; sh = `<div class="flex flex-col gap-1">${m.sharedLeaders.map(l => `<span class="text-[9px] badge-yellow px-1 py-0.5 rounded-sm">⚠️ ${l}</span>`).join('')}</div>`; }

        const vHtml = m.voters.map(v => `<div class="flex items-center gap-1 py-0.5 border-b border-slate-800/50"><div class="text-slate-200 text-[11px]">${v.nombre}</div></div>`).join('');
        
        rows += `<tr class="hover:bg-slate-800/40 border-b border-slate-800/50">
            <td class="py-3 px-4 align-top"><div class="font-medium text-slate-300 text-xs">${m.puesto}</div></td>
            <td class="py-3 px-2 text-center align-top"><span class="font-bold text-white text-sm">${m.mesa}</span></td>
            <td class="py-3 px-3 align-top"><div class="max-h-24 overflow-y-auto pr-1">${vHtml}</div></td>
            <td class="py-3 px-3 text-center align-top border-l border-slate-700/30 bg-slate-900/20"><div class="text-2xl font-bold text-blue-400">${rv !== null ? real : '—'}</div></td>
            <td class="py-3 px-3 text-center align-top"><span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${bc}">${it}</span><div class="text-slate-500 text-[10px] mt-1">${el}</div></td>
            <td class="py-3 px-2 align-top">${sh}</td>
        </tr>`;
    });

    tb.innerHTML = rows;
    document.getElementById('kpiMeta').innerText = tMeta;
    document.getElementById('kpiReal').innerText = tReal;
    document.getElementById('kpiShared').innerText = sc;
    document.getElementById('kpiAciertos').innerText = `${mCub} / ${lData.mesas.length}`;
    document.getElementById('tableCount').innerText = `${lData.mesas.length} Mesas`;

    const cumpleNum = tMeta > 0 ? (tReal / tMeta) * 100 : 0;
    const kpiCumple = document.getElementById('kpiCumple');
    kpiCumple.innerText = cumpleNum.toFixed(0) + '%';
    kpiCumple.className = `text-2xl font-bold mt-1 ${cumpleNum >= 100 ? 'text-emerald-400' : cumpleNum >= 50 ? 'text-amber-400' : 'text-red-400'}`;

    updateDonutChart(g, y, r, gr);
}

document.addEventListener('DOMContentLoaded', initDashboard);
