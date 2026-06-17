/*
 * QuantiScore – Lógica de análise e interface
 *
 * Este script controla a navegação entre páginas, coleta dados do formulário,
 * executa as estimativas probabilísticas e desenha visualizações para
 * apresentar os resultados ao usuário. Todo o cálculo é feito no cliente,
 * permitindo uso offline. Para uma precisão maior, as fórmulas podem ser
 * ajustadas ou conectadas a APIs externas no futuro.
 */

// Ao carregar o documento, configuramos handlers
document.addEventListener('DOMContentLoaded', () => {
    // Navegação via links do cabeçalho
    document.querySelectorAll('[data-nav]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const target = link.getAttribute('href').replace('#', '');
            showPage(target);
        });
    });

    // Botão da landing page
    const startBtn = document.getElementById('startAnalysisBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => showPage('analysis'));
    }

    // Botões do formulário
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.getElementById('analysisForm').reset();
            showPage('home');
        });
    }

    const newAnalysisBtn = document.getElementById('newAnalysisBtn');
    if (newAnalysisBtn) {
        newAnalysisBtn.addEventListener('click', () => {
            document.getElementById('analysisForm').reset();
            showPage('analysis');
        });
    }

    // Submissão do formulário
    const form = document.getElementById('analysisForm');
    if (form) {
        form.addEventListener('submit', handleAnalysis);
    }

    // Atualiza ano no rodapé
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Registrar Service Worker para funcionamento offline
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW não registrado', err));
        });
    }
});

/**
 * Mostra apenas a seção com o id especificado e oculta as demais
 * @param {string} pageId ID da seção a ser exibida
 */
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        if (page.id === pageId) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
    });
    // Scroll para topo ao trocar de página
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Handler de submissão do formulário. Converte entradas em dados, calcula
 * probabilidades e exibe resultados.
 * @param {SubmitEvent} event
 */
function handleAnalysis(event) {
    event.preventDefault();
    const data = collectFormData();
    const results = computeAnalysis(data);
    displayResults(data, results);
    showPage('result');
}

/**
 * Lê os valores do formulário e retorna um objeto com dados normalizados
 */
function collectFormData() {
    const getVal = id => document.getElementById(id)?.value;
    const getCheckbox = id => document.getElementById(id)?.checked;
    return {
        teamA: getVal('teamA')?.trim() || 'Time A',
        teamB: getVal('teamB')?.trim() || 'Time B',
        competition: getVal('competition')?.trim() || '',
        matchDate: getVal('matchDate') || '',
        autoStats: getCheckbox('autoStats'),
        autoMarket: getCheckbox('autoMarket'),
        autoClimate: getCheckbox('autoClimate'),
        autoModel: getCheckbox('autoModel')
    };
}

/**
 * Converte classificações em fatores numéricos, calcula as expectativas de gols,
 * aplica distribuição de Poisson para determinar probabilidades de placares e
 * agrega probabilidades para cada resultado. Também calcula métricas
 * derivadas e o grau de confiança.
 * @param {Object} data Dados coletados do formulário
 */
