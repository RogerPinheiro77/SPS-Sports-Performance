// test_dashboard_reorg_v238.js
// Harness Node (vm) para sps-v238: reorganização visual da Dashboard, aprovada
// pelo Roger no mockup_dashboard_v2.html ("ESTA BOIA A IDEIA... DEPOIS DECIDIMOS SE
// AVANÇAMOS PARA CODIGO" -> "avança com isso"). Cobre os 4 pontos concretos do
// feedback aprovado, implementados em renderDashboard() (index.html):
//   1. 1 KPI em destaque ("Proteção", .db-kpi-hero) em vez dos 6 com peso igual.
//   2. Paleta própria de "tipo de sessão" na Distribuição de Carga (azul/laranja/
//      verde-água/violeta, --cat1..4 do mockup), separada das cores de estado/risco.
//   3. "Risco de Lesão" e "Distribuição de Carga" split em 2 cartões.
//   4. Hover (data-tip) com valor exato onde o texto não mostra o valor exato.
// + o cartão novo "⭐ Estatísticas da Época — Top 5" (Golos/Assistências/Minutos),
// reaproveitando _seasonStatsAll()/_seasonGames() (Ranking do Plantel) sem duplicar
// dados, e o atalho "Ver Ranking completo →" (_dashVerRankingCompleto).
//
// Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_pse_wellness_cores_v236.js/test_presencas_refresh_v235.js) — nunca
// reimplementa a lógica de produção.
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const REAL_PATH = '/home/claude/sps/index.html';

function extractScript() {
  const html = fs.readFileSync(REAL_PATH, 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
  if (!m) throw new Error('script block not found in index.html');
  const script = m[1];
  const idx = script.indexOf('(function initPWA()');
  if (idx < 0) throw new Error('initPWA marker not found — file structure changed?');
  return script.slice(0, idx);
}

function makeFakeElement() {
  const el = {
    innerHTML: '', textContent: '', value: '', className: '',
    style: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
    children: [], attributes: {},
    addEventListener(){}, removeEventListener(){},
    setAttribute(k,v){ this.attributes[k]=String(v); if(k==='id')this.id=v; },
    getAttribute(k){ return this.attributes[k]; },
    removeAttribute(k){ delete this.attributes[k]; },
    appendChild(child){ this.children.push(child); return child; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    remove(){},
    closest(){ return null; },
    focus(){},
    cloneNode(){ return makeFakeElement(); },
  };
  return el;
}

function buildSandbox() {
  const storage = {};
  const localStorageStub = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(storage,k)?storage[k]:null; },
    setItem(k,v){ storage[k]=String(v); },
    removeItem(k){ delete storage[k]; },
  };
  const sessionStorageStub = { getItem(){ return null; }, setItem(){}, removeItem(){} };
  const elCache = {};
  function getEl(id) {
    if (!elCache[id]) { elCache[id] = makeFakeElement(); elCache[id].id = id; }
    return elCache[id];
  }
  const chartCalls = {};
  function ChartStub(canvas, config) {
    this.config = config;
    this.destroy = function(){};
    canvas._chart = this;
    if (canvas && canvas.id) chartCalls[canvas.id] = config;
  }
  const sandbox = {
    console,
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    Promise, Map, Set, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout(fn){ fn(); return 0; },
    clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    localStorage: localStorageStub,
    sessionStorage: sessionStorageStub,
    document: {
      getElementById: getEl,
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      createElementNS(ns, tag){ const el = makeFakeElement(); el.tagName = tag; return el; },
      addEventListener(){},
      removeEventListener(){},
      createElement(){ return makeFakeElement(); },
      body: makeFakeElement(),
    },
    window: {},
    scrollTo(){},
    navigator: { serviceWorker: undefined, onLine: true },
    confirm(){ return true; },
    prompt(){ return null; },
    alert(){},
    fetch(){ return Promise.reject(new Error('fetch disabled in test harness')); },
    btoa(s){ return Buffer.from(s, 'binary').toString('base64'); },
    atob(s){ return Buffer.from(s, 'base64').toString('binary'); },
    XMLSerializer: function(){ this.serializeToString = () => ''; },
    Image: function(){},
    crypto: { subtle: { digest: async () => new ArrayBuffer(32) } },
    location: { pathname: '/', search: '' },
    history: { replaceState(){} },
    URLSearchParams,
    Chart: ChartStub,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__elCache = elCache;
  sandbox.__chartCalls = chartCalls;
  return sandbox;
}

const BRIDGE_VARS = ['APP', 'ROLE', 'AID', '_curPg', '_pwTeam', '_jogoTab', '_rankingScope'];
function bridgeScript() {
  return BRIDGE_VARS.map(name => `function __set_${name}(v){${name}=v;} function __get_${name}(){return ${name};}`).join('\n');
}
function loadContext() {
  const code = extractScript();
  const sandbox = buildSandbox();
  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: 'index.html#script' });
  vm.runInContext(bridgeScript(), ctx, { filename: 'bridge.js' });
  BRIDGE_VARS.forEach(name => {
    Object.defineProperty(ctx, '$' + name, {
      get() { return ctx['__get_' + name](); },
      set(v) { ctx['__set_' + name](v); },
      configurable: true,
    });
  });
  return ctx;
}

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓', name); }
  catch (e) {
    failed++; failures.push({ name, err: e });
    console.log('  ✗', name, '\n      ', (e && e.stack) ? e.stack.split('\n').slice(0,3).join('\n       ') : e);
  }
}

