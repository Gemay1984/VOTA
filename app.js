let rawData = { status: 'pending', leaders: {}, leaderNames: [] };
let donutChart = null;
let dataDiaD = null;
let dataE14 = null;
let e14ByMesa = {};
let currentFilteredMesas = []; // Shared for Excel export

const STOP_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'ie', 'col', 'colegio', 'institucion', 'educativa', 'educativo', 'instituto', 'escuela', 'sede', 'puesto', 'and', 'the', 'num', 'no', 'mesa', 'urna', 'sd', 'principal', 'nuestra', 'senora', 'juan', 'maria', 'jose', 'santa', 'san', 'santander', 'normal', 'superior']);

const ABBREV_EXPAND = {
    'lv': 'laura vicuna', 'l v': 'laura vicuna', 'cam': 'centro administrativo municipal', 'eam': 'escuela administracion mercadotecnia',
    'iti': 'instituto tecnico industrial', 'esap': 'escuela superior administracion publica', 'imet': 'imet',
    'madre marcelina': 'madre marcelina', 'medre marcelina': 'madre marcelina', 'estadio': 'estadio centenario',
    'ciudad sur': 'ciudadela del sur', 'ciudadela del sur': 'ciudadela del sur', 'zuldemayda': 'zuldemayda',
    'zuldemaida': 'zuldemayda', 'quindos': 'los quindos', 'i e juan xxiii': 'juan xxiii', 'juan xxiii': 'juan xxiii', 'gustavo matamoros': 'gustavo matamoros',
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
    
    const savedApiUrl = localStorage.getItem('apiUrl');
    if (savedApiUrl) document.getElementById('apiUrl').value = savedApiUrl;

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
    
    const btn = document.getElementById('leaderSelectBtn');
    const dropdown = document.getElementById('leaderDropdown');
    const search = document.getElementById('leaderSearch');
    
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
    
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== btn) {
            dropdown.classList.remove('show');
        }
    });

    search.addEventListener('input', filterLeaders);
    document.getElementById('btnAll').addEventListener('click', selectAllLeaders);
    document.getElementById('btnClear').addEventListener('click', clearAllLeaders);
    
    document.getElementById('candidateSelect').addEventListener('change', renderDashboard);
    document.getElementById('includePartyToggle').addEventListener('change', renderDashboard);
    
    // Table filter listeners
    document.getElementById('filterPuesto').addEventListener('input', renderDashboard);
    document.getElementById('filterMesa').addEventListener('input', renderDashboard);
    document.getElementById('filterStatus').addEventListener('change', renderDashboard);
    document.getElementById('btnDownloadExcel').addEventListener('click', downloadExcel);
}

async function syncData() {
    const apiUrl = document.getElementById('apiUrl').value.trim();
    if (!apiUrl) return;

    localStorage.setItem('apiUrl', apiUrl);
    setStatus('Sincronizando...', 'yellow', true);

    try {
        const res = await fetch(apiUrl).then(r => r.ok ? r.json() : Promise.reject('Error de conexión'));
        if (res.error) throw new Error(res.error);
        dataDiaD = res.diad;
        dataE14 = res.e14;
        processData();
        setStatus('Datos Listos', 'green', false);
    } catch (err) {
        console.error(err);
        setStatus('Error de Conexión', 'red', false);
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
    e14ByMesa = {};
    dataE14.forEach(row => {
        if (!row) return;
        const mesa = parseInt(row['Mesa']) || 0;
        const folderWords = getKeyWords((row['Lugar (Puesto de Votación)'] || row['Lugar'] || '') + ' ' + (row['Zona'] || ''));
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
    const mesaLeaderIdx = {};

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
                    } : null
                });
                const key = `${puesto}|${mesa}`;
                if (!mesaLeaderIdx[key]) mesaLeaderIdx[key] = new Set();
                mesaLeaderIdx[key].add(lider);
            }
        }
    }

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
    let s = String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/\bmesa\s+\d+\b/g, '').replace(/\burna\s+\d+\b/g, '');
    s = s.replace(/\bi\.e\.?\b/g, 'ie').replace(/\bi\s+e\b/g, 'ie').replace(/\bsd\b/g, 'sede');
    s = s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
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
    const list = document.getElementById('leaderList');
    list.innerHTML = '';
    rawData.leaderNames.forEach(l => {
        const item = document.createElement('div');
        item.className = 'checkbox-item px-4 py-2 flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-700/30';
        item.innerHTML = `<input type="checkbox" value="${l}" class="leader-checkbox"><span class="text-sm text-slate-300 truncate">${l}</span>`;
        item.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') { const cb = item.querySelector('input'); cb.checked = !cb.checked; }
            renderDashboard();
        });
        list.appendChild(item);
    });
    renderDashboard();
}

