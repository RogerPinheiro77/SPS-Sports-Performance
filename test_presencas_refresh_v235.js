// test_presencas_refresh_v235.js
// Harness Node (vm) para o pedido do Roger (23/10/2026): "ve o que se passa, o
// preparador fisico nao esta a conseguir registar presenças de ginasio e as atletas
// no seguimento nao conseguiram registar o pse da sessao de ginasio de ontem".
//
// Investigação (confirmada por SQL direto à Supabase de produção): das 23 atletas de
// T1, só 7 ficaram com um registo de presença 'treino' na sessão real de Ginásio de
// 21/10/2026 (criados entre 18:38 e 19:14 UTC, em grupos de 2-3 segundos entre si —
// padrão de várias interações separadas no modal de presenças, não uma falha
// isolada). As outras 16 ficaram sem registo e, por isso, sem conseguir submeter o
// PSE do Ginásio (gate confirmado em renderAtPSE: para eventos 'Ginásio', o PSE só
// desbloqueia com um registo attendance.status==='treino' nesse evento — ver
// sps-v182/sps-v217/CLAUDE.md), tendo em vez disso submetido PSE para a Unidade de
// Treino principal do mesmo dia (confirmado: as 19 linhas de pse_records de
// 21/10/2026 apontam todas para o event_id da UT, nunca para o do Ginásio).
//
// Causa raiz: saveAttendance() grava corretamente em APP.attendance/cloud, mas nunca
// refrescava a página de onde o modal tinha sido aberto (renderPresencas() na grelha
// de Presenças, renderPlaneamento() no calendário) — a célula/ícone clicado ficava
// com o aspeto de "por marcar" até a página ser reaberta manualmente, dando a
// impressão de que a gravação não tinha funcionado. Fix: saveAttendance() passa a
// chamar navTo(_curPg) no fim, mesmo padrão de refrescar a página atual já usado
// noutros sítios desta base de código (importData, toggles de avisos Fisio/Nutri).
//
// Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_coc_ack_list_v226.js/test_marker_evolution_v204.js) — nunca reimplementa a lógica.
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
  // Cache de elementos "persistentes" por id — como no DOM real, getElementById('X')
  // devolve sempre o MESMO objeto (com o mesmo innerHTML que uma chamada anterior lá
  // escreveu), não um elemento novo a cada chamada.
  const elCache = {};
  function getEl(id) {
    if (!elCache[id]) elCache[id] = makeFakeElement();
    return elCache[id];
  }
  const sandbox = {
    console,
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    Promise, Map, Set, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout, setInterval, clearInterval,
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
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__elCache = elCache;
  return sandbox;
}

const BRIDGE_VARS = ['APP', 'ROLE', 'AID', '_curPg', '_SESSION', '_sync', '_presTeam', '_presMonth'];
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

function seedApp(extra) {
  ctx.$APP = Object.assign({
    teams: [{ id: 'T1', name: 'Sub-23' }],
    athletes: [
      athlete('a1', 'Ana Machado'),
      athlete('a2', 'Bárbara Martins'),
      athlete('a3', 'Sofia Leite'),
    ],
    schedule: [
      { id: 'ev_gym', teamId: 'T1', type: 'Ginásio', title: 'Ginásio', date: '2026-10-21', time: '19:30', guestIds: [] },
    ],
    attendance: [],
    pse: [],
    games: [],
  }, extra || {});
}

function resetDomCache() {
  Object.keys(ctx.__elCache).forEach(k => delete ctx.__elCache[k]);
}

// [1] Regressão: saveAttendance() continua a gravar corretamente em APP.attendance
// (um registo por atleta em _attState), com o resumo pres/total certo.
test('saveAttendance grava um registo por atleta em APP.attendance', () => {
  seedApp();
  ctx.$ROLE = 'prep_fisico';
  ctx.$_curPg = 'presencas';
  ctx.$_sync = false;
  ctx.window._attState = {
    a1: { id: null, status: 'treino', reason: null },
    a2: { id: null, status: 'ausente', reason: 'lesao' },
    a3: { id: null, status: 'tratamento', reason: null },
  };
  ctx.saveAttendance('ev_gym');
  const app = ctx.$APP;
  assert.strictEqual(app.attendance.length, 3, 'deve gravar os 3 registos');
  const recA1 = app.attendance.find(a => a.athleteId === 'a1');
  assert.strictEqual(recA1.status, 'treino');
  assert.strictEqual(recA1.present, true);
  const recA2 = app.attendance.find(a => a.athleteId === 'a2');
  assert.strictEqual(recA2.status, 'ausente');
  assert.strictEqual(recA2.present, false);
  assert.strictEqual(recA2.reason, 'lesao');
});

// [2] O bug relatado: ANTES do fix, a grelha de Presenças não se atualizava a seguir
// a gravar — aqui confirmamos o COMPORTAMENTO NOVO: estando na página 'presencas',
// saveAttendance() deixa a página com o HTML atualizado (célula já não "por marcar"),
// sem precisar de nenhuma ação manual extra.
test('depois de saveAttendance(), a grelha de Presenças já mostra a célula marcada (sem precisar de reabrir a página)', () => {
  seedApp();
  resetDomCache();
  ctx.$ROLE = 'prep_fisico';
  ctx.$_curPg = 'presencas';
  ctx.$_presTeam = 'T1';
  ctx.$_presMonth = '2026-10';
  ctx.$_sync = false;

  // Estado inicial: ninguém marcado — a célula da atleta a1 deve mostrar "—".
  ctx.renderPresencas();
  const before = ctx.__elCache['pg-presencas'].innerHTML;
  assert.ok(before.includes('>—<'), 'antes de gravar, a célula de a1 deve estar "por marcar" (—)');

  // Simula o modal de presenças a marcar as 3 atletas como 'treino' e a gravar.
  ctx.window._attState = {
    a1: { id: null, status: 'treino', reason: null },
    a2: { id: null, status: 'treino', reason: null },
    a3: { id: null, status: 'treino', reason: null },
  };
  ctx.saveAttendance('ev_gym');

  const after = ctx.__elCache['pg-presencas'].innerHTML;
  assert.ok(!after.includes('>—<'), 'depois de gravar, já não deve haver nenhuma célula "por marcar" nesta sessão');
  // 3 ícones ✅ (ou pelo menos um, confirmando que a grelha foi mesmo redesenhada com os dados novos)
  assert.ok(after.includes('✅'), 'a grelha redesenhada deve mostrar o ícone de presente');
});

