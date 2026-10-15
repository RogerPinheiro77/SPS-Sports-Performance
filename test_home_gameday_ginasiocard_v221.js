// test_home_gameday_ginasiocard_v221.js
// Harness Node (vm) para o pedido do Roger (14/10/2026): (1) consolidar o
// streak + evolução de Ginásio num único card na aba Treino da atleta;
// (2) separar o card "Convocatória" (sempre normal) do novo card "Gameday"
// (próximo jogo em dias normais, ativo/destacado no dia do jogo). Extrai e
// corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_ginasio_atleta_bloco2a_v220.js) — nunca reimplementa a lógica aqui.
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

// "Agora" fixo ao meio-dia de 14/10/2026 — torna today()/_atDiaJogoWindowActive
// determinísticos (independentes da hora real a que o teste corre), sem
// precisar de reatribuir a const `today` do próprio ficheiro (impossível).
// Só o construtor SEM argumentos fica fixo — `new Date(y,m,d,...)` continua a
// comportar-se normalmente, por isso a lógica de janela/intervalos não é afetada.
const FIXED_NOW_MS = new Date(2026, 9, 14, 12, 0, 0, 0).getTime();
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
  ctx.FIXED_TODAY = ctx.$today(); // '2026-10-14', derivado do Date fixo do sandbox ($today é a const `today` do ficheiro, acessível via bridge)
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
  ['_gymAthleteCardHtml','_gymStreakCardHtml','_gymEvolutionCardHtml','_atNextGame',
   'renderAtHome','renderAtTreino','_atGameHoje','_atGameHojeEquipa']
   .map(n => typeof ctx[n]).join(','));