function filterLeaders() {
    const q = document.getElementById('leaderSearch').value.toLowerCase();
    document.querySelectorAll('.checkbox-item').forEach(it => {
        const text = it.querySelector('span').innerText.toLowerCase();
        it.style.display = text.includes(q) ? 'flex' : 'none';
    });
}

function selectAllLeaders() { document.querySelectorAll('.leader-checkbox').forEach(cb => cb.checked = true); renderDashboard(); }
function clearAllLeaders() { document.querySelectorAll('.leader-checkbox').forEach(cb => cb.checked = false); renderDashboard(); }

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
    const selectedLeaders = Array.from(document.querySelectorAll('.leader-checkbox:checked')).map(cb => cb.value);
    const cid = document.getElementById('candidateSelect').value;
    const incP = document.getElementById('includePartyToggle').checked;
    const tb = document.getElementById('resultsTableBody');

    const selectBtnText = document.getElementById('selectedCountText');
    if (selectedLeaders.length === 0) selectBtnText.innerText = "Selecciona uno o varios líderes...";
    else if (selectedLeaders.length === 1) selectBtnText.innerText = selectedLeaders[0];
    else selectBtnText.innerText = `${selectedLeaders.length} líderes seleccionados`;

    if (!dataE14 || !dataDiaD) return;

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

    let tMeta=0, tReal=0, g=0, y=0, r=0, gr=0, sc=0, mCub=0;
    let rows = '';

    if (selectedLeaders.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-slate-500 italic">Sincronización Exitosa. Selecciona uno o más líderes para ver el detalle.</td></tr>';
        Object.values(rawData.leaders).forEach(l => {
            l.mesas.forEach(m => {
                const rv = getVotesFromE14(m.e14, cid, incP);
                if (rv === null) gr++;
                else { if (rv >= m.proyectados) g++; else if (rv > 0) y++; else r++; }
            });
        });
        document.getElementById('kpiMeta').innerText = "VOTACIÓN"; document.getElementById('kpiReal').innerText = "GLOBAL";
        document.getElementById('kpiCumple').innerText = "100%"; document.getElementById('kpiShared').innerText = "0";
        document.getElementById('kpiAciertos').innerText = "General"; document.getElementById('tableCount').innerText = "Resumen Global";
        updateDonutChart(g, y, r, gr);
        currentFilteredMesas = [];
        return;
    }
    
    const aggregatedMesas = [];
    selectedLeaders.forEach(lName => { if (rawData.leaders[lName]) aggregatedMesas.push(...rawData.leaders[lName].mesas); });
    aggregatedMesas.sort((a,b) => a.puesto.localeCompare(b.puesto));

    const fPuesto = document.getElementById('filterPuesto').value.toLowerCase();
    const fMesa = document.getElementById('filterMesa').value.toLowerCase();
    const fStatus = document.getElementById('filterStatus').value;

    const filteredMesas = aggregatedMesas.filter(m => {
        const rv = getVotesFromE14(m.e14, cid, incP);
        let mStatus = rv === null ? 'gray' : (rv >= m.proyectados ? 'green' : (rv > 0 ? 'yellow' : 'red'));
        const matchPuesto = fPuesto === '' || m.puesto.toLowerCase().includes(fPuesto);
        const matchMesa = fMesa === '' || String(m.mesa).includes(fMesa);
        const matchStatus = fStatus === 'all' || mStatus === fStatus;
        return matchPuesto && matchMesa && matchStatus;
    });

    currentFilteredMesas = filteredMesas;

    filteredMesas.forEach(m => {
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
        const filteredShared = (m.sharedLeaders || []).filter(l => selectedLeaders.includes(l));
        if (filteredShared.length) { sc++; sh = `<div class="flex flex-col gap-1">${filteredShared.map(l => `<span class="text-[9px] badge-yellow px-1 py-0.5 rounded-sm">⚠️ ${l}</span>`).join('')}</div>`; }

        const vHtml = m.voters.map(v => `<div class="flex items-center gap-1 py-0.5 border-b border-slate-800/50 text-slate-200 text-[11px]">${v.nombre}</div>`).join('');
        
        rows += `<tr class="hover:bg-slate-800/40 border-b border-slate-800/50">
            <td class="py-3 px-4 align-top text-slate-300 text-xs">${m.puesto}</td>
            <td class="py-3 px-2 text-center align-top font-bold text-white text-sm">${m.mesa}</td>
            <td class="py-3 px-3 align-top"><div class="max-h-24 overflow-y-auto pr-1">${vHtml}</div></td>
            <td class="py-3 px-3 text-center align-top border-l border-slate-700/30 bg-slate-900/20 text-2xl font-bold text-blue-400">${rv !== null ? real : '—'}</td>
            <td class="py-3 px-3 text-center align-top"><span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${bc}">${it}</span><div class="text-slate-500 text-[10px] mt-1">${el}</div></td>
            <td class="py-3 px-2 align-top">${sh}</td>
        </tr>`;
    });

    tb.innerHTML = rows;
    document.getElementById('kpiMeta').innerText = tMeta.toLocaleString();
    document.getElementById('kpiReal').innerText = tReal.toLocaleString();
    document.getElementById('kpiShared').innerText = sc;
    document.getElementById('kpiAciertos').innerText = `${mCub} / ${filteredMesas.length}`;
    document.getElementById('tableCount').innerText = `${filteredMesas.length} Mesas Encontradas`;

    const cumpleNum = tMeta > 0 ? (tReal / tMeta) * 100 : 0;
    const kpiCumple = document.getElementById('kpiCumple');
    kpiCumple.innerText = cumpleNum.toFixed(0) + '%';
    kpiCumple.className = `text-2xl font-bold mt-1 ${cumpleNum >= 100 ? 'text-emerald-400' : cumpleNum >= 50 ? 'text-amber-400' : 'text-red-400'}`;

    updateDonutChart(g, y, r, gr);
}

