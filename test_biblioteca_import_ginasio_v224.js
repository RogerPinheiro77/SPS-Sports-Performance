// test_biblioteca_import_ginasio_v224.js
// Harness Node (vm) para a importação em massa da Biblioteca de Exercícios —
// categoria "Ginásio" (sps-v224): catálogo de referência (_GYM_IMPORT_CATALOG),
// picker com dedup por nome, importação sem duplicar, e o atalho
// "🔍 Procurar no YouTube" no formulário de edição de um exercício.
// Extrai e corre o CÓDIGO REAL de index.html (mesmo padrão de
// test_ginasio_tab_v219.js / test_ginasio_bloco1_v218.js) — nunca reimplementa
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

function makeFakeElement(initial) {
  const el = Object.assign({
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
  }, initial || {});
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
  let openedUrls = [];
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
  sandbox.window.open = (url) => { openedUrls.push(url); return {}; };
  sandbox.globalThis = sandbox;
  sandbox._getOpenedUrls = () => openedUrls;
  sandbox._clearOpenedUrls = () => { openedUrls = []; sandbox._getOpenedUrls = () => openedUrls; };
  return sandbox;
}

const BRIDGE_VARS = [
  'APP', '_libSearch', '_libCat', '_showLibForm', '_editLibId',
  '_showGymImportPicker', '_gymImportGrupo', '_gymImportUnchecked', '_sync',
  '_GYM_IMPORT_CATALOG', '_GYM_IMPORT_GRUPOS',
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
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) {
    failed++; failures.push({ name, err: e });
    console.log('  ✗', name, '\n      ', (e && e.stack) ? e.stack.split('\n').slice(0,3).join('\n       ') : e);
  }
}

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();
console.log('Loaded. Functions available:',
  ['_GYM_IMPORT_CATALOG','_GYM_IMPORT_GRUPOS','_gymImportIsDup','openGymImportPicker','closeGymImportPicker',
   '_gymImportToggle','_gymImportSetVisible','_gymImportPickerHtml','importGymExercisesSelected','_libSearchYoutube']
   .map(n => typeof ctx[n]).join(','));

function freshApp(){
  return { exercises:[], gymSheets:[], gymRecords:[], schedule:[], athletes:[], teams:[{id:'T1',name:'T1'}] };
}