function athlete(id, name, num) {
  return { id, name, teamId: 'T1', num };
}
function game(id, date, status, playerStats) {
  return { id, date, status, tipo: 'oficial', comp: null, playerStats: playerStats || [] };
}
function pst(aid, goals, assists, mins) {
  return { aid, goals, assists, mins, yellow: 0, red: 0 };
}

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();

function resetDomCache() {
  Object.keys(ctx.__elCache).forEach(k => delete ctx.__elCache[k]);
  Object.keys(ctx.__chartCalls).forEach(k => delete ctx.__chartCalls[k]);
}

function seedApp(extra) {
  ctx.$APP = Object.assign({
    teams: [{ id: 'T1', name: 'Seniores Fem.' }],
    athletes: [
      athlete('a1', 'Diana Silva', 9),
      athlete('a2', 'Ana Ribeiro', 7),
      athlete('a3', 'Sofia Leite', 10),
      athlete('a4', 'Bruna Costa', 4),
      athlete('a5', 'Carla Nunes', 14),
    ],
    pse: [], wellness: [], schedule: [], attendance: [], injuries: [],
    extraTrainings: [], convocatorias: [], games: [],
    config: { classificacoes: {}, competitions: [] },
  }, extra || {});
  ctx.$_pwTeam = 'T1';
  ctx.$ROLE = 'treinador';
}

// ---------------------------------------------------------------------------
// [1] KPI row — 1 KPI em destaque (Proteção), os outros 5 normais
// ---------------------------------------------------------------------------
test('renderDashboard: KPI row tem 6 .db-kpi, exatamente 1 com .db-kpi-hero (Proteção)', () => {
  resetDomCache();
  seedApp({ injuries: [{ athleteId: 'a1', status: 'ativo' }] });
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  const kpiCount = (html.match(/class="db-kpi(?:\s|")/g) || []).length;
  const heroCount = (html.match(/class="db-kpi db-kpi-hero"/g) || []).length;
  assert.strictEqual(kpiCount, 6, 'esperava 6 tiles .db-kpi, achou ' + kpiCount);
  assert.strictEqual(heroCount, 1, 'esperava exatamente 1 tile com class="db-kpi db-kpi-hero", achou ' + heroCount);
  // o KPI em destaque é mesmo o de Proteção (injCount)
  const heroIdx = html.indexOf('class="db-kpi db-kpi-hero"');
  const nearby = html.slice(heroIdx, heroIdx + 400);
  assert.ok(nearby.includes('Proteção'), 'o KPI em destaque devia ser "Proteção": ' + nearby.slice(0,200));
  assert.ok(nearby.includes('ver destaques'), 'o KPI em destaque devia ter o atalho "ver destaques"');
});

// ---------------------------------------------------------------------------
// [2] Distribuição de Carga — paleta própria, separada das cores de estado/risco
// ---------------------------------------------------------------------------
test('renderDashboard: Distribuição de Carga usa a paleta própria (azul/laranja/verde-água/violeta), não verde/vermelho/azul/amarelo', () => {
  resetDomCache();
  seedApp({});
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  const distIdx = html.indexOf('DISTRIBUIÇÃO DE CARGA');
  assert.ok(distIdx >= 0, 'cartão Distribuição de Carga não encontrado');
  const card = html.slice(distIdx, distIdx + 1600);
  ['#3987e5', '#d95926', '#199e70', '#9085e9'].forEach(c => {
    assert.ok(card.includes(c), `cor ${c} (paleta própria) não encontrada no cartão de Distribuição`);
  });
  // as cores antigas de estado/risco não devem aparecer nos segmentos desta barra
  assert.ok(!card.includes('#4ade80') && !card.includes('#f87171') && !card.includes('#fbbf24'),
    'cores de estado/risco (verde/vermelho/amarelo) ainda aparecem na Distribuição de Carga');
  assert.ok(card.includes('cor própria'), 'falta o aviso "cor própria, já não é verde/amarelo/vermelho"');
});