function freshApp(){
  return {
    exercises:[], gymSheets:[], gymRecords:[], schedule:[], athletes:[{id:'a1',teamId:'T1',name:'Ana Teste',dob:'2005-01-01'}],
    teams:[{id:'T1',name:'T1'}], games:[], convocatorias:[], wellness:[], pse:[], injuries:[],
    trainingPlans:[], extraTrainings:[], evalPeriods:[], evalResponses:[], nutritionPlans:[], codeOfConduct:null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[1] Card único "Ginásio" (_gymAthleteCardHtml)');
test('_gymStreakCardHtml/_gymEvolutionCardHtml deixaram de existir', () => {
  assert.strictEqual(typeof ctx._gymStreakCardHtml, 'undefined');
  assert.strictEqual(typeof ctx._gymEvolutionCardHtml, 'undefined');
  assert.strictEqual(typeof ctx._gymAthleteCardHtml, 'function');
});
test('sem streak e sem evolução → card vazio', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  assert.strictEqual(ctx._gymAthleteCardHtml('a1'), '');
});
test('só streak (≥2) → mostra só a parte de streak, dentro de 1 .card "Ginásio"', () => {
  ctx.$APP = freshApp();
  for (let i = 1; i <= 3; i++) {
    ctx.$APP.schedule.push({ id: 'g'+i, type:'Ginásio', teamId:'T1', date:`2026-10-0${i}`, rsvp:{ a1:{status:'yes'} } });
  }
  const html = ctx._gymAthleteCardHtml('a1');
  assert.ok(html.includes('🏋️‍♀️ Ginásio') || html.includes('Ginásio'), 'título do card');
  assert.ok(html.includes('sessões seguidas confirmadas'));
  assert.strictEqual((html.match(/class="card"/g)||[]).length, 1, 'card único');
  assert.ok(!html.includes('A subir') && !html.includes('A descer'), 'sem evolução não deve inventar linhas de tendência');
});
test('só evolução (sem streak) → mostra só a evolução, sem a linha de streak', () => {
  ctx.$APP = freshApp();
  const gs = { id:'gs1', exercises:[{ name:'Squat' }] };
  ctx.$APP.schedule.push({ id:'ev1', type:'Ginásio', gymSheet:gs, teamId:'T1', date:'2026-09-01' });
  ctx.$APP.gymRecords.push({ id:'r1', athleteId:'a1', eventId:'ev1', vals:[{ carga:'40' }] });
  const html = ctx._gymAthleteCardHtml('a1');
  assert.ok(html.includes('Squat'));
  assert.ok(html.includes('🆕') || html.includes('1º registo'));
  assert.ok(!html.includes('sessões seguidas confirmadas'), 'sem streak suficiente, não deve aparecer');
  assert.strictEqual((html.match(/class="card"/g)||[]).length, 1);
});
test('streak + evolução juntos → 1 card só, com as duas partes', () => {
  ctx.$APP = freshApp();
  for (let i = 1; i <= 2; i++) {
    ctx.$APP.schedule.push({ id:'g'+i, type:'Ginásio', teamId:'T1', date:`2026-09-0${i}`, rsvp:{ a1:{status:'yes'} } });
  }
  const gs = { id:'gs1', exercises:[{ name:'Squat' }] };
  // ev1 tem de ser o Ginásio mais recente E confirmado (rsvp yes) — senão
  // _gymConsistencyStreak encontra-o como o mais recente sem confirmação e
  // quebra o streak logo ali (mesma classe de erro de teste já documentada
  // no changelog do sps-v220, corrigida aqui do mesmo modo).
  ctx.$APP.schedule.push({ id:'ev1', type:'Ginásio', gymSheet:gs, teamId:'T1', date:'2026-09-10', rsvp:{ a1:{status:'yes'} } });
  ctx.$APP.gymRecords.push({ id:'r1', athleteId:'a1', eventId:'ev1', vals:[{ carga:'40' }] });
  const html = ctx._gymAthleteCardHtml('a1');
  assert.ok(html.includes('sessões seguidas confirmadas'));
  assert.ok(html.includes('Squat'));
  assert.strictEqual((html.match(/class="card"/g)||[]).length, 1, 'ainda 1 card só');
});
test('nunca expõe a carga em bruto no HTML (teste de segurança)', () => {
  ctx.$APP = freshApp();
  const gs = { id:'gs1', exercises:[{ name:'Squat' }] };
  ctx.$APP.schedule.push({ id:'ev1', type:'Ginásio', gymSheet:gs, teamId:'T1', date:'2026-08-01' });
  ctx.$APP.schedule.push({ id:'ev2', type:'Ginásio', gymSheet:gs, teamId:'T1', date:'2026-09-01' });
  ctx.$APP.gymRecords.push({ id:'r1', athleteId:'a1', eventId:'ev1', vals:[{ carga:'40' }] });
  ctx.$APP.gymRecords.push({ id:'r2', athleteId:'a1', eventId:'ev2', vals:[{ carga:'47.5' }] });
  const html = ctx._gymAthleteCardHtml('a1');
  assert.ok(!html.includes('40'));
  assert.ok(!html.includes('47.5'));
  assert.ok(!html.includes('kg'));
});
test('renderAtGinasio (separador próprio, sps-v222) insere o card único', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  for (let i = 1; i <= 2; i++) {
    ctx.$APP.schedule.push({ id:'g'+i, type:'Ginásio', teamId:'T1', date:`2026-09-0${i}`, rsvp:{ a1:{status:'yes'} } });
  }
  ctx.renderAtGinasio();
  const html = ctx._getEl('atp-ginasio').innerHTML;
  assert.ok(html.includes('sessões seguidas confirmadas'));
  assert.strictEqual((html.match(/🏋️/g)||[]).length >= 1, true);
});
test('renderAtTreino (sps-v222: só "Treino Individual") já NÃO mostra o card de Ginásio', () => {
  ctx.$APP = freshApp();
  ctx.$AID = 'a1';
  for (let i = 1; i <= 2; i++) {
    ctx.$APP.schedule.push({ id:'g'+i, type:'Ginásio', teamId:'T1', date:`2026-09-0${i}`, rsvp:{ a1:{status:'yes'} } });
  }
  ctx.renderAtTreino();
  const html = ctx._getEl('atp-treino').innerHTML;
  assert.ok(!html.includes('sessões seguidas confirmadas'), 'o streak de Ginásio mudou-se para o separador próprio');
  assert.ok(html.includes('Treino Individual'), 'cabeçalho passou a "Treino Individual"');
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[2] Separação "Convocatória" (grelha, sempre normal) vs. card "Gameday"');
function homeHtml(app, aid) {
  ctx.$APP = app;
  ctx.$AID = aid;
  ctx.renderAtHome();
  return ctx._getEl('atp-home').innerHTML;
}
test('_atNextGame filtra por equipa e por data >= hoje, ordenado', () => {
  ctx.$APP = freshApp();
  ctx.$APP.games.push({ id:'past', teamId:'T1', date:'2026-01-01', opp:'Passado' });
  ctx.$APP.games.push({ id:'otherTeam', teamId:'T2', date:'2026-10-20', opp:'Outra equipa' });
  ctx.$APP.games.push({ id:'far', teamId:'T1', date:'2026-11-01', opp:'Longe' });
  ctx.$APP.games.push({ id:'near', teamId:'T1', date:'2026-10-20', opp:'Perto' });
  const g = ctx._atNextGame(ctx.$APP.athletes[0]);
  assert.ok(g, 'devia encontrar um jogo');
  assert.strictEqual(g.id, 'near', 'devia ser o mais próximo cronologicamente, da equipa certa');
});
test('dia normal, com próximo jogo: card "Gameday" mostra data/hora, sem onclick (não clicável)', () => {
  const app = freshApp();
  app.games.push({ id:'g1', teamId:'T1', date:'2026-10-20', time:'15:00', opp:'Destreza Aventura' });
  const html = homeHtml(app, 'a1');
  assert.ok(html.includes('⚽ Gameday'));
  assert.ok(html.includes('Próximo jogo: vs Destreza Aventura'));
  assert.ok(html.includes('15:00'));
  // o bloco específico do estado "normal" (cor neutra 148,163,184) nunca tem onclick
  const idx = html.indexOf('rgba(148,163,184,.08)');
  assert.ok(idx >= 0, 'bloco do estado normal deve existir');
  const snippet = html.slice(Math.max(0, idx-60), idx+40);
  assert.ok(!snippet.includes('onclick'), 'estado normal não deve ser clicável: ' + snippet);
});
test('sem nenhum jogo agendado: card "Gameday" não aparece, mas a tile Convocatória continua', () => {
  const html = homeHtml(freshApp(), 'a1');
  assert.ok(!html.includes('⚽ Gameday'));
  assert.ok(html.includes('Convocatórias'));
});
test('dia de jogo + convocada: card "Gameday" fica vermelho/ativo, abre _atOpenDiaJogo', () => {
  const app = freshApp();
  app.games.push({ id:'g1', teamId:'T1', date: ctx.FIXED_TODAY, time:'15:00', opp:'Destreza Aventura', convocatoriaLaunched:true });
  app.convocatorias.push({ id:'c1', gameId:'g1', athletes:['a1'], date: ctx.FIXED_TODAY });
  const html = homeHtml(app, 'a1');
  assert.ok(html.includes('Gameday — Hoje!'));
  assert.ok(html.includes("_atOpenDiaJogo('g1')"));
  assert.ok(!html.includes('Dia de Jogo!'), 'rótulo antigo da tile da grelha não deve mais existir');
});
test('dia de jogo + NÃO convocada: card "Gameday" fica azul, abre _atOpenGameDiaEquipa', () => {
  const app = freshApp();
  app.games.push({ id:'g1', teamId:'T1', date: ctx.FIXED_TODAY, time:'15:00', opp:'Destreza Aventura' });
  const html = homeHtml(app, 'a1');
  assert.ok(html.includes('Gameday — Hoje'));
  assert.ok(html.includes("_atOpenGameDiaEquipa('g1')"));
});
test('tile "Convocatória" da grelha é SEMPRE a versão normal, mesmo em dia de jogo', () => {
  const app = freshApp();
  app.games.push({ id:'g1', teamId:'T1', date: ctx.FIXED_TODAY, time:'15:00', opp:'Destreza Aventura', convocatoriaLaunched:true });
  app.convocatorias.push({ id:'c1', gameId:'g1', athletes:['a1'], date: ctx.FIXED_TODAY });
  const html = homeHtml(app, 'a1');
  assert.ok(html.includes('Convocatórias'), 'tile Convocatória continua presente na grelha');
  assert.ok(html.includes('Convocada!'), 'mostra o estado normal da convocatória');
  assert.strictEqual((html.match(/Convocatórias/g)||[]).length, 1, 'label da tile só aparece 1 vez (não duplicada)');
});
test('convocatória sem jogo hoje continua a navegar para a tab (não muda comportamento)', () => {
  const app = freshApp();
  app.convocatorias.push({ id:'c1', gameId:null, athletes:['a1'], date:'2026-10-25', published:true });
  const html = homeHtml(app, 'a1');
  assert.ok(html.includes("_atNavTo('convoc')"));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
