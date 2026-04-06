let rawData = { status: 'pending', leaders: {}, leaderNames: [] };
let donutChart = null;
let leaderChart = null;
let dataDiaD = null;
let dataE14 = null;
let e14ByMesa = {};
let currentFilteredMesas = [];
let selectedLeader = 'all';

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
    setupGlobalListeners();
    initCharts();
    const savedApiUrl = localStorage.getItem('apiUrl');
    if (savedApiUrl) document.getElementById('apiUrl').value = savedApiUrl;
    syncData();
}

function initCharts() {
    try {
        const ctxD = document.getElementById('donutChart').getContext('2d');
        donutChart = new Chart(ctxD, {
            type: 'doughnut',
            data: {
                labels: ['Cubiertas 🟢', 'Parciales 🟡', 'Sin votos 🔴', 'Sin datos ⚪'],
                datasets: [{
                    data: [0, 0, 0, 1],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#475569'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '70%', plugins: { legend: { display: false } } }
        });

        const ctxL = document.getElementById('leaderChart').getContext('2d');
        leaderChart = new Chart(ctxL, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    { label: 'Meta', data: [], backgroundColor: 'rgba(71, 85, 105, 0.5)', borderRadius: 4 },
                    { label: 'Fulfillment', data: [], backgroundColor: '#10b981', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { ticks: { color: '#e2e8f0' } }
                },
                plugins: { legend: { labels: { color: '#e2e8f0' } } }
            }
        });
    } catch (e) { console.error(e); }
}

function updateDonutChart(g, y, r, gr) {
    if (!donutChart) return;
    const total = g + y + r;
    const pct = total > 0 ? ((g / total) * 100).toFixed(0) + '%' : '0%';
    document.getElementById('lblGreen').innerText = g;
    document.getElementById('lblYellow').innerText = y;
    document.getElementById('lblRed').innerText = r;
    document.getElementById('lblGray').innerText = gr;
    document.getElementById('donutPct').innerText = pct;
    donutChart.data.datasets[0].data = [g, y, r, gr];
    donutChart.update();
}

function setupGlobalListeners() {
    document.getElementById('btnSync').onclick = syncData;
    const btn = document.getElementById('leaderSelectBtn');
    const dropdown = document.getElementById('leaderDropdown');
    btn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); };
    document.onclick = (e) => { if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.remove('show'); };
    document.getElementById('leaderSearch').oninput = filterLeaders;
    
    ['candidateSelect', 'includePartyToggle', 'filterStatus', 'candidateFilter'].forEach(id => { document.getElementById(id).onchange = renderDashboard; });
    ['filterPuesto', 'filterMesa'].forEach(id => { document.getElementById(id).oninput = renderDashboard; });
    document.getElementById('btnDownloadExcel').onclick = downloadExcel;
}

async function syncData() {
    const apiUrl = document.getElementById('apiUrl').value.trim();
    if (!apiUrl) return;
    localStorage.setItem('apiUrl', apiUrl);
    setStatus('Sync...', 'yellow', true);
    try {
        const res = await fetch(apiUrl).then(r => r.ok ? r.json() : Promise.reject('Error'));
        dataDiaD = res.diad; dataE14 = res.e14;
        processData();
        setStatus('Ready', 'green', false);
    } catch (err) { setStatus('Error', 'red', false); }
}

function setStatus(text, color, anim) {
    const b = document.getElementById('statusBadge');
    b.className = `px-4 py-2 rounded-full badge-${color} text-sm font-medium flex items-center gap-2`;
    b.innerHTML = `<span class="relative flex h-2 w-2">${anim ? '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>' : ''}<span class="relative inline-flex rounded-full h-2 w-2 bg-${color}-500"></span></span> ${text}`;
}

