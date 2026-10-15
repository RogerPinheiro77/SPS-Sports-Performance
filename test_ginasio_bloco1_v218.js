// test_ginasio_bloco1_v218.js
// Harness Node (vm) para o "Bloco 1" de melhorias ao Ginásio (sps-v218): vídeo nos
// exercícios da Biblioteca (link externo), pesquisa textual na Biblioteca/pickers,
// blocos/superséries opcionais na Ficha, e Modo Apresentação ao vivo no Registo.
// Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_marker_evolution_v204.js) — nunca reimplementa a lógica aqui.
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
  let confirmAnswer = true;
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
    confirm(){ return confirmAnswer; },
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
  sandbox._setConfirmAnswer = (v) => { confirmAnswer = v; };
  return sandbox;
}

const BRIDGE_VARS = [
  'APP', '_libSearch', '_libCat', '_gsDraft', '_gymGridData', '_gymGridEventId', '_gymAccOpen',
  '_presFrames', '_presIdx', '_presKind', '_presCtx', '_CLOUD_TABLE_SCHEMA',
];
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
console.log('Loaded. Functions available:',
  ['_gymExResolve','renderBiblioteca','saveExercise','editExercise','pickExForGymSheet','_pickGsEx',
   '_renderGsDetail','_gymSheetPdfHtml','_gymGridTableHtml','_gymGridAccordionHtml','pickExForAthleteExtra',
   '_pickExtraEx','_presSvgFor','_presGymSlideHtml','_presRender','gymOpenPresentation','_stripAccents']
   .map(n => typeof ctx[n]).join(','));

