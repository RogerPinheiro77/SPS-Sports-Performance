// test_nutri_pdf_tabs_v234.js
// Harness Node (vm) para o pedido do Roger: "preciso para todas as abas que ves no print
// o seu espaço para exportação de pdf, por atleta e geral para aqueles que te fizer
// sentido" — screenshot da aba Nutrição com 5 separadores (Planos Nutricionais, Anamnese
// & Diário Alimentar, Plano Dia de Jogo, Matchday Hydration, Suplementação). Suplementação
// já tinha individual+plantel; esta versão acrescenta PDF individual+plantel a Planos
// Nutricionais e Matchday Hydration, só plantel a Anamnese & Diário (o individual já
// existia), e só plantel/geral ao Plano Dia de Jogo (plano único da equipa, nunca por
// atleta — confirmado com o Roger via AskUserQuestion). Extrai e corre o CÓDIGO REAL de
// index.html (mesmo padrão de test_nutri_pdf_clube_v233.js) — nunca reimplementa a lógica.
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

const BRIDGE_VARS = ['APP', '_hydraSelAthlete', '_hydraSelGame'];
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

function athlete(id, name, extra) {
  return Object.assign({ id, name, dob: '2005-01-01' }, extra || {});
}

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();

function seedApp(extra) {
  ctx.$APP = Object.assign({
    athletes: [athlete('a1','Joana Silva',{pos:'MC',num:8}), athlete('a2','Mariana Costa',{pos:'DC',num:4})],
    nutritionPlans: [],
    nutritionDietAnamnesis: [],
    nutritionGameDayPlan: null,
    hydrationRecords: [],
    games: [],
    config: {},
    users: [],
  }, extra || {});
}

// ─── [1] printNutriPlanoPDF — individual, por plano/atleta ──────────────────────
test('printNutriPlanoPDF: plano ativo com macros/refeições/responsável', () => {
  seedApp({
    nutritionPlans: [{
      id:'p1', athleteId:'a1', name:'Plano Competição', objective:'Definição',
      kcal:2000, protein:150, carbs:200, fat:60, active:true, startDate:'2026-09-01',
      meals:[{name:'Almoço',time:'13:00',kcal:600,foods:'Arroz, frango, salada'},{name:'Jantar',time:'',kcal:'',foods:''}],
      responsavelName:'Teresa Ferreira',
    }],
  });
  let title=null, body=null, landscape=undefined;
  ctx._printWin = (t,b,he,sl,land) => { title=t; body=b; landscape=land; };
  ctx.printNutriPlanoPDF('p1');
  assert.strictEqual(title, 'Plano Nutricional — Joana Silva');
  assert.ok(body.includes('Joana Silva'));
  assert.ok(body.includes('Plano Competição'));
  assert.ok(body.includes('Definição'));
  assert.ok(body.includes('2000'));
  assert.ok(body.includes('Arroz, frango, salada'));
  assert.ok(body.includes('Plano ativo'));
  assert.ok(body.includes('Teresa Ferreira'));
  // Refeição sem foods (Jantar) é filtrada, nunca aparece em branco.
  assert.ok(!body.includes('🌙 Jantar'));
  assert.strictEqual(landscape, undefined, 'PDF individual de plano é sempre portrait (sem landscape)');
});

test('printNutriPlanoPDF: plano inativo, sem responsável, sem refeições detalhadas', () => {
  seedApp({
    nutritionPlans: [{ id:'p2', athleteId:'a2', name:'Plano Base', active:false, meals:[] }],
  });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printNutriPlanoPDF('p2');
  assert.ok(body.includes('Plano inativo'));
  assert.ok(body.includes('Sem refeições detalhadas.'));
  assert.ok(!body.includes('Responsável'));
});

test('printNutriPlanoPDF: planId inexistente nunca chama _printWin', () => {
  seedApp();
  let called=false;
  ctx._printWin = () => { called=true; };
  ctx.printNutriPlanoPDF('nope');
  assert.ok(!called);
});

test('printNutriPlanoPDF: plano com atleta inexistente (atleta apagada) nunca chama _printWin', () => {
  seedApp({ nutritionPlans: [{ id:'p3', athleteId:'ghost', name:'X', active:true, meals:[] }] });
  let called=false;
  ctx._printWin = () => { called=true; };
  ctx.printNutriPlanoPDF('p3');
  assert.ok(!called);
});

