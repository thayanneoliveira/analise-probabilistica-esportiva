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
    // Estatísticas básicas simuladas: índices ofensivo/defensivo entre 0.8 e 2.0
    const atkIndexA = 0.8 + pseudoRandom(teamA + 'atk') * 1.2;
    const defIndexA = 0.8 + pseudoRandom(teamA + 'def') * 1.2;
    const atkIndexB = 0.8 + pseudoRandom(teamB + 'atk') * 1.2;
    const defIndexB = 0.8 + pseudoRandom(teamB + 'def') * 1.2;
    // Base de gols média por equipe
    const baseAvg = 1.5;
    // Expectativa de gols ajustada pelos índices
    let muA = baseAvg * atkIndexA / defIndexB;
    let muB = baseAvg * atkIndexB / defIndexA;
    // Ajuste de ambientação (índice de adaptação)
    if (data.autoClimate) {
        const iaaA = 60 + pseudoRandom(teamA + 'climate') * 30; // 60–90
        const iaaB = 60 + pseudoRandom(teamB + 'climate') * 30;
        // Diferença percentual ajusta expectativas: vantagem de até ±5%
        const diff = (iaaA - iaaB) / 100; // -0.3 a 0.3
        muA *= 1 + diff * 0.1;
        muB *= 1 - diff * 0.1;
    }
    // Ajuste de motivação baseado na competição
    function estimateMotivation(comp) {
        if (!comp) return 6;
        const c = comp.toLowerCase();
        if (c.includes('final') || c.includes('mata') || c.includes('semi')) return 9;
        if (c.includes('amistoso') || c.includes('friendly')) return 3;
        if (c.includes('copa') || c.includes('cup') || c.includes('libertad') || c.includes('champ')) return 7;
        return 6;
    }
    const motivationA = estimateMotivation(data.competition);
    const motivationB = motivationA; // mesma competição
    // Fadiga simulada entre 0 e 5
    const fatigueA = pseudoRandom(teamA + 'fatigue') * 5;
    const fatigueB = pseudoRandom(teamB + 'fatigue') * 5;
    // Número máximo de gols considerado na distribuição
    const maxGoals = 5;
    // Garante limites positivos
    muA = Math.max(muA, 0.1);
    muB = Math.max(muB, 0.1);
    const distA = poissonDistribution(muA, maxGoals);
    const distB = poissonDistribution(muB, maxGoals);
    // Probabilidades de resultados e placares
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
    // Probabilidades derivadas (mesmo cálculo que antes)
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
    // Confiabilidade baseada na diferença e variáveis
    const diffProb = Math.abs(winA - winB);
    let confidence = 60 + diffProb * 40; // base 60
    // Ajuste por fadiga média
    const avgFatigue = (fatigueA + fatigueB) / 2;
    confidence -= avgFatigue * 3; // cada ponto reduz 3
    // Ajuste por motivação
    const avgMotivation = (motivationA + motivationB) / 2;
    confidence += (avgMotivation - 5) * 2; // motivo acima da média aumenta
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
        fatigueA,
        fatigueB,
        motivationA,
        motivationB,
        iaaA: data.autoClimate ? (60 + pseudoRandom(teamA + 'climate') * 30) : null,
        iaaB: data.autoClimate ? (60 + pseudoRandom(teamB + 'climate') * 30) : null
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
    // Sumário executivo baseado em métricas automáticas
    const lines = [];
    // Comparação de expectativas de gols
    const muDiff = results.muA - results.muB;
    if (muDiff > 0.3) {
        lines.push(`${data.teamA} tem expectativa ofensiva superior, com média estimada de ${results.muA.toFixed(2)} gol(s), contra ${results.muB.toFixed(2)} de ${data.teamB}.`);
    } else if (muDiff < -0.3) {
        lines.push(`${data.teamB} tem expectativa ofensiva superior, com média estimada de ${results.muB.toFixed(2)} gol(s), contra ${results.muA.toFixed(2)} de ${data.teamA}.`);
    } else {
        lines.push(`As expectativas de gols são semelhantes: ${data.teamA} (${results.muA.toFixed(2)}) e ${data.teamB} (${results.muB.toFixed(2)}).`);
    }
    // Ambientação/clima (IAA)
    if (results.iaaA !== null && results.iaaB !== null) {
        const iaaDiff = results.iaaA - results.iaaB;
        if (Math.abs(iaaDiff) >= 10) {
            const advantagedTeam = iaaDiff > 0 ? data.teamA : data.teamB;
            lines.push(`${advantagedTeam} está mais adaptado ao ambiente (clima, altitude, umidade), o que pode representar vantagem.`);
        } else {
            lines.push(`Índices de adaptação ambiental próximos, sem vantagem significativa para ${data.teamA} ou ${data.teamB}.`);
        }
    }
    // Fadiga
    const fatDiff = results.fatigueA - results.fatigueB;
    if (Math.abs(fatDiff) >= 1.5) {
        const moreFatiguedTeam = fatDiff > 0 ? data.teamA : data.teamB;
        lines.push(`${moreFatiguedTeam} apresenta maior fadiga acumulada, fator que pode reduzir performance.`);
    }
    // Motivação
    const motDiff = results.motivationA - results.motivationB;
    if (Math.abs(motDiff) >= 2) {
        const moreMotivatedTeam = motDiff > 0 ? data.teamA : data.teamB;
        lines.push(`${moreMotivatedTeam} demonstra motivação superior para a partida.`);
    }
    // Comentário sobre equilíbrio de probabilidades
    const diffProb = Math.abs(results.winA - results.winB);
    if (diffProb < 0.1) {
        lines.push('O confronto é bastante equilibrado segundo as probabilidades iniciais.');
    } else {
        const favorito = results.winA > results.winB ? data.teamA : data.teamB;
        lines.push(`${favorito} é ligeiro favorito de acordo com as probabilidades estimadas.`);
    }
    return '<p>' + lines.join('</p><p>') + '</p>';
}

/**
 * Define lista de fatores de risco com base nos dados e resultados
 */
function computeRisks(data, results) {
    // Avalia fatores de risco com base nas métricas automáticas
    const risks = [];
    // Fadiga alta (valores de 0 a 5)
    if (results.fatigueA >= 4) {
        risks.push(`Alta fadiga para ${data.teamA}`);
    }
    if (results.fatigueB >= 4) {
        risks.push(`Alta fadiga para ${data.teamB}`);
    }
    // Diferença de adaptação ao ambiente
    if (results.iaaA !== null && results.iaaB !== null) {
        const iaaDiff = Math.abs(results.iaaA - results.iaaB);
        if (iaaDiff >= 15) {
            const disadvantaged = results.iaaA < results.iaaB ? data.teamA : data.teamB;
            risks.push(`Baixa adaptação ambiental para ${disadvantaged}`);
        }
    }
    // Equilíbrio elevado das probabilidades
    if (Math.abs(results.winA - results.winB) < 0.1) {
        risks.push('Probabilidades muito próximas, alto equilíbrio entre as equipes');
    }
    // Confiabilidade geral baixa
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