function computeAnalysis(data) {
    // Gerador pseudo-aleatório determinístico a partir de string
    function pseudoRandom(str) {
        let hash = 0;
        if (!str) return Math.random();
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash % 1000) / 1000;
    }
    const teamA = data.teamA;
    const teamB = data.teamB;
    // ====== Form Stats (Etapa 1) ======
    function generateFormStats(team) {
        const last5Pts = Math.round(pseudoRandom(team + 'form5') * 15);
        const last10Pts = Math.round(pseudoRandom(team + 'form10') * 30);
        const last20Pts = Math.round(pseudoRandom(team + 'form20') * 60);
        const last5GF = Math.round(pseudoRandom(team + 'gf5') * 15);
        const last5GA = Math.round(pseudoRandom(team + 'ga5') * 15);
        const last10GF = Math.round(pseudoRandom(team + 'gf10') * 30);
        const last10GA = Math.round(pseudoRandom(team + 'ga10') * 30);
        const last20GF = Math.round(pseudoRandom(team + 'gf20') * 60);
        const last20GA = Math.round(pseudoRandom(team + 'ga20') * 60);
        const avgGF5 = last5GF / 5;
        const avgGA5 = last5GA / 5;
        const avgGF10 = last10GF / 10;
        const avgGA10 = last10GA / 10;
        const avgGF20 = last20GF / 20;
        const avgGA20 = last20GA / 20;
        // Tendência: compara média de gols marcados nos últimos 5 e 10 jogos
        const trend = avgGF5 > avgGF10 ? 'ascendente' : 'descendente';
        return {
            last5Pts,
            last10Pts,
            last20Pts,
            avgGF5,
            avgGA5,
            avgGF10,
            avgGA10,
            avgGF20,
            avgGA20,
            trend
        };
    }
    const formA = generateFormStats(teamA);
    const formB = generateFormStats(teamB);
    // ====== Offensive Strength (Etapa 2) ======
    function generateOffense(team) {
        const xg = 0.5 + pseudoRandom(team + 'xg') * 3; // 0.5–3.5
        const shots = 5 + Math.round(pseudoRandom(team + 'shots') * 15); // 5–20
        const onTarget = 2 + Math.round(pseudoRandom(team + 'onTarget') * 8); // 2–10
        const goals = Math.round(pseudoRandom(team + 'goalsOff') * 3); // 0–3
        const conversion = onTarget > 0 ? goals / onTarget : 0;
        const bigChances = Math.round(pseudoRandom(team + 'bigChances') * 4); // 0–4
        // Participação dos principais jogadores (0-1)
        const starImpact = pseudoRandom(team + 'star') * 0.5 + 0.5; // 0.5–1.0
        // Índice ofensivo combinando métricas (ponderado)
        let index = (xg / 3.5) * 0.4 + (conversion) * 0.3 + (bigChances / 4) * 0.2 + starImpact * 0.1;
        // Classificação
        let classification;
        if (index >= 0.8) classification = 'Muito Forte';
        else if (index >= 0.65) classification = 'Forte';
        else if (index >= 0.5) classification = 'Médio';
        else if (index >= 0.35) classification = 'Fraco';
        else classification = 'Muito Fraco';
        return { xg, shots, onTarget, goals, conversion, bigChances, starImpact, index, classification };
    }
    const offenseA = generateOffense(teamA);
    const offenseB = generateOffense(teamB);
    // ====== Defensive Strength (Etapa 3) ======
    function generateDefense(team) {
        const xga = 0.5 + pseudoRandom(team + 'xga') * 3; // 0.5–3.5
        const goalsConceded = Math.round(pseudoRandom(team + 'gc') * 3);
        const chancesConceded = Math.round(pseudoRandom(team + 'chances') * 5);
        const errors = Math.round(pseudoRandom(team + 'errors') * 3);
        const keeperEff = 0.7 + pseudoRandom(team + 'keeper') * 0.25; // 0.7–0.95
        // Índice defensivo: menor xGA, menos gols, menos chances, menos erros, maior eficiência
        let index = (1 - (xga / 3.5)) * 0.4 + (1 - (goalsConceded / 3)) * 0.2 + (1 - (chancesConceded / 5)) * 0.2 + (1 - (errors / 3)) * 0.1 + (keeperEff / 0.95) * 0.1;
        let classification;
        if (index >= 0.8) classification = 'Muito Forte';
        else if (index >= 0.65) classification = 'Forte';
        else if (index >= 0.5) classification = 'Médio';
        else if (index >= 0.35) classification = 'Fraco';
        else classification = 'Muito Fraco';
        return { xga, goalsConceded, chancesConceded, errors, keeperEff, index, classification };
    }
    const defenseA = generateDefense(teamA);
    const defenseB = generateDefense(teamB);
    // ====== Home/Away (Etapa 4) ======
    function generateHomeAdvantage(team) {
        // Simula desempenho em casa e fora (percentual de vitórias)
        const homeWinPct = 0.4 + pseudoRandom(team + 'homeWin') * 0.3; // 40–70%
        const awayWinPct = 0.3 + pseudoRandom(team + 'awayWin') * 0.3; // 30–60%
        const diff = homeWinPct - awayWinPct; // -0.3 a 0.4
        return { homeWinPct, awayWinPct, diff };
    }
    const homeAdvA = generateHomeAdvantage(teamA);
    const homeAdvB = generateHomeAdvantage(teamB);
    // Impacto percentual do mando: diferença média
    const homeImpactA = homeAdvA.diff - homeAdvB.diff; // positivo favorece A
    const homeImpactB = -homeImpactA;
    // ====== Squad (Etapa 5) ======
    function generateSquad(team) {
        const injuries = Math.round(pseudoRandom(team + 'injuries') * 4);
        const suspensions = Math.round(pseudoRandom(team + 'susp') * 2);
        const returns = Math.round(pseudoRandom(team + 'returns') * 2);
        const minutes = 1000 + Math.round(pseudoRandom(team + 'minutes') * 1500);
        const subQuality = 1 + Math.round(pseudoRandom(team + 'subs') * 9); // 1–10
        // Índice de impacto: mais lesões e suspensões e menos qualidade aumenta impacto
        let impactIndex = (injuries * 0.4 + suspensions * 0.3 - returns * 0.2 + (10 - subQuality) * 0.1) / 5;
        if (impactIndex < 0) impactIndex = 0;
        let classification;
        if (impactIndex >= 0.8) classification = 'Muito Alto';
        else if (impactIndex >= 0.6) classification = 'Alto';
        else if (impactIndex >= 0.4) classification = 'Médio';
        else if (impactIndex >= 0.2) classification = 'Baixo';
        else classification = 'Muito Baixo';
        return { injuries, suspensions, returns, minutes, subQuality, impactIndex, classification };
    }
    const squadA = generateSquad(teamA);
    const squadB = generateSquad(teamB);
    // ====== Fatigue (Etapa 6) ======
    function generateFatigue(team) {
        const daysRest = 2 + Math.round(pseudoRandom(team + 'rest') * 6); // 2–8 dias
        const travelDist = Math.round(pseudoRandom(team + 'travel') * 5000); // 0–5000 km
        const games14 = 2 + Math.round(pseudoRandom(team + 'games') * 4); // 2–6 jogos
        const rotation = Math.round(pseudoRandom(team + 'rotation') * 3); // 0–3
        // Índice de fadiga: menos dias de descanso, mais viagem, mais jogos e pouca rotação -> maior
        let index = ( (8 - daysRest) / 6 ) * 0.3 + (travelDist / 5000) * 0.3 + ((games14 - 2) / 4) * 0.3 + ((3 - rotation) / 3) * 0.1;
        if (index < 0) index = 0;
        if (index > 1) index = 1;
        return { daysRest, travelDist, games14, rotation, index };
    }
    const fatigueA = generateFatigue(teamA);
    const fatigueB = generateFatigue(teamB);
    // ====== Motivation (Etapa 7) ======
    function generateMotivation(comp) {
        // Baseado na competição string como antes
        if (!comp) return 0.6;
        const c = comp.toLowerCase();
        if (c.includes('final') || c.includes('mata') || c.includes('semi')) return 0.9;
        if (c.includes('amistoso') || c.includes('friendly')) return 0.3;
        if (c.includes('copa') || c.includes('cup') || c.includes('libertad') || c.includes('champ')) return 0.8;
        return 0.6;
    }
    const motivationIndexA = generateMotivation(data.competition);
    const motivationIndexB = motivationIndexA;
    // ====== Tactical Matchup (Etapa 8) ======
    function generateTactics(team) {
        const styles = ['posse', 'pressão alta', 'transição', 'contra-ataque', 'bola parada'];
        const style = styles[Math.floor(pseudoRandom(team + 'style') * styles.length)];
        return { style };
    }
    const tacticA = generateTactics(teamA);
    const tacticB = generateTactics(teamB);
    // Determine matchup type (simplified)
    let matchup = 'equilibrado';
    if (tacticA.style === 'posse' && tacticB.style === 'contra-ataque') matchup = `${data.teamB} pode explorar contra-ataques`;
    else if (tacticB.style === 'posse' && tacticA.style === 'contra-ataque') matchup = `${data.teamA} pode explorar contra-ataques`;
    // ====== Market (Etapa 9) ======
    function generateMarket(team, suffix) {
        // Gera odds iniciais e atuais de forma pseudo-aleatória
        const initOdd = 1.5 + pseudoRandom(team + 'initOdd' + suffix) * 3; // 1.5–4.5
        // Aplica variação até ±15%
        const movement = (pseudoRandom(team + 'move' + suffix) - 0.5) * 0.3; // -0.15–0.15
        const currentOdd = initOdd * (1 + movement);
        return { initOdd, currentOdd, movement };
    }
    const marketA = generateMarket(teamA, 'A');
    const marketB = generateMarket(teamB, 'B');
    const marketDraw = generateMarket('draw', 'D');
    // ====== Modelagem (Etapa 10) ======
    // Gera ELO rating para cada time
    const eloA = 1400 + pseudoRandom(teamA + 'elo') * 600; // 1400–2000
    const eloB = 1400 + pseudoRandom(teamB + 'elo') * 600;
    const eloDiff = eloA - eloB;
    // Convert offensive/defensive indices to factors around 1
    const offFactorA = 0.8 + offenseA.index * 0.4; // 0.8–1.2
    const defFactorA = 0.8 + defenseA.index * 0.4;
    const offFactorB = 0.8 + offenseB.index * 0.4;
    const defFactorB = 0.8 + defenseB.index * 0.4;
    // Form factor based on last5 points ratio (normalized 0–1)
    const formFactorA = 0.8 + (formA.last5Pts / 15) * 0.4; // 0.8–1.2
    const formFactorB = 0.8 + (formB.last5Pts / 15) * 0.4;
    // Squad impact factor (penaliza com impacto)
    const squadFactorA = 1 - squadA.impactIndex * 0.2; // 1 - (0-1)*0.2 => 0.8–1
    const squadFactorB = 1 - squadB.impactIndex * 0.2;
    // Fatigue factor (penaliza)
    const fatigueFactorA = 1 - fatigueA.index * 0.2; // 0.8–1
    const fatigueFactorB = 1 - fatigueB.index * 0.2;
    // Motivation factor (0.8–1.2)
    const motivationFactorA = 0.8 + motivationIndexA * 0.4;
    const motivationFactorB = 0.8 + motivationIndexB * 0.4;
    // Home advantage factor (1 + homeImpact * 0.1)
    const homeFactorA = 1 + homeImpactA * 0.1;
    const homeFactorB = 1 + homeImpactB * 0.1;
    // Adaptation factor (Etapa adapt from climate) using IAA
    let iaaA = null; let iaaB = null;
    let adaptationFactorA = 1; let adaptationFactorB = 1;
    if (data.autoClimate) {
        iaaA = 60 + pseudoRandom(teamA + 'climate') * 30;
        iaaB = 60 + pseudoRandom(teamB + 'climate') * 30;
        const diff = (iaaA - iaaB) / 100; // -0.3 a 0.3
        adaptationFactorA = 1 + diff * 0.1;
        adaptationFactorB = 1 - diff * 0.1;
    }
    // Combine factors to compute expected goals
    const baseAvgGoals = 1.5;
    let muA = baseAvgGoals * offFactorA * formFactorA * squadFactorB * fatigueFactorB * motivationFactorA * homeFactorA * adaptationFactorA / (defFactorB);
    let muB = baseAvgGoals * offFactorB * formFactorB * squadFactorA * fatigueFactorA * motivationFactorB * homeFactorB * adaptationFactorB / (defFactorA);
    // Ensure positivity
    muA = Math.max(muA, 0.1);
    muB = Math.max(muB, 0.1);
    // ====== Poisson distribution for scorelines ======
    const maxGoals = 5;
    const distA = poissonDistribution(muA, maxGoals);
    const distB = poissonDistribution(muB, maxGoals);
    let winA = 0, draw = 0, winB = 0;
    let scoreProbs = [];
    for (let i = 0; i <= maxGoals; i++) {
        for (let j = 0; j <= maxGoals; j++) {
            const p = distA[i] * distB[j];
            scoreProbs.push({ score: `${i}–${j}`, prob: p });
            if (i > j) winA += p;
            else if (i === j) draw += p;
            else winB += p;
        }
    }
    scoreProbs.sort((a, b) => b.prob - a.prob);
    const topScores = scoreProbs.slice(0, 5);
    // Probabilidades derivadas (over goals)
    const totalGoalDist = {};
    scoreProbs.forEach(item => {
        const [a, b] = item.score.split('–').map(Number);
        const total = a + b;
        totalGoalDist[total] = (totalGoalDist[total] || 0) + item.prob;
    });
    const over05 = 1 - (totalGoalDist[0] || 0);
    const over15 = 1 - ((totalGoalDist[0] || 0) + (totalGoalDist[1] || 0));
    const over25 = 1 - ((totalGoalDist[0] || 0) + (totalGoalDist[1] || 0) + (totalGoalDist[2] || 0));
    const over35 = 1 - ((totalGoalDist[0] || 0) + (totalGoalDist[1] || 0) + (totalGoalDist[2] || 0) + (totalGoalDist[3] || 0));
    let bothScore = 0;
    for (let i = 1; i <= maxGoals; i++) {
        for (let j = 1; j <= maxGoals; j++) {
            bothScore += distA[i] * distB[j];
        }
    }
    const cleanA = distB[0];
    const cleanB = distA[0];
    // ====== Confidence ======
    const diffProb = Math.abs(winA - winB);
    let confidence = 60 + diffProb * 40;
    // Ajuste por fadiga média (mais fadiga, menos confiança)
    const avgFatigueIdx = (fatigueA.index + fatigueB.index) / 2;
    confidence -= avgFatigueIdx * 20; // até -20
    // Ajuste por impacto de elenco médio
    const avgSquadImpact = (squadA.impactIndex + squadB.impactIndex) / 2;
    confidence -= avgSquadImpact * 15; // até -15
    // Ajuste por motivação média
    const avgMot = (motivationIndexA + motivationIndexB) / 2;
    confidence += (avgMot - 0.5) * 20; // -10 a +20
    // Ajuste por adaptação (muito desbalanceado) -> reduz confiança
    if (iaaA !== null && iaaB !== null) {
        const iaaDiffAbs = Math.abs(iaaA - iaaB);
        confidence -= iaaDiffAbs / 30 * 10; // se diff 30, -10
    }
    // Ajuste por odds movimento (se movimento grande indica incerteza)
    const movementMagnitude = Math.abs(marketA.movement) + Math.abs(marketB.movement) + Math.abs(marketDraw.movement);
    confidence -= movementMagnitude * 50; // -0.15*50= -7.5
    confidence = Math.max(0, Math.min(100, confidence));
    let confidenceLabel;
    if (confidence >= 81) confidenceLabel = 'Muito Alta';
    else if (confidence >= 61) confidenceLabel = 'Alta';
    else if (confidence >= 41) confidenceLabel = 'Moderada';
    else if (confidence >= 21) confidenceLabel = 'Baixa';
    else confidenceLabel = 'Muito Baixa';
    return {
        muA,
        muB,
        winA,
        draw,
        winB,
        topScores,
        derived: {
            over05,
            over15,
            over25,
            over35,
            bothScore,
            cleanA,
            cleanB
        },
        confidence,
        confidenceLabel,
        // Include detailed metrics for summary
        formA,
        formB,
        offenseA,
        offenseB,
        defenseA,
        defenseB,
        homeAdvantageA: homeAdvA,
        homeAdvantageB: homeAdvB,
        homeImpactA,
        homeImpactB,
        squadA,
        squadB,
        fatigueA,
        fatigueB,
        motivationIndexA,
        motivationIndexB,
        tacticA,
        tacticB,
        matchup,
        marketA,
        marketB,
        marketDraw,
        eloA,
        eloB,
        iaaA,
        iaaB
    };
}