// ─── [2] printNutriPlanosPlantelPDF — resumo de macros de todo o plantel ─────────
test('printNutriPlanosPlantelPDF: plantel misto (com/sem plano ativo), landscape e rodapé', () => {
  seedApp({
    athletes: [athlete('a1','Joana Silva',{num:8}), athlete('a2','Mariana Costa',{num:4}), athlete('a3','Beatriz Lopes',{num:1})],
    nutritionPlans: [
      { id:'p1', athleteId:'a1', name:'Plano A', objective:'Definição', kcal:2000, protein:150, carbs:200, fat:60, active:true, startDate:'2026-09-01' },
      { id:'p0', athleteId:'a1', name:'Plano Antigo', active:false, startDate:'2026-01-01' },
      { id:'p2', athleteId:'a2', name:'Plano B', objective:'Manutenção', kcal:1900, protein:140, carbs:190, fat:55, active:true, startDate:'2026-08-01' },
    ],
  });
  let body=null, landscape=undefined;
  ctx._printWin = (t,b,he,sl,land) => { body=b; landscape=land; };
  ctx.printNutriPlanosPlantelPDF();
  assert.strictEqual(landscape, true, 'PDF plantel de planos usa paisagem A4');
  assert.ok(body.includes('Joana Silva') && body.includes('Mariana Costa') && body.includes('Beatriz Lopes'));
  assert.ok(body.includes('Plano A') && body.includes('Plano B'));
  assert.ok(!body.includes('Plano Antigo'), 'só o plano ativo mais recente entra, nunca um inativo');
  assert.ok(body.includes('Sem plano ativo'), 'Beatriz Lopes (sem nenhum plano) mostra o aviso');
  assert.ok(body.includes('2 de 3 atletas com plano ativo'));
});

test('printNutriPlanosPlantelPDF: atleta com 2 planos ativos usa o de startDate mais recente', () => {
  seedApp({
    athletes: [athlete('a1','Joana Silva',{num:8})],
    nutritionPlans: [
      { id:'old', athleteId:'a1', name:'Plano Velho', kcal:1800, active:true, startDate:'2026-05-01' },
      { id:'new', athleteId:'a1', name:'Plano Novo', kcal:2100, active:true, startDate:'2026-10-01' },
    ],
  });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printNutriPlanosPlantelPDF();
  assert.ok(body.includes('Plano Novo'));
  assert.ok(!body.includes('Plano Velho'));
  assert.ok(body.includes('2100'));
});

test('printNutriPlanosPlantelPDF: sem nenhum atleta mostra estado vazio na tabela', () => {
  seedApp({ athletes: [] });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printNutriPlanosPlantelPDF();
  assert.ok(body.includes('Sem atletas no plantel'));
});

// ─── [3] renderNutriPlanos — botões de UI (header + por cartão) ─────────────────
test('renderNutriPlanos: header tem "PDF Plantel" + "Novo Plano"; cada cartão tem o botão de imprimir', () => {
  seedApp({
    nutritionPlans: [{ id:'p1', athleteId:'a1', name:'Plano A', active:true, meals:[] }],
  });
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-nutri-planos') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.renderNutriPlanos();
  assert.ok(html.includes('onclick="printNutriPlanosPlantelPDF()"'), 'botão de PDF Plantel no cabeçalho');
  assert.ok(html.includes("onclick=\"printNutriPlanoPDF('p1')\""), 'botão de imprimir no cartão do plano');
  assert.ok(html.includes('+ Novo Plano'), 'botão de criar novo plano continua presente');
});

// ─── [4] printNutriAnamneseDiarioPlantelPDF — checklist de estado ────────────────
test('printNutriAnamneseDiarioPlantelPDF: anamnese preenchida + diário definido para uma atleta, nada para a outra', () => {
  const planWithDiario = { id:'p1', athleteId:'a1', active:true, weekMeals:{ Seg:[{name:'Almoço',time:'',kcal:'',foods:'Arroz e frango'}] } };
  seedApp({
    nutritionDietAnamnesis: [ { athleteId:'a1', selfReport:{}, selfReportUpdatedAt:'2026-10-01T10:00:00.000Z', nutriNotes:'' } ],
    nutritionPlans: [planWithDiario],
  });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printNutriAnamneseDiarioPlantelPDF();
  assert.ok(body.includes('✅'), 'a1 tem anamnese preenchida e diário definido, com vistos verdes');
  assert.ok(body.includes('Por preencher'), 'a2 nunca preencheu a anamnese');
  assert.ok(body.includes('Não definido'), 'a2 não tem diário semanal definido');
  assert.ok(body.includes('1 de 2 atletas com anamnese preenchida'));
  assert.ok(body.includes('1 de 2 com diário alimentar semanal já definido pela Nutri'));
});

test('printNutriAnamneseDiarioPlantelPDF: plano ativo sem nenhuma refeição com conteúdo não conta como diário definido', () => {
  seedApp({
    nutritionPlans: [{ id:'p1', athleteId:'a1', active:true, weekMeals:{ Seg:[{name:'Almoço',time:'',kcal:'',foods:''}] } }],
  });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printNutriAnamneseDiarioPlantelPDF();
  assert.ok(body.includes('0 de 2 com diário alimentar semanal já definido pela Nutri'));
});

