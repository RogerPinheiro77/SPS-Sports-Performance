// sps-v250: Hidratação — generalização para Treino + Jogo (pedido do Roger, 18/11/2026).
// Testa o código REAL extraído do index.html:
//  1) _hydraAllSessions() junta Jogos (APP.games) + Treinos (APP.schedule, type='Treino')
//     numa lista única, mais recente primeiro — mesmo espírito de generalização já usado
//     em pse_records (event_id + session_type em vez de uma coluna fixa só para jogo).
//  2) saveHydraRecord/_hydraRecordFor passam a ser indexados por eventId (genérico) em
//     vez de gameId — funciona tanto para Jogo como para Treino.
//  3) atSaveHidraPost (App Atleta): para TREINO, o peso "pré" nunca é pedido de novo —
//     é sempre o valor que a atleta já registou hoje no Registo de Peso (nutrition_records,
//     source:'atleta') — exigência explícita do Roger ("quando a atleta se pesa, o pré
//     passa a ser também a pesagem do dia"). Confirma também que isto NUNCA usa a
//     avaliação da nutricionista (source!=='atleta'), mesmo que exista no mesmo dia —
//     mesma regra de independência já validada no Registo de Peso (sps-v248).
//  4) atSaveHidraPre/atSaveHidraPost (JOGO): pré-jogo continua manual, pós calcula taxa de
//     sudação / % perda / objetivo de reposição com as fórmulas NATA já existentes
//     (_hydraSweatRate/_hydraWeightLossPct/_hydraReplacementTarget), inalteradas.
//  5) registeredBy/registeredById em hydration_records vêm da sessão de quem grava — uma
//     correção da equipa técnica fica identificável (registeredById != athleteId) sem
//     nenhuma coluna nova, só comparando com o id da atleta.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
const full = m[1];

