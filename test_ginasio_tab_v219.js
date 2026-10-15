// test_ginasio_tab_v219.js
// Harness Node (vm) para a nova secção própria "Ginásio" na barra lateral (sps-v219),
// separada de "Recursos", com um atalho direto para a Biblioteca de Exercícios
// (partilhada por todas as especialidades, filtrada pela categoria "Ginásio").
// Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_ginasio_bloco1_v218.js / test_marker_evolution_v204.js) — nunca reimplementa
// a lógica aqui.
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

const BRIDGE_VARS = ['_libCat', 'ALL_PAGES', '_NAV_TITLES'];
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

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();

// [1] ALL_PAGES: "Ginásio" é uma secção própria, separada de "Recursos", e contém
// "fichas-ginasio"; "Recursos" já não contém "fichas-ginasio".
test('ALL_PAGES tem uma secção "Ginásio" com fichas-ginasio dentro', () => {
  const pages = ctx.$ALL_PAGES;
  assert.ok(Array.isArray(pages) && pages.length > 0, 'ALL_PAGES deve existir');
  let curSec = null;
  const secOf = {};
  pages.forEach(p => {
    if (p.sec) { curSec = p.sec; return; }
    secOf[p.id] = curSec;
  });
  assert.strictEqual(secOf['fichas-ginasio'], 'Ginásio', 'fichas-ginasio deve estar na secção Ginásio');
  assert.strictEqual(secOf['biblioteca'], 'Recursos', 'biblioteca deve continuar em Recursos');
  assert.strictEqual(secOf['scouting'], 'Recursos', 'scouting deve continuar em Recursos');
  assert.strictEqual(secOf['treinos-ind'], 'Recursos', 'treinos-ind deve continuar em Recursos');
});

test('secção "Ginásio" tem só a página fichas-ginasio (sem arrastar outras)', () => {
  const pages = ctx.$ALL_PAGES;
  const idx = pages.findIndex(p => p.sec === 'Ginásio');
  assert.ok(idx >= 0, 'secção Ginásio deve existir');
  const idsInSec = [];
  for (let i = idx + 1; i < pages.length && !pages[i].sec; i++) idsInSec.push(pages[i].id);
  assert.deepStrictEqual(idsInSec, ['fichas-ginasio']);
});

// [2] _NAV_TITLES continua a ter a entrada certa (não devia ter sido tocado)
test('_NAV_TITLES ainda mapeia fichas-ginasio para "Fichas de Ginásio"', () => {
  assert.strictEqual(ctx.$_NAV_TITLES['fichas-ginasio'], 'Fichas de Ginásio');
});

// [3] gsOpenBiblioteca() — atalho: filtra a Biblioteca por "Ginásio" e navega para lá,
// nunca cria/duplica dados, nunca move a Biblioteca.
test('gsOpenBiblioteca existe e é uma função', () => {
  assert.strictEqual(typeof ctx.gsOpenBiblioteca, 'function');
});

test('gsOpenBiblioteca define _libCat="Ginásio" e chama navTo("biblioteca")', () => {
  ctx.$_libCat = '';
  let navArg = null, navCalls = 0;
  const originalNavTo = ctx.navTo;
  ctx.navTo = (id) => { navArg = id; navCalls++; };
  try {
    ctx.gsOpenBiblioteca();
  } finally {
    ctx.navTo = originalNavTo;
  }
  assert.strictEqual(ctx.$_libCat, 'Ginásio');
  assert.strictEqual(navCalls, 1);
  assert.strictEqual(navArg, 'biblioteca');
});

test('gsOpenBiblioteca não lê/escreve em APP (é só navegação+filtro, sem efeitos de dados)', () => {
  const before = JSON.stringify(ctx.APP);
  const originalNavTo = ctx.navTo;
  ctx.navTo = () => {};
  try {
    ctx.gsOpenBiblioteca();
  } finally {
    ctx.navTo = originalNavTo;
  }
  const after = JSON.stringify(ctx.APP);
  assert.strictEqual(before, after);
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
