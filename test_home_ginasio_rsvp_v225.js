// test_home_ginasio_rsvp_v225.js
// Harness Node (vm) para o pedido do Roger (15/10/2026): "quero que na app atleta
// onde esta definido o pré treino ginasio, tambem ai elas possam clicar e colocar
// se vai ou nao" — estender o RSVP (Vou/Não vou) do Ginásio, que só existia na
// Agenda, também à lista "Hoje" da Casa. Extrai e corre o CÓDIGO REAL de
// index.html (mesmo padrão de test_home_ginasio_card_v223.js) — nunca reimplementa
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

// "Hoje" fixo a 15/10/2026 — mesma data usada no resto da suite desta sessão
// (test_home_ginasio_card_v223.js), para os eventos "de hoje" caírem sempre no
// mesmo dia independentemente de quando este teste é corrido.
const FIXED_NOW_MS = new Date(2026, 9, 15, 10, 0, 0, 0).getTime();
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

const BRIDGE_VARS = ['APP', 'AID', 'today', '_atPage', '_atAgendaView', '_atAgendaDay', '_sync'];
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
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) {
    failed++; failures.push({ name, err: e });
    console.log('  ✗', name, '\n      ', (e && e.stack) ? e.stack.split('\n').slice(0,3).join('\n       ') : e);
  }
}

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();
const TD = ctx.FIXED_TODAY;

function freshApp(){
  return {
    exercises:[], gymSheets:[], gymRecords:[], schedule:[], athletes:[{id:'a1',teamId:'T1',name:'Ana Teste',dob:'2005-01-01'}],
    teams:[{id:'T1',name:'T1'}], games:[], convocatorias:[], wellness:[], pse:[], injuries:[],
    trainingPlans:[], extraTrainings:[], evalPeriods:[], evalResponses:[], nutritionPlans:[], codeOfConduct:null,
  };
}

function setup(app, aid){
  ctx.$APP = app;
  ctx.$AID = aid;
  ctx.$_sync = false;
}

function homeHtml(){
  ctx.renderAtHome();
  return ctx._getEl('atp-home').innerHTML;
}
function agendaDiaHtml(){
  ctx.$_atAgendaView = 'dia';
  ctx.$_atAgendaDay = TD;
  ctx.renderAtAgenda();
  return ctx._getEl('atp-agenda').innerHTML;
}

// Evento de Ginásio HOJE, com hora cedo o suficiente para a janela de 2h de prazo
// ainda não ter passado às 10:00 (FIXED_NOW) — horário real de fim de tarde.
function gymEventToday(extra){
  return Object.assign({ id:'ev-gym-1', type:'Ginásio', teamId:'T1', date:TD, time:'19:30', title:'PRÉ TREINO - GINASIO', location:'Academia Moreirense' }, extra||{});
}
function treinoEventToday(extra){
  return Object.assign({ id:'ev-tr-1', type:'Treino', teamId:'T1', date:TD, time:'18:00', title:'Treino de Equipa' }, extra||{});
}