function freshApp(){
  return {
    exercises:[], gymSheets:[], gymRecords:[], schedule:[], athletes:[], teams:[{id:'T1',name:'T1'}],
    attendance:[], convocatorias:[],
  };
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[1] Vídeo nos exercícios da Biblioteca');
test('_gymExResolve devolve videoUrl da Biblioteca (via exId) com fallback para o campo copiado na ficha', () => {
  ctx.$APP = freshApp();
  ctx.$APP.exercises.push({id:'ex1',name:'Squat',cat:'Ginásio',videoUrl:'https://youtube.com/squat'});
  const resolved = ctx._gymExResolve({exId:'ex1',name:'Squat'});
  assert.strictEqual(resolved.videoUrl, 'https://youtube.com/squat');
  // exercício apagado da Biblioteca — cai no fallback copiado na própria ficha
  const resolved2 = ctx._gymExResolve({exId:'missing',name:'Lunge',videoUrl:'https://vimeo.com/lunge'});
  assert.strictEqual(resolved2.videoUrl, 'https://vimeo.com/lunge');
  // sem nenhum dos dois
  const resolved3 = ctx._gymExResolve({name:'Plank'});
  assert.strictEqual(resolved3.videoUrl, '');
});
test('_CLOUD_TABLE_SCHEMA.exercises inclui video_url (coluna + rename)', () => {
  const schema = ctx.$_CLOUD_TABLE_SCHEMA.exercises;
  assert.ok(schema.cols.includes('video_url'), 'coluna video_url em falta');
  assert.strictEqual(schema.rename.videoUrl, 'video_url');
});
test('saveExercise grava videoUrl do campo lf-video', () => {
  ctx.$APP = freshApp();
  const els = {};
  ['lf-name','lf-cat','lf-muscles','lf-diff','lf-equip','lf-video','lf-desc','lf-img-box'].forEach(id=>{
    const el = makeFakeElement(); el.value=''; els[id]=el;
  });
  els['lf-name'].value='Deadlift'; els['lf-cat'].value='Ginásio'; els['lf-video'].value='https://youtube.com/dl';
  els['lf-img-box'].getAttribute = (k)=> k==='data-val' ? '' : undefined;
  ctx.document.getElementById = (id)=> els[id] || makeFakeElement();
  ctx._editLibId = null; ctx._showLibForm = true;
  ctx.saveExercise();
  assert.strictEqual(ctx.$APP.exercises.length, 1);
  assert.strictEqual(ctx.$APP.exercises[0].videoUrl, 'https://youtube.com/dl');
});

console.log('\n[2] Pesquisa textual (Biblioteca + pickers)');
test('renderBiblioteca filtra por nome, sem distinguir acentos/maiúsculas (_stripAccents)', () => {
  ctx.$APP = freshApp();
  ctx.$APP.exercises.push({id:'e1',name:'Agachamento Búlgaro',cat:'Ginásio'});
  ctx.$APP.exercises.push({id:'e2',name:'Prancha Lateral',cat:'Ginásio'});
  ctx.$_libCat=''; ctx.$_libSearch='bulgaro';
  let capturedHtml='';
  ctx.document.getElementById = (id)=>{ const el=makeFakeElement(); if(id==='pg-biblioteca'){ Object.defineProperty(el,'innerHTML',{get(){return capturedHtml;},set(v){capturedHtml=v;}}); } return el; };
  ctx.renderBiblioteca();
  assert.ok(capturedHtml.includes('Agachamento'), 'devia encontrar o exercício acentuado pesquisando sem acento');
  assert.ok(!capturedHtml.includes('Prancha Lateral'), 'não devia mostrar exercícios que não correspondem à pesquisa');
});
test('pickExForGymSheet / _renderPickGsList filtra por texto', () => {
  ctx.$APP = freshApp();
  ctx.$APP.exercises.push({id:'e1',name:'Leg Press',cat:'Ginásio'});
  ctx.$APP.exercises.push({id:'e2',name:'Remada',cat:'Ginásio'});
  ctx.$_gsDraft = {id:'gs1',title:'',phase:'Pré-época',notes:'',exercises:[]};
  let capturedHtml='';
  ctx.document.getElementById = (id)=>{ const el=makeFakeElement(); if(id==='pick-gs-list'){ Object.defineProperty(el,'innerHTML',{get(){return capturedHtml;},set(v){capturedHtml=v;}}); } return el; };
  ctx.pickExForGymSheet();
  ctx.window._pickGsSearch='remada';
  ctx.window._renderPickGsList();
  assert.ok(capturedHtml.includes('Remada'));
  assert.ok(!capturedHtml.includes('Leg Press'));
});
test('pickExForAthleteExtra / _renderPickExtraList filtra por texto', () => {
  ctx.$APP = freshApp();
  ctx.$APP.exercises.push({id:'e1',name:'Hip Thrust',cat:'Ginásio'});
  ctx.$APP.exercises.push({id:'e2',name:'Elevação de Panturrilha',cat:'Ginásio'});
  let capturedHtml='';
  ctx.document.getElementById = (id)=>{ const el=makeFakeElement(); if(id==='pick-extra-list'){ Object.defineProperty(el,'innerHTML',{get(){return capturedHtml;},set(v){capturedHtml=v;}}); } return el; };
  ctx.pickExForAthleteExtra('ath1');
  ctx.window._pickExtraSearch='panturrilha';
  ctx.window._renderPickExtraList();
  assert.ok(capturedHtml.includes('Panturrilha'));
  assert.ok(!capturedHtml.includes('Hip Thrust'));
});

console.log('\n[3] Pickers copiam videoUrl (e _pickGsEx também inicializa bloco vazio)');
test('_pickGsEx empurra videoUrl+bloco para _gsDraft.exercises', () => {
  ctx.$APP = freshApp();
  ctx.$APP.exercises.push({id:'e1',name:'Squat',cat:'Ginásio',videoUrl:'https://youtube.com/sq'});
  ctx.$_gsDraft = {id:'gs1',title:'',phase:'Pré-época',notes:'',exercises:[]};
  ctx._pickGsEx('e1');
  const pushed = ctx.$_gsDraft.exercises[0];
  assert.strictEqual(pushed.videoUrl, 'https://youtube.com/sq');
  assert.strictEqual(pushed.bloco, '');
});
test('_pickExtraEx empurra videoUrl para _gymGridData[athId].extraEx', () => {
  ctx.$APP = freshApp();
  ctx.$APP.exercises.push({id:'e1',name:'Lunge',cat:'Ginásio',videoUrl:'https://youtube.com/lg'});
  ctx.window._pickExtraAthId = 'ath1';
  ctx.$_gymGridData = {};
  ctx._pickExtraEx('e1');
  const pushed = ctx.$_gymGridData['ath1'].extraEx[0];
  assert.strictEqual(pushed.videoUrl, 'https://youtube.com/lg');
});

console.log('\n[4] Blocos/superséries — Ficha builder e Ficha PDF (nunca no Registo)');
test('_renderGsDetail mostra um cabeçalho de bloco quando o valor muda entre exercícios consecutivos', () => {
  ctx.$APP = freshApp();
  ctx.$_gsDraft = {id:'gs1',title:'Ficha A',phase:'Pré-época',notes:'',exercises:[
    {exId:null,name:'Squat',reps:'3x10',rir:'2',note:'',bloco:'Bloco A'},
    {exId:null,name:'Lunge',reps:'3x10',rir:'2',note:'',bloco:'Bloco A'},
    {exId:null,name:'Plank',reps:'3x40s',rir:'',note:'',bloco:''},
  ]};
  let capturedHtml='';
  ctx.document.getElementById = (id)=>{ const el=makeFakeElement(); if(id==='pg-fichas-ginasio'){ Object.defineProperty(el,'innerHTML',{get(){return capturedHtml;},set(v){capturedHtml=v;}}); } return el; };
  ctx._renderGsDetail();
  const occurrences = (capturedHtml.match(/Bloco: Bloco A/g)||[]).length;
  assert.strictEqual(occurrences, 1, 'o cabeçalho do bloco só deve aparecer 1 vez (no início do grupo), nunca repetido em cada exercício do mesmo bloco');
});
test('_gymSheetPdfHtml mostra o link de vídeo e o cabeçalho de bloco', () => {
  ctx.$APP = freshApp();
  const f = {id:'gs1',title:'Ficha A',phase:'Pré-época',notes:'',exercises:[
    {exId:null,name:'Squat',reps:'3x10',rir:'2',note:'',bloco:'Bloco A',videoUrl:'https://youtube.com/sq'},
    {exId:null,name:'Lunge',reps:'3x10',rir:'2',note:'',bloco:'Bloco A'},
  ]};
  const html = ctx._gymSheetPdfHtml(f);
  assert.ok(html.includes('youtube.com/sq'), 'devia incluir o link de vídeo em texto');
  assert.ok((html.match(/Bloco: Bloco A/g)||[]).length===1, 'cabeçalho de bloco só 1 vez no PDF');
});

console.log('\n[5] Registo (grelha) — ícone de vídeo, nunca agrupamento por bloco');
test('_gymGridTableHtml mostra 🎥 junto do nome quando o exercício tem vídeo (principal e extra)', () => {
  ctx.$APP = freshApp();
  const gs = {id:'gs1',title:'Ficha',exercises:[
    {exId:null,name:'Squat',reps:'3x10',rir:'2',videoUrl:'https://youtube.com/sq'},
    {exId:null,name:'Plank',reps:'3x40s',rir:''},
  ]};
  const athletes=[{id:'a1',name:'Atleta 1'}];
  ctx.$_gymGridData = {a1:{vals:[],obs:'',hiddenEx:[],extraEx:[{exId:null,name:'Extra X',videoUrl:'https://youtube.com/ex',val:{}}]}};
  const html = ctx._gymGridTableHtml(gs, athletes);
  assert.ok(html.includes('🎥'), 'devia conter o ícone de vídeo em pelo menos um sítio');
  // Plank não tem vídeo — não deve ganhar ícone associado a ela especificamente;
  // garantimos pelo menos que o nº de ícones bate com o nº de exercícios com vídeo (2: Squat + Extra X)
  const iconCount = (html.match(/🎥/g)||[]).length;
  assert.strictEqual(iconCount, 2);
});
test('_gymGridAccordionHtml mostra 🎥 junto do nome quando o exercício tem vídeo', () => {
  ctx.$APP = freshApp();
  const gs = {id:'gs1',title:'Ficha',exercises:[
    {exId:null,name:'Squat',reps:'3x10',rir:'2',videoUrl:'https://youtube.com/sq'},
  ]};
  const athletes=[{id:'a1',name:'Atleta 1'}];
  ctx.$_gymGridData = {a1:{vals:[],obs:'',hiddenEx:[],extraEx:[]}};
  ctx.$_gymGridEventId = null;
  ctx.$_gymAccOpen = 'a1';
  const html = ctx._gymGridAccordionHtml(gs, athletes);
  assert.ok(html.includes('🎥'));
});

console.log('\n[6] Modo Apresentação (gym) — early return antes do regex de style, nunca mexe em dados');
test('_presSvgFor com kind=gym devolve HTML (não SVG) via _presGymSlideHtml, com os seus próprios style="..." intactos', () => {
  ctx.$_presKind = 'gym';
  const ex = {name:'Squat',reps:'3x10',rir:'2',bloco:'Bloco A',videoUrl:'https://youtube.com/sq'};
  const html = ctx._presSvgFor(ex);
  assert.ok(html.includes('Squat'));
  assert.ok(html.includes('Bloco A'));
  assert.ok(html.includes('youtube.com/sq'));
  // confirma que não é um <svg> (branch diferente dos kinds pb/pitch)
  assert.ok(!html.trim().startsWith('<svg'));
  // confirma que o 1º style="..." não foi corrompido pelo regex genérico (continua a
  // ser o style do próprio div do slide, com display:flex — nunca "width:100%;height:100%;display:block"
  // que é o que o regex aplicaria a um SVG)
  const firstStyleMatch = html.match(/style="([^"]*)"/);
  assert.ok(firstStyleMatch && firstStyleMatch[1].includes('display:flex'), '1º style deveria ser o do slide, não reescrito pelo regex do SVG');
});
test('gymOpenPresentation usa gs.exercises como frames (sem personalização por atleta) e abre o overlay', () => {
  ctx.$APP = freshApp();
  const gs = {id:'gs1',title:'Ficha',exercises:[
    {exId:null,name:'Squat',reps:'3x10',rir:'2'},
    {exId:null,name:'Lunge',reps:'3x10',rir:'2'},
  ]};
  ctx.$APP.schedule.push({id:'ev1',type:'Ginásio',gymSheet:gs,teamId:'T1',date:'2026-10-14'});
  ctx.gymOpenPresentation('ev1');
  assert.strictEqual(ctx.$_presKind, 'gym');
  assert.strictEqual(ctx.$_presFrames.length, 2);
  assert.strictEqual(ctx.$_presFrames[0].name, 'Squat');
});
test('contador do Modo Apresentação mostra "Exercício X de N" para o kind gym (nunca "Passo")', () => {
  ctx.$APP = freshApp();
  const gs = {id:'gs1',title:'Ficha',exercises:[{name:'Squat',reps:'3x10'},{name:'Lunge',reps:'3x10'}]};
  ctx.$APP.schedule.push({id:'ev2',type:'Ginásio',gymSheet:gs,teamId:'T1',date:'2026-10-14'});
  let counterText='';
  const fakeStage = makeFakeElement();
  const fakeCounter = makeFakeElement();
  Object.defineProperty(fakeCounter,'textContent',{get(){return counterText;},set(v){counterText=v;}});
  const fakePrev = makeFakeElement(), fakeNext = makeFakeElement();
  ctx.document.getElementById = (id)=>{
    if(id==='pres-stage')return fakeStage;
    if(id==='pres-counter')return fakeCounter;
    if(id==='pres-prev')return fakePrev;
    if(id==='pres-next')return fakeNext;
    return makeFakeElement();
  };
  ctx.gymOpenPresentation('ev2');
  assert.ok(counterText.startsWith('Exercício'), 'contador devia começar por "Exercício", não "Passo": '+counterText);
  assert.ok(counterText.includes('1 de 2'));
});
test('abrir/navegar o Modo Apresentação (gym) nunca muta gs.exercises nem o evento', () => {
  ctx.$APP = freshApp();
  const gs = {id:'gs1',title:'Ficha',exercises:[{name:'Squat',reps:'3x10',rir:'2'},{name:'Lunge',reps:'3x10',rir:'2'}]};
  ctx.$APP.schedule.push({id:'ev3',type:'Ginásio',gymSheet:gs,teamId:'T1',date:'2026-10-14'});
  const before = JSON.stringify(ctx.$APP.schedule);
  ctx.document.getElementById = ()=>makeFakeElement();
  ctx.gymOpenPresentation('ev3');
  ctx.presNext(); ctx.presPrev(); ctx.presClose();
  const after = JSON.stringify(ctx.$APP.schedule);
  assert.strictEqual(before, after, 'Modo Apresentação nunca deve escrever em APP.schedule/gymSheet');
});

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