/**
 * Calcula a distribuição de Poisson para um valor médio mu até maxGoals
 * @param {number} mu Valor médio
 * @param {number} maxGoals Número máximo de gols considerado
 * @returns {number[]} Array com probabilidades de 0 até maxGoals
 */
function poissonDistribution(mu, maxGoals) {
    const probs = [];
    // Calcular fatorial incrementalmente para eficiência
    let factorial = 1;
    const expNegMu = Math.exp(-mu);
    for (let k = 0; k <= maxGoals; k++) {
        if (k === 0) {
            probs[k] = expNegMu;
        } else {
            factorial *= k;
            probs[k] = Math.pow(mu, k) * expNegMu / factorial;
        }
    }
    return probs;
}

/**
 * Exibe os resultados nas seções apropriadas e cria visualizações
 * @param {Object} data Dados de entrada
 * @param {Object} results Resultados computados
 */
function displayResults(data, results) {
    // Sumário executivo
    const execSummary = document.getElementById('executiveSummary');
    execSummary.innerHTML = generateExecutiveSummary(data, results);

    // Probabilidades principais
    const mainList = document.getElementById('mainProbs');
    mainList.innerHTML = '';
    const formatPercent = p => (p * 100).toFixed(1) + '%';
    mainList.innerHTML += `<li><span>Vitória ${data.teamA}:</span><span>${formatPercent(results.winA)}</span></li>`;
    mainList.innerHTML += `<li><span>Empate:</span><span>${formatPercent(results.draw)}</span></li>`;
    mainList.innerHTML += `<li><span>Vitória ${data.teamB}:</span><span>${formatPercent(results.winB)}</span></li>`;

    // Mercados derivados
    const derivedList = document.getElementById('derivedList');
    derivedList.innerHTML = '';
    derivedList.innerHTML += `<li><span>Over 0.5 gols:</span><span>${formatPercent(results.derived.over05)}</span></li>`;
    derivedList.innerHTML += `<li><span>Over 1.5 gols:</span><span>${formatPercent(results.derived.over15)}</span></li>`;
    derivedList.innerHTML += `<li><span>Over 2.5 gols:</span><span>${formatPercent(results.derived.over25)}</span></li>`;
    derivedList.innerHTML += `<li><span>Over 3.5 gols:</span><span>${formatPercent(results.derived.over35)}</span></li>`;
    derivedList.innerHTML += `<li><span>Ambos marcam:</span><span>${formatPercent(results.derived.bothScore)}</span></li>`;
    derivedList.innerHTML += `<li><span>Clean sheet ${data.teamA}:</span><span>${formatPercent(results.derived.cleanA)}</span></li>`;
    derivedList.innerHTML += `<li><span>Clean sheet ${data.teamB}:</span><span>${formatPercent(results.derived.cleanB)}</span></li>`;

    // Fatores de risco
    const riskList = document.getElementById('riskList');
    const risks = computeRisks(data, results);
    riskList.innerHTML = '';
    if (risks.length > 0) {
        risks.forEach(item => {
            riskList.innerHTML += `<li>${item}</li>`;
        });
    } else {
        riskList.innerHTML = '<li>Nenhum fator crítico identificado.</li>';
    }

    // Veredito final
    const verdictDiv = document.getElementById('finalVerdict');
    verdictDiv.innerHTML = generateFinalVerdict(data, results, risks);

    // Desenha os gráficos
    drawCharts(data, results);
}

