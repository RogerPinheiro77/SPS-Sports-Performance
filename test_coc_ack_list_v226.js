// test_coc_ack_list_v226.js
// Harness Node (vm) para o pedido do Roger (16/10/2026): "COMO SEI QUAIS AS ATLETAS
// QUE JA ACEITARAM O CODIGO DE CONDUTA?" — a página Código de Conduta só mostrava a
// contagem (X/Y) e, quando havia 8 ou menos pendentes, os NOMES de quem faltava —
// nunca uma lista de quem já tinha confirmado. _cocAckStats() passou a devolver também
// `ackAthletes` (array, não só a contagem), e renderCodigoConduta() ganhou um <details>
// colapsável com as duas listas completas (quem já confirmou / quem falta), sem
// depender de nenhum limite de nº de atletas.
// Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_ginasio_tab_v219.js/test_marker_evolution_v204.js) — nunca reimplementa a lógica.
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
  const sandbox = {
    console,
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    Promise, Map, Set, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: localStorageStub,
    sessionStorage: sessionStorageStub,
    document: {
      getElementById(){ return makeFakeElement(); },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      createElementNS(ns, tag){ const el = makeFakeElement(); el.tagName = tag; return el; },
      addEventListener(){},
      removeEventListener(){},
      createElement(){ return makeFakeElement(); },
    },
    window: {},
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
  return sandbox;
}

const BRIDGE_VARS = ['APP', '_SESSION'];
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

function athlete(id, name, alcunha, ackVersion) {
  const a = { id, name };
  if (alcunha) a.alcunha = alcunha;
  if (ackVersion !== undefined) a.cocAckVersion = ackVersion;
  return a;
}

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();

// Plantel de teste: 5 atletas, 3 confirmaram a versão 1, 2 não confirmaram (1 nunca, 1 com versão antiga).
function seedApp(extra) {
  ctx.$APP = Object.assign({
    athletes: [
      athlete('a1', 'Joana Silva', 'Jô', 1),
      athlete('a2', 'Mariana Costa', '', 1),
      athlete('a3', 'Beatriz Lopes', 'Bia', 1),
      athlete('a4', 'Ana Ferreira', '', undefined), // nunca confirmou
      athlete('a5', 'Rita Alves', '', 0),            // confirmou versão antiga (0 !== 1)
    ],
    codeOfConduct: { active: true, version: 1, publishedAt: '2026-10-02T10:00:00Z', publishedBy: 'Roger' },
  }, extra || {});
}

// [1] _cocAckStats devolve a contagem + os dois arrays (ackAthletes e pending).
test('_cocAckStats devolve ackAthletes (array) e pending, com a contagem certa', () => {
  seedApp();
  const st = ctx._cocAckStats();
  assert.strictEqual(st.total, 5);
  assert.strictEqual(st.ack, 3);
  assert.ok(Array.isArray(st.ackAthletes), 'ackAthletes deve ser um array');
  assert.strictEqual(st.ackAthletes.length, 3);
  assert.deepStrictEqual(st.ackAthletes.map(a => a.id).sort(), ['a1', 'a2', 'a3']);
  assert.deepStrictEqual(st.pending.map(a => a.id).sort(), ['a4', 'a5']);
});

// [2] _cocAckStats com 0 confirmações — ackAthletes vazio, nunca undefined/erro.
test('_cocAckStats sem nenhuma confirmação devolve ackAthletes=[] (nunca erro)', () => {
  seedApp({ athletes: [athlete('a1', 'Joana Silva')] });
  const st = ctx._cocAckStats();
  assert.strictEqual(st.ack, 0);
  assert.deepStrictEqual(st.ackAthletes, []);
  assert.strictEqual(st.pending.length, 1);
});

// [3] renderCodigoConduta() monta o HTML com as duas listas completas (sem limite de 8).
test('renderCodigoConduta mostra a lista de quem já confirmou (nomes)', () => {
  seedApp();
  ctx.$_SESSION = { isAdmin: true };
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-codigo-conduta') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.renderCodigoConduta();
  assert.ok(html.includes('✅ Já confirmaram (3)'), 'deve mostrar a contagem de quem já confirmou');
  assert.ok(html.includes('Jô (Joana Silva)'), 'deve mostrar o nome (com alcunha) de quem já confirmou');
  assert.ok(html.includes('Mariana Costa'), 'deve mostrar o nome de quem já confirmou, mesmo sem alcunha');
  assert.ok(html.includes('Bia (Beatriz Lopes)'), 'deve mostrar os 3 nomes de quem já confirmou');
});

// [4] A mesma lista também mostra quem falta, sem limite de 8 atletas.
test('renderCodigoConduta mostra também a lista de quem falta confirmar, sem limite de 8', () => {
  // 10 atletas sem nenhuma confirmação — antes do fix, a lista de pendentes só
  // aparecia com 8 ou menos; agora deve continuar a aparecer sempre.
  const many = Array.from({ length: 10 }, (_, i) => athlete('p' + i, 'Pendente ' + i));
  seedApp({ athletes: many });
  ctx.$_SESSION = { isAdmin: true };
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-codigo-conduta') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.renderCodigoConduta();
  assert.ok(html.includes('⏳ Ainda não confirmaram (10)'), 'deve listar as 10 pendentes, sem o limite antigo de 8');
  assert.ok(html.includes('Pendente 0') && html.includes('Pendente 9'), 'deve incluir os nomes de todas as 10');
});

// [5] Código inativo — nenhuma das duas listas aparece (ackHtml continua vazio).
test('renderCodigoConduta não mostra nenhuma lista quando o Código ainda não está ativo', () => {
  seedApp({ codeOfConduct: { active: false } });
  ctx.$_SESSION = { isAdmin: true };
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-codigo-conduta') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.renderCodigoConduta();
  assert.ok(!html.includes('Já confirmaram'), 'sem Código ativo não deve haver nenhuma lista de confirmação');
});

// [6] Ordenação alfabética (pelo nome de exibição) — nunca pela ordem do array original.
test('as listas aparecem ordenadas alfabeticamente pelo nome de exibição', () => {
  seedApp({
    athletes: [
      athlete('a1', 'Zulmira Santos', '', 1),
      athlete('a2', 'Ana Ferreira', '', 1),
      athlete('a3', 'Mariana Costa', '', 1),
    ],
  });
  ctx.$_SESSION = { isAdmin: true };
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-codigo-conduta') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.renderCodigoConduta();
  const iAna = html.indexOf('Ana Ferreira');
  const iMariana = html.indexOf('Mariana Costa');
  const iZulmira = html.indexOf('Zulmira Santos');
  assert.ok(iAna > -1 && iMariana > -1 && iZulmira > -1, 'os 3 nomes devem aparecer no HTML');
  assert.ok(iAna < iMariana && iMariana < iZulmira, 'ordem deve ser alfabética: Ana < Mariana < Zulmira');
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
