// test_pse_wellness_cores_v236.js
// Harness Node (vm) para sps-v236: "PSE & Wellness cores por tipo" — a funcionalidade
// que o Roger pediu via WhatsApp para a equipa técnica ("os vários PSEs") e que, ao
// investigar, se confirmou existir só como 3 mockups HTML de uma sessão anterior
// (mockup_pse_wellness_cores_v1/v2/v3.html, v3 "final") — nunca implementada em
// index.html/sw.js. O Roger escolheu explicitamente "Avançar para código agora"
// (AskUserQuestion) em vez de anunciar como "em breve" ou manter a mensagem anterior.
//
// Cobre: _pseGroup (classificação Treino/Ginásio/Outros), _pseRelDay (Hoje/Ontem/N
// dias), _pseTypeCellHtml (pílula colorida + fallback "—"), a tabela Individual
// reestruturada (3 colunas por tipo em vez de PSE/Dur/UA/Última Sub., colspan=8 no
// estado vazio e na linha de histórico expandida), a legenda com as 3 cores, e os 2
// gráficos coletivos agora com 3 séries (Treino/Ginásio/Outros) via buildMultiLineChart
// — capturados com um stub de `Chart` (gap identificado: nenhum teste existente no
// projeto precisou disto até agora, confirmado por grep antes de escrever este ficheiro).
//
// Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_presencas_refresh_v235.js/test_marker_evolution_v204.js) — nunca reimplementa a
// lógica de produção.
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
  // Captura das chamadas a `new Chart(canvas,config)` por id de canvas — gap
  // confirmado por grep ("buildChart\|new Chart(" em test_*.js devolve vazio) antes
  // desta sessão: nenhum teste existente no projeto tinha um stub de Chart.js.
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
    // setTimeout síncrono e determinístico — renderPSEWellness() agenda a construção
    // dos gráficos com setTimeout(...,50); correr a callback de imediato evita
    // qualquer necessidade de temporizadores reais/assíncronos neste harness (o cache
    // de elementos é um mapa plano por id, não uma árvore DOM real, por isso construir
    // o canvas antes do innerHTML do contentor ser escrito não tem qualquer efeito).
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

// 'today'/'PSE_GROUP_COLORS' são const no script real — como qualquer outra
// variável top-level let/const, só ficam acessíveis fora do vm context através
// deste mecanismo de ponte (nunca diretamente como ctx.today/ctx.$PSE_GROUP_COLORS,
// que devolveria undefined); os __set_ correspondentes nunca chegam a ser chamados
// nos testes (não há necessidade de reatribuir nenhum dos dois), por isso a
// atribuição a uma const dentro desses setters nunca é de facto executada.
const BRIDGE_VARS = ['APP', 'ROLE', 'AID', '_curPg', '_pwTab', '_pwTeam', '_pwPeriod', '_pwExpand', '_pwAddOpen', 'today', 'PSE_GROUP_COLORS'];
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

function athlete(id, name, teamId) {
  return { id, name, teamId: teamId || 'T1' };
}

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();

function resetDomCache() {
  Object.keys(ctx.__elCache).forEach(k => delete ctx.__elCache[k]);
  Object.keys(ctx.__chartCalls).forEach(k => delete ctx.__chartCalls[k]);
}

function seedApp(extra) {
  ctx.$APP = Object.assign({
    teams: [{ id: 'T1', name: 'Sub-23' }],
    athletes: [
      athlete('a1', 'Ana Machado'),
      athlete('a2', 'Bárbara Martins'),
    ],
    pse: [],
    wellness: [],
    schedule: [],
    attendance: [],
    games: [],
  }, extra || {});
}

function pse(id, athleteId, date, val, duration, sessionType) {
  return { id, athleteId, date, pse: val, duration, ua: val * duration, sessionType };
}

// ---------------------------------------------------------------------------
// [1] _pseGroup — classificação Treino/Ginásio/Outros
// ---------------------------------------------------------------------------
test('_pseGroup: "Ginásio" -> ginasio', () => {
  assert.strictEqual(ctx._pseGroup('Ginásio'), 'ginasio');
});
test('_pseGroup: "Treino" -> treino', () => {
  assert.strictEqual(ctx._pseGroup('Treino'), 'treino');
});
test('_pseGroup: em branco/undefined -> treino (fallback, mesmo padrão ||\'Treino\' do resto da app)', () => {
  assert.strictEqual(ctx._pseGroup(undefined), 'treino');
  assert.strictEqual(ctx._pseGroup(''), 'treino');
  assert.strictEqual(ctx._pseGroup(null), 'treino');
});
test('_pseGroup: "Jogo"/"Reabilitação"/"Ativação" -> outros (agrupados)', () => {
  assert.strictEqual(ctx._pseGroup('Jogo'), 'outros');
  assert.strictEqual(ctx._pseGroup('Reabilitação'), 'outros');
  assert.strictEqual(ctx._pseGroup('Ativação'), 'outros');
});