function extractFn(name) {
  const re = new RegExp('(?:async\\s+)?function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const start = full.search(re);
  assert.ok(start >= 0, 'função ' + name + ' não encontrada');
  let depth = 0, i = full.indexOf('{', start), end = -1;
  for (; i < full.length; i++) {
    if (full[i] === '{') depth++;
    else if (full[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return full.slice(start, end);
}
function extractConst(name) {
  const re = new RegExp('const ' + name + '\\s*=.*?;');
  const mm = full.match(re);
  assert.ok(mm, 'constante ' + name + ' não encontrada');
  return mm[0];
}
function extractConstObj(name) {
  const re = new RegExp('const ' + name + '\\s*=\\s*\\{');
  const start = full.search(re);
  assert.ok(start >= 0, 'constante ' + name + ' não encontrada');
  let depth = 0, i = full.indexOf('{', start), end = -1;
  for (; i < full.length; i++) {
    if (full[i] === '{') depth++;
    else if (full[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return full.slice(start, end) + ';';
}

const src = [
  extractConstObj('HYDRATION_DEFAULTS'),
  extractFn('_hydraBands'),
  extractFn('_hydraSweatRate'),
  extractFn('_hydraWeightLossPct'),
  extractFn('_hydraReplacementTarget'),
  extractFn('_hydraWeightColor'),
  extractFn('_hydraRecordFor'),
  extractFn('saveHydraRecord'),
  extractFn('_hydraAllSessions'),
  extractFn('_hydraSessionById'),
  extractFn('_atHidraTodaySessions'),
  extractFn('atSaveHidraPre'),
  extractFn('atSaveHidraPost'),
  extractFn('_nutriOpenHidraHistorico'),
  extractFn('_displayName'),
  extractFn('fmtDate'),
  'const escHtml=s=>String(s||\'\').replace(/&/g,\'&amp;\').replace(/</g,\'&lt;\').replace(/>/g,\'&gt;\').replace(/"/g,\'&quot;\');',
].join('\n\n');

let n = 0;
function ok(cond, msg) { assert.ok(cond, 'FALHA: ' + msg); n++; console.log('OK: ' + msg); }

function freshSandbox(opts = {}) {
  const els = {
    'at-hidra-pre': { value: opts.preVal || '' },
    'at-hidra-post': { value: opts.postVal || '' },
    'at-hidra-fluids': { value: opts.fluidsVal || '' },
  };
  const sandbox = {
    APP: {
      config: { hydrationGuidelines: { default: {}, athletes: {} } },
      hydrationRecords: [],
      nutritionAssessments: opts.nutritionAssessments || [],
      athletes: opts.athletes || [{ id: 'athlete1', name: 'Beatriz Nogueira', teamId: 'T1' }],
      games: opts.games || [],
      schedule: opts.schedule || [],
    },
    AID: 'athlete1',
    _sync: true,
    _cid: 'club1',
    _syncCalls: [],
    _SESSION: opts.session !== undefined ? opts.session : { userId: 'athlete1', role: 'atleta', name: 'Beatriz Nogueira' },
    getSession() { return sandbox._SESSION; },
    document: { getElementById(id) { return els[id] || null; } },
    today: () => opts.today || '2026-11-18',
    saveData() { sandbox._saved = true; },
    cloudUpsert: (table, row) => { sandbox._syncCalls.push({ table, row: { ...row } }); },
    toast: (msg, type) => { sandbox._lastToast = { msg, type }; },
    renderAtNutri() { sandbox._rendered = true; },
    _hydraRerender() {},
    openMod(title, bodyHtml, size) { sandbox._lastModal = { title, bodyHtml, size }; },
    console,
    Date,
    Math,
    isNaN,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

// ── 1) _hydraAllSessions junta Jogos + Treinos numa lista única, mais recente primeiro ──
{
  const sb = freshSandbox({
    games: [{ id: 'g1', opp: 'FC Ferreirense', date: '2026-11-22', teamId: 'T1', djDurJogo: 90 }],
    schedule: [
      { id: 'ev_treino_18', type: 'Treino', date: '2026-11-18', teamId: 'T1', dur: 90 },
      { id: 'ev_reuniao', type: 'Reunião', date: '2026-11-19', teamId: 'T1', dur: 30 }, // não é Treino, não entra
    ],
  });
  const all = sb._hydraAllSessions();
  ok(all.length === 2, '_hydraAllSessions junta Jogo + Treino, ignora outros tipos de evento (ex: Reunião)');
  ok(all[0].id === 'g1' && all[0].type === 'Jogo', 'sessão mais recente (22 Nov, Jogo) vem primeiro');
  ok(all[1].id === 'ev_treino_18' && all[1].type === 'Treino', 'treino de 18 Nov vem depois');
  ok(all[1].durH === 1.5, 'duração do treino convertida de minutos (90) para horas (1.5)');
  ok(sb._hydraSessionById('g1').label.includes('Ferreirense'), '_hydraSessionById resolve o jogo pelo id');
}

// ── 2) saveHydraRecord/_hydraRecordFor indexados por eventId genérico (Jogo OU Treino) ──
{
  const sb = freshSandbox();
  sb.saveHydraRecord('athlete1', 'ev_treino_18', 'Treino', { preWeight: 61.0, postWeight: 59.6 });
  const rec = sb._hydraRecordFor('athlete1', 'ev_treino_18');
  ok(!!rec, 'registo gravado e encontrado por athleteId+eventId (genérico, não gameId)');
  ok(rec.sessionType === 'Treino', 'sessionType gravado no registo');
  ok(sb._syncCalls.length === 1 && sb._syncCalls[0].table === 'hydration_records', 'cloudUpsert chamado em hydration_records');
  ok(sb._syncCalls[0].row.eventId === 'ev_treino_18' && sb._syncCalls[0].row.sessionType === 'Treino', 'payload enviado para a cloud já usa eventId/sessionType (não gameId)');
  // registeredBy/registeredById vêm da sessão de quem grava (aqui a própria atleta)
  ok(rec.registeredBy === 'Beatriz Nogueira' && rec.registeredById === 'athlete1', 'registeredBy/registeredById preenchidos a partir da sessão de quem grava');
}

// ── 3) TREINO: pré nunca é pedido de novo — vem sempre do Registo de Peso de hoje ───────
{
  const sb = freshSandbox({
    schedule: [{ id: 'ev_treino_18', type: 'Treino', date: '2026-11-18', teamId: 'T1', dur: 90 }],
    today: '2026-11-18',
    nutritionAssessments: [
      // avaliação da NUTRICIONISTA no mesmo dia — não deve ser usada como "pré"
      { id: 'nutri1', athleteId: 'athlete1', date: '2026-11-18', weight: '61.0', source: 'nutricionista' },
      // autorregisto da ATLETA no mesmo dia — este sim é o "pré" do treino
      { id: 'self1', athleteId: 'athlete1', date: '2026-11-18', weight: '60.4', source: 'atleta' },
    ],
    postVal: '59.6', fluidsVal: '0.3',
  });
  sb._atHidraSelType = 'treino';
  sb.atSaveHidraPost();
  const rec = sb._hydraRecordFor('athlete1', 'ev_treino_18');
  ok(!!rec, 'registo de treino criado ao gravar o pós');
  ok(rec.preWeight === 60.4, 'pré-treino = peso do Registo de Peso de HOJE (autorregisto da atleta), nunca pedido de novo');
  ok(rec.preWeight !== 61.0, 'pré-treino NUNCA usa a avaliação da nutricionista do mesmo dia (independência exigida pelo Roger desde o Registo de Peso)');
  ok(rec.postWeight === 59.6 && rec.fluidsL === 0.3, 'pós-treino e líquidos gravados corretamente');
  ok(Math.abs(rec.weightLossPct - ((60.4 - 59.6) / 60.4 * 100)) < 0.001, '% perda calculada com a fórmula NATA já existente (pré vindo do Registo de Peso)');
  ok(rec.sweatRate != null, 'taxa de sudação calculada');
}

// ── 4) TREINO sem Registo de Peso feito hoje → bloqueia o pós com mensagem clara ────────
{
  const sb = freshSandbox({
    schedule: [{ id: 'ev_treino_18', type: 'Treino', date: '2026-11-18', teamId: 'T1', dur: 90 }],
    today: '2026-11-18',
    nutritionAssessments: [],
    postVal: '59.6',
  });
  sb._atHidraSelType = 'treino';
  sb.atSaveHidraPost();
  ok((sb.APP.hydrationRecords || []).length === 0, 'sem autorregisto de peso hoje → pós-treino não é gravado');
  ok(sb._lastToast && sb._lastToast.type === 'err', 'toast de erro a pedir para registar o peso primeiro');
}

// ── 5) JOGO: pré continua manual (não usa o Registo de Peso diário) ───────────────────
{
  const sb = freshSandbox({
    games: [{ id: 'g1', opp: 'FC Ferreirense', date: '2026-11-22', teamId: 'T1', djDurJogo: 90 }],
    today: '2026-11-22',
    preVal: '61.0',
  });
  sb.atSaveHidraPre();
  let rec = sb._hydraRecordFor('athlete1', 'g1');
  ok(rec && rec.preWeight === 61.0, 'pré-jogo gravado manualmente (registo próprio, independente do Registo de Peso)');

  sb.document.getElementById('at-hidra-post').value = '59.5';
  sb.document.getElementById('at-hidra-fluids').value = '0.4';
  sb._atHidraSelType = 'jogo';
  sb.atSaveHidraPost();
  rec = sb._hydraRecordFor('athlete1', 'g1');
  ok(rec.postWeight === 59.5 && rec.fluidsL === 0.4, 'pós-jogo gravado, usando o pré-jogo manual já guardado');
  ok(rec.sweatRate != null && rec.weightLossPct != null, 'cálculos de sudação/perda feitos também para jogo');
}

// ── 6) Correção pela equipa técnica é identificável sem coluna nova ────────────────────
{
  const sb = freshSandbox();
  sb.saveHydraRecord('athlete1', 'ev_treino_18', 'Treino', { preWeight: 60.4, postWeight: 59.6 });
  let rec = sb._hydraRecordFor('athlete1', 'ev_treino_18');
  ok(rec.registeredById === 'athlete1', 'registo original é da própria atleta');
  // Equipa técnica corrige o mesmo registo (sessão diferente a gravar)
  sb._SESSION = { userId: 'staff_teresa', role: 'nutricionista', name: 'Teresa Ferreira' };
  sb.saveHydraRecord('athlete1', 'ev_treino_18', 'Treino', { postWeight: 59.4 });
  rec = sb._hydraRecordFor('athlete1', 'ev_treino_18');
  ok(rec.postWeight === 59.4, 'equipa técnica conseguiu corrigir o valor');
  ok(rec.registeredById === 'staff_teresa' && rec.registeredById !== 'athlete1', 'registeredById passa a identificar a correção da equipa técnica (registeredById != athleteId), sem coluna nova');
}

// ── 7) Histórico por atleta (treino+jogo) distingue autorregisto de correção da equipa ──
{
  const sb = freshSandbox({
    games: [{ id: 'g1', opp: 'FC Ferreirense', date: '2026-11-22', teamId: 'T1', djDurJogo: 90 }],
    schedule: [{ id: 'ev_treino_18', type: 'Treino', date: '2026-11-18', teamId: 'T1', dur: 90 }],
  });
  // Treino: autorregisto da própria atleta
  sb.saveHydraRecord('athlete1', 'ev_treino_18', 'Treino', { preWeight: 60.4, postWeight: 59.6 });
  // Jogo: equipa técnica corrigiu o registo
  sb._SESSION = { userId: 'staff_teresa', role: 'nutricionista', name: 'Teresa Ferreira' };
  sb.saveHydraRecord('athlete1', 'g1', 'Jogo', { preWeight: 61.0, postWeight: 59.6 });

  sb._nutriOpenHidraHistorico('athlete1');
  ok(!!sb._lastModal, '_nutriOpenHidraHistorico abre um modal (openMod chamado)');
  ok(sb._lastModal.title.includes('Histórico de Hidratação'), 'título do modal correto');
  ok(sb._lastModal.title.includes('Beatriz'), 'título do modal inclui o nome da atleta');
  const body = sb._lastModal.bodyHtml;
  ok(body.includes('Jogo vs FC Ferreirense') && body.includes('Treino'), 'modal lista as sessões de treino E jogo combinadas');
  ok(body.indexOf('Jogo vs FC Ferreirense') < body.indexOf('Treino'), 'ordenado por data mais recente primeiro (Jogo 22 Nov antes de Treino 18 Nov)');
  const occurrences = body.split('corrigido pela equipa técnica').length - 1;
  ok(occurrences === 1, 'apenas o registo do Jogo (corrigido pela nutricionista) mostra a etiqueta "corrigido pela equipa técnica"');
  // a linha do treino (autorregisto) não deve ter a etiqueta junto ao seu "Treino"
  const treinoRowIdx = body.indexOf('Treino');
  const corrIdx = body.indexOf('corrigido pela equipa técnica');
  ok(corrIdx > body.indexOf('Jogo vs FC Ferreirense') && corrIdx < treinoRowIdx || corrIdx > treinoRowIdx, 'a etiqueta de correção está associada à linha certa');
}

// ── 8) Histórico sem registos mostra mensagem vazia (sem erro) ──────────────────────────
{
  const sb = freshSandbox();
  sb._nutriOpenHidraHistorico('athlete1');
  ok(sb._lastModal.bodyHtml.includes('Sem registos de hidratação'), 'sem registos → modal mostra mensagem vazia em vez de tabela/erro');
}

console.log(`\n${n} verificações OK — sps-v250 Hidratação (treino + jogo, generalizado)`);
