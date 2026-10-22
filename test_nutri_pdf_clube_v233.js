// test_nutri_pdf_clube_v233.js
// Harness Node (vm) para o pedido do Roger: na aba Nutrição → Avaliações, manter o
// espaço de impressão já existente (renomeado "PDF Plantel (SPS)") e criar um novo
// "PDF Plantel (Clube)", fiel à folha de referência do clube — Atleta/Idade/Altura +
// Peso/Soma de Pregas por mês (intervalo escolhido) + "Avaliação" (texto curto,
// auto-sugerido ao registar, editável). Cor da Soma de Pregas relativa ao plantel
// (quartis, recalculados sempre) — nunca um limiar absoluto.
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

const BRIDGE_VARS = ['APP', '_SESSION', '_naAtId', '_showNaForm', '_CLOUD_TABLE_SCHEMA'];
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

function athlete(id, name, dob) {
  return { id, name, dob: dob || '2005-01-01' };
}
function aval(id, athleteId, date, weight, sumSkinfolds, height, clubNote) {
  return { id, athleteId, date, weight, sumSkinfolds, height: height!=null?height:170, clubNote: clubNote||'' };
}

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();

function seedApp(extra) {
  ctx.$APP = Object.assign({
    athletes: [athlete('a1','Joana Silva'), athlete('a2','Mariana Costa'), athlete('a3','Beatriz Lopes')],
    nutritionAssessments: [],
  }, extra || {});
}

// [1] _naClubNoteText — as combinações de tendência.
test('_naClubNoteText: diminuição de massa gorda e peso', () => {
  assert.strictEqual(ctx._naClubNoteText(60, 62, 40, 50), 'Diminuição % de massa gorda e peso corporal');
});
test('_naClubNoteText: só diminuição de massa gorda (peso estável)', () => {
  assert.strictEqual(ctx._naClubNoteText(60, 60, 40, 50), 'Diminuição % de massa gorda');
});
test('_naClubNoteText: aumento de massa gorda e peso', () => {
  assert.strictEqual(ctx._naClubNoteText(64, 60, 55, 50), 'Aumento % de massa gorda e peso corporal');
});
test('_naClubNoteText: só diminuição de peso (soma estável)', () => {
  assert.strictEqual(ctx._naClubNoteText(58, 62, 50, 50), 'Diminuição de peso corporal');
});
test('_naClubNoteText: estável (ambos iguais)', () => {
  assert.strictEqual(ctx._naClubNoteText(60, 60, 50, 50), 'Estável');
});
test('_naClubNoteText: sem dados de nenhum dos dois lados devolve vazio', () => {
  assert.strictEqual(ctx._naClubNoteText(null, null, null, null), '');
});
test('_naClubNoteText: sem avaliação anterior (null nos dois "prev") devolve vazio', () => {
  assert.strictEqual(ctx._naClubNoteText(60, null, 50, null), '');
});

// [2] _naQuartileColorer — quartis sobre o plantel.
test('_naQuartileColorer: com menos de 2 valores nunca dá cor', () => {
  const c0 = ctx._naQuartileColorer([]);
  const c1 = ctx._naQuartileColorer([42]);
  assert.strictEqual(c0(42), null);
  assert.strictEqual(c1(42), null);
});
test('_naQuartileColorer: 4 valores — menor fica verde, maior fica vermelho', () => {
  const c = ctx._naQuartileColorer([40, 50, 60, 70]);
  assert.strictEqual(c(40), 'g');
  assert.strictEqual(c(70), 'r');
});
test('_naQuartileColorer: valor null nunca rebenta, devolve null', () => {
  const c = ctx._naQuartileColorer([40, 50, 60, 70]);
  assert.strictEqual(c(null), null);
});

// [3] _naMonthsAvailable — meses únicos, ordenados.
test('_naMonthsAvailable devolve os meses únicos ordenados', () => {
  seedApp({ nutritionAssessments: [
    aval('e1','a1','2026-09-10',60,50), aval('e2','a2','2026-11-05',58,45), aval('e3','a1','2026-09-20',59,48),
  ]});
  assert.strictEqual(JSON.stringify(ctx._naMonthsAvailable()), JSON.stringify(['2026-09','2026-11']));
});