// ---------------------------------------------------------------------------
// [3] Risco de Lesão e Distribuição de Carga em 2 cartões separados
// ---------------------------------------------------------------------------
test('renderDashboard: "RISCO DE LESÃO" já não contém a Distribuição de Carga (2 cartões separados)', () => {
  resetDomCache();
  seedApp({ injuries: [{ athleteId: 'a1', status: 'ativo' }] });
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  const riscoIdx = html.indexOf('RISCO DE LESÃO');
  assert.ok(riscoIdx >= 0, 'cartão Risco de Lesão não encontrado');
  // o cartão deve fechar (</div></div>) bem antes do título "DISTRIBUIÇÃO DE CARGA"
  const distIdx = html.indexOf('DISTRIBUIÇÃO DE CARGA');
  const riscoCard = html.slice(riscoIdx, riscoIdx + 900);
  assert.ok(!riscoCard.includes('Distribuição de Carga'), 'o cartão Risco de Lesão ainda contém a Distribuição de Carga');
  assert.ok(distIdx > riscoIdx, 'Distribuição de Carga devia vir depois, como cartão próprio');
  // Risco de Lesão continua com a contagem/lista
  assert.ok(riscoCard.includes('ALTO RISCO') || riscoCard.includes('ATENÇÃO') || riscoCard.includes('CONTROLADO'));
});