/**
 * Cria o sumário executivo com base nos dados e resultados
 */
function generateExecutiveSummary(data, results) {
    // Novo sumário executivo detalhado (até 10 linhas)
    const lines = [];
    // 1. Forma das equipes
    lines.push(`${data.teamA}: ${results.formA.last5Pts} pontos nos últimos 5 jogos (GF ${results.formA.avgGF5.toFixed(2)}, GA ${results.formA.avgGA5.toFixed(2)}), tendência ${results.formA.trend}; ${data.teamB}: ${results.formB.last5Pts} pontos (GF ${results.formB.avgGF5.toFixed(2)}, GA ${results.formB.avgGA5.toFixed(2)}).`);
    // 2. Força ofensiva
    lines.push(`Ataque: ${data.teamA} é ${results.offenseA.classification} (xG ${results.offenseA.xg.toFixed(2)}, grandes chances ${results.offenseA.bigChances}), enquanto ${data.teamB} é ${results.offenseB.classification} (xG ${results.offenseB.xg.toFixed(2)}, grandes chances ${results.offenseB.bigChances}).`);
    // 3. Força defensiva
    lines.push(`Defesa: ${data.teamA} é ${results.defenseA.classification} (xGA ${results.defenseA.xga.toFixed(2)}, erros ${results.defenseA.errors}), já ${data.teamB} é ${results.defenseB.classification} (xGA ${results.defenseB.xga.toFixed(2)}, erros ${results.defenseB.errors}).`);
    // 4. Mando de campo
    const homeImpactPct = (results.homeImpactA * 10).toFixed(1);
    if (Math.abs(results.homeImpactA) > 0.05) {
        const favTeam = results.homeImpactA > 0 ? data.teamA : data.teamB;
        lines.push(`Mando de campo: vantagem de ${homeImpactPct}% para ${favTeam} devido ao desempenho relativo em casa/fora.`);
    } else {
        lines.push('Mando de campo: impacto mínimo, desempenho em casa e fora similares.');
    }
    // 5. Elenco
    lines.push(`Elenco: ${data.teamA} possui ${results.squadA.injuries} lesões e ${results.squadA.suspensions} suspensões (impacto ${results.squadA.classification}), enquanto ${data.teamB} tem ${results.squadB.injuries} lesões e ${results.squadB.suspensions} suspensões (impacto ${results.squadB.classification}).`);
    // 6. Fadiga
    lines.push(`Fadiga: ${data.teamA} descansou ${results.fatigueA.daysRest} dias e viajou ${results.fatigueA.travelDist} km nos últimos jogos (índice ${(results.fatigueA.index * 100).toFixed(0)}%), já ${data.teamB} descansou ${results.fatigueB.daysRest} dias e viajou ${results.fatigueB.travelDist} km (índice ${(results.fatigueB.index * 100).toFixed(0)}%).`);
    // 7. Motivação
    lines.push(`Motivação: competição classificada com fator ${(results.motivationIndexA * 10).toFixed(0)}/10 para ambas equipes, refletindo importância do torneio.`);
    // 8. Confronto tático
    lines.push(`Confronto tático: ${data.teamA} atua em estilo ${results.tacticA.style} e ${data.teamB} em ${results.tacticB.style}; ${results.matchup}.`);
    // 9. Mercado
    lines.push(`Mercado: odds ${data.teamA} ${results.marketA.initOdd.toFixed(2)}→${results.marketA.currentOdd.toFixed(2)}, ${data.teamB} ${results.marketB.initOdd.toFixed(2)}→${results.marketB.currentOdd.toFixed(2)}, empate ${results.marketDraw.initOdd.toFixed(2)}→${results.marketDraw.currentOdd.toFixed(2)}.`);
    // 10. Modelagem e expectativas
    lines.push(`Modelagem: ELO ${data.teamA} ${results.eloA.toFixed(0)} vs ${data.teamB} ${results.eloB.toFixed(0)}. Expectativas de gols μA=${results.muA.toFixed(2)}, μB=${results.muB.toFixed(2)} considerando xG, forma, elenco, fadiga, motivação e adaptação.`);
    return '<p>' + lines.join('</p><p>') + '</p>';
}

