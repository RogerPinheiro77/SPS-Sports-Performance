// test_team_manager_v227.js
// Harness Node (vm) para o Team Manager — Bloco 1 (atalho ?teammanager=1 + página
// "Visão Geral" + acesso/permissões do Diretor, incl. writeExceptions em Estágios).
// Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_coc_ack_list_v226.js/test_ginasio_tab_v219.js) — nunca reimplementa a lógica.
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

function buildSandbox(search) {
  const storage = {};
  const localStorageStub = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(storage,k)?storage[k]:null; },
    setItem(k,v){ storage[k]=String(v); },
    removeItem(k){ delete storage[k]; },
  };
  const sessionStorageStub = { getItem(){ return null; }, setItem(){}, removeItem(){} };
  const elements = {};
  const sandbox = {
    console,
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    Promise, Map, Set, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: localStorageStub,
    sessionStorage: sessionStorageStub,
    document: {
      getElementById(id){ if(!elements[id])elements[id]=makeFakeElement(); return elements[id]; },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      createElementNS(ns, tag){ const el = makeFakeElement(); el.tagName = tag; return el; },
      addEventListener(){},
      removeEventListener(){},
      createElement(){ return makeFakeElement(); },
      body: makeFakeElement(),
    },
    window: {},
    navigator: { serviceWorker: undefined, onLine: true },
    scrollTo(){},
    confirm(){ return true; },
    prompt(){ return null; },
    alert(){},
    fetch(){ return Promise.reject(new Error('fetch disabled in test harness')); },
    btoa(s){ return Buffer.from(s, 'binary').toString('base64'); },
    atob(s){ return Buffer.from(s, 'base64').toString('binary'); },
    XMLSerializer: function(){ this.serializeToString = () => ''; },
    Image: function(){},
    crypto: { subtle: { digest: async () => new ArrayBuffer(32) } },
    location: { pathname: '/', search: search || '' },
    history: { replaceState(){} },
    URLSearchParams,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__elements = elements;
  return sandbox;
}

const BRIDGE_VARS = ['APP', '_SESSION', 'ROLE', 'ROLE_DEFS', '_curPg', '_forceTeamManagerMode'];
function bridgeScript() {
  return BRIDGE_VARS.map(name => `function __set_${name}(v){${name}=v;} function __get_${name}(){return ${name};}`).join('\n');
}
function loadContext(search) {
  const code = extractScript();
  const sandbox = buildSandbox(search);
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

console.log('Loading real index.html script into vm context (no ?teammanager=1)...');
const ctx = loadContext('');

function baseApp(extra) {
  return Object.assign({
    teams: [{ id: 'T1', name: 'Equipa Principal' }],
    athletes: [],
    games: [],
    estagios: [],
    convocatorias: [],
    config: { clubName: 'Moreirense FC', clubLogo: '' },
    codeOfConduct: null,
  }, extra || {});
}

// ─── [1] Elegibilidade (_teamManagerEligibleRole) ──────────────────────────
test('_teamManagerEligibleRole: team_manager é elegível (tem visao-geral nas pages)', () => {
  assert.strictEqual(ctx._teamManagerEligibleRole('team_manager'), true);
});
test('_teamManagerEligibleRole: diretor é elegível, mesmo sendo readOnly', () => {
  assert.strictEqual(ctx.$ROLE_DEFS.diretor.readOnly, true, 'pré-condição: diretor continua readOnly');
  assert.strictEqual(ctx._teamManagerEligibleRole('diretor'), true);
});
test('_teamManagerEligibleRole: treinador/treinador_adj são elegíveis (acesso total, _ALL_PAGE_IDS)', () => {
  assert.strictEqual(ctx._teamManagerEligibleRole('treinador'), true);
  assert.strictEqual(ctx._teamManagerEligibleRole('treinador_adj'), true);
});
test('_teamManagerEligibleRole: fisio/nutri/treinador_gr/prep_fisico NÃO são elegíveis', () => {
  assert.strictEqual(ctx._teamManagerEligibleRole('fisio'), false);
  assert.strictEqual(ctx._teamManagerEligibleRole('nutri'), false);
  assert.strictEqual(ctx._teamManagerEligibleRole('treinador_gr'), false);
  assert.strictEqual(ctx._teamManagerEligibleRole('prep_fisico'), false);
});
test('_teamManagerEligibleRole: cargo inexistente/undefined nunca rebenta', () => {
  assert.strictEqual(ctx._teamManagerEligibleRole('xyz'), false);
  assert.strictEqual(ctx._teamManagerEligibleRole(undefined), false);
});

// ─── [2] ROLE_DEFS — páginas/writeExceptions ───────────────────────────────
test('ROLE_DEFS.team_manager.pages tem visao-geral (não dashboard)', () => {
  assert.ok(ctx.$ROLE_DEFS.team_manager.pages.includes('visao-geral'));
  assert.ok(!ctx.$ROLE_DEFS.team_manager.pages.includes('dashboard'));
});
test('ROLE_DEFS.diretor.pages tem visao-geral E continua a ter dashboard', () => {
  assert.ok(ctx.$ROLE_DEFS.diretor.pages.includes('visao-geral'));
  assert.ok(ctx.$ROLE_DEFS.diretor.pages.includes('dashboard'));
});
test('ROLE_DEFS.diretor.writeExceptions é exatamente ["estagios"]', () => {
  // Array vindo do vm context (outro "realm") — comparar por JSON.stringify em vez de
  // deepStrictEqual direto (mesmo cuidado documentado no sps-v224/test_biblioteca_import_ginasio_v224.js).
  assert.strictEqual(JSON.stringify(ctx.$ROLE_DEFS.diretor.writeExceptions), JSON.stringify(['estagios']));
});
test('Outros cargos não ganharam writeExceptions por engano', () => {
  assert.strictEqual(ctx.$ROLE_DEFS.team_manager.writeExceptions, undefined);
  assert.strictEqual(ctx.$ROLE_DEFS.treinador.writeExceptions, undefined);
});

// ─── [3] navTo() — writeExceptions respeita o bloqueio readOnly fora da lista ──
test('navTo(estagios) como Diretor NÃO aplica _applyReadOnlyLock (writeException)', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'diretor';
  let lockCalled = false;
  const origLock = ctx._applyReadOnlyLock;
  ctx._applyReadOnlyLock = () => { lockCalled = true; };
  try {
    ctx.navTo('estagios');
    assert.strictEqual(lockCalled, false, '_applyReadOnlyLock não devia ter corrido em estagios para o Diretor');
  } finally {
    ctx._applyReadOnlyLock = origLock;
  }
});
test('navTo(visao-geral) como Diretor CONTINUA a aplicar _applyReadOnlyLock (não está na exceção)', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'diretor';
  let lockCalled = false;
  const origLock = ctx._applyReadOnlyLock;
  ctx._applyReadOnlyLock = () => { lockCalled = true; };
  try {
    ctx.navTo('visao-geral');
    assert.strictEqual(lockCalled, true, '_applyReadOnlyLock devia continuar a correr em visao-geral para o Diretor');
  } finally {
    ctx._applyReadOnlyLock = origLock;
  }
});
test('navTo(jogos) como Diretor CONTINUA a aplicar _applyReadOnlyLock (outra página fora da exceção)', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'diretor';
  let lockCalled = false;
  const origLock = ctx._applyReadOnlyLock;
  ctx._applyReadOnlyLock = () => { lockCalled = true; };
  try {
    ctx.navTo('jogos');
    assert.strictEqual(lockCalled, true);
  } finally {
    ctx._applyReadOnlyLock = origLock;
  }
});
test('navTo(estagios) como Team Manager (não readOnly) nunca chama _applyReadOnlyLock de todo', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'team_manager';
  let lockCalled = false;
  const origLock = ctx._applyReadOnlyLock;
  ctx._applyReadOnlyLock = () => { lockCalled = true; };
  try {
    ctx.navTo('estagios');
    assert.strictEqual(lockCalled, false);
  } finally {
    ctx._applyReadOnlyLock = origLock;
  }
});