// ---------------------------------------------------------------------------
// [4] Hover (data-tip) com valor exato
// ---------------------------------------------------------------------------
test('renderDashboard: data-tip presente no KPI em destaque e nos segmentos da Distribuição de Carga', () => {
  resetDomCache();
  seedApp({ injuries: [{ athleteId: 'a1', status: 'ativo' }] });
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  assert.ok(/data-tip="1 atletas? com lesão ativa/.test(html), 'falta data-tip com valor exato no KPI Proteção');
  const distIdx = html.indexOf('DISTRIBUIÇÃO DE CARGA');
  const card = html.slice(distIdx, distIdx + 1600);
  assert.ok(card.includes('data-tip="Treino ·'), 'falta data-tip com u.a. exato no segmento Treino');
  assert.ok(card.includes('data-tip="Jogo ·'), 'falta data-tip com u.a. exato no segmento Jogo');
});
test('renderDashboard: CSS do tooltip [data-tip] está presente no <style> injetado', () => {
  resetDomCache();
  seedApp({});
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  assert.ok(html.includes('[data-tip]:hover::after'), 'CSS do tooltip (hover) não encontrado');
});

// ---------------------------------------------------------------------------
// [5] Estatísticas da Época — Top 5 (reaproveita _seasonStatsAll/_seasonGames)
// ---------------------------------------------------------------------------
test('renderDashboard: sem jogos realizados -> cartão "Estatísticas da Época" não aparece', () => {
  resetDomCache();
  seedApp({ games: [] });
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  // procura o cabeçalho real do cartão (com a estrela), não o comentário HTML
  // estático que antecede o bloco condicional e também contém "Estatísticas da Época"
  assert.ok(!html.includes('⭐ Estatísticas da Época'), 'o cartão não devia aparecer sem jogos realizados');
});
test('renderDashboard: com jogos realizados -> Top 5 Golos/Assistências/Minutos corretos, reaproveitando _seasonStatsAll real', () => {
  resetDomCache();
  seedApp({
    games: [
      game('g1', '2026-08-20', 'realizado', [
        pst('a1', 2, 0, 90), pst('a2', 1, 2, 90), pst('a3', 0, 1, 75), pst('a4', 0, 0, 90), pst('a5', 0, 0, 60),
      ]),
      game('g2', '2026-08-27', 'realizado', [
        pst('a1', 1, 0, 85), pst('a2', 0, 1, 90), pst('a3', 1, 1, 80),
      ]),
    ],
  });
  // confirma que o harness está mesmo a usar a função real de produção, não uma réplica
  const real = ctx._seasonStatsAll().find(r => r.at.id === 'a1');
  assert.strictEqual(real.goals, 3, 'pré-condição: _seasonStatsAll real devia dar 3 golos a Diana Silva');
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  const idx = html.indexOf('⭐ Estatísticas da Época');
  assert.ok(idx >= 0, 'cartão não apareceu com jogos realizados');
  // janela grande o suficiente para conter as 3 colunas (Golos/Assistências/
  // Minutos Jogados) inteiras — 3500 cortava a coluna de Minutos a meio
  const card = html.slice(idx, idx + 9000);
  assert.ok(card.includes('⚽ Golos') && card.includes('🅰️ Assistências') && card.includes('⏱️ Minutos Jogados'),
    'faltam os 3 mini-rankings');
  // Diana Silva (3 golos) deve aparecer em 1º no mini-ranking de Golos.
  // Procura a partir do grid das 3 colunas (não a partir do início do
  // cartão), porque a frase de introdução já menciona "⚽ Golos"/
  // "🅰️ Assistências" antes das colunas reais existirem.
  const gridIdx = card.indexOf('grid-template-columns:1fr 1fr 1fr');
  assert.ok(gridIdx >= 0, 'grid das 3 colunas não encontrado');
  const golosIdx = card.indexOf('⚽ Golos', gridIdx);
  const assistIdx = card.indexOf('🅰️ Assistências', gridIdx);
  const golosCol = card.slice(golosIdx, assistIdx);
  assert.ok(golosCol.indexOf('Diana Silva') < golosCol.indexOf('Ana Ribeiro'), 'Diana Silva (3 golos) devia vir antes de Ana Ribeiro (1 golo) no ranking de Golos');
  assert.ok(/>3</.test(golosCol.slice(golosCol.indexOf('Diana Silva'))), 'valor de golos da Diana Silva devia ser 3');
  // data-tip com nº de jogos, mesmo padrão do mockup aprovado
  assert.ok(golosCol.includes('data-tip="2 jogos"'), 'falta data-tip "2 jogos" para quem jogou os 2 jogos');
  // botão para o Ranking completo
  assert.ok(card.includes('_dashVerRankingCompleto()'), 'falta o botão "Ver Ranking completo"');
});
test('renderDashboard: atleta sem jogos no período não aparece no Top 5', () => {
  resetDomCache();
  seedApp({
    games: [ game('g1', '2026-08-20', 'realizado', [ pst('a1', 5, 0, 90) ]) ],
  });
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  const idx = html.indexOf('⭐ Estatísticas da Época');
  const card = html.slice(idx, idx + 3500);
  // a2..a5 nunca jogaram -> não devem poluir os rankings (jogos=0 filtrado)
  assert.ok(!card.includes('Carla Nunes'), 'atleta sem jogos não devia aparecer no Top 5');
});

// ---------------------------------------------------------------------------
// [6] "Ver Ranking completo →" — garante o separador certo antes do navTo
// ---------------------------------------------------------------------------
test('_dashVerRankingCompleto: define _jogoTab="ranking" e navega para "jogos"', () => {
  let navCalledWith = null;
  const originalNavTo = ctx.navTo;
  ctx.navTo = function (id) { navCalledWith = id; };
  ctx.$_jogoTab = 'proximos';
  ctx._dashVerRankingCompleto();
  assert.strictEqual(ctx.$_jogoTab, 'ranking', '_jogoTab devia ficar "ranking" ANTES do navTo (que chama renderJogos() sozinho)');
  assert.strictEqual(navCalledWith, 'jogos');
  ctx.navTo = originalNavTo;
});

// ---------------------------------------------------------------------------
// [7] Classificação continua no mesmo sítio (não foi movida)
// ---------------------------------------------------------------------------
test('renderDashboard: Classificação continua na fiada de 4 colunas, depois de Risco de Lesão', () => {
  resetDomCache();
  // precisa de pelo menos 1 jogo realizado para o cartão "Estatísticas da
  // Época" aparecer (senão estatIdx fica -1 e a asserção de ordem não tem
  // sentido) — não é o foco deste teste, só precisa de existir.
  seedApp({ games: [ game('g1', '2026-08-20', 'realizado', [ pst('a1', 1, 0, 90) ]) ] });
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  const riscoIdx = html.indexOf('RISCO DE LESÃO');
  const classifIdx = html.indexOf('CLASSIFICAÇÃO');
  const estatIdx = html.indexOf('⭐ Estatísticas da Época');
  assert.ok(riscoIdx < classifIdx, 'Classificação devia continuar depois de Risco de Lesão, na mesma fiada');
  assert.ok(classifIdx < estatIdx, 'Classificação devia continuar antes do novo cartão de Estatísticas (não mudou de posição)');
});

// ---------------------------------------------------------------------------
// [8] Resto mantém-se igual: Estado do Plantel, Wellness, Próxima Sessão
// ---------------------------------------------------------------------------
test('renderDashboard: Estado do Plantel, Wellness Médio e Próxima Sessão continuam a renderizar', () => {
  resetDomCache();
  seedApp({});
  ctx.renderDashboard();
  const html = ctx.__elCache['pg-dashboard'].innerHTML;
  assert.ok(html.includes('ESTADO DO PLANTEL'));
  assert.ok(html.includes('WELLNESS MÉDIO (7 DIAS)'));
  assert.ok(html.includes('PRÓXIMA SESSÃO'));
  // os gauges de wellness continuam com o logo embutido (sps-v237, não regressão)
  assert.ok(html.includes('assets/logo_sps_ring.png'));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(' -', f.name));
  process.exit(1);
}
