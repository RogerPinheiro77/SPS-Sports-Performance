// test_wellness_dup_fix_v231.js
// Harness Node (vm) para o pedido do Roger (16/10/2026): "VE O QUE SE PASSA COM OS
// QUESTIONARIOS WELNESS, APARENTEMENTE HOJE HOUVE ATLETAS COM DIFICULDADES EM
// SUBMETER". Investigação (SQL direto à Supabase) confirmou várias atletas com 2-3
// registos de wellness_records para o MESMO dia — nunca um erro de validação a
// bloquear a submissão, mas sim o formulário a ficar visualmente "em branco" depois
// de submeter (_wfVals reposto a 0), convidando a reintroduzir tudo, e cada
// resubmissão a gerar um id novo (uid()) em vez de atualizar o registo já existente,
// fazendo o cloudUpsert (upsert por id) criar uma linha nova na cloud em vez de
// atualizar a mesma. Este harness extrai e corre o CÓDIGO REAL de index.html (mesmo
// padrão de test_home_ginasio_rsvp_v225.js) — nunca reimplementa a lógica aqui.
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

// "Hoje" fixo a 16/10/2026 (data real do pedido do Roger).
const FIXED_NOW_MS = new Date(2026, 9, 16, 9, 0, 0, 0).getTime();
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

const BRIDGE_VARS = ['APP', 'AID', 'today', '_wfVals', '_sync'];
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
    config: { wellnessStart:'00:00', wellnessEnd:'23:59' }, // janela sempre aberta neste teste
    athletes:[{id:'a1',teamId:'T1',name:'Ana Teste'}],
    teams:[{id:'T1',name:'T1'}], wellness:[], pse:[], games:[], schedule:[],
  };
}
function resetWfVals(){ return {sleep:0,fatigue:0,stress:0,pain:0,mood:0,cycle:'',cycleImpact:0}; }
function setup(app, aid){
  ctx.$APP = app;
  ctx.$AID = aid;
  ctx.$_sync = false; // sem cloud nesta suite — foco no id/UI local, que é onde o bug vive
  ctx.$_wfVals = resetWfVals();
}
function fillForm(vals){
  Object.assign(ctx.$_wfVals, vals);
}
function wellnessHtml(){
  ctx.renderAtWellness();
  return ctx._getEl('atp-wellness').innerHTML;
}