// ─── [4] _maybeEnterTeamManagerMode — depende do URL ?teammanager=1 ────────
test('_maybeEnterTeamManagerMode: sem ?teammanager=1 na URL, não faz nada', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'team_manager';
  let navCalled = false;
  const origNav = ctx.navTo;
  ctx.navTo = (id) => { navCalled = true; };
  try {
    ctx._maybeEnterTeamManagerMode();
    assert.strictEqual(navCalled, false, 'sem o parâmetro na URL, não deve navegar');
  } finally { ctx.navTo = origNav; }
});

const ctxTM = loadContext('?teammanager=1');
test('_maybeEnterTeamManagerMode: com ?teammanager=1 e cargo elegível, navega para visao-geral', () => {
  ctxTM.$APP = baseApp();
  ctxTM.$ROLE = 'team_manager';
  let navTarget = null;
  const origNav = ctxTM.navTo;
  ctxTM.navTo = (id) => { navTarget = id; };
  try {
    ctxTM._maybeEnterTeamManagerMode();
    assert.strictEqual(navTarget, 'visao-geral');
  } finally { ctxTM.navTo = origNav; }
});
test('_maybeEnterTeamManagerMode: com ?teammanager=1 e cargo NÃO elegível, mostra aviso e não navega', () => {
  ctxTM.$APP = baseApp();
  ctxTM.$ROLE = 'fisio';
  let navCalled = false, toastMsg = null;
  const origNav = ctxTM.navTo, origToast = ctxTM.toast;
  ctxTM.navTo = () => { navCalled = true; };
  ctxTM.toast = (msg) => { toastMsg = msg; };
  try {
    ctxTM._maybeEnterTeamManagerMode();
    assert.strictEqual(navCalled, false);
    assert.ok(toastMsg && /SPS-Team Manager/.test(toastMsg));
  } finally { ctxTM.navTo = origNav; ctxTM.toast = origToast; }
});

// ─── [5] renderVisaoGeral — estados de dados ───────────────────────────────
function htmlOf(ctxX, id, fn) {
  const el = ctxX.__elements[id] || (ctxX.__elements[id] = makeFakeElement());
  let captured = '';
  Object.defineProperty(el, 'innerHTML', { get() { return captured; }, set(v) { captured = v; }, configurable: true });
  fn();
  return captured;
}