(async () => {

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[1] Catálogo de referência (_GYM_IMPORT_CATALOG)');
await test('catálogo não está vazio, todas as entradas têm grupo/nome/músculos, e todas nascem sem videoUrl', () => {
  const cat = ctx.$_showGymImportPicker, catalog = ctx.$_GYM_IMPORT_CATALOG;
  assert.ok(Array.isArray(catalog) && catalog.length > 50, 'catálogo deve ter um número substancial de exercícios');
  catalog.forEach(e => {
    assert.ok(e.grupo && e.name && e.muscles, 'cada entrada deve ter grupo/nome/muscles: ' + JSON.stringify(e));
    assert.ok(!('videoUrl' in e), 'o catálogo de referência não deve ter videoUrl próprio — é sempre vazio na importação');
  });
});
await test('_GYM_IMPORT_GRUPOS deriva os grupos únicos do catálogo, sem duplicados', () => {
  const grupos = ctx.$_GYM_IMPORT_GRUPOS;
  const catalog = ctx.$_GYM_IMPORT_CATALOG;
  const expected = [...new Set(catalog.map(e => e.grupo))];
  // Comparação por valor (não por referência/protótipo): _GYM_IMPORT_GRUPOS é um
  // array criado dentro do vm context (outro "realm"), por isso deepStrictEqual
  // contra um array literal deste ficheiro falha por protótipo mesmo com o mesmo
  // conteúdo — mesmo cuidado já usado noutros testes deste ficheiro (JSON.stringify).
  assert.strictEqual(JSON.stringify(Array.from(grupos)), JSON.stringify(expected));
  assert.strictEqual(new Set(grupos).size, grupos.length);
});
await test('nomes do catálogo não têm duplicados entre si (cada exercício aparece uma só vez)', () => {
  const catalog = ctx.$_GYM_IMPORT_CATALOG;
  const names = catalog.map(e => e.name.trim().toLowerCase());
  assert.strictEqual(new Set(names).size, names.length, 'catálogo não devia ter nomes repetidos');
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[2] _gymImportIsDup — deteção de duplicados por nome, sem distinguir acentos/maiúsculas');
await test('exercício novo (nome não existe na Biblioteca-Ginásio) não é duplicado', () => {
  ctx.$APP = freshApp();
  const entry = ctx.$_GYM_IMPORT_CATALOG[0];
  assert.strictEqual(ctx._gymImportIsDup(entry), false);
});
await test('exercício já existente na categoria Ginásio (nome exato) é duplicado', () => {
  ctx.$APP = freshApp();
  const entry = ctx.$_GYM_IMPORT_CATALOG[0];
  ctx.$APP.exercises.push({id:'x1', cat:'Ginásio', name: entry.name});
  assert.strictEqual(ctx._gymImportIsDup(entry), true);
});
await test('deteção ignora acentos e maiúsculas/minúsculas', () => {
  ctx.$APP = freshApp();
  ctx.$APP.exercises.push({id:'x1', cat:'Ginásio', name:'agachamento livre com barra'});
  const entry = ctx.$_GYM_IMPORT_CATALOG.find(e => e.name === 'Agachamento Livre com Barra');
  assert.ok(entry, 'catálogo deve ter este exercício');
  assert.strictEqual(ctx._gymImportIsDup(entry), true);
});
await test('um exercício com o mesmo nome mas noutra categoria (ex: Físico) NÃO conta como duplicado', () => {
  ctx.$APP = freshApp();
  const entry = ctx.$_GYM_IMPORT_CATALOG[0];
  ctx.$APP.exercises.push({id:'x1', cat:'Físico', name: entry.name});
  assert.strictEqual(ctx._gymImportIsDup(entry), false, 'categorias diferentes não devem colidir na dedup');
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[3] openGymImportPicker / closeGymImportPicker — estado do picker');
await test('openGymImportPicker abre o picker e fecha o formulário de edição; closeGymImportPicker fecha o picker', () => {
  ctx.$APP = freshApp();
  ctx.$_showLibForm = true; ctx.$_editLibId = 'abc';
  ctx.document.getElementById = () => makeFakeElement();
  ctx.openGymImportPicker();
  assert.strictEqual(ctx.$_showGymImportPicker, true);
  assert.strictEqual(ctx.$_showLibForm, false);
  assert.strictEqual(ctx.$_editLibId, null);
  assert.strictEqual(ctx.$_gymImportGrupo, '');
  ctx.closeGymImportPicker();
  assert.strictEqual(ctx.$_showGymImportPicker, false);
});
await test('openGymImportPicker reinicia as seleções desmarcadas (_gymImportUnchecked) a cada abertura', () => {
  ctx.$APP = freshApp();
  ctx.document.getElementById = () => makeFakeElement();
  ctx.$_gymImportUnchecked = new Set([0,1,2]);
  ctx.openGymImportPicker();
  assert.strictEqual(ctx.$_gymImportUnchecked.size, 0);
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[4] _gymImportToggle / _gymImportSetVisible — seleção individual e em massa');
await test('_gymImportToggle(idx) alterna um índice dentro/fora do conjunto de desmarcados', () => {
  ctx.$APP = freshApp();
  ctx.document.getElementById = () => makeFakeElement();
  ctx.$_gymImportUnchecked = new Set();
  ctx._gymImportToggle(3);
  assert.ok(ctx.$_gymImportUnchecked.has(3));
  ctx._gymImportToggle(3);
  assert.ok(!ctx.$_gymImportUnchecked.has(3));
});
await test('_gymImportSetVisible(false) desmarca todos os visíveis (grupo atual), preservando outros grupos', () => {
  ctx.$APP = freshApp();
  ctx.document.getElementById = () => makeFakeElement();
  const catalog = ctx.$_GYM_IMPORT_CATALOG;
  const grupoA = catalog[0].grupo;
  ctx.$_gymImportGrupo = grupoA;
  ctx.$_gymImportUnchecked = new Set();
  ctx._gymImportSetVisible(false);
  catalog.forEach((e,i) => {
    if (e.grupo === grupoA) assert.ok(ctx.$_gymImportUnchecked.has(i), 'exercício do grupo visível devia ficar desmarcado: '+e.name);
    else assert.ok(!ctx.$_gymImportUnchecked.has(i), 'exercício de outro grupo não devia ser tocado: '+e.name);
  });
});
await test('_gymImportSetVisible(true) nunca marca um duplicado', () => {
  ctx.$APP = freshApp();
  ctx.document.getElementById = () => makeFakeElement();
  const catalog = ctx.$_GYM_IMPORT_CATALOG;
  const dupEntry = catalog[5];
  ctx.$APP.exercises.push({id:'d1', cat:'Ginásio', name: dupEntry.name});
  ctx.$_gymImportGrupo = '';
  ctx.$_gymImportUnchecked = new Set(catalog.map((e,i)=>i)); // tudo desmarcado inicialmente
  ctx._gymImportSetVisible(true);
  const dupIdx = catalog.indexOf(dupEntry);
  assert.ok(ctx.$_gymImportUnchecked.has(dupIdx), 'duplicado nunca deve ser marcado por "Marcar Todos"');
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[5] _gymImportPickerHtml — pré-visualização (sem efeitos de dados)');
await test('_gymImportPickerHtml devolve HTML com os exercícios visíveis, badge "Já existe" nos duplicados', () => {
  ctx.$APP = freshApp();
  const catalog = ctx.$_GYM_IMPORT_CATALOG;
  const dupEntry = catalog[2];
  ctx.$APP.exercises.push({id:'d1', cat:'Ginásio', name: dupEntry.name});
  ctx.$_gymImportGrupo = '';
  ctx.$_gymImportUnchecked = new Set();
  const html = ctx._gymImportPickerHtml();
  assert.ok(typeof html === 'string' && html.length > 100);
  assert.ok(html.includes('Já existe'), 'deve assinalar o exercício duplicado');
  assert.ok(html.includes('Sem vídeo'), 'deve mostrar o espaço reservado para o vídeo em todos os cards');
  assert.ok(!html.includes('undefined') && !html.includes('NaN'));
});
await test('_gymImportPickerHtml nunca muta APP nem o catálogo (é só leitura)', () => {
  ctx.$APP = freshApp();
  ctx.$APP.exercises.push({id:'e1', cat:'Ginásio', name:'Já lá estava'});
  ctx.$_gymImportGrupo = '';
  ctx.$_gymImportUnchecked = new Set();
  const beforeApp = JSON.stringify(ctx.$APP);
  const beforeCatalog = JSON.stringify(ctx.$_GYM_IMPORT_CATALOG);
  ctx._gymImportPickerHtml();
  assert.strictEqual(JSON.stringify(ctx.$APP), beforeApp);
  assert.strictEqual(JSON.stringify(ctx.$_GYM_IMPORT_CATALOG), beforeCatalog);
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[6] importGymExercisesSelected — importação real, sem duplicar, vídeo sempre vazio');
await test('importa todos os não-duplicados quando nada foi desmarcado', async () => {
  ctx.$APP = freshApp();
  ctx.$_gymImportUnchecked = new Set();
  ctx.document.getElementById = () => makeFakeElement();
  const catalogLen = ctx.$_GYM_IMPORT_CATALOG.length;
  await ctx.importGymExercisesSelected();
  assert.strictEqual(ctx.$APP.exercises.length, catalogLen);
  ctx.$APP.exercises.forEach(e => {
    assert.strictEqual(e.cat, 'Ginásio');
    assert.strictEqual(e.videoUrl, '', 'vídeo tem de nascer sempre vazio na importação');
    assert.ok(e.id, 'cada exercício importado precisa de um id próprio');
  });
  assert.strictEqual(ctx.$_showGymImportPicker, false, 'importar deve fechar o picker');
});
await test('nunca importa um exercício já existente (por nome, na categoria Ginásio)', async () => {
  ctx.$APP = freshApp();
  const catalog = ctx.$_GYM_IMPORT_CATALOG;
  const existing = catalog[1];
  ctx.$APP.exercises.push({id:'pre1', cat:'Ginásio', name: existing.name, videoUrl:'https://youtube.com/ja-tenho'});
  ctx.$_gymImportUnchecked = new Set();
  ctx.document.getElementById = () => makeFakeElement();
  await ctx.importGymExercisesSelected();
  const matches = ctx.$APP.exercises.filter(e => e.name === existing.name);
  assert.strictEqual(matches.length, 1, 'não deve duplicar o exercício já existente');
  assert.strictEqual(matches[0].id, 'pre1', 'o registo já existente (com o seu vídeo) não deve ser tocado/substituído');
  assert.strictEqual(matches[0].videoUrl, 'https://youtube.com/ja-tenho');
});
await test('respeita os exercícios desmarcados manualmente (_gymImportUnchecked)', async () => {
  ctx.$APP = freshApp();
  const catalog = ctx.$_GYM_IMPORT_CATALOG;
  ctx.$_gymImportUnchecked = new Set([0,1,2]);
  ctx.document.getElementById = () => makeFakeElement();
  await ctx.importGymExercisesSelected();
  assert.strictEqual(ctx.$APP.exercises.length, catalog.length - 3);
  [0,1,2].forEach(i => {
    assert.ok(!ctx.$APP.exercises.some(e => e.name === catalog[i].name), 'exercício desmarcado não devia ter sido importado: '+catalog[i].name);
  });
});
await test('re-importar depois de já ter importado tudo não cria segundas cópias (idempotente)', async () => {
  ctx.$APP = freshApp();
  ctx.$_gymImportUnchecked = new Set();
  ctx.document.getElementById = () => makeFakeElement();
  await ctx.importGymExercisesSelected();
  const afterFirst = ctx.$APP.exercises.length;
  ctx.$_gymImportUnchecked = new Set();
  await ctx.importGymExercisesSelected();
  assert.strictEqual(ctx.$APP.exercises.length, afterFirst, 'segunda importação não deve acrescentar nada — tudo já é duplicado');
});
await test('sem nada selecionado (tudo desmarcado), avisa e não importa nada', async () => {
  ctx.$APP = freshApp();
  const catalog = ctx.$_GYM_IMPORT_CATALOG;
  ctx.$_gymImportUnchecked = new Set(catalog.map((e,i)=>i));
  ctx.document.getElementById = () => makeFakeElement();
  await ctx.importGymExercisesSelected();
  assert.strictEqual(ctx.$APP.exercises.length, 0);
});
await test('importação nunca escreve equipamento/músculos indefinidos (sempre string, mesmo vazia)', async () => {
  ctx.$APP = freshApp();
  ctx.$_gymImportUnchecked = new Set();
  ctx.document.getElementById = () => makeFakeElement();
  await ctx.importGymExercisesSelected();
  ctx.$APP.exercises.forEach(e => {
    assert.strictEqual(typeof e.muscles, 'string');
    assert.strictEqual(typeof e.equip, 'string');
    assert.strictEqual(typeof e.desc, 'string');
  });
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[7] _libSearchYoutube — atalho de pesquisa no formulário de edição');
await test('abre a pesquisa do YouTube com o nome do campo "lf-name" codificado no URL', () => {
  ctx._clearOpenedUrls();
  const els = { 'lf-name': makeFakeElement({ value: 'Agachamento Livre com Barra' }) };
  ctx.document.getElementById = (id) => els[id] || makeFakeElement();
  ctx._libSearchYoutube();
  const urls = ctx._getOpenedUrls();
  assert.strictEqual(urls.length, 1);
  assert.ok(urls[0].startsWith('https://www.youtube.com/results?search_query='));
  assert.ok(urls[0].includes(encodeURIComponent('Agachamento Livre com Barra')));
});
await test('sem nome preenchido, não abre nada (evita pesquisa vazia)', () => {
  ctx._clearOpenedUrls();
  const els = { 'lf-name': makeFakeElement({ value: '  ' }) };
  ctx.document.getElementById = (id) => els[id] || makeFakeElement();
  ctx._libSearchYoutube();
  assert.strictEqual(ctx._getOpenedUrls().length, 0);
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`Resultado: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) {
  console.log('\nFalhas:');
  failures.forEach(f => console.log(' -', f.name));
  process.exit(1);
}

})();