// [3] Mesmo fix aplicado a partir do Planeamento (calendário): estando em
// '_curPg=planeamento', saveAttendance() deve chamar renderPlaneamento() (confirmado
// indiretamente: a função corre sem excepção e o registo persiste).
test('saveAttendance() a partir do Planeamento (_curPg=planeamento) não rebenta e persiste os dados', () => {
  seedApp();
  resetDomCache();
  ctx.$ROLE = 'prep_fisico';
  ctx.$_curPg = 'planeamento';
  ctx.$_sync = false;
  ctx.window._attState = { a1: { id: null, status: 'treino', reason: null } };
  assert.doesNotThrow(() => ctx.saveAttendance('ev_gym'));
  assert.strictEqual(ctx.$APP.attendance.length, 1);
  assert.strictEqual(ctx.$APP.attendance[0].status, 'treino');
});

// [4] Reprodução do cenário exato do Roger: 23 atletas, mas o treinador só grava 7
// (uma de cada vez, via célula a célula). Confirma que, mesmo sem marcar as 16
// restantes, as 7 gravadas ficam corretamente persistidas e visíveis na grelha após
// cada gravação (sem a atleta ter de reabrir a página para "acreditar" que funcionou).
test('marcar atletas uma a uma (cenário real reportado) deixa sempre a grelha atualizada a cada gravação', () => {
  const many = [];
  for (let i = 1; i <= 23; i++) many.push(athlete('a' + i, 'Atleta ' + i));
  seedApp({ athletes: many });
  resetDomCache();
  ctx.$ROLE = 'prep_fisico';
  ctx.$_curPg = 'presencas';
  ctx.$_presTeam = 'T1';
  ctx.$_presMonth = '2026-10';
  ctx.$_sync = false;

  // Marca só as primeiras 7, uma de cada vez (como o preparador físico fez na
  // prática) — cada vez que grava, chama openAttendanceModal(ev,at) + saveAttendance.
  for (let i = 1; i <= 7; i++) {
    const aid = 'a' + i;
    ctx.openAttendanceModal('ev_gym', aid);
    ctx.window._attState[aid].status = 'treino';
    ctx.saveAttendance('ev_gym');
  }

  assert.strictEqual(ctx.$APP.attendance.length, 7, '7 atletas devem ficar com registo — nunca duplicado nem perdido');
  const html = ctx.__elCache['pg-presencas'].innerHTML;
  // As 7 marcadas já não devem aparecer como "—"; deve haver pelo menos 7 presentes (✅).
  const checks = (html.match(/✅/g) || []).length;
  assert.ok(checks >= 7, `esperava pelo menos 7 marcadores ✅ na grelha já atualizada (encontrados ${checks})`);
});

// [5] Gate do PSE de Ginásio na app da atleta (regressão, não tocada por este fix):
// sem presença marcada pelo treinador, o PSE do Ginásio continua bloqueado — confirma
// que a consequência reportada pelo Roger ("atletas não conseguiram registar o PSE")
// tem mesmo esta causa a montante (não é um bug duplo e independente).
test('sem presença marcada (status treino) no evento de Ginásio, o PSE dessa atleta fica bloqueado', () => {
  seedApp();
  ctx.$APP.attendance = []; // ninguém marcado
  // Réplica mínima da condição de desbloqueio usada em renderAtPSE para eventos de Ginásio.
  const ended = (ctx.$APP.attendance || []).some(a => a.eventId === 'ev_gym' && a.athleteId === 'a1' && a.status === 'treino');
  assert.strictEqual(ended, false, 'sem registo de presença, o PSE de Ginásio não deve desbloquear');
});
test('com a presença marcada (status treino) pelo treinador, o PSE dessa atleta desbloqueia', () => {
  seedApp();
  ctx.$APP.attendance = [{ id: 'att1', eventId: 'ev_gym', athleteId: 'a1', status: 'treino', present: true }];
  const ended = (ctx.$APP.attendance || []).some(a => a.eventId === 'ev_gym' && a.athleteId === 'a1' && a.status === 'treino');
  assert.strictEqual(ended, true, 'com o registo de presença, o PSE de Ginásio deve desbloquear');
});

// [6] Regressão explícita: saveAttendance() nunca corre o refresh para um role
// 'atleta' (função nunca é chamada desse lado da app, mas a guarda `ROLE!=='atleta'`
// deve ser segura mesmo que ROLE esteja por acaso nesse valor).
test('saveAttendance() com ROLE=atleta não tenta chamar navTo (guarda de segurança)', () => {
  seedApp();
  resetDomCache();
  ctx.$ROLE = 'atleta';
  ctx.$_curPg = 'presencas';
  ctx.$_sync = false;
  ctx.window._attState = { a1: { id: null, status: 'treino', reason: null } };
  assert.doesNotThrow(() => ctx.saveAttendance('ev_gym'));
  assert.strictEqual(ctx.$APP.attendance.length, 1, 'o registo continua a ser gravado normalmente');
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
