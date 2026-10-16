// test_wellness_report_pagination_v232.js
// Harness Node (vm) para o pedido do Roger (16/10/2026): "A QUESTAO É QUE QUANDO TENTO
// ACEDER AOS DADOS DE HOJE, DA SEM DADOS" — o relatório de Wellness (Relatórios &
// Exportações) continuava a mostrar "Sem dados para imprimir" para o dia de hoje mesmo
// depois de recarregar a página. Investigação: um fetch real ao Supabase (anon key, via
// browser, mesmo pedido que pullCloud() faz) confirmou que o endpoint devolvia sempre
// 200 OK mas CORTADO em exatamente 1000 linhas — a tabela wellness_records do Moreirense
// tinha acabado de passar das 1000 linhas (1020 no total), e o pedido antigo
// (select('*').eq('club_id',_cid), sem order nem paginação) nunca pedia mais do que esse
// limite por defeito do Supabase/PostgREST (db-max-rows=1000). Sem ORDER BY, a ordem
// devolvida não é garantida, mas na prática ficavam de fora exatamente os registos mais
// recentes — os de hoje. Este harness extrai e corre o CÓDIGO REAL de index.html (mesmo
// padrão de test_wellness_dup_fix_v231.js) — nunca reimplementa a lógica de paginação
// aqui; só simula um backend Supabase paginado para verificar que pullCloud() pede mais
// do que uma página quando a tabela tem mais de 1000 linhas.
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

const FIXED_NOW_MS = new Date(2026, 9, 16, 14, 0, 0, 0).getTime();
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

const BRIDGE_VARS = ['APP', '_supa', '_cid', '_sync', 'ROLE', '_curPg'];
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
  // navTo/toast/saveData não são o alvo deste teste (é pullCloud/_fetchAllClubRows) —
  // neutralizados para não arrastar renderização de ecrãs inteiros para este harness,
  // mesmo padrão de isolamento já usado nos outros test_*.js deste projeto.
  ctx.navTo = () => {};
  ctx.toast = () => {};
  ctx.saveData = () => {};
  ctx._getEl = (id) => elements[id];
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

// ── Backend Supabase falso, com o MESMO comportamento real que causou o bug: nunca
// devolve mais de 1000 linhas por pedido, haja ou não .range() a pedir mais. ──────────
const SERVER_MAX_ROWS = 1000;
function makeFakeSupa(tables) {
  const calls = []; // regista cada pedido .range()/.maybeSingle() feito, para os asserts
  function builderFor(tbl) {
    const rows = tables[tbl] || [];
    let filters = [];
    let orderCol = null, orderAsc = true;
    const builder = {
      select() { return builder; },
      eq(col, val) { filters.push([col, val]); return builder; },
      order(col, opts) { orderCol = col; orderAsc = !opts || opts.ascending !== false; return builder; },
      range(from, to) {
        calls.push({ tbl, type: 'range', from, to });
        let filtered = rows.filter(r => filters.every(([c, v]) => r[c] === v));
        if (orderCol) {
          filtered = filtered.slice().sort((a, b) => {
            if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1;
            if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1;
            return 0;
          });
        }
        let slice = filtered.slice(from, to + 1);
        if (slice.length > SERVER_MAX_ROWS) slice = slice.slice(0, SERVER_MAX_ROWS); // limite real do Supabase
        return Promise.resolve({ data: slice, error: null });
      },
      maybeSingle() {
        calls.push({ tbl, type: 'maybeSingle' });
        const filtered = rows.filter(r => filters.every(([c, v]) => r[c] === v));
        return Promise.resolve({ data: filtered[0] || null, error: null });
      },
      update() { return { eq() { return Promise.resolve({ data: null, error: null }); } }; },
    };
    return builder;
  }
  return { from: (tbl) => builderFor(tbl), __calls: calls };
}

function zeroPad(n, len) { return String(n).padStart(len, '0'); }

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();
const CID = '406d8b81-a759-4832-b871-37add6a91b18';