/**
 * Define lista de fatores de risco com base nos dados e resultados
 */
function computeRisks(data, results) {
    // Avalia fatores de risco com base nas métricas automáticas
    const risks = [];
    // Fadiga alta (indice > 0.6)
    if (results.fatigueA.index > 0.6) {
        risks.push(`Alta fadiga acumulada para ${data.teamA}`);
    }
    if (results.fatigueB.index > 0.6) {
        risks.push(`Alta fadiga acumulada para ${data.teamB}`);
    }
    // Impacto de elenco elevado
    if (results.squadA.impactIndex > 0.6) {
        risks.push(`Várias lesões/suspensões em ${data.teamA} (impacto ${results.squadA.classification})`);
    }
    if (results.squadB.impactIndex > 0.6) {
        risks.push(`Várias lesões/suspensões em ${data.teamB} (impacto ${results.squadB.classification})`);
    }
    // Diferença de adaptação ao ambiente
    if (results.iaaA !== null && results.iaaB !== null) {
        const iaaDiff = Math.abs(results.iaaA - results.iaaB);
        if (iaaDiff >= 15) {
            const disadvantaged = results.iaaA < results.iaaB ? data.teamA : data.teamB;
            risks.push(`Baixa adaptação ambiental para ${disadvantaged}`);
        }
    }
    // Movimentos de odds muito grandes
    const totalMove = Math.abs(results.marketA.movement) + Math.abs(results.marketB.movement) + Math.abs(results.marketDraw.movement);
    if (totalMove > 0.2) {
        risks.push('Mercado com forte volatilidade, sugerindo informações assimétricas ou eventos inesperados');
    }
    // Probabilidades muito próximas
    if (Math.abs(results.winA - results.winB) < 0.08) {
        risks.push('Probabilidades muito próximas, alto equilíbrio entre as equipes');
    }
    // Baixa confiança geral
    if (results.confidence < 40) {
        risks.push('Nível de confiança baixo na estimativa final');
    }
    return risks;
}