test('printNutriAnamneseDiarioPlantelPDF: sem atletas mostra estado vazio', () => {
  seedApp({ athletes: [] });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printNutriAnamneseDiarioPlantelPDF();
  assert.ok(body.includes('Sem atletas no plantel'));
});

// ─── [5] renderNutriAnamneseDiario — botão de PDF Plantel no cabeçalho ───────────
test('renderNutriAnamneseDiario: cabeçalho tem o botão "PDF Plantel"', () => {
  seedApp();
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-nutri-anamnese-diario') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.renderNutriAnamneseDiario();
  assert.ok(html.includes('onclick="printNutriAnamneseDiarioPlantelPDF()"'));
  assert.ok(html.includes('🖨️ PDF Plantel'));
});

// ─── [6] printNutriGamedayPDF — plano único e comum à equipa ────────────────────
test('printNutriGamedayPDF: sem nenhum campo personalizado usa sempre o texto genérico', () => {
  seedApp({ nutritionGameDayPlan: null });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printNutriGamedayPDF();
  assert.ok(body.includes('Texto genérico'));
  assert.ok(!body.includes('Personalizado'));
  assert.ok(body.includes('Ainda sem nenhum campo personalizado'));
  // Texto genérico efetivo de "Ao acordar" (_DJ_NUTRI_DEFAULTS.wake) deve aparecer.
  assert.ok(body.includes('Hidrata bem'));
});

test('printNutriGamedayPDF: com campos personalizados mostra o selo "Personalizado" e a data', () => {
  seedApp({
    nutritionGameDayPlan: {
      id:'gameday-x', wake:'Bebe 600ml de água ao acordar.', preGameMeal:'', hydration:'', snack:'', postGame:'',
      updatedAt:'2026-10-20T09:00:00.000Z', updatedBy:'Teresa Ferreira',
    },
  });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printNutriGamedayPDF();
  assert.ok(body.includes('Bebe 600ml de água ao acordar.'));
  assert.ok(body.includes('Personalizado'));
  assert.ok(body.includes('Texto genérico'), 'os campos ainda vazios continuam a mostrar o selo genérico');
  assert.ok(body.includes('Teresa Ferreira'));
});

// ─── [7] renderNutriGameday — botão de imprimir no cartão ───────────────────────
test('renderNutriGameday: cartão tem o botão "🖨️ Imprimir"', () => {
  seedApp();
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-nutri-gameday') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.renderNutriGameday();
  assert.ok(html.includes('onclick="printNutriGamedayPDF()"'));
  assert.ok(html.includes('🖨️ Imprimir'));
});

// ─── [8] printHydraIndividualPDF — ficha de um jogo específico ──────────────────
test('printHydraIndividualPDF: sem registo guardado avisa por toast e não chama _printWin', () => {
  seedApp({ games: [{ id:'g1', opp:'FC Tadim', date:'2026-10-18' }] });
  let toasted=null, called=false;
  ctx.toast = (msg) => { toasted=msg; };
  ctx._printWin = () => { called=true; };
  ctx.printHydraIndividualPDF('a1','g1');
  assert.ok(toasted);
  assert.ok(!called);
});

test('printHydraIndividualPDF: com registo guardado — KPIs, semáforo de perda de peso e reposição', () => {
  seedApp({
    games: [{ id:'g1', opp:'FC Tadim', date:'2026-10-18' }],
    hydrationRecords: [{ id:'hy1', athleteId:'a1', gameId:'g1', preWeight:60, postWeight:58.8, fluidsL:0.5, urineL:0, durationH:1.5, notes:'Sentiu-se bem.' }],
  });
  let title=null, body=null;
  ctx._printWin = (t,b) => { title=t; body=b; };
  ctx.printHydraIndividualPDF('a1','g1');
  assert.strictEqual(title, 'Matchday Hydration — Joana Silva');
  assert.ok(body.includes('FC Tadim'));
  assert.ok(body.includes('60 kg'));
  assert.ok(body.includes('58.8 kg'));
  assert.ok(body.includes('Perda de peso:'));
  assert.ok(body.includes('Sentiu-se bem.'));
});

test('printHydraIndividualPDF: ganho de peso mostra o aviso próprio (nunca "dentro do objetivo")', () => {
  seedApp({
    games: [{ id:'g1', opp:'FC Tadim', date:'2026-10-18' }],
    hydrationRecords: [{ id:'hy1', athleteId:'a1', gameId:'g1', preWeight:60, postWeight:60.5, fluidsL:1, urineL:0, durationH:1.5 }],
  });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printHydraIndividualPDF('a1','g1');
  assert.ok(body.includes('bg-y'));
  assert.ok(body.includes('Ganhou peso'));
});