(async () => {

console.log('\n[1] 1ª submissão do dia — id determinístico, nunca aleatório');
await test('entry.id segue o padrão w_<athleteId>_<data>, não um uid() aleatório', () => {
  const app = freshApp();
  setup(app, 'a1');
  fillForm({sleep:4,fatigue:3,stress:2,mood:4,pain:1});
  ctx.submitWellness();
  assert.strictEqual(app.wellness.length, 1, 'cria exatamente 1 registo');
  assert.strictEqual(app.wellness[0].id, 'w_a1_'+TD, 'id determinístico athleteId+data');
});

console.log('\n[2] Resubmissão no MESMO dispositivo/sessão — nunca duplica');
await test('resubmeter com _wfVals preenchido de novo atualiza o MESMO registo (mesmo id)', () => {
  const app = freshApp();
  setup(app, 'a1');
  fillForm({sleep:4,fatigue:3,stress:2,mood:4,pain:1});
  ctx.submitWellness();
  const idAfterFirst = app.wellness[0].id;
  // Resubmissão (mesmo padrão do bug relatado: a atleta preenche tudo outra vez porque
  // o formulário parecia vazio) — ainda no mesmo dispositivo, "existing" é encontrado.
  ctx.$_wfVals = resetWfVals();
  fillForm({sleep:3,fatigue:5,stress:4,mood:2,pain:2});
  ctx.submitWellness();
  assert.strictEqual(app.wellness.length, 1, 'continua a haver só 1 registo, nunca 2');
  assert.strictEqual(app.wellness[0].id, idAfterFirst, 'reaproveita o id já existente');
  assert.strictEqual(app.wellness[0].sleep, 3, 'os valores mais recentes substituem os antigos');
});

console.log('\n[3] Resubmissão depois de um pull "esquecer" localmente a submissão (a corrida de fundo documentada) — ainda assim nunca duplica');
await test('sem "existing" local (pull apagou a entrada em memória), o id cai sempre no MESMO determinístico', () => {
  const app = freshApp();
  setup(app, 'a1');
  fillForm({sleep:4,fatigue:3,stress:2,mood:4,pain:1});
  ctx.submitWellness();
  const idAfterFirst = app.wellness[0].id;
  // Simula exatamente a corrida identificada na investigação: pullCloud() (ex: depois de
  // >60s em 2º plano) sobrepôs APP.wellness com uma cópia da cloud que ainda não tinha
  // o cloudUpsert mais recente — a entrada de hoje "desaparece" da memória local.
  app.wellness = [];
  ctx.$_wfVals = resetWfVals();
  fillForm({sleep:2,fatigue:6,stress:5,mood:3,pain:3});
  ctx.submitWellness();
  assert.strictEqual(app.wellness.length, 1, 'mesmo sem "existing" local, não cria um 2º registo');
  assert.strictEqual(app.wellness[0].id, idAfterFirst, 'cai sempre no mesmo id determinístico — o upsert na cloud atualiza a mesma linha, nunca cria outra');
});

console.log('\n[4] Submissões de atletas diferentes no mesmo dia nunca colidem');
await test('ids determinísticos de 2 atletas diferentes no mesmo dia são distintos', () => {
  const app = freshApp();
  app.athletes.push({id:'a2',teamId:'T1',name:'Bruna Teste'});
  setup(app, 'a1');
  fillForm({sleep:4,fatigue:3,stress:2,mood:4,pain:1});
  ctx.submitWellness();
  ctx.$AID = 'a2';
  ctx.$_wfVals = resetWfVals();
  fillForm({sleep:5,fatigue:1,stress:1,mood:5,pain:0});
  ctx.submitWellness();
  assert.strictEqual(app.wellness.length, 2, '2 registos, um por atleta');
  const ids = app.wellness.map(w=>w.id);
  assert.notStrictEqual(ids[0], ids[1], 'ids diferentes para atletas diferentes');
});

console.log('\n[5] Validação de campos obrigatórios — regressão, comportamento inalterado');
await test('sem todos os campos obrigatórios preenchidos, continua a bloquear (toast err) e não grava', () => {
  const app = freshApp();
  setup(app, 'a1');
  fillForm({sleep:4,fatigue:0,stress:2,mood:4}); // fatigue em falta
  const result = ctx.submitWellness();
  assert.strictEqual(app.wellness.length, 0, 'nenhum registo criado sem todos os campos');
});

console.log('\n[6] Formulário já não aparece vazio depois de já ter submetido hoje');
await test('alreadyToday pré-preenche as escalas com a resposta já submetida (botão "on" na escala certa)', () => {
  const app = freshApp();
  setup(app, 'a1');
  fillForm({sleep:4,fatigue:3,stress:2,mood:4,pain:1});
  // submitWellness() já termina com a sua própria chamada a renderAtWellness() — o
  // pré-preenchimento novo entra em ação logo nessa chamada interna (_wfVals tinha
  // sido reposto a 0 um instante antes, dentro do próprio submitWellness()), por isso
  // o ecrã resultante já mostra as escalas com a resposta submetida destacada, nunca
  // em branco. Lê o HTML já gerado por essa chamada, sem precisar de renderizar de novo.
  ctx.submitWellness();
  const html = ctx._getEl('atp-wellness').innerHTML;
  // scaleHtml marca a classe "on" no botão cujo valor bate com _wfVals[k] — depois do
  // pré-preenchimento novo, tem de bater com o que já está gravado (sleep=4 → botão "4" on).
  // Nota: a onclick de cada botão contém "=>" (arrow function) — um "[^>]*" ingénuo
  // para o resto da tag confunde-se com esse ">" e nunca chega ao fecho real da tag.
  // Em vez de regex sobre a tag inteira, cada chunk entre "<button" já isola 1 botão.
  function onButtonValue(segment){
    const chunks = segment.split('<button').slice(1);
    for (const c of chunks) {
      if (c.startsWith(' class="wsb on"')) { const m = c.match(/>(\d+)<\/button>/); if (m) return m[1]; }
    }
    return null;
  }
  assert.strictEqual(onButtonValue(html.split('Sono')[1].split('Fadiga')[0]), '4', 'Sono pré-preenchido com 4 (on)');
  assert.strictEqual(onButtonValue(html.split('Fadiga')[1].split('Stress')[0]), '3', 'Fadiga pré-preenchido com 3 (on)');
});

await test('sem já ter submetido hoje, o formulário NÃO pré-preenche nada (fica a 0, como sempre)', () => {
  const app = freshApp();
  setup(app, 'a1');
  const html = wellnessHtml();
  assert.strictEqual(ctx.$_wfVals.sleep, 0, 'sem submissão de hoje, _wfVals continua a 0');
  assert.ok(!/al al-g/.test(html), 'sem aviso de "já submetido"');
});

console.log('\n[7] Rótulo do botão distingue 1ª submissão de atualização');
await test('botão diz "Submeter Questionário" antes da 1ª submissão de hoje', () => {
  const app = freshApp();
  setup(app, 'a1');
  const html = wellnessHtml();
  assert.ok(html.includes('Submeter Questionário'), 'rótulo de 1ª submissão presente');
  assert.ok(!html.includes('Atualizar Questionário'), 'ainda não é "Atualizar"');
});

await test('botão passa a "Atualizar Questionário" depois de já ter submetido hoje', () => {
  const app = freshApp();
  setup(app, 'a1');
  fillForm({sleep:4,fatigue:3,stress:2,mood:4,pain:1});
  ctx.submitWellness();
  const html = wellnessHtml();
  assert.ok(html.includes('Atualizar Questionário'), 'rótulo muda para "Atualizar"');
  assert.ok(!html.includes('>Submeter Questionário<'), 'já não mostra "Submeter" como rótulo do botão');
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed) process.exitCode = 1;

})();