function downloadExcel() {
    if (!currentFilteredMesas || currentFilteredMesas.length === 0) { alert("No hay datos filtrados para descargar."); return; }
    const cid = document.getElementById('candidateSelect').value;
    const incP = document.getElementById('includePartyToggle').checked;

    const data = currentFilteredMesas.map(m => {
        const rv = getVotesFromE14(m.e14, cid, incP);
        let mStatus = rv === null ? 'No hay E14' : (rv >= m.proyectados ? 'Cumplida' : (rv > 0 ? 'Parcial' : 'Sin votos'));
        return {
            "Puesto de Votación": m.puesto,
            "Mesa": m.mesa,
            "Personas Proyectadas": m.proyectados,
            "Votos E-14 (Real)": rv !== null ? rv : 0,
            "Estado": mStatus,
            "Porcentaje": m.proyectados > 0 ? `${(( (rv||0) / m.proyectados )*100).toFixed(1)}%` : '0%',
            "Líderes Shared": (m.sharedLeaders || []).join(", "),
            "Votantes": m.voters.map(v => v.nombre).join(" | ")
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Eficacia");
    XLSX.writeFile(wb, `Reporte_Eficacia_${new Date().toISOString().split('T')[0]}.xlsx`);
}

document.addEventListener('DOMContentLoaded', initDashboard);
