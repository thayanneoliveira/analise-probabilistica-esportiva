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
    const getVal = id => document.getElementById(id).value;
    return {
        teamA: getVal('teamA').trim() || 'Time A',
        teamB: getVal('teamB').trim() || 'Time B',
        homeTeam: document.querySelector('input[name="homeTeam"]:checked').value,
        attackA: getVal('attackA'),
        attackB: getVal('attackB'),
        defenseA: getVal('defenseA'),
        defenseB: getVal('defenseB'),
        avgGoalsForA: parseFloat(getVal('avgGoalsForA')),
        avgGoalsAgainstA: parseFloat(getVal('avgGoalsAgainstA')),
        avgGoalsForB: parseFloat(getVal('avgGoalsForB')),
        avgGoalsAgainstB: parseFloat(getVal('avgGoalsAgainstB')),
        motivationA: parseFloat(getVal('motivationA')),
        motivationB: parseFloat(getVal('motivationB')),
        fatigueA: parseFloat(getVal('fatigueA')),
        fatigueB: parseFloat(getVal('fatigueB')),
        squadA: getVal('squadA'),
        squadB: getVal('squadB'),
        oddA: parseFloat(getVal('oddA')),
        oddDraw: parseFloat(getVal('oddDraw')),
        oddB: parseFloat(getVal('oddB'))
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
    // Mapeamento de classificações ofensivas e defensivas para multiplicadores
    const attackMap = {
        'muito-forte': 1.30,
        'forte': 1.15,
        'medio': 1.00,
        'fraco': 0.85,
        'muito-fraco': 0.70
    };
    const defenseMap = {
        'muito-forte': 0.70,
        'forte': 0.85,
        'medio': 1.00,
        'fraco': 1.15,
        'muito-fraco': 1.30
    };

    // Converte classificações em valores numéricos
    const atkA = attackMap[data.attackA];
    const atkB = attackMap[data.attackB];
    const defA = defenseMap[data.defenseA];
    const defB = defenseMap[data.defenseB];

    // Calcula expectativa de gols (média) para cada time
    // Combina ataque próprio e defesa adversária
    let muA = (data.avgGoalsForA * atkA + data.avgGoalsAgainstB * defB) / 2;
    let muB = (data.avgGoalsForB * atkB + data.avgGoalsAgainstA * defA) / 2;

    // Aplica mando de campo: pequeno incremento de 10% para o mandante
    const homeFactor = 0.10;
    if (data.homeTeam === 'A') {
        muA *= 1 + homeFactor;
        muB *= 1 - homeFactor;
    } else {
        muA *= 1 - homeFactor;
        muB *= 1 + homeFactor;
    }

    // Garante que valores sejam positivos e dentro de limites razoáveis
    muA = Math.max(muA, 0.1);
    muB = Math.max(muB, 0.1);

    // Número máximo de gols considerado na distribuição
    const maxGoals = 5;
    const distA = poissonDistribution(muA, maxGoals);
    const distB = poissonDistribution(muB, maxGoals);

    // Calcula probabilidades de resultados e placares
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
    // Ordena placares por probabilidade decrescente
    scoreProbs.sort((a, b) => b.prob - a.prob);
    const topScores = scoreProbs.slice(0, 5);

    // Probabilidades derivadas
    // Total de gols para cada soma
    const totalGoalDist = {};
    for (let item of scoreProbs) {
        const [a, b] = item.score.split('–').map(Number);
        const total = a + b;
        totalGoalDist[total] = (totalGoalDist[total] || 0) + item.prob;
    }
    const over05 = 1 - (totalGoalDist[0] || 0);
    const over15 = 1 - ((totalGoalDist[0] || 0) + (totalGoalDist[1] || 0));
    const over25 = 1 - ((totalGoalDist[0] || 0) + (totalGoalDist[1] || 0) + (totalGoalDist[2] || 0));
    const over35 = 1 - ((totalGoalDist[0] || 0) + (totalGoalDist[1] || 0) + (totalGoalDist[2] || 0) + (totalGoalDist[3] || 0));
    // Ambos marcam: pelo menos 1 gol para cada
    let bothScore = 0;
    for (let i = 1; i <= maxGoals; i++) {
        for (let j = 1; j <= maxGoals; j++) {
            bothScore += distA[i] * distB[j];
        }
    }
    // Clean sheets
    const cleanA = distB[0];
    const cleanB = distA[0];

    // Confiança: base 50 + diferença * 50 - fadiga + impacto de elenco
    const diff = Math.abs(winA - winB);
    let confidence = 50 + diff * 50;
    // Ajuste por fadiga média (0–10)
    const avgFatigue = (data.fatigueA + data.fatigueB) / 2;
    confidence -= avgFatigue * 1.5; // cada ponto de fadiga tira 1.5 pontos de confiança
    // Ajuste por impacto de elenco
    const squadPenalty = {
        'muito-baixo': 0,
        'baixo': -2,
        'medio': -6,
        'alto': -12,
        'muito-alto': -20
    };
    confidence += squadPenalty[data.squadA] + squadPenalty[data.squadB];
    // Ajuste por motivação (média 0–10): quanto maior a motivação média, maior a confiança
    const avgMotivation = (data.motivationA + data.motivationB) / 2;
    confidence += avgMotivation * 1.5;
    // Garante valores entre 0 e 100
    confidence = Math.max(0, Math.min(100, confidence));
    // Classificação de confiança
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
        confidenceLabel
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
    const lines = [];
    // Ataque comparativo
    if (data.avgGoalsForA > data.avgGoalsForB + 0.2) {
        lines.push(`${data.teamA} apresenta ataque mais produtivo (média de ${data.avgGoalsForA.toFixed(2)} gols por jogo) do que ${data.teamB} (${data.avgGoalsForB.toFixed(2)}).`);
    } else if (data.avgGoalsForB > data.avgGoalsForA + 0.2) {
        lines.push(`${data.teamB} apresenta ataque mais produtivo (média de ${data.avgGoalsForB.toFixed(2)}) comparado a ${data.teamA} (${data.avgGoalsForA.toFixed(2)}).`);
    } else {
        lines.push(`Os ataques de ${data.teamA} e ${data.teamB} possuem médias semelhantes de gols (${data.avgGoalsForA.toFixed(2)} e ${data.avgGoalsForB.toFixed(2)}).`);
    }
    // Defesa comparativa
    if (data.avgGoalsAgainstA + 0.2 < data.avgGoalsAgainstB) {
        lines.push(`A defesa de ${data.teamA} é mais sólida, sofrendo em média ${data.avgGoalsAgainstA.toFixed(2)} gol(s) contra ${data.avgGoalsAgainstB.toFixed(2)} de ${data.teamB}.`);
    } else if (data.avgGoalsAgainstB + 0.2 < data.avgGoalsAgainstA) {
        lines.push(`A defesa de ${data.teamB} é mais sólida, sofrendo em média ${data.avgGoalsAgainstB.toFixed(2)} gol(s) contra ${data.avgGoalsAgainstA.toFixed(2)} de ${data.teamA}.`);
    } else {
        lines.push(`As defesas apresentam eficiência semelhante, com ${data.teamA} sofrendo ${data.avgGoalsAgainstA.toFixed(2)} e ${data.teamB} ${data.avgGoalsAgainstB.toFixed(2)} gol(s) por jogo.`);
    }
    // Classificação de ataque e defesa
    const cap = str => {
        return str.replace(/\b(m|f|d|a)([a-z]+)/i, (m, p1, p2) => p1.toUpperCase() + p2);
    };
    const atkDescA = cap(data.attackA.replace('-', ' '));
    const atkDescB = cap(data.attackB.replace('-', ' '));
    const defDescA = cap(data.defenseA.replace('-', ' '));
    const defDescB = cap(data.defenseB.replace('-', ' '));
    lines.push(`Força ofensiva: ${data.teamA} (${atkDescA}) vs ${data.teamB} (${atkDescB}).`);
    lines.push(`Força defensiva: ${data.teamA} (${defDescA}) vs ${data.teamB} (${defDescB}).`);
    // Mando de campo
    if (data.homeTeam === 'A') {
        lines.push(`O mando de campo é de ${data.teamA}, conferindo ligeira vantagem (estimada em 10%).`);
    } else {
        lines.push(`O mando de campo é de ${data.teamB}, conferindo ligeira vantagem (estimada em 10%).`);
    }
    // Motivação
    if (Math.abs(data.motivationA - data.motivationB) >= 3) {
        const moreMotivated = data.motivationA > data.motivationB ? data.teamA : data.teamB;
        lines.push(`${moreMotivated} demonstra motivação significativamente maior para a partida.`);
    }
    // Fadiga
    if (Math.abs(data.fatigueA - data.fatigueB) >= 3) {
        const moreFatigued = data.fatigueA > data.fatigueB ? data.teamA : data.teamB;
        lines.push(`${moreFatigued} chega com fadiga consideravelmente maior, o que pode afetar o rendimento.`);
    }
    // Impacto de elenco
    const impactMapDesc = {
        'muito-baixo': 'muito baixo',
        'baixo': 'baixo',
        'medio': 'médio',
        'alto': 'alto',
        'muito-alto': 'muito alto'
    };
    if (data.squadA !== 'muito-baixo' || data.squadB !== 'muito-baixo') {
        lines.push(`Impacto de elenco: ${data.teamA} (${impactMapDesc[data.squadA]}) vs ${data.teamB} (${impactMapDesc[data.squadB]}).`);
    }
    return '<p>' + lines.join('</p><p>') + '</p>';
}