// [4] Botões renomeados/novos na página de Avaliações.
test('renderNutriAval mostra os 3 botões (Evolução / Plantel SPS / Plantel Clube)', () => {
  seedApp();
  let html = '';
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    if (id === 'pg-nutri-aval') {
      Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    }
    return el;
  };
  ctx.renderNutriAval();
  assert.ok(html.includes('🖨️ PDF Plantel (SPS)'), 'deve ter o botão renomeado "PDF Plantel (SPS)"');
  assert.ok(html.includes('🖨️ PDF Plantel (Clube)'), 'deve ter o novo botão "PDF Plantel (Clube)"');
  assert.ok(!html.includes('PDF Plantel (2 últimas)'), 'o rótulo antigo não deve sobreviver');
  assert.ok(html.includes('openNaPlantelClubePicker()'), 'o botão novo deve abrir o seletor de meses');
});

// [5] Sem avaliações, o picker avisa em vez de abrir um modal vazio.
test('openNaPlantelClubePicker sem avaliações avisa por toast e não chama openMod', () => {
  seedApp({ nutritionAssessments: [] });
  let toasted = null, opened = false;
  ctx.toast = (msg) => { toasted = msg; };
  ctx.openMod = () => { opened = true; };
  ctx.openNaPlantelClubePicker();
  assert.ok(toasted, 'deve avisar por toast');
  assert.ok(!opened, 'não deve abrir o modal sem dados');
});

// [6] Com avaliações, o picker abre com os 2 selects (De/Até) pré-preenchidos.
test('openNaPlantelClubePicker abre o modal com os meses disponíveis nos 2 selects', () => {
  seedApp({ nutritionAssessments: [
    aval('e1','a1','2026-09-10',60,50), aval('e2','a2','2026-10-05',58,45), aval('e3','a1','2026-11-20',59,48),
  ]});
  let modalBody = null;
  ctx.openMod = (title, body) => { modalBody = body; };
  ctx.openNaPlantelClubePicker();
  assert.ok(modalBody, 'deve ter chamado openMod com corpo');
  assert.ok(modalBody.includes('id="na-clube-from"') && modalBody.includes('id="na-clube-to"'));
  assert.ok(modalBody.includes('>Setembro 2026<') || modalBody.includes('Setembro 2026'));
});

// [7] printNaPlantelClubePDF — geração real da tabela, cores por quartil e Avaliação.
test('printNaPlantelClubePDF gera a tabela com meses/colunas, cor por quartil e Avaliação', () => {
  seedApp({
    athletes: [athlete('a1','Joana Silva'), athlete('a2','Mariana Costa'), athlete('a3','Beatriz Lopes'), athlete('a4','Carla Dias')],
    nutritionAssessments: [
      // Setembro: 4 atletas avaliadas — soma de pregas 40/50/60/70 (quartis bem definidos).
      aval('e1','a1','2026-09-10',60,40,170,''),
      aval('e2','a2','2026-09-10',58,50,165,''),
      aval('e3','a3','2026-09-10',62,60,172,''),
      aval('e4','a4','2026-09-10',55,70,160,''),
      // Outubro: só a1 e a4 (soma desceu para a1, subiu para a4).
      aval('e5','a1','2026-10-10',58,36,170,'Diminuição % de massa gorda e peso corporal'),
      aval('e6','a4','2026-10-10',56,75,160,'Aumento % de massa gorda'),
    ],
  });
  let title = null, body = null, landscape = null;
  ctx._printWin = (t, b, he, sl, land) => { title = t; body = b; landscape = land; };
  ctx.printNaPlantelClubePDF('2026-09','2026-10');
  assert.ok(body, 'deve ter chamado _printWin com corpo');
  assert.strictEqual(landscape, 'A3', 'deve usar A3 horizontal (tabela larga)');
  assert.ok(body.includes('Setembro 2026') && body.includes('Outubro 2026'), 'deve ter os 2 meses como grupos de coluna');
  assert.ok(body.includes('Idade') && body.includes('Altura') && body.includes('Avaliação'), 'colunas fixas da folha do clube');
  // Em Setembro, a1 (soma 40, menor) deve ficar verde (bg-g) e a4 (soma 70, maior) vermelho (bg-r).
  const iA1 = body.indexOf('Joana Silva');
  const iA4 = body.indexOf('Carla Dias');
  assert.ok(iA1 > -1 && iA4 > -1);
  const rowA1 = body.slice(iA1, iA1+600);
  const rowA4 = body.slice(iA4, iA4+600);
  assert.ok(rowA1.includes('bg-g') , 'a atleta com a menor soma de pregas do mês deve ficar no quartil verde');
  assert.ok(rowA4.includes('bg-r'), 'a atleta com a maior soma de pregas do mês deve ficar no quartil vermelho');
  // Avaliação = nota da avaliação mais recente dentro do intervalo (Outubro, para a1/a4).
  assert.ok(rowA1.includes('Diminuição % de massa gorda e peso corporal'));
  assert.ok(rowA4.includes('Aumento % de massa gorda'));
  // Atletas sem avaliação nesse mês (a2/a3 em Outubro) mostram "—", nunca uma célula vazia a rebentar o layout.
  const iA2 = body.indexOf('Mariana Costa');
  const rowA2 = body.slice(iA2, iA2+600);
  assert.ok(rowA2.includes('—'), 'sem avaliação em Outubro deve mostrar "—"');
});