(async () => {

console.log('\n[1] Tabela com mais de 1000 linhas — pullCloud() pagina e traz TUDO, incluindo os registos de hoje');
await test('APP.wellness fica com as 1500 linhas (não só as primeiras 1000) e os 20 registos de hoje aparecem', async () => {
  // Reproduz exatamente o cenário real: 1500 linhas no total para o clube, as últimas 20
  // (ids mais altos, por ordem de 'id' ascendente — a mesma ordem usada na paginação) com
  // a data de hoje. Simula o estado real encontrado em produção (1020 linhas no total,
  // aqui exagerado para 1500 para deixar claro que funciona para além de 1 página extra).
  const wellnessRows = [];
  for (let i = 0; i < 1480; i++) {
    wellnessRows.push({
      id: 'w' + zeroPad(i, 5), athlete_id: 'athlete_old_' + i, club_id: CID,
      date: '2026-09-' + zeroPad((i % 28) + 1, 2), sleep: 3, fatigue: 3, stress: 3, pain: 1, mood: 3,
      score: 70, cycle: 'N/A', cycle_impact: 0, submitted_at: '2026-09-01T08:00:00Z',
    });
  }
  for (let i = 1480; i < 1500; i++) {
    wellnessRows.push({
      id: 'w' + zeroPad(i, 5), athlete_id: 'athlete_today_' + i, club_id: CID,
      date: '2026-10-16', sleep: 4, fatigue: 2, stress: 2, pain: 1, mood: 4,
      score: 80, cycle: 'N/A', cycle_impact: 0, submitted_at: '2026-10-16T09:00:00Z',
    });
  }
  const fakeSupa = makeFakeSupa({
    clubs: [{ id: CID, meta: { config: {}, teams: [] }, updated_at: '2026-10-16T12:00:00Z' }],
    wellness_records: wellnessRows,
    // Todas as outras tabelas do array `pulls` ficam vazias neste teste — o que importa
    // aqui é só a paginação de wellness_records, mesmo padrão de isolamento do resto da
    // suite.
  });
  ctx.$APP = { config: {}, teams: [], athletes: [], wellness: [], pse: [], games: [], schedule: [] };
  ctx.$_supa = fakeSupa;
  ctx.$_cid = CID;
  ctx.$_sync = true;
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'relatorios';

  await ctx.pullCloud();

  assert.strictEqual(ctx.$APP.wellness.length, 1500, 'traz as 1500 linhas, não só as primeiras 1000');
  const today = ctx.$APP.wellness.filter(w => w.date === '2026-10-16');
  assert.strictEqual(today.length, 20, 'os 20 registos de hoje (os mais recentes) já não ficam de fora');

  // Confirma que isto só foi possível por ir buscar MAIS DE UMA página — prova direta de
  // que a correção está mesmo a paginar, e não só "a dar sorte" com um limite maior.
  const wellnessRangeCalls = fakeSupa.__calls.filter(c => c.tbl === 'wellness_records' && c.type === 'range');
  assert.ok(wellnessRangeCalls.length >= 2, 'pediu pelo menos 2 páginas a wellness_records (recebeu ' + wellnessRangeCalls.length + ')');
});

console.log('\n[2] Regressão — tabela pequena (menos de 1000 linhas) continua a funcionar normalmente, numa só página');
await test('tabela com 3 linhas é lida por inteiro, com uma única chamada .range()', async () => {
  const fakeSupa = makeFakeSupa({
    clubs: [{ id: CID, meta: { config: {}, teams: [] }, updated_at: '2026-10-16T12:00:00Z' }],
    wellness_records: [
      { id: 'w1', athlete_id: 'a1', club_id: CID, date: '2026-10-14', sleep: 3, fatigue: 3, stress: 3, pain: 1, mood: 3, score: 70, cycle: 'N/A', cycle_impact: 0, submitted_at: '2026-10-14T08:00:00Z' },
      { id: 'w2', athlete_id: 'a2', club_id: CID, date: '2026-10-15', sleep: 4, fatigue: 2, stress: 2, pain: 0, mood: 4, score: 85, cycle: 'N/A', cycle_impact: 0, submitted_at: '2026-10-15T08:00:00Z' },
      { id: 'w3', athlete_id: 'a3', club_id: CID, date: '2026-10-16', sleep: 5, fatigue: 1, stress: 1, pain: 0, mood: 5, score: 95, cycle: 'N/A', cycle_impact: 0, submitted_at: '2026-10-16T08:00:00Z' },
    ],
  });
  ctx.$APP = { config: {}, teams: [], athletes: [], wellness: [], pse: [], games: [], schedule: [] };
  ctx.$_supa = fakeSupa;
  ctx.$_cid = CID;
  ctx.$_sync = true;
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'relatorios';

  await ctx.pullCloud();

  assert.strictEqual(ctx.$APP.wellness.length, 3, 'as 3 linhas continuam todas presentes');
  const wellnessRangeCalls = fakeSupa.__calls.filter(c => c.tbl === 'wellness_records' && c.type === 'range');
  assert.strictEqual(wellnessRangeCalls.length, 1, 'uma tabela pequena só precisa de 1 página (sem pedidos extra desnecessários)');
});

console.log('\n[3] Clube sem nenhum registo numa tabela — não rebenta, fica com array vazio (não undefined)');
await test('wellness_records vazio não sobrescreve com undefined nem lança erro', async () => {
  const fakeSupa = makeFakeSupa({
    clubs: [{ id: CID, meta: { config: {}, teams: [] }, updated_at: '2026-10-16T12:00:00Z' }],
    wellness_records: [],
  });
  const appBefore = { config: {}, teams: [], athletes: [], wellness: [{ id: 'local_only', date: '2026-10-10' }], pse: [], games: [], schedule: [] };
  ctx.$APP = appBefore;
  ctx.$_supa = fakeSupa;
  ctx.$_cid = CID;
  ctx.$_sync = true;
  ctx.$ROLE = 'treinador';
  ctx.$_curPg = 'relatorios';

  await ctx.pullCloud();

  // Mesmo comportamento de sempre (já existente antes desta correção): uma tabela sem
  // nenhuma linha na cloud não apaga dados só-locais ainda não sincronizados — o setter
  // só corre quando data.length>0.
  assert.strictEqual(ctx.$APP.wellness.length, 1, 'mantém o registo local (proteção já existente, inalterada)');
});

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);

})().catch(e => { console.error('ERRO INESPERADO:', e); process.exit(1); });
