// test_at_ginasio_treino_split_v222.js
// Harness Node (vm) para o pedido do Roger (15/10/2026): "ter uma aba só para
// ginásio à parte e a outra do treino individual em separado" — na App da
// Atleta, o separador "Treino" misturava o card de Ginásio (streak+evolução,
// sps-v220/v221, liderado pela equipa técnica) com os Planos Individuais e
// Treinos Extra (trabalho que a atleta faz por sua conta, em casa/ginásio
// próprio/etc.). Passa a haver 2 separadores: "Ginásio" (novo) e "Treino"
// (agora só "Treino Individual"). Extrai e corre o CÓDIGO REAL de
// index.html (mesmo padrão de test_home_gameday_ginasiocard_v221.js).
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const REAL_PATH = '/home/claude/sps/index.html';
const RAW_HTML = fs.readFileSync(REAL_PATH, 'utf8');

function extractScript() {
  const m = RAW_HTML.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
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
  let lastModal = null;
  ctx.openMod = (title, body, size) => { lastModal = { title, body, size }; };
  ctx.closeMod = () => {};
  ctx._getLastModal = () => lastModal;
  ctx._getEl = (id) => elements[id];
  ctx.FIXED_TODAY = ctx.$today(); // '2026-10-15'
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
console.log('Loaded. Functions available:',
  ['renderAtGinasio','renderAtTreino','_gymAthleteCardHtml','atOpenGinasioPlanoDia','atNav']
   .map(n => typeof ctx[n]).join(','));

function freshApp(){
  return {
    exercises:[], gymSheets:[], gymRecords:[], schedule:[], athletes:[{id:'a1',teamId:'T1',name:'Ana Teste',dob:'2005-01-01'}],
    teams:[{id:'T1',name:'T1'}], games:[], convocatorias:[], wellness:[], pse:[], injuries:[],
    trainingPlans:[], extraTrainings:[], evalPeriods:[], evalResponses:[], nutritionPlans:[], codeOfConduct:null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[1] Wiring — HTML/nav/_AT_RENDERS');
test('existe o container atp-ginasio no markup da App da Atleta', () => {
  assert.ok(RAW_HTML.includes('id="atp-ginasio"'));
});
test('existe o botão de navegação para \'ginasio\' na bottom nav', () => {
  assert.ok(RAW_HTML.includes("atNav('ginasio',this)"));
});
test('o botão de navegação para \'treino\' continua a existir, com o rótulo "Individual"', () => {
  const m = RAW_HTML.match(/<div class="at-ni"[^>]*onclick="atNav\('treino',this\)"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(m, 'botão de navegação para treino não encontrado');
  assert.ok(m[1].includes('Individual'));
});
test('renderAtGinasio existe e está registada em _AT_RENDERS', () => {
  assert.strictEqual(typeof ctx.renderAtGinasio, 'function');
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[2] renderAtGinasio — card de streak/evolução + atalho "sessão de hoje"');
test('sem histórico e sem sessão hoje: mostra o estado vazio, sem atalho', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  ctx.renderAtGinasio();
  const html = ctx._getEl('atp-ginasio').innerHTML;
  assert.ok(html.includes('Ginásio'));
  assert.ok(html.includes('Ainda sem histórico de Ginásio'));
  assert.ok(!html.includes('Sessão de hoje'));
});
test('com streak ≥2: mostra o card (reaproveita _gymAthleteCardHtml ao vivo)', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  for (let i = 1; i <= 2; i++) {
    ctx.$APP.schedule.push({ id:'g'+i, type:'Ginásio', teamId:'T1', date:`2026-09-0${i}`, rsvp:{ a1:{status:'yes'} } });
  }
  ctx.renderAtGinasio();
  const html = ctx._getEl('atp-ginasio').innerHTML;
  assert.ok(html.includes('sessões seguidas confirmadas'));
  assert.ok(!html.includes('Ainda sem histórico'));
});
test('com uma sessão de Ginásio agendada para HOJE (com ficha): mostra o atalho "Sessão de hoje"', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  const gs = { id:'gs1', exercises:[{ name:'Squat' }] };
  ctx.$APP.schedule.push({ id:'evHoje', type:'Ginásio', teamId:'T1', date: ctx.FIXED_TODAY, gymSheet: gs, title:'Força — Semana 6' });
  ctx.renderAtGinasio();
  const html = ctx._getEl('atp-ginasio').innerHTML;
  assert.ok(html.includes('Sessão de hoje'));
  assert.ok(html.includes('Força — Semana 6'));
  assert.ok(html.includes("atOpenGinasioPlanoDia('evHoje')"));
});
test('sessão de Ginásio hoje SEM ficha importada: não mostra o atalho (nada para ver)', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  ctx.$APP.schedule.push({ id:'evHoje2', type:'Ginásio', teamId:'T1', date: ctx.FIXED_TODAY });
  ctx.renderAtGinasio();
  const html = ctx._getEl('atp-ginasio').innerHTML;
  assert.ok(!html.includes('Sessão de hoje'));
});
test('sessão de Ginásio hoje de OUTRA equipa: não mostra o atalho', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  const gs = { id:'gs1', exercises:[{ name:'Squat' }] };
  ctx.$APP.schedule.push({ id:'evOutra', type:'Ginásio', teamId:'T2', date: ctx.FIXED_TODAY, gymSheet: gs });
  ctx.renderAtGinasio();
  const html = ctx._getEl('atp-ginasio').innerHTML;
  assert.ok(!html.includes('Sessão de hoje'));
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[3] renderAtTreino — agora só "Treino Individual" (Planos + Treino Extra)');
test('cabeçalho passou a "Treino Individual", já sem o card de Ginásio', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  for (let i = 1; i <= 3; i++) {
    ctx.$APP.schedule.push({ id:'g'+i, type:'Ginásio', teamId:'T1', date:`2026-09-0${i}`, rsvp:{ a1:{status:'yes'} } });
  }
  ctx.renderAtTreino();
  const html = ctx._getEl('atp-treino').innerHTML;
  assert.ok(html.includes('Treino Individual'));
  assert.ok(!html.includes('sessões seguidas confirmadas'));
});
test('Planos Individuais continuam a aparecer normalmente em "Treino Individual"', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  ctx.$APP.trainingPlans.push({ id:'p1', athleteId:'a1', title:'Trabalho de Velocidade', type:'Físico', done:false, createdAt:'2026-10-01' });
  ctx.renderAtTreino();
  const html = ctx._getEl('atp-treino').innerHTML;
  assert.ok(html.includes('Trabalho de Velocidade'));
  assert.ok(html.includes('Planos individuais'));
});
test('"Treino Extra" continua embutido no mesmo separador (via _atExtraHtml)', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  ctx.renderAtTreino();
  const html = ctx._getEl('atp-treino').innerHTML;
  assert.ok(html.includes('Treino Extra'));
  assert.ok(html.includes('Registar Treino Extra'));
});
test('registos de Ginásio (streak/evolução) nunca aparecem dentro de "Treino Individual"', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  const gs = { id:'gs1', exercises:[{ name:'Squat' }] };
  ctx.$APP.schedule.push({ id:'ev1', type:'Ginásio', gymSheet: gs, teamId:'T1', date:'2026-08-01' });
  ctx.$APP.schedule.push({ id:'ev2', type:'Ginásio', gymSheet: gs, teamId:'T1', date:'2026-09-01' });
  ctx.$APP.gymRecords.push({ id:'r1', athleteId:'a1', eventId:'ev1', vals:[{ carga:'40' }] });
  ctx.$APP.gymRecords.push({ id:'r2', athleteId:'a1', eventId:'ev2', vals:[{ carga:'47.5' }] });
  ctx.renderAtTreino();
  const htmlTreino = ctx._getEl('atp-treino').innerHTML;
  assert.ok(!htmlTreino.includes('A subir') && !htmlTreino.includes('Squat'), 'evolução de Ginásio não deve vazar para Treino Individual');
  ctx.renderAtGinasio();
  const htmlGinasio = ctx._getEl('atp-ginasio').innerHTML;
  assert.ok(htmlGinasio.includes('Squat'), 'mas deve aparecer no separador Ginásio');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
