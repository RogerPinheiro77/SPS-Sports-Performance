// test_home_ginasio_card_v223.js
// Harness Node (vm) para o pedido do Roger (15/10/2026): "quero como card
// nem que para isso seja necessario reduzir os outros cards" — depois de
// explicar que o separador "Ginásio" (sps-v222) é uma aba própria na barra
// de baixo, Roger pediu mesmo assim um card dedicado na grelha da Casa
// (App da Atleta), ainda que isso implicasse reduzir os outros 8 já lá
// existentes. Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_home_gameday_ginasiocard_v221.js) — nunca reimplementa a lógica aqui.
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

function makeFakeElement(id) {
  const el = {
    id, innerHTML: '', textContent: '', value: '', className: '',
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
    cloneNode(){ return makeFakeElement(id); },
  };
  return el;
}

const FIXED_NOW_MS = new Date(2026, 9, 15, 12, 0, 0, 0).getTime();
class SandboxDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(FIXED_NOW_MS);
    else super(...args);
  }
}
SandboxDate.now = () => FIXED_NOW_MS;

function buildSandbox(elements) {
  const storage = {};
  const localStorageStub = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(storage,k)?storage[k]:null; },
    setItem(k,v){ storage[k]=String(v); },
    removeItem(k){ delete storage[k]; },
  };
  const sessionStorageStub = { getItem(){ return null; }, setItem(){}, removeItem(){} };
  const sandbox = {
    console,
    Math, Date: SandboxDate, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    Promise, Map, Set, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: localStorageStub,
    sessionStorage: sessionStorageStub,
    document: {
      getElementById(id){ if(!elements[id]) elements[id]=makeFakeElement(id); return elements[id]; },
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

const BRIDGE_VARS = ['APP', 'AID', 'today'];
function bridgeScript() {
  return BRIDGE_VARS.map(name => `function __set_${name}(v){${name}=v;} function __get_${name}(){return ${name};}`).join('\n');
}
function loadContext() {
  const code = extractScript();
  const elements = {};
  const sandbox = buildSandbox(elements);
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
  ctx._getEl = (id) => elements[id];
  ctx.FIXED_TODAY = ctx.$today();
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

function freshApp(){
  return {
    exercises:[], gymSheets:[], gymRecords:[], schedule:[], athletes:[{id:'a1',teamId:'T1',name:'Ana Teste',dob:'2005-01-01'}],
    teams:[{id:'T1',name:'T1'}], games:[], convocatorias:[], wellness:[], pse:[], injuries:[],
    trainingPlans:[], extraTrainings:[], evalPeriods:[], evalResponses:[], nutritionPlans:[], codeOfConduct:null,
  };
}
function homeHtml(app, aid) {
  ctx.$APP = app;
  ctx.$AID = aid;
  ctx.renderAtHome();
  return ctx._getEl('atp-home').innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[1] Card "Ginásio" na grelha da Casa (sps-v223)');
test('grelha passou a 3 colunas', () => {
  const html = homeHtml(freshApp(), 'a1');
  assert.ok(html.includes('grid-template-columns:repeat(3,1fr)'), 'devia usar 3 colunas');
  assert.ok(!html.includes('grid-template-columns:1fr 1fr'), 'não devia sobrar a grelha antiga de 2 colunas');
});
test('tile "Ginásio" presente, com onclick para a página "ginasio"', () => {
  const html = homeHtml(freshApp(), 'a1');
  assert.ok(html.includes("_atNavTo('ginasio')"), 'devia navegar para a página ginasio');
  assert.ok(html.includes('>Ginásio<'), 'título do tile');
});
test('sem streak (≥2) → subtítulo genérico, cor neutra', () => {
  const html = homeHtml(freshApp(), 'a1');
  const idx = html.indexOf("_atNavTo('ginasio')");
  const snippet = html.slice(idx, idx+600);
  assert.ok(snippet.includes('Treinos da equipa técnica'));
  assert.ok(!snippet.includes('sessões seguidas'));
});
test('com streak ≥2 → subtítulo mostra a contagem, mesma lógica de _gymConsistencyStreak', () => {
  const app = freshApp();
  for (let i = 1; i <= 3; i++) {
    app.schedule.push({ id:'g'+i, type:'Ginásio', teamId:'T1', date:`2026-10-0${i}`, rsvp:{ a1:{status:'yes'} } });
  }
  const html = homeHtml(app, 'a1');
  const idx = html.indexOf("_atNavTo('ginasio')");
  const snippet = html.slice(idx, idx+600);
  assert.ok(snippet.includes('3 sessões seguidas 🔥'));
});
test('todos os 8 tiles antigos continuam presentes (nada foi removido, só reduzido)', () => {
  const html = homeHtml(freshApp(), 'a1');
  ['Wellness','PSE','Agenda','Avaliações','Nutrição','Fisio','Convocatórias','Treino Ind.'].forEach(t=>{
    assert.ok(html.includes(t), `tile "${t}" devia continuar presente`);
  });
});
test('9 tiles no total, todos dentro da mesma grelha de 3 colunas', () => {
  const html = homeHtml(freshApp(), 'a1');
  const gridIdx = html.indexOf('grid-template-columns:repeat(3,1fr)');
  const gridCloseIdx = html.indexOf('</div>\n  ${todayEvs.length', gridIdx); // não usado, só documentativo
  const onclicks = (html.match(/onclick="_atNavTo\('[a-z]+'\)"/g) || []);
  assert.strictEqual(onclicks.length, 9, `esperava 9 tiles, encontrou ${onclicks.length}: ${onclicks.join(',')}`);
});
test('ícone do tile "Treino Ind." passou a "run" (consistência com a nav do sps-v222)', () => {
  const html = homeHtml(freshApp(), 'a1');
  const idx = html.indexOf("_atNavTo('treino')");
  const snippet = html.slice(idx, idx+300);
  assert.ok(snippet.includes('ti-run'), 'ícone devia ser ti-run, igual à bottom nav');
  assert.ok(!snippet.includes('ti-barbell'), 'não devia mais usar ti-barbell neste tile');
});
test('ícone do tile "Ginásio" é "barbell" (igual à bottom nav do separador Ginásio)', () => {
  const html = homeHtml(freshApp(), 'a1');
  const idx = html.indexOf("_atNavTo('ginasio')");
  const snippet = html.slice(idx, idx+300);
  assert.ok(snippet.includes('ti-barbell'));
});
test('card "Ginásio" nunca expõe carga em bruto (mesma regra do card da aba Ginásio)', () => {
  const app = freshApp();
  const gs = { id:'gs1', exercises:[{ name:'Squat' }] };
  app.schedule.push({ id:'ev1', type:'Ginásio', gymSheet:gs, teamId:'T1', date:'2026-09-01' });
  app.gymRecords.push({ id:'r1', athleteId:'a1', eventId:'ev1', vals:[{ carga:'52.5' }] });
  const html = homeHtml(app, 'a1');
  assert.ok(!html.includes('52.5'));
});
test('renderAtGinasio (separador próprio) continua a funcionar, sem alteração', () => {
  const app = freshApp();
  for (let i = 1; i <= 2; i++) {
    app.schedule.push({ id:'g'+i, type:'Ginásio', teamId:'T1', date:`2026-09-0${i}`, rsvp:{ a1:{status:'yes'} } });
  }
  ctx.$APP = app; ctx.$AID = 'a1';
  ctx.renderAtGinasio();
  const html = ctx._getEl('atp-ginasio').innerHTML;
  assert.ok(html.includes('sessões seguidas confirmadas'));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