// ---------------------------------------------------------------------------
// [2] _pseRelDay — "Hoje"/"Ontem"/"N dias", fallback fmtDate para datas futuras
// ---------------------------------------------------------------------------
test('_pseRelDay: data de hoje -> "Hoje"', () => {
  assert.strictEqual(ctx._pseRelDay(ctx.$today()), 'Hoje');
});
test('_pseRelDay: ontem -> "Ontem"', () => {
  const yest = ctx.addDaysStr(ctx.$today(), -1);
  assert.strictEqual(ctx._pseRelDay(yest), 'Ontem');
});
test('_pseRelDay: 5 dias antes -> "5 dias"', () => {
  const d = ctx.addDaysStr(ctx.$today(), -5);
  assert.strictEqual(ctx._pseRelDay(d), '5 dias');
});
test('_pseRelDay: data futura (defensivo) cai no fallback fmtDate, nunca "-1 dias"', () => {
  const tmr = ctx.addDaysStr(ctx.$today(), 1);
  const got = ctx._pseRelDay(tmr);
  assert.ok(!/dias/.test(got), 'nunca deve devolver algo como "-1 dias"');
  assert.strictEqual(got, ctx.fmtDate(tmr));
});

// ---------------------------------------------------------------------------
// [3] _pseTypeCellHtml — pílula colorida por tipo, fallback "—" sem registo
// ---------------------------------------------------------------------------
test('_pseTypeCellHtml: sem registo (p=null) devolve "—"', () => {
  const html = ctx._pseTypeCellHtml(null, 'treino');
  assert.ok(html.includes('—'));
});
test('_pseTypeCellHtml: com registo mostra pse/10, duração, UA e dia relativo, na cor do grupo', () => {
  const p = { pse: 7, duration: 90, ua: 630, date: ctx.$today() };
  const html = ctx._pseTypeCellHtml(p, 'treino');
  assert.ok(html.includes('7/10'), 'deve mostrar "7/10"');
  assert.ok(html.includes('90min'), 'deve mostrar a duração');
  assert.ok(html.includes('UA 630'), 'deve mostrar a UA');
  assert.ok(html.includes('Hoje'), 'deve mostrar o dia relativo');
  assert.ok(html.includes(ctx.$PSE_GROUP_COLORS.treino), 'deve usar a cor do grupo treino (#27a34a)');
});
test('_pseTypeCellHtml: grupo ginasio usa a cor roxa #7d3c98 (convenção já estabelecida no resto da app)', () => {
  const p = { pse: 5, duration: 60, ua: 300, date: ctx.$today() };
  const html = ctx._pseTypeCellHtml(p, 'ginasio');
  assert.ok(html.includes('#7d3c98'));
});
test('PSE_GROUP_COLORS: as 3 cores confirmadas no mockup v3 (Ginásio corrigido para roxo, nunca âmbar)', () => {
  assert.strictEqual(ctx.$PSE_GROUP_COLORS.treino, '#27a34a');
  assert.strictEqual(ctx.$PSE_GROUP_COLORS.ginasio, '#7d3c98');
  assert.strictEqual(ctx.$PSE_GROUP_COLORS.outros, '#5cd0e8');
});

// ---------------------------------------------------------------------------
// [4] renderPSEWellness() — aba "pse": legenda, cabeçalho, tabela, gráficos
// ---------------------------------------------------------------------------
test('renderPSEWellness(pse): legenda com as 3 cores e o rótulo agrupado de "Outros"', () => {
  seedApp();
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 14;
  ctx.$_pwExpand = new Set();
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();
  const html = ctx.__elCache['pg-pse-wellness'].innerHTML;
  assert.ok(html.includes('PSE Treino'), 'legenda deve ter "PSE Treino"');
  assert.ok(html.includes('PSE Ginásio'), 'legenda deve ter "PSE Ginásio"');
  assert.ok(html.includes('PSE Outros (Jogo · Reabilitação · Ativação)'), 'legenda deve explicar o agrupamento de Outros');
});