/**
 * Define lista de fatores de risco com base nos dados e resultados
 */
function computeRisks(data, results) {
    const risks = [];
    // Fadiga alta
    if (data.fatigueA > 7) {
        risks.push(`Alta fadiga para ${data.teamA}`);
    }
    if (data.fatigueB > 7) {
        risks.push(`Alta fadiga para ${data.teamB}`);
    }
    // Impacto de elenco
    if (data.squadA === 'alto' || data.squadA === 'muito-alto') {
        risks.push(`Lesões/suspensões significativas em ${data.teamA}`);
    }
    if (data.squadB === 'alto' || data.squadB === 'muito-alto') {
        risks.push(`Lesões/suspensões significativas em ${data.teamB}`);
    }
    // Equilíbrio excessivo
    if (Math.abs(results.winA - results.winB) < 0.1) {
        risks.push('Probabilidades muito próximas, alto equilíbrio entre as equipes');
    }
    // Ataque equilibrado
    if (data.attackA === data.attackB) {
        risks.push('Ataques com classificação equivalente, dificultando diferenciação');
    }
    // Defesa equilibrada
    if (data.defenseA === data.defenseB) {
        risks.push('Defesas com classificação equivalente, aumentando incerteza');
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
    // Principais justificativas: seleciona as duas primeiras linhas do sumário
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