function processData() {
    if (!dataE14 || !dataDiaD) return;
    e14ByMesa = {};
    dataE14.forEach(row => {
        const m = parseInt(row['Mesa']) || 0;
        if (!e14ByMesa[m]) e14ByMesa[m] = [];
        e14ByMesa[m].push({ words: getKeyWords((row['Lugar (Puesto de Votación)'] || row['Lugar'] || '') + ' ' + (row['Zona'] || '')), row });
    });

    const lMap = {};
    dataDiaD.forEach(row => {
        const lid = String(row['usuario'] || 'DESCONOCIDO').trim();
        const p = String(row['Puesto de Votacion'] || row['Puesto de Votacion '] || '').trim();
        const m = parseInt(row['Mesa']) || 0;
        if (!m) return;
        if (!lMap[lid]) lMap[lid] = {};
        if (!lMap[lid][p]) lMap[lid][p] = {};
        const s_info = String(row['S'] || '').trim();
        const cand = String(row['candidato'] || 'N/A').trim();
        if (!lMap[lid][p][m]) lMap[lid][p][m] = { voters: [], cand: cand };
        lMap[lid][p][m].voters.push({ n: row['Nombres y Apellidos'], s: s_info });
    });

    const results = {};
    const candSet = new Set();
    const gMesas = {};

    for (const [lid, puestos] of Object.entries(lMap)) {
        results[lid] = { mesas: [], cand: 'N/A' };
        for (const [p, ms] of Object.entries(puestos)) {
            for (const [m, d] of Object.entries(ms)) {
                const e14Row = findE14Match(p, m);
                results[lid].mesas.push({ p, m, voters: d.voters, proyectados: d.voters.length, e14: e14Row });
                if (d.cand && d.cand !== 'N/A') { results[lid].cand = d.cand; candSet.add(d.cand); }
                
                const standardKey = e14Row ? `E14|${e14Row['Zona']}|${e14Row['Lugar (Puesto de Votación)'] || e14Row['Lugar']}|${m}` : `RAW|${p}|${m}`;
                if (!gMesas[standardKey]) gMesas[standardKey] = [];
                if (!gMesas[standardKey].includes(lid)) gMesas[standardKey].push(lid);
            }
        }
    }
    rawData = { leaders: results, leaderNames: Object.keys(results).sort(), candidates: Array.from(candSet).sort(), globalMesas: gMesas };
    populateCandidateFilter();
    populateLeaders();
}

function populateCandidateFilter() {
    const sel = document.getElementById('candidateFilter');
    const cur = sel.value;
    sel.innerHTML = '<option value="all">Todos los Candidatos</option>';
    rawData.candidates.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c;
        sel.appendChild(opt);
    });
    if (cur && rawData.candidates.includes(cur)) sel.value = cur;
}

function syncCandidateForms() {
    const candF = document.getElementById('candidateFilter').value;
    const candS = document.getElementById('candidateSelect');
    const options = Array.from(candS.options);
    
    let party = 'all';
    if (candF.toLowerCase().includes('conservador')) party = 'con';
    else if (candF.toLowerCase().includes(' de la u') || candF.toLowerCase().includes('(u)')) party = 'u';

    let firstMatch = null;
    options.forEach(opt => {
        let isMatch = true;
        if (party === 'con') isMatch = opt.value.startsWith('Con_');
        else if (party === 'u') isMatch = opt.value.startsWith('U_');
        else isMatch = true; // Show all if 'all' candidate
        
        opt.style.display = isMatch ? 'block' : 'none';
        if (isMatch && !firstMatch) firstMatch = opt.value;
    });

    // Stricter: if party doesn't match current selection, force change
    if (party !== 'all' && !candS.value.toLowerCase().startsWith(party)) {
        candS.value = firstMatch;
    }
}