test('renderPSEWellness(pse): cabeçalho da tabela tem as 3 colunas por tipo + Carga Aguda/Crónica/ACWR (8 colunas no total)', () => {
  seedApp();
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 14;
  ctx.$_pwExpand = new Set();
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();
  const html = ctx.__elCache['pg-pse-wellness'].innerHTML;
  assert.ok(html.includes('<th>Atleta</th>'));
  assert.ok(html.includes('<th>Pos</th>'));
  assert.ok(html.includes('>PSE Treino</th>'));
  assert.ok(html.includes('>PSE Ginásio</th>'));
  assert.ok(html.includes('>PSE Outros</th>'));
  assert.ok(html.includes('<th>Carga Aguda</th>'));
  assert.ok(html.includes('<th>Carga Crónica</th>'));
  assert.ok(html.includes('<th>ACWR</th>'));
  // Nunca deve sobrar a estrutura antiga (PSE/Dur/UA/Última Sub. como colunas soltas)
  assert.ok(!html.includes('Última Sub'), 'coluna antiga "Última Sub." deve ter sido removida');
});

test('renderPSEWellness(pse): sem nenhum atleta na equipa, estado vazio usa colspan=8', () => {
  seedApp({ athletes: [] });
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 14;
  ctx.$_pwExpand = new Set();
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();
  const html = ctx.__elCache['pg-pse-wellness'].innerHTML;
  assert.ok(html.includes('colspan="8"'), 'estado vazio deve usar colspan=8 (8 colunas na tabela nova)');
  assert.ok(html.includes('Sem dados PSE'));
});

test('renderPSEWellness(pse): atleta sem nenhum PSE no período mostra "—" nas 3 colunas de tipo', () => {
  seedApp();
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 14;
  ctx.$_pwExpand = new Set();
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();
  const html = ctx.__elCache['pg-pse-wellness'].innerHTML;
  assert.ok(html.includes('Ana Machado') || html.includes('Ana'), 'a atleta deve aparecer na tabela');
  // As 2 atletas sem registo -> cada uma das 3 colunas de tipo deve cair no fallback "—"
  const dashCount = (html.match(/—<\/span>/g) || []).length;
  assert.ok(dashCount >= 6, `esperava pelo menos 6 "—" (2 atletas × 3 tipos), encontrados ${dashCount}`);
});

test('renderPSEWellness(pse): último registo de cada tipo é escolhido corretamente por atleta (Treino/Ginásio/Outros nunca se misturam)', () => {
  const td = ctx.$today();
  const d1 = ctx.addDaysStr(td, -1);
  const d2 = ctx.addDaysStr(td, -2);
  const d3 = ctx.addDaysStr(td, -3);
  seedApp({
    pse: [
      pse('p1', 'a1', d3, 6, 70, 'Treino'),
      pse('p2', 'a1', d2, 8, 60, 'Ginásio'),
      pse('p3', 'a1', d1, 5, 80, 'Jogo'),
      pse('p4', 'a1', td, 7, 75, 'Treino'), // mais recente de Treino — deve substituir p1
    ],
  });
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 14;
  ctx.$_pwExpand = new Set();
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();
  const html = ctx.__elCache['pg-pse-wellness'].innerHTML;
  assert.ok(html.includes('7/10'), 'Treino mais recente (p4, PSE 7) deve aparecer, não o p1 (PSE 6)');
  assert.ok(html.includes('8/10'), 'Ginásio (p2, PSE 8) deve aparecer');
  assert.ok(html.includes('5/10'), 'Outros/Jogo (p3, PSE 5) deve aparecer');
  assert.ok(!html.includes('6/10'), 'Treino mais antigo (p1, PSE 6) NUNCA deve aparecer — foi substituído pelo mais recente');
});

test('renderPSEWellness(pse): linha de histórico expandida usa colspan=8 (era 9 antes da coluna "Última Sub." ser removida)', () => {
  const td = ctx.$today();
  seedApp({ pse: [pse('p1', 'a1', td, 6, 70, 'Treino')] });
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 14;
  ctx.$_pwExpand = new Set(['pse_a1']);
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();
  const html = ctx.__elCache['pg-pse-wellness'].innerHTML;
  assert.ok(html.includes('colspan="8" style="padding:0;background:var(--bg1)"'), 'a linha de histórico expandida deve usar colspan=8');
});