// [8] Atletas sem NENHUMA avaliação no intervalo ficam fora da tabela, contadas no rodapé.
test('printNaPlantelClubePDF deixa fora da tabela quem não tem avaliação no intervalo', () => {
  seedApp({
    athletes: [athlete('a1','Joana Silva'), athlete('a2','Sem Avaliação Nenhuma')],
    nutritionAssessments: [aval('e1','a1','2026-09-10',60,40)],
  });
  let body = null;
  ctx._printWin = (t, b) => { body = b; };
  ctx.printNaPlantelClubePDF('2026-09','2026-09');
  assert.ok(!body.includes('Sem Avaliação Nenhuma'), 'atleta sem nenhuma avaliação não deve aparecer na tabela');
  assert.ok(body.includes('1 atleta sem avaliação no intervalo escolhido'), 'deve contar no rodapé');
});

// [9] saveNutriAval persiste o campo clubNote (auto-sugerido/editado no formulário).
test('saveNutriAval grava clubNote no registo', () => {
  seedApp();
  ctx.$_SESSION = { name: 'Teresa', userId: 'u1' };
  const values = {
    'na-at': 'a1', 'na-date': '2026-10-10', 'na-wt': '58', 'na-ht': '170', 'na-bmi': '20',
    'na-fat': '', 'na-mus': '', 'na-hyd': '', 'na-tri':'','na-bic':'','na-sub':'','na-sup':'',
    'na-abd':'','na-spe':'','na-cru':'','na-gem':'','na-sumpregas':'','na-braco':'','na-coxa':'',
    'na-pgem':'','na-cint':'','na-anc':'','na-whr':'','na-notes':'','na-athnote':'',
    'na-clubnote': 'Diminuição % de massa gorda',
  };
  ctx.document.getElementById = (id) => {
    const el = makeFakeElement();
    el.value = values[id] !== undefined ? values[id] : '';
    return el;
  };
  ctx.renderNutriAval = () => {};
  ctx.toast = () => {};
  ctx.saveNutriAval();
  const saved = ctx.$APP.nutritionAssessments.find(a => a.athleteId === 'a1' && a.date === '2026-10-10');
  assert.ok(saved, 'deve ter criado o registo');
  assert.strictEqual(saved.clubNote, 'Diminuição % de massa gorda');
});

// [10] _CLOUD_TABLE_SCHEMA.nutrition_records tem a coluna/rename club_note (push↔pull sem perdas).
test('_CLOUD_TABLE_SCHEMA.nutrition_records inclui club_note', () => {
  const schema = ctx.$_CLOUD_TABLE_SCHEMA.nutrition_records;
  assert.ok(schema.cols.includes('club_note'), 'coluna club_note deve estar na lista de push');
  assert.strictEqual(schema.rename.clubNote, 'club_note', 'rename clubNote->club_note deve existir');
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