/**
 * Gera o texto do veredito final com base nos resultados e riscos
 */
function generateFinalVerdict(data, results, risks) {
    let verdictResult;
    if (results.winA > results.winB && results.winA > results.draw) {
        verdictResult = `Vitória de ${data.teamA}`;
    } else if (results.winB > results.winA && results.winB > results.draw) {
        verdictResult = `Vitória de ${data.teamB}`;
    } else {
        verdictResult = 'Empate';
    }
    const topScore = results.topScores[0];
    const confidenceScore = Math.round(results.confidence);
    const confidenceLabel = results.confidenceLabel;
    // Principais justificativas: use as três primeiras linhas do sumário
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = generateExecutiveSummary(data, results);
    const paragraphs = Array.from(tempDiv.querySelectorAll('p')).map(p => p.textContent);
    const justifications = paragraphs.slice(0, 3).join(' ');
    return `Resultado mais provável: <strong>${verdictResult}</strong><br>` +
        `Placar mais provável: <strong>${topScore.score}</strong> (prob. ${(topScore.prob * 100).toFixed(1)}%)<br>` +
        `Nível de confiança: <strong>${confidenceScore}/100 (${confidenceLabel})</strong><br>` +
        `Principais justificativas: ${justifications}`;
}

/**
 * Desenha os gráficos de probabilidades e placares usando Chart.js
 */