test('printHydraIndividualPDF: jogo não identificado (gameId sem correspondência) não rebenta', () => {
  seedApp({
    games: [],
    hydrationRecords: [{ id:'hy1', athleteId:'a1', gameId:'gX', preWeight:60, postWeight:59, durationH:1 }],
  });
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printHydraIndividualPDF('a1','gX');
  assert.ok(body.includes('Jogo não identificado'));
});

// ─── [9] printHydraPlantelPDF — checklist de plantel num jogo escolhido ─────────
test('printHydraPlantelPDF: sem jogo escolhido (_hydraSelGame vazio) avisa por toast', () => {
  seedApp();
  ctx.$_hydraSelGame = null;
  let toasted=null, called=false;
  ctx.toast = (msg) => { toasted=msg; };
  ctx._printWin = () => { called=true; };
  ctx.printHydraPlantelPDF();
  assert.ok(toasted);
  assert.ok(!called);
});

test('printHydraPlantelPDF: com jogo escolhido — algumas atletas com registo, outras sem', () => {
  seedApp({
    athletes: [athlete('a1','Joana Silva',{num:8}), athlete('a2','Mariana Costa',{num:4})],
    games: [{ id:'g1', opp:'FC Tadim', date:'2026-10-18' }],
    hydrationRecords: [{ id:'hy1', athleteId:'a1', gameId:'g1', preWeight:60, postWeight:58.8, fluidsL:0.5, urineL:0, durationH:1.5, sweatRate:0.5 }],
  });
  ctx.$_hydraSelGame = 'g1';
  let body=null, landscape=undefined;
  ctx._printWin = (t,b,he,sl,land) => { body=b; landscape=land; };
  ctx.printHydraPlantelPDF();
  assert.strictEqual(landscape, 'A3', 'PDF plantel de hidratação usa A3 horizontal');
  assert.ok(body.includes('FC Tadim'));
  assert.ok(body.includes('Joana Silva') && body.includes('Mariana Costa'));
  assert.ok(body.includes('Sem registo'), 'Mariana Costa (sem registo neste jogo) mostra o aviso');
  assert.ok(body.includes('1 de 2 atletas com registo neste jogo'));
});

test('printHydraPlantelPDF: sem nenhum atleta no plantel mostra o estado vazio da tabela', () => {
  seedApp({ athletes: [], games: [{ id:'g1', opp:'FC Tadim', date:'2026-10-18' }] });
  ctx.$_hydraSelGame = 'g1';
  let body=null;
  ctx._printWin = (t,b) => { body=b; };
  ctx.printHydraPlantelPDF();
  assert.ok(body.includes('Sem atletas no plantel'));
});

// ─── [10] _hidratacaoCore — botão de plantel sempre visível, individual condicional ──
test('_hidratacaoCore: botão "PDF Plantel (Jogo)" sempre presente no cabeçalho', () => {
  seedApp({ games: [{ id:'g1', opp:'FC Tadim', date:'2026-10-18' }] });
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-nutri-hidratacao') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.$_hydraSelAthlete = null; ctx.$_hydraSelGame = null;
  ctx.renderNutriHidratacao();
  assert.ok(html.includes('onclick="printHydraPlantelPDF()"'));
  assert.ok(html.includes('🖨️ PDF Plantel (Jogo)'));
  // Sem atleta+jogo escolhidos, o botão individual (que depende de um registo já guardado) não aparece.
  assert.ok(!html.includes("printHydraIndividualPDF("));
});

test('_hidratacaoCore: botão individual "🖨️ PDF" aparece só depois de já existir um registo guardado', () => {
  seedApp({
    athletes: [athlete('a1','Joana Silva')],
    games: [{ id:'g1', opp:'FC Tadim', date:'2026-10-18' }],
    hydrationRecords: [{ id:'hy1', athleteId:'a1', gameId:'g1', preWeight:60, postWeight:58.8, durationH:1.5 }],
  });
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-fisio-hidratacao') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.$_hydraSelAthlete = 'a1'; ctx.$_hydraSelGame = 'g1';
  ctx.renderFisioHidratacao();
  assert.ok(html.includes("onclick=\"printHydraIndividualPDF('a1','g1')\""), 'partilhado por Nutri e Fisio — testado aqui do lado do Fisio');
  assert.ok(html.includes('🖨️ PDF'));
});

test('_hidratacaoCore: sem atleta+jogo escolhidos, nenhum registo é possível — sem botão individual nem erro', () => {
  seedApp({ games: [] });
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-nutri-hidratacao') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.$_hydraSelAthlete = null; ctx.$_hydraSelGame = null;
  ctx.renderNutriHidratacao();
  assert.ok(html.includes('Escolhe a atleta e o jogo para registar peso e líquidos.'));
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
