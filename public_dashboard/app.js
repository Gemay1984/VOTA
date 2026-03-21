let rawData = null;
let donutChart = null;

async function initDashboard() {
    try {
        const res = await fetch('/api/data');
        rawData = await res.json();
        
        if (rawData.status === 'success') {
            document.getElementById('statusBadge').innerHTML = '<span class="relative flex h-3 w-3"><span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span> Datos Conectados';
            document.getElementById('statusBadge').className = 'mt-4 md:mt-0 px-4 py-2 rounded-full badge-green text-sm font-medium flex items-center gap-2';
            populateLeaders();
            setupEventListeners();
            initDonutChart();
        } else {
            alert("Error cargando los datos del servidor.");
        }
    } catch (e) {
        alert("Error de conexión al servidor local. ¿Está encendido el puerto 4000?");
        console.error(e);
    }
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
                borderWidth: 2,
                hoverOffset: 6
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
    
    const total = green + yellow + red + gray;
    const pct = total > 0 ? Math.round((green / total) * 100) : 0;
    document.getElementById('donutPct').innerText = `${pct}%`;
    
    document.getElementById('lblGreen').innerText = green;
    document.getElementById('lblYellow').innerText = yellow;
    document.getElementById('lblRed').innerText = red;
    document.getElementById('lblGray').innerText = gray;
}

function populateLeaders() {
    const leaderSelect = document.getElementById('leaderSelect');
    leaderSelect.innerHTML = '<option value="">Selecciona un líder...</option>';
    rawData.leaderNames.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.textContent = l;
        leaderSelect.appendChild(opt);
    });
}

function setupEventListeners() {
    document.getElementById('leaderSelect').addEventListener('change', renderDashboard);
    document.getElementById('candidateSelect').addEventListener('change', renderDashboard);
    document.getElementById('includePartyToggle').addEventListener('change', renderDashboard);
}

// Returns the relevant votes from E14 based on the candidate selection
// Always includes "Solo por el Partido" of the selected party automatically
function getVotesFromE14(e14, candidateId, includeParty) {
    if (!e14) return null;
    let candidateVotes = 0;
    let partyVotes = 0;
    
    switch(candidateId) {
        case 'U_6':
            candidateVotes = e14.uCand6;
            partyVotes = e14.uSoloPartido; // Always include "Solo Partido" for the party
            break;
        case 'U_Solo':
            partyVotes = e14.uSoloPartido;
            break;
        case 'Con_11':
            candidateVotes = e14.conCand11;
            partyVotes = e14.conSoloPartido; // Always include "Solo Partido" for the party
            break;
        case 'Con_Solo':
            partyVotes = e14.conSoloPartido;
            break;
    }
    
    // If toggle is on: include party votes in total
    return candidateVotes + (includeParty ? partyVotes : 0);
}