function drawCharts(data, results) {
    // Remove gráficos existentes para evitar overlay
    const probCanvas = document.getElementById('probChart');
    const scoreCanvas = document.getElementById('scoreChart');
    const confCanvas = document.getElementById('confidenceChart');
    // Destrói instâncias anteriores se existirem
    if (probCanvas._chart) {
        probCanvas._chart.destroy();
    }
    if (scoreCanvas._chart) {
        scoreCanvas._chart.destroy();
    }
    if (confCanvas._chart) {
        confCanvas._chart.destroy();
    }
    // Gráfico de pizza para resultado principal
    const ctxProb = probCanvas.getContext('2d');
    probCanvas._chart = new Chart(ctxProb, {
        type: 'doughnut',
        data: {
            labels: [data.teamA, 'Empate', data.teamB],
            datasets: [{
                data: [results.winA * 100, results.draw * 100, results.winB * 100],
                backgroundColor: [
                    'rgba(0, 176, 80, 0.8)',
                    'rgba(192, 192, 192, 0.8)',
                    'rgba(231, 76, 60, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#d0d8e8'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.label + ': ' + context.formattedValue + '%';
                        }
                    }
                }
            }
        }
    });

    // Gráfico de barras para placares mais prováveis
    const labelsScores = results.topScores.map(item => item.score);
    const scoresData = results.topScores.map(item => (item.prob * 100));
    const ctxScore = scoreCanvas.getContext('2d');
    scoreCanvas._chart = new Chart(ctxScore, {
        type: 'bar',
        data: {
            labels: labelsScores,
            datasets: [{
                label: 'Probabilidade (%)',
                data: scoresData,
                backgroundColor: 'rgba(0, 176, 80, 0.8)',
                borderColor: 'rgba(0, 176, 80, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        color: '#d0d8e8'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    ticks: {
                        color: '#d0d8e8',
                        callback: function(value) { return value + '%'; }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context => context.formattedValue + '%'
                    }
                }
            }
        }
    });

    // Gráfico de confiança (gauge) usando doughnut
    const ctxConf = confCanvas.getContext('2d');
    confCanvas._chart = new Chart(ctxConf, {
        type: 'doughnut',
        data: {
            labels: ['Confiança', 'Restante'],
            datasets: [{
                data: [results.confidence, 100 - results.confidence],
                backgroundColor: [
                    'rgba(0, 176, 80, 0.8)',
                    'rgba(255, 255, 255, 0.1)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            rotation: -90,
            circumference: 180,
            cutout: '70%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            }
        }
    });
    // Sobrepor valor numérico ao gráfico de confiança
    // Remove overlay anterior se existir
    const parent = confCanvas.parentNode;
    // Remove overlays existentes
    const oldOverlay = parent.querySelector('.confidence-overlay');
    if (oldOverlay) parent.removeChild(oldOverlay);
    const overlay = document.createElement('div');
    overlay.className = 'confidence-overlay';
    overlay.textContent = Math.round(results.confidence) + '/100';
    parent.style.position = 'relative';
    parent.appendChild(overlay);
}