test('renderVisaoGeral: sem jogos/estágios agendados, mostra os estados vazios', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'team_manager';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  assert.ok(html.includes('Sem jogos agendados'));
  assert.ok(html.includes('Sem estágios agendados'));
  assert.ok(!html.includes('Convocatória pendente'));
});

test('renderVisaoGeral: próximo jogo aparece com atalho para Convocatória/Pré-Jogo', () => {
  ctx.$APP = baseApp({
    games: [{ id: 'g1', teamId: 'T1', date: '2099-01-10', time: '15:00', opp: 'Sporting', ha: 'casa', loc: 'Estádio', lineup: [], subs: [], convocatoria: [], convocatoriaLaunched: false }],
  });
  ctx.$ROLE = 'team_manager';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  assert.ok(html.includes('Sporting'));
  assert.ok(html.includes("openJogo('g1','prejogo')"));
  assert.ok(html.includes('Convocatória pendente'), 'sem convocatória publicada deve alertar');
});

test('renderVisaoGeral: convocatória publicada com onze completo e tudo confirmado não alerta', () => {
  const lineup = Array.from({ length: 11 }, (_, i) => 'a' + i);
  ctx.$APP = baseApp({
    games: [{ id: 'g1', teamId: 'T1', date: '2099-01-10', time: '15:00', opp: 'Sporting', ha: 'casa', loc: 'Estádio', lineup, subs: [], convocatoria: lineup, convocatoriaLaunched: true }],
    convocatorias: [{ id: 'c1', gameId: 'g1', athletes: lineup, rsvp: Object.fromEntries(lineup.map(id => [id, { status: 'yes' }])) }],
  });
  ctx.$ROLE = 'team_manager';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  assert.ok(!html.includes('Convocatória pendente'));
});

test('renderVisaoGeral: próximo estágio aparece com contagem de convocadas/pendentes e atalho', () => {
  ctx.$APP = baseApp({
    estagios: [{ id: 'e1', teamId: 'T1', titulo: 'Estágio — Jornada 12', local: 'Hotel X', dataInicio: '2099-02-01', dataFim: '2099-02-02', convocatoria: ['a1', 'a2'], rsvp: { a1: { status: 'yes' } } }],
  });
  ctx.$ROLE = 'team_manager';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  assert.ok(html.includes('Estágio — Jornada 12'));
  assert.ok(html.includes('2 convocadas'));
  assert.ok(html.includes('1 por confirmar'));
  assert.ok(html.includes("openEstagio('e1')"));
});

test('renderVisaoGeral: Código de Conduta ativo mostra o cartão com a % de confirmação', () => {
  ctx.$APP = baseApp({
    athletes: [{ id: 'a1', name: 'A', cocAckVersion: 1 }, { id: 'a2', name: 'B', cocAckVersion: undefined }],
    codeOfConduct: { active: true, version: 1 },
  });
  ctx.$ROLE = 'team_manager';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  assert.ok(html.includes('CÓDIGO DE CONDUTA'));
  assert.ok(html.includes('1 de 2 atletas'));
});

test('renderVisaoGeral: Código de Conduta inativo não mostra o cartão', () => {
  ctx.$APP = baseApp({ codeOfConduct: null });
  ctx.$ROLE = 'team_manager';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  assert.ok(!html.includes('CÓDIGO DE CONDUTA'));
});

// ─── [6] Atalhos — refletem _navForRole(ROLE), nunca <button> ──────────────
test('renderVisaoGeral: grid de atalhos lista as páginas de _navForRole(ROLE), sem visao-geral/dashboard', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'team_manager';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  const nav = ctx._navForRole('team_manager').filter(n => !n.sec && n.id !== 'visao-geral' && n.id !== 'dashboard');
  assert.ok(nav.length > 0, 'pré-condição: team_manager deve ter páginas além de visao-geral');
  nav.forEach(n => {
    assert.ok(html.includes(`navTo('${n.id}')`), `atalho para ${n.id} deve estar presente`);
  });
  assert.ok(!html.includes("navTo('visao-geral')"), 'não deve haver atalho para a própria página');
});

test('renderVisaoGeral: atalhos são sempre <div onclick>, nunca <button> (sobrevivem a _applyReadOnlyLock)', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'diretor';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  const atalhosSection = html.split('Atalhos')[1] || '';
  assert.ok(!/<button[^>]*onclick="navTo/.test(atalhosSection), 'atalhos não devem ser <button>');
  assert.ok(/<div onclick="navTo/.test(atalhosSection), 'atalhos devem ser <div onclick>');
});

test('renderVisaoGeral: Diretor (readOnly) também vê atalhos, incl. estagios', () => {
  ctx.$APP = baseApp();
  ctx.$ROLE = 'diretor';
  const html = htmlOf(ctx, 'pg-visao-geral', () => ctx.renderVisaoGeral());
  assert.ok(html.includes("navTo('estagios')"));
  assert.ok(html.includes("navTo('jogos')"));
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