function getKeyWords(str) {
    if (!str) return [];
    let s = String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return s.split(' ').map(w => ABBREV_EXPAND[w] || w).join(' ').split(' ').filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

function findE14Match(p, m) {
    const cs = e14ByMesa[parseInt(m)] || [];
    const pw = getKeyWords(p);
    let b = null, bs = 0;
    
    // First Pass: Keyword matching
    cs.forEach(c => {
        let sc = 0; 
        pw.forEach(w => { 
            c.words.forEach(fw => { 
                // Exact word match or clear substring
                if (fw === w || (fw.length > 3 && w.length > 3 && (fw.includes(w) || w.includes(fw)))) sc++; 
            }); 
        });
        if (sc > bs) { bs = sc; b = c; }
    });
    
    if (bs >= 1) return b.row;

    // Second Pass: Direct string containment ignoring spaces/symbols
    let pRaw = String(p).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    if (pRaw.length < 4) return null; // Avoid false positives on tiny strings
    
    for (const c of cs) {
        let cRaw = String(c.row['Lugar (Puesto de Votación)'] || c.row['Lugar'] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        let zRaw = String(c.row['Zona'] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        
        if (cRaw.includes(pRaw) || pRaw.includes(cRaw) || zRaw.includes(pRaw) || pRaw.includes(zRaw)) {
            return c.row;
        }
    }

    return null;
}

function populateLeaders() {
    const list = document.getElementById('leaderList');
    const candFilter = document.getElementById('candidateFilter').value;
    list.innerHTML = '';

    const elTodos = document.createElement('div');
    elTodos.className = 'leader-option px-4 py-2 flex items-center cursor-pointer hover:bg-slate-700/20 border-b border-slate-700/30 text-sm font-bold text-blue-400';
    elTodos.innerText = 'Todos los Líderes';
    elTodos.onclick = () => { selectLeader('all'); };
    list.appendChild(elTodos);

    rawData.leaderNames.forEach(l => {
        const lData = rawData.leaders[l];
        if (candFilter !== 'all' && lData.cand !== candFilter) return;
        
        const div = document.createElement('div');
        div.className = 'leader-option px-4 py-2 flex items-center cursor-pointer hover:bg-slate-700/20 border-b border-slate-700/30 text-sm text-slate-300';
        div.innerText = l;
        div.onclick = () => { selectLeader(l); };
        list.appendChild(div);
    });
}

function selectLeader(l) {
    selectedLeader = l;
    document.getElementById('leaderDropdown').classList.remove('show');
    renderDashboard();
}

function filterLeaders() {
    const q = document.getElementById('leaderSearch').value.toLowerCase();
    document.querySelectorAll('.leader-option').forEach((it, index) => { 
        if (index === 0 && q !== '') { it.style.display = 'none'; return; }
        if (index === 0 && q === '') { it.style.display = 'flex'; return; }
        it.style.display = it.innerText.toLowerCase().includes(q) ? 'flex' : 'none'; 
    });
}

function getOff(e14, cid, incP) {
    if (!e14) return null;
    let cv = 0, pv = 0;
    if (cid === 'U_7') { cv = parseInt(e14['Partido de la U (Cand 7)'])||0; pv = parseInt(e14['Votos SOLO POR LA LISTA (U)'])||0; }
    else if (cid === 'U_Solo') { pv = parseInt(e14['Votos SOLO POR LA LISTA (U)'])||0; }
    else if (cid === 'Con_11') { cv = parseInt(e14['Conservador (Cand 11)'])||0; pv = parseInt(e14['Votos SOLO POR LA LISTA (Conservador)'])||0; }
    else if (cid === 'Con_Solo') { pv = parseInt(e14['Votos SOLO POR LA LISTA (Conservador)'])||0; }
    return cv + (incP ? pv : 0);
}

function renderDashboard() {
    const candF = document.getElementById('candidateFilter').value;
    const cid = document.getElementById('candidateSelect').value;
    const incP = document.getElementById('includePartyToggle').checked;
    const tb = document.getElementById('resultsTableBody');
    const statusContainer = document.getElementById('leaderStatusList');
    
    // Si cambia el filtro de candidato, refrescamos la lista de líderes disponible
    if (this && this.id === 'candidateFilter') {
        selectedLeader = 'all'; // Reset leader selection when candidate changes
        populateLeaders();
        syncCandidateForms();
    }

    let selected = [];
    if (selectedLeader === 'all') {
    if (candF !== 'all') {
        selected = rawData.leaderNames.filter(l => rawData.leaders[l].cand === candF);
        document.getElementById('selectedCountText').innerHTML = `<b>${candF}</b> (${selected.length} líd.)`;
        document.getElementById('leaderSelectBtn').classList.add('border-blue-500', 'bg-blue-500/10');
    } else {
        selected = rawData.leaderNames;
        document.getElementById('selectedCountText').innerText = "Todos los Líderes";
        document.getElementById('leaderSelectBtn').classList.remove('border-blue-500', 'bg-blue-500/10');
    }
} else {
    selected = [selectedLeader];
    document.getElementById('selectedCountText').innerHTML = `<b>Líder:</b> <span class="truncate ml-1 max-w-[150px] inline-block align-bottom">${selectedLeader}</span>`;
    document.getElementById('leaderSelectBtn').classList.add('border-blue-500', 'bg-blue-500/10');
}

let targetCand = candF;
if (selectedLeader !== 'all' && rawData.leaders[selectedLeader]) {
    targetCand = rawData.leaders[selectedLeader].cand;
}

if (!dataE14 || !dataDiaD) return;

    let totalGlobalE14 = 0;
    dataE14.forEach(row => { totalGlobalE14 += getOff(row, cid, incP) || 0; });
    document.getElementById('kpiGlobal').innerText = totalGlobalE14.toLocaleString();

    let tM=0, tR=0, g=0, y=0, r=0, gr=0, sc=0, mC=0;
    if (!selected.length) {
        tb.innerHTML = '<tr><td colspan="7" class="py-12 text-center text-slate-500 italic text-sm">Sin selección.</td></tr>';
        statusContainer.innerHTML = '';
        Object.values(rawData.leaders).forEach(l => {
            l.mesas.forEach(m => {
                const off = getOff(m.e14, cid, incP);
                if (off === null) gr++; else if (off > 0) g++; else r++;
            });
        });
        document.getElementById('kpiMeta').innerText = "VOTACIÓN"; document.getElementById('kpiReal').innerText = "GLOBAL";
        document.getElementById('kpiCumple').innerText = "—"; document.getElementById('kpiShared').innerText = "0";
        document.getElementById('kpiAciertos').innerText = "TODOS"; document.getElementById('tableCount').innerText = "Global Overview";
        updateDonutChart(g, y, r, gr);
        if (leaderChart) { leaderChart.data.labels=[]; leaderChart.data.datasets[0].data=[]; leaderChart.data.datasets[1].data=[]; leaderChart.update(); }
        return;
    }

    const uniqueMesas = new Map();
    const cLabels = []; const cMeta = []; const cReal = [];
    let sHtml = '';

    selected.forEach(lName => {
        const lData = rawData.leaders[lName];
        if (!lData) return;
        let lSumM = 0, lSumR = 0;
        lData.mesas.forEach(m => {
            lSumM += m.proyectados;
            const off = getOff(m.e14, cid, incP);
            // CAPPING: Efficiency = min(Goal, Official)
            const eff = off === null ? 0 : Math.min(m.proyectados, off);
            lSumR += eff;
            const key = `${m.p}|${m.m}`;
            if (!uniqueMesas.has(key)) uniqueMesas.set(key, { ...m, mergedM: m.proyectados, lids: [lName], vots: [...m.voters] });
            else { const ex = uniqueMesas.get(key); ex.mergedM += m.proyectados; ex.lids.push(lName); ex.vots.push(...m.voters); }
        });
        cLabels.push(lName); cMeta.push(lSumM); cReal.push(lSumR);
        const lP = lSumM > 0 ? (lSumR/lSumM)*100 : 0;
        let d = '⚪', cl = 'text-slate-500';
        if (lSumM > 0) { if (lP >= 100) { d='🟢'; cl='text-emerald-400'; } else if (lP > 0) { d='🟡'; cl='text-amber-400'; } else { d='🔴'; cl='text-red-400'; } }
        sHtml += `<div class="p-3 bg-slate-900/50 rounded-xl border border-slate-800/50 mb-2 flex justify-between items-center"><div class="flex items-center gap-3"><span>${d}</span><span class="text-xs font-bold text-white">${lName}</span></div><span class="text-xs font-black ${cl}">${lP.toFixed(0)}%</span></div>`;
    });

    statusContainer.innerHTML = sHtml;
    if (leaderChart) { leaderChart.data.labels = cLabels; leaderChart.data.datasets[0].data = cMeta; leaderChart.data.datasets[1].data = cReal; leaderChart.update(); }

    const fp = document.getElementById('filterPuesto').value.toLowerCase();
    const fm = document.getElementById('filterMesa').value.toLowerCase();
    const fs = document.getElementById('filterStatus').value;

    const filtered = Array.from(uniqueMesas.values()).sort((a,b) => a.p.localeCompare(b.p)).filter(m => {
        const off = getOff(m.e14, cid, incP);
        const st = off === null ? 'gray' : (off >= m.mergedM ? 'green' : (off > 0 ? 'yellow' : 'red'));
        return (fp==='' || m.p.toLowerCase().includes(fp)) && (fm==='' || String(m.m).includes(fm)) && (fs==='all' || st===fs);
    });

    currentFilteredMesas = filtered;
    let rows = '';
    filtered.forEach(m => {
        tM += m.mergedM;
        const off = getOff(m.e14, cid, incP);
        const eff = off === null ? 0 : Math.min(m.mergedM, off);
        tR += eff;
        let bc, it, el;
        if (off === null) { bc='text-slate-400'; it='⚪ No Data'; el='Pending'; gr++; }
        else if (off >= m.mergedM) { bc='text-emerald-400'; it='🟢 Goal Met'; el=`${((off/m.mergedM)*100).toFixed(0)}%`; g++; mC++; }
        else if (off > 0) { bc='text-amber-400'; it='🟡 Partial'; el=`${((off/m.mergedM)*100).toFixed(0)}%`; y++; }
        else { bc='text-red-400'; it='🔴 Zero Votes'; el='0%'; r++; }
        
        const standardKey = m.e14 ? `E14|${m.e14['Zona']}|${m.e14['Lugar (Puesto de Votación)'] || m.e14['Lugar']}|${m.m}` : `RAW|${m.p}|${m.m}`;
        const globalLids = rawData.globalMesas[standardKey] || [];
        
        // Filter shared leaders: only show those from the SAME candidate
        const filteredLids = globalLids.filter(l => {
            if (targetCand === 'all') return true;
            return rawData.leaders[l] && rawData.leaders[l].cand === targetCand;
        });

        const shH = filteredLids.map(l => {
            const isSelected = m.lids.includes(l);
            if (isSelected) return `<span class="bg-blue-900/50 border border-blue-500/30 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded block mb-1">👤 ${l}</span>`;
            return `<span class="bg-slate-800/80 border border-slate-700 text-slate-400 text-[9px] px-1.5 py-0.5 rounded block mb-1">👀 ${l} (Comparte)</span>`;
        }).join('');
        
        if (filteredLids.length > 1) sc++;
        const confH = m.vots.some(v => v.s && v.s !== '') ? '<span class="text-emerald-400 font-bold">✅ SI</span>' : '<span class="text-slate-500">NO</span>';
        const vH = m.vots.map(v => `<div class="text-[9px] text-slate-400 border-b border-white/5 flex justify-between"><span>${v.n}</span><span>${v.s?'✅':''}</span></div>`).join('');
        
        rows += `<tr class="border-b border-white/5 hover:bg-white/5"><td class="py-3 px-4 text-[11px] text-slate-300">${m.p}</td><td class="py-3 px-2 text-center font-bold text-white">${m.m}</td><td class="py-3 px-3"><div class="max-h-24 overflow-y-auto">${vH}</div></td><td class="py-3 px-3 text-center bg-white/5"><div class="text-lg font-bold text-blue-400">${off!==null?eff:'—'}</div><div class="text-[8px] text-slate-500">Goal: ${m.mergedM} | Off: ${off||0}</div></td><td class="py-3 px-3 text-center"><span class="px-2 py-0.5 text-[8px] font-bold border rounded ${bc}">${it}</span><div class="text-[8px] text-slate-500 mt-0.5">${el}</div></td><td class="py-3 px-2 text-center">${confH}</td><td class="py-3 px-2">${shH}</td></tr>`;
    });

    tb.innerHTML = rows;
    document.getElementById('kpiMeta').innerText = tM.toLocaleString();
    document.getElementById('kpiReal').innerText = tR.toLocaleString();
    document.getElementById('kpiShared').innerText = sc;
    document.getElementById('kpiAciertos').innerText = `${mC} / ${filtered.length}`;
    document.getElementById('tableCount').innerText = `${filtered.length} Mesas`;
    const cP = tM > 0 ? (tR/tM)*100 : 0;
    const kC = document.getElementById('kpiCumple');
    kC.innerText = cP.toFixed(0) + '%';
    kC.className = `text-2xl font-bold ${cP>=100?'text-emerald-400':cP>=50?'text-amber-400':'text-red-400'}`;
    updateDonutChart(g, y, r, gr);
}

function downloadExcel() {
    if (typeof XLSX === 'undefined' || !currentFilteredMesas.length) return;
    try {
        const cid = document.getElementById('candidateSelect').value, incP = document.getElementById('includePartyToggle').checked;
        const d = currentFilteredMesas.map(m => {
            const off = getOff(m.e14, cid, incP);
            const eff = off === null ? 0 : Math.min(m.mergedM, off);
            const voters = m.vots.map(v => `${v.n} (${v.s || 'No Conf.'})`).join(", ");
            return { 
                "Puesto": m.p, 
                "Mesa": m.m, 
                "Meta": m.mergedM, 
                "Real (Eficacia)": eff, 
                "Oficial E14": off||0, 
                "Confirmación": m.vots.some(v => v.s) ? "SÍ" : "NO",
                "Referidos": voters,
                "Líderes": m.lids.join(", ") 
            };
        });
        const ws = XLSX.utils.json_to_sheet(d);
        
        // Add styles using xlsx-js-style
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Header styling
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({c: C, r: 0});
            if (!ws[address]) continue;
            ws[address].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { patternType: "solid", fgColor: { rgb: "1E293B" } }, // Dark Slate header
                alignment: { horizontal: "center" }
            };
        }

        // Row styling based on status
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const rowData = d[R - 1];
            if (!rowData) continue;
            
            let bgColor = "FFFFFF";
            let fontColor = "000000";

            if (rowData["Confirmación"] === "SÍ") {
                bgColor = "C6EFCE"; // Verde: Confirmado
                fontColor = "006100";
            } else if (rowData["Oficial E14"] > 0) {
                bgColor = "FFEB9C"; // Naranja: Con coincidencia
                fontColor = "9C6500";
            } else {
                bgColor = "FFC7CE"; // Rojo: No voto (0 E14 y no confirmado)
                fontColor = "9C0006";
            }

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({c: C, r: R});
                if (!ws[address]) continue;
                ws[address].s = {
                    fill: { patternType: "solid", fgColor: { rgb: bgColor } },
                    font: { color: { rgb: fontColor } }
                };
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        XLSX.writeFile(wb, `Reporte_Electoral_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', initDashboard);