// ---------------------------------------------------------------------------
// [5] Gráficos coletivos — 3 séries via buildMultiLineChart (Treino/Ginásio/Outros)
// ---------------------------------------------------------------------------
test('renderPSEWellness(pse): os 2 gráficos coletivos passam a ter 3 séries (nunca 1, como antes)', () => {
  const td = ctx.$today();
  const d1 = ctx.addDaysStr(td, -1);
  seedApp({
    pse: [
      pse('p1', 'a1', td, 6, 70, 'Treino'),
      pse('p2', 'a2', td, 8, 60, 'Ginásio'),
      pse('p3', 'a1', d1, 4, 50, 'Jogo'),
    ],
  });
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 14;
  ctx.$_pwExpand = new Set();
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();

  const pseConfig = ctx.__chartCalls['chart-pse-col'];
  const uaConfig = ctx.__chartCalls['chart-ua-col'];
  assert.ok(pseConfig, 'buildMultiLineChart devia ter sido chamado para o gráfico de PSE Médio');
  assert.ok(uaConfig, 'buildMultiLineChart devia ter sido chamado para o gráfico de UA Total');
  assert.strictEqual(pseConfig.data.datasets.length, 3, 'gráfico de PSE Médio deve ter 3 séries (Treino/Ginásio/Outros)');
  assert.strictEqual(uaConfig.data.datasets.length, 3, 'gráfico de UA Total deve ter 3 séries');

  const labels = pseConfig.data.datasets.map(ds => ds.label);
  assert.ok(labels.includes('PSE Treino'));
  assert.ok(labels.includes('PSE Ginásio'));
  assert.ok(labels.includes('PSE Outros'));

  const colors = pseConfig.data.datasets.map(ds => ds.borderColor);
  assert.ok(colors.includes(ctx.$PSE_GROUP_COLORS.treino));
  assert.ok(colors.includes(ctx.$PSE_GROUP_COLORS.ginasio));
  assert.ok(colors.includes(ctx.$PSE_GROUP_COLORS.outros));
});

test('renderPSEWellness(pse): dados do gráfico — valor do dia de hoje na série "Ginásio" reflete o PSE correto', () => {
  const td = ctx.$today();
  seedApp({
    pse: [
      pse('p1', 'a2', td, 8, 60, 'Ginásio'),
    ],
  });
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 7;
  ctx.$_pwExpand = new Set();
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();

  const pseConfig = ctx.__chartCalls['chart-pse-col'];
  const ginasioDs = pseConfig.data.datasets.find(ds => ds.label === 'PSE Ginásio');
  const lastVal = ginasioDs.data[ginasioDs.data.length - 1]; // último dia do período = hoje
  assert.strictEqual(lastVal, 8, 'o último ponto da série Ginásio (hoje) deve ser 8 (único registo)');

  const uaConfig = ctx.__chartCalls['chart-ua-col'];
  const ginasioUaDs = uaConfig.data.datasets.find(ds => ds.label === 'PSE Ginásio');
  const lastUa = ginasioUaDs.data[ginasioUaDs.data.length - 1];
  assert.strictEqual(lastUa, 8 * 60, 'UA total de hoje na série Ginásio deve ser 480 (8×60)');
});

test('renderPSEWellness(pse): dia sem nenhum registo de um tipo fica null no gráfico (nunca 0, para o spanGaps funcionar)', () => {
  seedApp({ pse: [] });
  resetDomCache();
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'pse-wellness';
  ctx.$_pwTab = 'pse';
  ctx.$_pwTeam = 'T1';
  ctx.$_pwPeriod = 7;
  ctx.$_pwExpand = new Set();
  ctx.$_pwAddOpen = false;
  ctx.renderPSEWellness();
  const pseConfig = ctx.__chartCalls['chart-pse-col'];
  pseConfig.data.datasets.forEach(ds => {
    ds.data.forEach(v => assert.strictEqual(v, null, `sem registos, cada ponto deve ser null (nunca 0) — série ${ds.label}`));
  });
});

// ---------------------------------------------------------------------------
// [6] Regressão — sw.js com a versão bumped (confirmação rápida, sem reler o ficheiro)
// ---------------------------------------------------------------------------
test('CACHE do sw.js está em sps-v236', () => {
  const sw = fs.readFileSync('/home/claude/sps/sw.js', 'utf8');
  assert.ok(/const CACHE = 'sps-v236';/.test(sw));
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