(async () => {

console.log('\n[1] Lista "Hoje" da Casa mostra o bloco RSVP do Ginásio');
await test('evento de Ginásio hoje mostra "Vais ao ginásio?" + botões Vou/Não vou', () => {
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  const html = homeHtml();
  assert.ok(html.includes('Vais ao ginásio?'), 'devia mostrar o prompt de RSVP');
  assert.ok(html.includes("atGymRsvpYes('ev-gym-1')"), 'botão Vou devia chamar atGymRsvpYes');
  assert.ok(html.includes("atGymRsvpDeclineStart('ev-gym-1')"), 'botão Não vou devia chamar atGymRsvpDeclineStart');
});
await test('evento de Treino (não-Ginásio) hoje NÃO mostra o bloco RSVP', () => {
  const app = freshApp();
  app.schedule.push(treinoEventToday());
  setup(app, 'a1');
  const html = homeHtml();
  assert.ok(html.includes('Treino de Equipa'), 'o evento devia aparecer na lista');
  assert.ok(!html.includes('Vais ao ginásio?'), 'treino não deve ter o prompt de RSVP do Ginásio');
  assert.ok(!html.includes('atGymRsvpYes'), 'treino não deve ter botões de RSVP de Ginásio');
});
await test('Ginásio + Treino no mesmo dia: só o Ginásio tem RSVP, os dois aparecem', () => {
  const app = freshApp();
  app.schedule.push(treinoEventToday(), gymEventToday());
  setup(app, 'a1');
  const html = homeHtml();
  assert.ok(html.includes('Treino de Equipa') && html.includes('PRÉ TREINO - GINASIO'));
  const onlyOnePrompt = (html.match(/Vais ao ginásio\?/g) || []).length;
  assert.strictEqual(onlyOnePrompt, 1, 'devia haver só 1 prompt de RSVP, do evento de Ginásio');
});
await test('atleta já confirmada: Casa mostra "Confirmaste presença", não o prompt', () => {
  const app = freshApp();
  app.schedule.push(gymEventToday({ rsvp:{ a1:{ status:'yes', reason:'', respondedAt:new Date().toISOString() } } }));
  setup(app, 'a1');
  const html = homeHtml();
  assert.ok(html.includes('✅ Confirmaste presença'));
  assert.ok(!html.includes('Vais ao ginásio?'));
});

console.log('\n[2] RSVP a partir da Casa re-renderiza a Casa (nunca força a Agenda)');
await test('atGymRsvpYes chamado com _atPage="home" atualiza atp-home para "Confirmaste presença"', async () => {
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  ctx.$_atPage = 'home';
  homeHtml(); // 1ª renderização, prompt visível
  await ctx.atGymRsvpYes('ev-gym-1');
  const html = ctx._getEl('atp-home').innerHTML;
  assert.ok(html.includes('✅ Confirmaste presença'), 'atp-home devia ter sido redesenhado com a resposta');
  assert.strictEqual(app.schedule[0].rsvp.a1.status, 'yes');
});
await test('responder a partir da Casa não deixa o botão "preso" — nunca falha por não existir atp-agenda', async () => {
  // Regressão do bug que este pedido corrige: antes a função chamava sempre
  // renderAtAgenda(), que no fluxo real nem sempre tem o container visível/preenchido.
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  ctx.$_atPage = 'home';
  homeHtml();
  await assert.doesNotReject(() => ctx.atGymRsvpYes('ev-gym-1'));
});

console.log('\n[3] RSVP a partir da Agenda continua a funcionar (regressão)');
await test('atGymRsvpYes chamado com _atPage="agenda" atualiza atp-agenda', async () => {
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  ctx.$_atPage = 'agenda';
  agendaDiaHtml(); // 1ª renderização, prompt visível na Agenda
  await ctx.atGymRsvpYes('ev-gym-1');
  const html = ctx._getEl('atp-agenda').innerHTML;
  assert.ok(html.includes('✅ Confirmaste presença'), 'atp-agenda devia ter sido redesenhado com a resposta');
});
await test('responder a partir da Agenda nunca escreve em atp-home', async () => {
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  ctx.$_atPage = 'agenda';
  agendaDiaHtml();
  const before = ctx._getEl('atp-home') ? ctx._getEl('atp-home').innerHTML : undefined;
  await ctx.atGymRsvpYes('ev-gym-1');
  const after = ctx._getEl('atp-home') ? ctx._getEl('atp-home').innerHTML : undefined;
  assert.strictEqual(after, before, 'atp-home não devia ter sido tocado ao responder a partir da Agenda');
});

console.log('\n[4] Fluxo de "Não vou" (motivo) a partir da Casa');
await test('DeclineStart mostra o seletor de motivo na Casa', () => {
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  ctx.$_atPage = 'home';
  homeHtml();
  ctx.atGymRsvpDeclineStart('ev-gym-1');
  const html = ctx._getEl('atp-home').innerHTML;
  assert.ok(html.includes('gym-rsvp-reason-ev-gym-1'), 'devia mostrar o <select> de motivo');
});
await test('DeclineConfirm sem motivo não grava e mostra erro', async () => {
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  ctx.$_atPage = 'home';
  homeHtml();
  ctx.atGymRsvpDeclineStart('ev-gym-1');
  homeHtml();
  ctx.document.getElementById('gym-rsvp-reason-ev-gym-1').value = '';
  await ctx.atGymRsvpDeclineConfirm('ev-gym-1');
  assert.ok(!app.schedule[0].rsvp, 'não devia ter gravado nada sem motivo escolhido');
});
await test('DeclineConfirm com motivo grava "no" e volta a redesenhar a Casa', async () => {
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  ctx.$_atPage = 'home';
  homeHtml();
  ctx.atGymRsvpDeclineStart('ev-gym-1');
  homeHtml();
  ctx.document.getElementById('gym-rsvp-reason-ev-gym-1').value = 'lesao';
  await ctx.atGymRsvpDeclineConfirm('ev-gym-1');
  assert.strictEqual(app.schedule[0].rsvp.a1.status, 'no');
  assert.strictEqual(app.schedule[0].rsvp.a1.reason, 'lesao');
  const html = ctx._getEl('atp-home').innerHTML;
  assert.ok(html.includes('❌ Avisaste que não vais'));
});
await test('DeclineCancel volta ao prompt Vou/Não vou, sem gravar nada', () => {
  const app = freshApp();
  app.schedule.push(gymEventToday());
  setup(app, 'a1');
  ctx.$_atPage = 'home';
  homeHtml();
  ctx.atGymRsvpDeclineStart('ev-gym-1');
  ctx.atGymRsvpDeclineCancel('ev-gym-1');
  const html = ctx._getEl('atp-home').innerHTML;
  assert.ok(html.includes('Vais ao ginásio?'));
  assert.ok(!app.schedule[0].rsvp);
});

console.log('\n[5] "Mudar resposta" (reset) a partir da Casa');
await test('atGymRsvpReset limpa a resposta e volta a mostrar o prompt na Casa', async () => {
  const app = freshApp();
  app.schedule.push(gymEventToday({ rsvp:{ a1:{ status:'yes', reason:'', respondedAt:new Date().toISOString() } } }));
  setup(app, 'a1');
  ctx.$_atPage = 'home';
  homeHtml();
  await ctx.atGymRsvpReset('ev-gym-1');
  assert.ok(!app.schedule[0].rsvp.a1, 'resposta devia ter sido removida');
  const html = ctx._getEl('atp-home').innerHTML;
  assert.ok(html.includes('Vais ao ginásio?'), 'devia voltar a mostrar o prompt depois do reset');
});

console.log('\n[6] Prazo terminado (2h antes) — nunca aceita resposta nova nem reset');
await test('depois do prazo, a Casa mostra aviso de prazo terminado em vez do prompt', () => {
  const app = freshApp();
  // FIXED_NOW = 15/10/2026 10:00 — evento às 09:00 já passou o prazo de 2h (07:00).
  app.schedule.push(gymEventToday({ time:'09:00' }));
  setup(app, 'a1');
  const html = homeHtml();
  assert.ok(html.includes('Prazo de resposta terminado'));
  assert.ok(!html.includes('Vais ao ginásio?'));
});
await test('atGymRsvpYes depois do prazo não altera o registo', async () => {
  const app = freshApp();
  app.schedule.push(gymEventToday({ time:'09:00' }));
  setup(app, 'a1');
  ctx.$_atPage = 'home';
  homeHtml();
  await ctx.atGymRsvpYes('ev-gym-1');
  assert.ok(!app.schedule[0].rsvp, 'não devia ter gravado resposta depois do prazo');
});

})().then(() => {
  console.log(`\nResultado: ${passed} passaram, ${failed} falharam.`);
  if (failed) process.exit(1);
});