function renderDashboard() {
    const leader = document.getElementById('leaderSelect').value;
    const candidateId = document.getElementById('candidateSelect').value;
    const includeParty = document.getElementById('includePartyToggle').checked;
    const tbody = document.getElementById('resultsTableBody');
    
    if (!leader) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-slate-500 italic">Selecciona un líder para visualizar el desglose.</td></tr>';
        resetKPIs();
        return;
    }
    
    const leaderData = rawData.leaders[leader];
    if (!leaderData) return;
    
    let totalMeta = 0, totalReal = 0;
    let cntGreen = 0, cntYellow = 0, cntRed = 0, cntGray = 0;
    let mesasCubiertas = 0, mesasConOtros = 0;
    let rows = '';
    
    for (const entry of leaderData.mesas) {
        const meta = entry.proyectados;
        totalMeta += meta;
        
        const realVotes = getVotesFromE14(entry.e14, candidateId, includeParty);
        const real = realVotes === null ? 0 : realVotes;
        if (realVotes !== null) totalReal += real;
        
        let badgeClass, iconText, effectLabel, category;
        if (realVotes === null) {
            badgeClass = 'text-slate-400 bg-slate-800 border-slate-700';
            iconText = '⚪ Sin datos E-14';
            effectLabel = 'No encontrado';
            category = 'gray'; cntGray++;
        } else if (real >= meta) {
            badgeClass = 'text-emerald-400 bg-emerald-900/40 border-emerald-800';
            iconText = `🟢 Cubierta`;
            effectLabel = `${((real/meta)*100).toFixed(0)}%`;
            category = 'green'; cntGreen++; mesasCubiertas++;
        } else if (real > 0) {
            badgeClass = 'text-amber-400 bg-amber-900/40 border-amber-800';
            iconText = `🟡 Parcial`;
            effectLabel = `${((real/meta)*100).toFixed(0)}%`;
            category = 'yellow'; cntYellow++;
        } else {
            badgeClass = 'text-red-400 bg-red-900/40 border-red-800';
            iconText = `🔴 Sin votos`;
            effectLabel = `0%`;
            category = 'red'; cntRed++;
        }
        
        // Shared leaders alert
        let sharedHtml = '—';
        if (entry.sharedLeaders && entry.sharedLeaders.length > 0) {
            mesasConOtros++;
            sharedHtml = `<div class="flex flex-col gap-1">` + 
                entry.sharedLeaders.map(l => `<span class="text-xs badge-yellow px-2 py-0.5 rounded-md">⚠️ ${l}</span>`).join('') +
                `</div>`;
        }
        
        // Show E-14 vote breakdown
        let e14Breakdown = '';
        if (entry.e14) {
            const ic = candidateId.startsWith('U_') ? {
                cand: `U (Cand 6): <b>${entry.e14.uCand6}</b>`,
                solo: `U (Partido): <b>${entry.e14.uSoloPartido}</b>`
            } : {
                cand: `Con (Cand 11): <b>${entry.e14.conCand11}</b>`,
                solo: `Con (Partido): <b>${entry.e14.conSoloPartido}</b>`
            };
            e14Breakdown = `<div class="text-slate-500 text-xs mt-1">${ic.cand} | ${ic.solo}</div>`;
        }
        
        // Individual voters list
        const votersHtml = entry.voters.map(v => 
            `<div class="flex items-center gap-2 py-0.5">
                <div class="w-6 h-6 rounded-full bg-blue-800/50 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">${v.nombre.charAt(0)}</div>
                <div>
                    <div class="text-slate-200 text-xs font-medium leading-tight">${v.nombre}</div>
                    <div class="text-slate-500 text-xs">CC: ${v.cedula}</div>
                </div>
            </div>`
        ).join('');

        rows += `
            <tr class="hover:bg-slate-800/40 transition border-b border-slate-800">
                <td class="py-4 px-6 align-top">
                    <div class="font-semibold text-slate-200 text-sm">${entry.puesto}</div>
                    ${entry.e14 ? `<div class="text-slate-500 text-xs mt-0.5">📂 ${entry.e14.zona.split('\\').slice(-2).join(' › ')}</div>` : '<span class="text-xs text-red-500/70">⚠️ No emparejado en E-14</span>'}
                </td>
                <td class="py-4 px-4 text-center align-top">
                    <span class="font-bold text-white text-base">M ${entry.mesa}</span>
                </td>
                <td class="py-4 px-4 align-top">
                    <div class="text-slate-400 text-xs mb-1 font-semibold">Proyectados: ${meta}</div>
                    <div class="max-h-28 overflow-y-auto flex flex-col gap-0.5">${votersHtml}</div>
                </td>
                <td class="py-4 px-4 text-center align-top border-l border-slate-700 bg-slate-900/40">
                    <div class="text-3xl font-bold text-blue-400">${realVotes !== null ? real : '—'}</div>
                    ${e14Breakdown}
                </td>
                <td class="py-4 px-4 text-center align-top">
                    <span class="px-3 py-1.5 text-xs font-bold rounded-full border ${badgeClass}">${iconText}</span>
                    <div class="text-slate-500 text-xs mt-1">${effectLabel}</div>
                </td>
                <td class="py-4 px-4 align-top">${sharedHtml}</td>
            </tr>`;
    }
    
    tbody.innerHTML = rows || '<tr><td colspan="6" class="py-10 text-center text-slate-500">No hay datos para este líder.</td></tr>';
    
    // Update KPIs
    document.getElementById('kpiMeta').innerText = totalMeta;
    document.getElementById('kpiReal').innerText = totalReal;
    document.getElementById('kpiShared').innerText = mesasConOtros;
    document.getElementById('kpiAciertos').innerText = `${mesasCubiertas} / ${leaderData.mesas.length}`;
    document.getElementById('tableCount').innerText = `${leaderData.mesas.length} Mesas activas`;
    
    // Update donut chart
    updateDonutChart(cntGreen, cntYellow, cntRed, cntGray);
}

function resetKPIs() {
    document.getElementById('kpiMeta').innerText = '0';
    document.getElementById('kpiReal').innerText = '0';
    document.getElementById('kpiShared').innerText = '0';
    document.getElementById('kpiAciertos').innerText = '0';
    document.getElementById('donutPct').innerText = '—';
    updateDonutChart(0, 0, 0, 1);
}

document.addEventListener('DOMContentLoaded', initDashboard);
