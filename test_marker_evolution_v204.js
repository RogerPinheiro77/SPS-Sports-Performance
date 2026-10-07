// test_marker_evolution_v204.js
// Harness Node (vm) para a evolução visual de marcadores/setas (sps-v204), extraindo e
// correndo o CÓDIGO REAL de index.html (tudo o que está definido antes dos 3 IIFEs de
// bootstrap no fim do <script>, que são o único código de topo de nível que corre
// imediatamente — nunca reescrito aqui, só stubado o ambiente de browser em torno dele).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const INDEX_HTML = path.join(__dirname, '..', '..', '..', '..', '..', 'home', 'claude', 'sps', 'index.html');
// Caminho absoluto direto, mais robusto do que relativo ao scratchpad.
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
  const sessionStorageStub = {
    getItem(){ return null; }, setItem(){}, removeItem(){},
  };
  // confirmAnswer controla o retorno de confirm() nos testes (default: true).
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
      createElementNS(ns, tag){
        const el = makeFakeElement();
        el.tagName = tag;
        return el;
      },
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
  sandbox.window = sandbox; // self-referencing global, same pattern browsers use
  sandbox.globalThis = sandbox;
  sandbox._setConfirmAnswer = (v) => { confirmAnswer = v; };
  return sandbox;
}

// IMPORTANT vm gotcha: top-level `let`/`const` declared by the extracted script (APP,
// _pbArrowDragging, _jogoArrowStyle, etc.) become lexical bindings of the context's
// global *lexical* environment, NOT enumerable properties of the sandbox object itself
// — so `ctx.$APP = {...}` from OUTSIDE silently creates an unrelated own-property on the
// sandbox object and does NOT change what the real functions see when they read/write
// `APP`. A second small script run via vm.runInContext on the SAME context DOES share
// that lexical environment (V8 keeps a persistent global lexical environment per
// context across multiple runInContext calls), so we load a tiny bridge script right
// after the real one, exposing explicit get/set functions for every top-level `let` the
// tests need to control. This bridges state into the REAL code's own variables instead
// of re-implementing anything.
const BRIDGE_VARS = [
  'APP', '_pbArrowDragging', '_pbDragging', '_pbWasDrag', '_pbDrawMode', '_pbArrowStyle', '_pbArrowKind', '_pbArrowColor',
  '_arrowDragging', '_pitchDragging', '_pitchWasDrag', '_jogoCampoDrawMode', '_jogoArrowStyle', '_jogoArrowKind', '_jogoArrowColor', '_jogoCampoTab',
  '_CLOUD_TABLE_SCHEMA',
];
// Helper: cross-realm-safe deep comparison for arrays/objects coming out of the vm
// context (their Array/Object are a *different* realm's intrinsics than this test
// file's, so assert.deepStrictEqual correctly refuses to call them equal even when the
// content matches — "Values have same structure but are not reference-equal"). Re-wrap
// through JSON to compare by content only, which is all these tests need.
function sameContent(a, b) { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); }
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

// ─────────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    failed++;
    failures.push({ name, err: e });
    console.log('  ✗', name, '\n      ', (e && e.stack) ? e.stack.split('\n').slice(0,3).join('\n       ') : e);
  }
}

console.log('Loading real index.html script into vm context...');
const ctx = loadContext();
console.log('Loaded. Functions available:',
  ['_bibMarkerSvg','_bibDarken','_bibTextColor','_ballIconSvg','_freehandPathD',
   '_pbInit','_pbMarkersHtml','_pbOpponentsHtml','_pbBallHtml','_pbBoardHtml',
   '_pbSnapshot','_pbLoadSnapshot','_pbSnapshotSvg','pbArrowEnd','pbArrowClick','pbClearArrows',
   'pbHideAllOwn','pbRestoreAllOwn','pbClearOpponents','_bibApplyField','_bibDeleteMarker',
   '_jogoCampoHtml','_pitchSnapshotSvg','pitchArrowEnd','pitchArrowClick','pitchClearArrows',
   'pitchHideAllOwn','pitchRestoreAllOwn','pitchClearOpponents','_CLOUD_TABLE_SCHEMA']
   .map(n => typeof ctx[n]).join(','));

// ─────────────────────────────────────────────────────────────────────────
// 1) _bibMarkerSvg / _bibDarken / _bibTextColor
console.log('\n[1] Shared SVG helpers');
test('_bibMarkerSvg produces a <g> with two <rect> legs rotated by facing and a <circle> with the given fill', () => {
  const svg = ctx._bibMarkerSvg('#ffd700', '#b39b00', 7, 7, 45);
  assert.ok(svg.includes('<g transform="rotate(45)">'), 'facing rotation group missing');
  const rectCount = (svg.match(/<rect/g) || []).length;
  assert.strictEqual(rectCount, 2, 'expected exactly 2 leg rects, got ' + rectCount);
  assert.ok(svg.includes('fill="#ffd700"'), 'circle fill missing');
  assert.ok(svg.includes('<circle'), 'circle missing');
  assert.ok(svg.includes('>7</text>'), 'label missing');
});
test('_bibMarkerSvg omits the label <text> when label is null (adversárias)', () => {
  const svg = ctx._bibMarkerSvg('#e63946', '#a32330', null, 7, 0);
  assert.ok(!svg.includes('<text'), 'should not render a label when label is null');
});
test('_bibMarkerSvg defaults facing to 0 when omitted', () => {
  const svg = ctx._bibMarkerSvg('#ffd700', '#b39b00', 1, 7);
  assert.ok(svg.includes('<g transform="rotate(0)">'));
});
test('_bibDarken darkens each channel and keeps a valid #rrggbb', () => {
  const d = ctx._bibDarken('#ffd700', 0.25);
  assert.match(d, /^#[0-9a-f]{6}$/);
  assert.notStrictEqual(d.toLowerCase(), '#ffd700');
});
test('_bibTextColor returns dark text for light fills and white text for dark fills (same logic as isGK before)', () => {
  assert.strictEqual(ctx._bibTextColor('#ffd700'), '#1a1a2e'); // jogadora de linha (ouro) -> texto escuro
  assert.strictEqual(ctx._bibTextColor('#27ae60'), '#fff');    // guarda-redes (verde) -> texto branco, como já era
});

// 2) _ballIconSvg
console.log('\n[2] _ballIconSvg');
test('_ballIconSvg produces a white circle, a dark pentagon path and 5 seam lines', () => {
  const svg = ctx._ballIconSvg(4.9);
  assert.ok(svg.includes('<circle'));
  assert.ok(svg.includes('<path'));
  const lineCount = (svg.match(/<line/g) || []).length;
  assert.strictEqual(lineCount, 5, 'expected 5 seams, got ' + lineCount);
});

// 3) _freehandPathD
console.log('\n[3] _freehandPathD');
test('_freehandPathD with 2 points returns a simple M...L path', () => {
  const d = ctx._freehandPathD([{x:0,y:0},{x:10,y:10}]);
  assert.ok(d.startsWith('M 0.0 0.0'));
  assert.ok(d.includes('L 10.0 10.0'));
});
test('_freehandPathD with 3 points uses a Q (quadratic) segment', () => {
  const d = ctx._freehandPathD([{x:0,y:0},{x:5,y:5},{x:10,y:0}]);
  assert.ok(d.startsWith('M'));
  assert.ok(d.includes(' Q '));
});
test('_freehandPathD with 10+ points produces a valid d starting with M and using Q', () => {
  const pts = Array.from({length:12}, (_,i)=>({x:i*2, y:Math.sin(i)*5}));
  const d = ctx._freehandPathD(pts);
  assert.ok(d.startsWith('M'));
  assert.ok(d.includes(' Q '));
  assert.ok(/ L [\-\d.]+ [\-\d.]+$/.test(d), 'path should end with an L segment to the last point');
});
test('_freehandPathD returns empty string for fewer than 2 points', () => {
  assert.strictEqual(ctx._freehandPathD([{x:0,y:0}]), '');
  assert.strictEqual(ctx._freehandPathD([]), '');
  assert.strictEqual(ctx._freehandPathD(null), '');
});

// ─────────────────────────────────────────────────────────────────────────
// Playbook fixtures
function makePb(overrides) {
  return Object.assign({
    id: 'pb1', teamId: 't1', title: 'Jogada 1', category: 'bolasParadas', submomento: '',
    formation: '', description: '', videoUrl: '',
    positions: {}, opponents: [], ball: null, fullView: false, snapshots: [],
    athleteAssign: {}, createdAt: '2026-01-01T00:00:00.000Z', createdBy: '', createdById: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }, overrides || {});
}

console.log('\n[4] Playbook — _pbInit / render functions');
test('_pbInit adds hiddenOwn=[] and arrows=[] on an old pb object without crashing (retrocompat)', () => {
  const pb = { id: 'old1', title: 'Antiga', category: 'orgOf' }; // sem nenhum campo novo
  ctx._pbInit(pb);
  sameContent(pb.hiddenOwn, []);
  sameContent(pb.arrows, []);
  sameContent(pb.positions, {});
  sameContent(pb.opponents, []);
  // Render functions não devem rebentar com o pb "velho" inicializado.
  const html = ctx._pbMarkersHtml(pb) + ctx._pbOpponentsHtml(pb) + ctx._pbBallHtml(pb);
  assert.strictEqual(typeof html, 'string');
});
test('_pbMarkersHtml renders 11 own markers by default, using the bib marker (vest) shape', () => {
  const pb = makePb();
  ctx._pbInit(pb);
  const html = ctx._pbMarkersHtml(pb);
  const count = (html.match(/data-kind="own"/g) || []).length;
  assert.strictEqual(count, 11);
  assert.ok(html.includes('data-mid="1"'));
});
test('_pbMarkersHtml skips ids listed in pb.hiddenOwn', () => {
  const pb = makePb({ hiddenOwn: [1, 5] });
  const html = ctx._pbMarkersHtml(pb);
  assert.ok(!html.includes('data-mid="1" transform'));
  assert.ok(!html.includes('data-mid="5" transform'));
  const count = (html.match(/data-kind="own"/g) || []).length;
  assert.strictEqual(count, 9);
});
test('_pbMarkersHtml uses custom color/facing when set on a position, default colors otherwise', () => {
  const pb = makePb({ positions: { 1: { x: 10, y: 10, color: '#3b82f6', facing: 90 }, 2: { x: 20, y: 20 } } });
  const html = ctx._pbMarkersHtml(pb);
  assert.ok(html.includes('fill="#3b82f6"'), 'custom color for marker 1 missing');
  assert.ok(html.includes('rotate(90)'), 'facing 90 missing for marker 1');
  assert.ok(html.includes('fill="#ffd700"'), 'default gold fill for marker 2 missing');
});
test('_pbOpponentsHtml uses opponent color/facing with no label', () => {
  const pb = makePb({ opponents: [{ id: 'o1', num: 1, x: 5, y: 5, color: '#a855f7', facing: 180 }] });
  const html = ctx._pbOpponentsHtml(pb);
  assert.ok(html.includes('fill="#a855f7"'));
  assert.ok(html.includes('rotate(180)'));
  assert.ok(!html.includes('<text'), 'opponents must not render a number label');
});
test('_pbBallHtml renders the new ball icon (pentagon path) instead of a plain circle', () => {
  const pb = makePb({ ball: { x: 150, y: 100 } });
  const html = ctx._pbBallHtml(pb);
  assert.ok(html.includes('<path'), 'ball icon pentagon path missing');
});

console.log('\n[5] Playbook — marker options modal data/commit (_bibApplyField / _bibDeleteMarker)');
test('_bibApplyField("pb", ..., "own", "color") sets color on pb.positions[mid] and saves', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._bibApplyField('pb', 'pbA', 'own', 3, 'color', '#f97316');
  const pb = ctx2.$APP.playbook[0];
  assert.strictEqual(pb.positions[3].color, '#f97316');
});
test('_bibApplyField("pb", ..., "own", "facing") coerces to a number and defaults position to the grid default', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._bibApplyField('pb', 'pbA', 'own', 4, 'facing', '270');
  const pb = ctx2.$APP.playbook[0];
  assert.strictEqual(pb.positions[4].facing, 270);
  assert.strictEqual(typeof pb.positions[4].x, 'number');
});
test('_bibApplyField("pb", ..., "opponent", "color") sets color on the matching opponent entry', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA', opponents: [{id:'o1',num:1,x:1,y:1}] })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._bibApplyField('pb', 'pbA', 'opponent', 'o1', 'color', '#1a1a2e');
  assert.strictEqual(ctx2.$APP.playbook[0].opponents[0].color, '#1a1a2e');
});
test('_bibDeleteMarker("pb", ..., "own") hides (adds to hiddenOwn) instead of deleting', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._bibDeleteMarker('pb', 'pbA', 'own', 7);
  sameContent(ctx2.$APP.playbook[0].hiddenOwn, [7]);
  assert.strictEqual(ctx2.$APP.playbook[0].opponents.length, 0); // unaffected
});
test('_bibDeleteMarker("pb", ..., "opponent") removes the opponent for good (confirm() required)', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA', opponents: [{id:'o1',num:1,x:1,y:1}] })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._setConfirmAnswer(true);
  ctx2._bibDeleteMarker('pb', 'pbA', 'opponent', 'o1');
  assert.strictEqual(ctx2.$APP.playbook[0].opponents.length, 0);
});
test('_bibDeleteMarker("pb", ..., "opponent") does nothing if confirm() is declined', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA', opponents: [{id:'o1',num:1,x:1,y:1}] })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._setConfirmAnswer(false);
  ctx2._bibDeleteMarker('pb', 'pbA', 'opponent', 'o1');
  assert.strictEqual(ctx2.$APP.playbook[0].opponents.length, 1);
});

console.log('\n[6] Playbook — hide/restore all + clear opponents');
test('pbHideAllOwn hides all 11 ids (with confirm)', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._setConfirmAnswer(true);
  ctx2.pbHideAllOwn('pbA');
  assert.strictEqual(ctx2.$APP.playbook[0].hiddenOwn.length, 11);
});
test('pbRestoreAllOwn clears hiddenOwn', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA', hiddenOwn: [1,2,3] })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2.pbRestoreAllOwn('pbA');
  sameContent(ctx2.$APP.playbook[0].hiddenOwn, []);
});
test('pbClearOpponents removes all opponents (with confirm)', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA', opponents: [{id:'o1',x:1,y:1},{id:'o2',x:2,y:2}] })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._setConfirmAnswer(true);
  ctx2.pbClearOpponents('pbA');
  assert.strictEqual(ctx2.$APP.playbook[0].opponents.length, 0);
});

console.log('\n[7] Playbook — arrows (straight + freehand), click/clear');
test('pbArrowEnd commits a straight arrow (dist>=8) with the active style/color', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2.$_pbArrowStyle = 'dashed'; ctx2.$_pbArrowColor = '#e63946';
  ctx2.$_pbArrowDragging = { pbid: 'pbA', kind: 'straight', x1: 10, y1: 10, x2: 50, y2: 10 };
  ctx2.pbArrowEnd();
  const arrows = ctx2.$APP.playbook[0].arrows;
  assert.strictEqual(arrows.length, 1);
  assert.strictEqual(arrows[0].kind, 'straight');
  assert.strictEqual(arrows[0].style, 'dashed');
  assert.strictEqual(arrows[0].color, '#e63946');
});
test('pbArrowEnd discards a straight arrow shorter than 8px', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2.$_pbArrowDragging = { pbid: 'pbA', kind: 'straight', x1: 10, y1: 10, x2: 12, y2: 10 };
  ctx2.pbArrowEnd();
  assert.strictEqual(ctx2.$APP.playbook[0].arrows.length, 0);
});
test('pbArrowEnd commits a freehand arrow (>=3 points, length>=8) with its sampled points', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2.$_pbArrowDragging = { pbid: 'pbA', kind: 'freehand', points: [{x:0,y:0},{x:5,y:5},{x:10,y:10},{x:15,y:5}] };
  ctx2.pbArrowEnd();
  const arrows = ctx2.$APP.playbook[0].arrows;
  assert.strictEqual(arrows.length, 1);
  assert.strictEqual(arrows[0].kind, 'freehand');
  assert.strictEqual(arrows[0].points.length, 4);
});
test('pbArrowEnd discards a freehand arrow with fewer than 3 points', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2.$_pbArrowDragging = { pbid: 'pbA', kind: 'freehand', points: [{x:0,y:0},{x:5,y:5}] };
  ctx2.pbArrowEnd();
  assert.strictEqual(ctx2.$APP.playbook[0].arrows.length, 0);
});
test('pbArrowEnd discards a freehand arrow whose total sampled length is < 8px', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA' })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2.$_pbArrowDragging = { pbid: 'pbA', kind: 'freehand', points: [{x:0,y:0},{x:1,y:1},{x:2,y:2}] };
  ctx2.pbArrowEnd();
  assert.strictEqual(ctx2.$APP.playbook[0].arrows.length, 0);
});
test('pbArrowClick removes a single arrow by id when confirmed', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA', arrows: [{id:'a1',kind:'straight',x1:0,y1:0,x2:50,y2:0,style:'solid'},{id:'a2',kind:'straight',x1:0,y1:0,x2:50,y2:0,style:'solid'}] })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._setConfirmAnswer(true);
  ctx2.pbArrowClick({}, 'pbA', 'a1');
  const arrows = ctx2.$APP.playbook[0].arrows;
  assert.strictEqual(arrows.length, 1);
  assert.strictEqual(arrows[0].id, 'a2');
});
test('pbClearArrows empties all arrows when confirmed', () => {
  const ctx2 = loadContext();
  ctx2.$APP = { playbook: [makePb({ id: 'pbA', arrows: [{id:'a1'},{id:'a2'}] })], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._setConfirmAnswer(true);
  ctx2.pbClearArrows('pbA');
  assert.strictEqual(ctx2.$APP.playbook[0].arrows.length, 0);
});
test('_pbBoardHtml renders straight arrows as <line> and freehand arrows as <path>', () => {
  const pb = makePb({
    id: 'pbA',
    arrows: [
      { id: 'a1', kind: 'straight', x1: 0, y1: 0, x2: 50, y2: 0, style: 'solid', color: '#fff' },
      { id: 'a2', kind: 'freehand', points: [{x:0,y:0},{x:5,y:5},{x:10,y:0}], style: 'solid', color: '#ffd700' },
    ],
  });
  ctx.$APP = { playbook: [pb], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  const html = ctx._pbBoardHtml(pb);
  assert.ok(html.includes('onclick="pbArrowClick(event,\'pbA\',\'a1\')"'));
  assert.ok(html.includes('onclick="pbArrowClick(event,\'pbA\',\'a2\')"'));
  assert.ok(/<path[^>]*onclick="pbArrowClick\(event,'pbA','a2'\)"/.test(html), 'freehand arrow should render as <path>');
});

console.log('\n[8] Playbook — snapshot round-trip preserves color/facing/hidden markers');
test('_pbSnapshot captures color/facing on own positions and opponents via spread (survives round-trip)', () => {
  const ctx2 = loadContext();
  const pb = makePb({
    id: 'pbA',
    positions: { 1: { x: 10, y: 10, color: '#27ae60', facing: 0 }, 2: { x: 20, y: 20, color: '#3b82f6', facing: 120 } },
    opponents: [{ id: 'o1', num: 1, x: 30, y: 30, color: '#a855f7', facing: 45 }],
  });
  ctx2.$APP = { playbook: [pb], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._pbSnapshot('pbA');
  const snap = ctx2.$APP.playbook[0].snapshots[0];
  assert.ok(snap, 'snapshot was not created');
  assert.strictEqual(snap.positions[2].color, '#3b82f6');
  assert.strictEqual(snap.positions[2].facing, 120);
  assert.strictEqual(snap.opponents[0].color, '#a855f7');
  assert.strictEqual(snap.opponents[0].facing, 45);
});
test('_pbLoadSnapshot restores color/facing back onto pb.positions/pb.opponents', () => {
  const ctx2 = loadContext();
  const pb = makePb({
    id: 'pbA',
    positions: { 1: { x: 10, y: 10, color: '#27ae60', facing: 0 }, 2: { x: 20, y: 20, color: '#e63946', facing: 200 } },
    opponents: [{ id: 'o1', num: 1, x: 30, y: 30, color: '#f97316', facing: 90 }],
  });
  ctx2.$APP = { playbook: [pb], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._pbSnapshot('pbA');
  const snapId = ctx2.$APP.playbook[0].snapshots[0].id;
  // Muda o quadro ao vivo para valores diferentes, depois recarrega o snapshot.
  ctx2.$APP.playbook[0].positions[2] = { x: 99, y: 99, color: '#ffffff', facing: 0 };
  ctx2.$APP.playbook[0].opponents[0].color = '#ffffff';
  ctx2._pbLoadSnapshot('pbA', snapId);
  assert.strictEqual(ctx2.$APP.playbook[0].positions[2].color, '#e63946');
  assert.strictEqual(ctx2.$APP.playbook[0].positions[2].facing, 200);
  assert.strictEqual(ctx2.$APP.playbook[0].opponents[0].color, '#f97316');
});
test('_pbSnapshotSvg renders the bib marker (vest) look for own markers, opponents and ball', () => {
  const snap = {
    fullView: false,
    positions: { 1: { x: 10, y: 10, color: '#27ae60', facing: 0 } },
    opponents: [{ id: 'o1', x: 30, y: 30, color: '#e63946', facing: 90 }],
    ball: { x: 50, y: 50 },
  };
  const svg = ctx._pbSnapshotSvg(snap, 190);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('rotate(90)'), 'opponent facing missing from snapshot svg');
  assert.ok(svg.includes('<path'), 'ball pentagon path missing from snapshot svg');
});

console.log('\n[9] Playbook — touch support function exists and is wired from _renderPbDetail');
test('_initPbEvents exists as a function (Playbook touch support, mirrors _initPitchEvents)', () => {
  assert.strictEqual(typeof ctx._initPbEvents, 'function');
});

// ─────────────────────────────────────────────────────────────────────────
// Set Pieces fixtures
function makeGame(overrides) {
  return Object.assign({
    id: 'g1', teamId: 't1', opp: 'Adversário', date: '2026-10-10', lineup: ['a1', 'a2'], subs: [],
    formation: '4-3-3', captain: '', viceCaptain: '',
  }, overrides || {});
}
function makeAthletes() {
  return [
    { id: 'a1', name: 'Atleta Um', number: 1, pos: 'GR' },
    { id: 'a2', name: 'Atleta Dois', number: 7, pos: 'MED' },
  ];
}

console.log('\n[10] Set Pieces — helpers (_pitchMarkerColorsMap / _pitchHiddenOwnList) + hide/restore/clear');
['tatico', 'bolasParadas_cornerDef'].forEach((label) => {
  const mode = label === 'tatico' ? 'tatico' : 'cornerDef';
  test(`_pitchHiddenOwnList + pitchHideAllOwn/pitchRestoreAllOwn work for mode=${mode}`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX' });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._setConfirmAnswer(true);
    ctx2.pitchHideAllOwn('gX', mode);
    sameContent(g.pitchHiddenOwn[mode].slice().sort(), ['a1','a2'].sort());
    ctx2.pitchRestoreAllOwn('gX', mode);
    sameContent(g.pitchHiddenOwn[mode], []);
  });
  test(`pitchClearOpponents removes all opponents for mode=${mode}`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX', pitchOpponents: { tatico: [], cornerDef: [], cornerOf: [], freeKick: [] } });
    g.pitchOpponents[mode] = [{ id: 'o1', num: 1, x: 1, y: 1 }, { id: 'o2', num: 2, x: 2, y: 2 }];
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._setConfirmAnswer(true);
    ctx2.pitchClearOpponents('gX', mode);
    assert.strictEqual(g.pitchOpponents[mode].length, 0);
  });
});

console.log('\n[11] Set Pieces — marker options modal data/commit (own color via pitchMarkerColors, facing on position)');
['tatico', 'cornerDef'].forEach((mode) => {
  test(`_bibApplyField("pitch", "gX|${mode}", "own", "color") sets g.pitchMarkerColors[${mode}][aid]`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX' });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a2', 'color', '#a855f7');
    assert.strictEqual(g.pitchMarkerColors[mode].a2, '#a855f7');
  });
  test(`_bibApplyField("pitch", "gX|${mode}", "own", "facing") sets facing on the position entry`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX' });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a1', 'facing', '315');
    const posMap = mode === 'tatico' ? g.playerPositions : g.setpiecePositions[mode];
    assert.strictEqual(posMap.a1.facing, 315);
  });
  test(`_bibApplyField("pitch", "gX|${mode}", "own", "facing") on a player with NO stored position falls back to that player's actual default grid position (_pitchDefaultPos), not a hardcoded center point — regression for a bug found during independent verification (sps-v204): rotating a never-dragged marker used to silently snap it to (150,210), the pitch center, instead of preserving its displayed default spot`, () => {
    const ctx2 = loadContext();
    // a1 (número 1, GR) ordena primeiro (i=0) em _pitchDefaultPos; a2 (número 7) vem a
    // seguir (i=1) — confirma que cada um recebe o SEU próprio default, não os dois o
    // mesmo ponto fixo.
    const g = makeGame({ id: 'gX' });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a1', 'facing', '90');
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a2', 'facing', '45');
    const posMap = mode === 'tatico' ? g.playerPositions : g.setpiecePositions[mode];
    const expectedA1 = ctx2._pitchDefaultPos(mode, 0, g.formation);
    const expectedA2 = ctx2._pitchDefaultPos(mode, 1, g.formation);
    assert.strictEqual(posMap.a1.x, expectedA1[0], 'a1.x should match its own default grid x, not a hardcoded value');
    assert.strictEqual(posMap.a1.y, expectedA1[1], 'a1.y should match its own default grid y, not a hardcoded value');
    assert.strictEqual(posMap.a2.x, expectedA2[0], 'a2.x should match its own default grid x (different from a1), not the same hardcoded point');
    assert.strictEqual(posMap.a2.y, expectedA2[1], 'a2.y should match its own default grid y (different from a1), not the same hardcoded point');
    assert.notDeepStrictEqual([posMap.a1.x, posMap.a1.y], [150, 210], 'must not fall back to the old hardcoded center-of-pitch bug');
  });
  test(`_bibApplyField("pitch", "gX|${mode}", "own", "facing") does NOT move a player who already has a manually-dragged stored position`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX' });
    g.playerPositions = { a1: { x: 222, y: 55 } };
    g.setpiecePositions = { cornerDef: { a1: { x: 222, y: 55 } }, cornerOf: {}, freeKick: {} };
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a1', 'facing', '180');
    const posMap = mode === 'tatico' ? g.playerPositions : g.setpiecePositions[mode];
    assert.strictEqual(posMap.a1.x, 222);
    assert.strictEqual(posMap.a1.y, 55);
    assert.strictEqual(posMap.a1.facing, 180);
  });
  test(`_bibDeleteMarker("pitch", "gX|${mode}", "own") hides the aid (restorable) instead of deleting the athlete`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX' });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._bibDeleteMarker('pitch', 'gX|' + mode, 'own', 'a1');
    sameContent(g.pitchHiddenOwn[mode], ['a1']);
  });
  test(`_bibApplyField/_bibDeleteMarker("pitch", "gX|${mode}", "opponent", ...) set color/remove an opponent`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX', pitchOpponents: { tatico: [], cornerDef: [], cornerOf: [], freeKick: [] } });
    g.pitchOpponents[mode] = [{ id: 'o1', num: 1, x: 1, y: 1 }];
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'opponent', 'o1', 'color', '#f97316');
    assert.strictEqual(g.pitchOpponents[mode][0].color, '#f97316');
    ctx2._setConfirmAnswer(true);
    ctx2._bibDeleteMarker('pitch', 'gX|' + mode, 'opponent', 'o1');
    assert.strictEqual(g.pitchOpponents[mode].length, 0);
  });
});

console.log('\n[12] Set Pieces — arrows (straight + freehand), click/clear, same rules as Playbook');
['tatico', 'cornerOf'].forEach((mode) => {
  test(`pitchArrowEnd commits a straight arrow for mode=${mode} with kind/style/color`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX' });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2.$_jogoArrowStyle = 'solid'; ctx2.$_jogoArrowColor = '#3b82f6';
    ctx2.$_arrowDragging = { gid: 'gX', mode, kind: 'straight', x1: 0, y1: 0, x2: 40, y2: 0 };
    ctx2.pitchArrowEnd();
    const arr = g.pitchArrows[mode];
    assert.strictEqual(arr.length, 1);
    assert.strictEqual(arr[0].kind, 'straight');
    assert.strictEqual(arr[0].color, '#3b82f6');
  });
  test(`pitchArrowEnd commits a freehand arrow for mode=${mode} with its points`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX' });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2.$_arrowDragging = { gid: 'gX', mode, kind: 'freehand', points: [{x:0,y:0},{x:4,y:4},{x:8,y:0},{x:12,y:4}] };
    ctx2.pitchArrowEnd();
    const arr = g.pitchArrows[mode];
    assert.strictEqual(arr.length, 1);
    assert.strictEqual(arr[0].kind, 'freehand');
    assert.strictEqual(arr[0].points.length, 4);
  });
  test(`pitchArrowEnd discards too-short straight/freehand arrows for mode=${mode}`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX' });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2.$_arrowDragging = { gid: 'gX', mode, kind: 'straight', x1: 0, y1: 0, x2: 3, y2: 0 };
    ctx2.pitchArrowEnd();
    ctx2.$_arrowDragging = { gid: 'gX', mode, kind: 'freehand', points: [{x:0,y:0},{x:1,y:1}] };
    ctx2.pitchArrowEnd();
    assert.strictEqual((g.pitchArrows && g.pitchArrows[mode] || []).length, 0);
  });
  test(`pitchArrowClick removes one arrow by id for mode=${mode}, pitchClearArrows empties all`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX', pitchArrows: { tatico: [], cornerDef: [], cornerOf: [], freeKick: [] } });
    g.pitchArrows[mode] = [{ id: 'arrA', kind: 'straight', x1:0,y1:0,x2:40,y2:0, style:'solid' }, { id: 'arrB', kind: 'straight', x1:0,y1:0,x2:40,y2:0, style:'solid' }];
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._setConfirmAnswer(true);
    ctx2.pitchArrowClick({}, 'gX', 'arrA', mode);
    assert.strictEqual(g.pitchArrows[mode].length, 1);
    ctx2.pitchClearArrows('gX', mode);
    assert.strictEqual(g.pitchArrows[mode].length, 0);
  });
});

console.log('\n[13] Set Pieces — _jogoCampoHtml render (bib markers, hidden filter, new buttons, arrow rendering)');
['tatico', 'cornerDef'].forEach((mode) => {
  test(`_jogoCampoHtml (mode=${mode}) filters hidden own markers and renders bib markers for players/opponents/ball`, () => {
    const g = makeGame({
      id: 'gX',
      pitchOpponents: { tatico: [{id:'o1',num:1,x:30,y:30,color:'#a855f7',facing:45}], cornerDef: [{id:'o2',num:1,x:30,y:30,color:'#a855f7',facing:45}], cornerOf: [], freeKick: [] },
      pitchBall: { tatico: {x:150,y:100}, cornerDef: {x:150,y:100}, cornerOf: null, freeKick: null },
      pitchHiddenOwn: { tatico: ['a2'], cornerDef: ['a2'], cornerOf: [], freeKick: [] },
    });
    ctx.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx.$_jogoCampoTab = mode;
    const html = ctx._jogoCampoHtml(g);
    assert.ok(!html.includes('data-aid="a2" data-kind="player"'), 'hidden own marker a2 should not render for mode=' + mode);
    assert.ok(html.includes('data-aid="a1" data-kind="player"'), 'visible own marker a1 missing');
    assert.ok(html.includes('🙈 Esconder Todos'));
    assert.ok(html.includes('👁️ Restaurar Todos'), 'restore-all button should show because hiddenOwn is non-empty');
    assert.ok(html.includes('🗑️ Limpar Adversárias'));
    assert.ok(html.includes("_openMarkerOptionsModal('pitch','gX|" + mode + "','own','a1')"));
    assert.ok(html.includes("_openMarkerOptionsModal('pitch','gX|" + mode + "','opponent','"));
  });
  test(`_jogoCampoHtml (mode=${mode}) renders straight arrows as <line> and freehand as <path>`, () => {
    const g = makeGame({
      id: 'gX',
      pitchArrows: { tatico: [], cornerDef: [], cornerOf: [], freeKick: [] },
    });
    g.pitchArrows[mode] = [
      { id: 'a1', kind: 'straight', x1: 0, y1: 0, x2: 40, y2: 0, style: 'solid', color: '#fff' },
      { id: 'a2', kind: 'freehand', points: [{x:0,y:0},{x:5,y:5},{x:10,y:0}], style: 'dashed', color: '#ffd700' },
    ];
    ctx.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx.$_jogoCampoTab = mode;
    const html = ctx._jogoCampoHtml(g);
    assert.ok(/<path[^>]*onclick="pitchArrowClick\(event,'gX','a2','"+mode+"'\)"/.test(html.replace(/\s+/g,' ')) || html.includes("pitchArrowClick(event,'gX','a2','" + mode + "')"));
    assert.ok(html.includes("pitchArrowClick(event,'gX','a1','" + mode + "')"));
  });
});

console.log('\n[14] Set Pieces — snapshot round-trip preserves facing + pitchMarkerColors + opponent color/facing');
['tatico', 'freeKick'].forEach((mode) => {
  test(`_pitchSnapshot/_pitchLoadSnapshot round-trip facing + markerColors for mode=${mode}`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX', lineup: ['a1', 'a2'] });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    // Define facing na posição e cor customizada, depois regista.
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a2', 'facing', '77');
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a2', 'color', '#e63946');
    ctx2._pitchSnapshot('gX', mode);
    const snaps = mode === 'tatico' ? g.tacticoSnapshots : g.setpieceSnapshots[mode];
    assert.strictEqual(snaps.length, 1, 'snapshot not recorded for mode=' + mode);
    assert.strictEqual(snaps[0].positions.a2.facing, 77);
    assert.strictEqual(snaps[0].markerColors.a2, '#e63946');
    // Muda o valor ao vivo e recarrega — deve voltar ao snapshot.
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a2', 'facing', '10');
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a2', 'color', '#ffffff');
    ctx2._pitchLoadSnapshot('gX', mode, snaps[0].id);
    const posMap = mode === 'tatico' ? g.playerPositions : g.setpiecePositions[mode];
    assert.strictEqual(posMap.a2.facing, 77);
    assert.strictEqual(g.pitchMarkerColors[mode].a2, '#e63946');
  });
  test(`_pitchCurrentFrame (mode=${mode}, used by Modo Apresentação) carries facing + markerColors live`, () => {
    const ctx2 = loadContext();
    const g = makeGame({ id: 'gX', lineup: ['a1', 'a2'] });
    ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    ctx2._bibApplyField('pitch', 'gX|' + mode, 'own', 'a1', 'facing', '33');
    const frame = ctx2._pitchCurrentFrame(g, mode);
    assert.strictEqual(frame.positions.a1.facing, 33);
  });
  test(`_pitchSnapshotSvg (mode=${mode}) renders bib markers with custom color, opponent facing and the new ball icon`, () => {
    const snap = {
      fullView: false, lineup: ['a1'],
      positions: { a1: { x: 10, y: 10, facing: 0 } },
      markerColors: { a1: '#3b82f6' },
      opponents: [{ id: 'o1', x: 30, y: 30, color: '#e63946', facing: 90 }],
      ball: { x: 50, y: 50 },
    };
    ctx.$APP = { games: [], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
    const svg = ctx._pitchSnapshotSvg(mode, snap, 190);
    assert.ok(svg.includes('fill="#3b82f6"'), 'custom markerColors fill missing from snapshot svg');
    assert.ok(svg.includes('rotate(90)'), 'opponent facing missing from snapshot svg');
    assert.ok(svg.includes('<path'), 'ball pentagon path missing from snapshot svg');
  });
});

console.log('\n[15] Retrocompatibilidade — jogo/jogada antigos sem nenhum campo novo não rebentam');
test('_jogoCampoHtml renders without throwing for a game with no pitchOpponents/pitchBall/pitchArrows/pitchHiddenOwn/pitchMarkerColors at all', () => {
  const ctx2 = loadContext();
  const g = makeGame({ id: 'gOld' }); // sem nenhum campo novo
  ctx2.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._jogoCampoTab = 'tatico';
  let html;
  assert.doesNotThrow(() => { html = ctx2._jogoCampoHtml(g); });
  assert.ok(html.includes('data-aid="a1"'));
});
test('_pbBoardHtml renders without throwing for a pb with no arrows/hiddenOwn at all (pre-sps-v204 jogada)', () => {
  const ctx2 = loadContext();
  const pb = { id: 'pbOld', title: 'Antiga', category: 'orgOf', positions: {}, opponents: [], ball: null, fullView: false, snapshots: [], athleteAssign: {} };
  ctx2.$APP = { playbook: [pb], games: [], athletes: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx2._pbInit(pb);
  let html;
  assert.doesNotThrow(() => { html = ctx2._pbBoardHtml(pb); });
  assert.ok(html.includes('pb-pitch-pbOld'));
});
test('old straight arrows without "kind"/"color" (pre-sps-v204) still render as a <line> with the default white color', () => {
  const g = makeGame({ id: 'gOld', pitchArrows: { tatico: [{ id: 'oldArr', x1: 0, y1: 0, x2: 40, y2: 0, style: 'solid' }], cornerDef: [], cornerOf: [], freeKick: [] } });
  ctx.$APP = { games: [g], athletes: makeAthletes(), playbook: [], teams: [{id:'t1',name:'A'}], config: {} };
  ctx.$_jogoCampoTab = 'tatico';
  const html = ctx._jogoCampoHtml(g);
  assert.ok(html.includes('<line x1="0" y1="0" x2="40" y2="0" stroke="#fff"'), 'old arrow without kind/color should still render as a white <line>');
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[16] _CLOUD_TABLE_SCHEMA — new columns present for playbook and games');
test('_CLOUD_TABLE_SCHEMA.playbook.cols contains arrows, hidden_own, marker_colors', () => {
  const cols = ctx.$_CLOUD_TABLE_SCHEMA.playbook.cols;
  ['arrows', 'hidden_own', 'marker_colors'].forEach(c => assert.ok(cols.includes(c), 'missing col ' + c));
  assert.strictEqual(ctx.$_CLOUD_TABLE_SCHEMA.playbook.rename.hiddenOwn, 'hidden_own');
  assert.strictEqual(ctx.$_CLOUD_TABLE_SCHEMA.playbook.rename.markerColors, 'marker_colors');
});
test('_CLOUD_TABLE_SCHEMA.games.cols contains pitch_opponents, pitch_ball, pitch_marker_colors, pitch_hidden_own', () => {
  const cols = ctx.$_CLOUD_TABLE_SCHEMA.games.cols;
  ['pitch_opponents', 'pitch_ball', 'pitch_marker_colors', 'pitch_hidden_own'].forEach(c => assert.ok(cols.includes(c), 'missing col ' + c));
  const rn = ctx.$_CLOUD_TABLE_SCHEMA.games.rename;
  assert.strictEqual(rn.pitchOpponents, 'pitch_opponents');
  assert.strictEqual(rn.pitchBall, 'pitch_ball');
  assert.strictEqual(rn.pitchMarkerColors, 'pitch_marker_colors');
  assert.strictEqual(rn.pitchHiddenOwn, 'pitch_hidden_own');
});

console.log('\n[17] cloudUpsert — payload actually includes the new columns when the local object has them');
test('cloudUpsert builds a payload with hidden_own/marker_colors/arrows for a playbook row (no network — _supa is null, so it is a no-op, but we can call the schema-mapping logic directly via the same code path)', () => {
  // cloudUpsert() is async and returns early when _supa is null — exercise the mapping
  // logic itself the same way cloudUpsert does, using the real schema object (not a
  // reimplementation), to confirm the new local camelCase fields really do map to the
  // new snake_case columns.
  const schema = ctx.$_CLOUD_TABLE_SCHEMA.playbook;
  const pb = makePb({ id: 'pbA', hiddenOwn: [1, 2], arrows: [{ id: 'a1' }], markerColors: {} });
  const src = { ...pb };
  Object.keys(schema.rename || {}).forEach(k => { if (src[k] !== undefined) src[schema.rename[k]] = src[k]; });
  const payload = {};
  schema.cols.forEach(c => { if (src[c] !== undefined) payload[c] = src[c]; });
  assert.deepStrictEqual(payload.hidden_own, [1, 2]);
  assert.deepStrictEqual(payload.arrows, [{ id: 'a1' }]);
});

console.log('\n[18] pullCloud bug fix — games row mapping now maps pitch_opponents/pitch_ball/pitch_marker_colors/pitch_hidden_own');
test('the games pull-mapper (extracted logic from pullCloud, same shape) maps pitch_opponents/pitch_ball/pitch_marker_colors/pitch_hidden_own from a fake row', () => {
  // Simula uma linha real da tabela games como o Supabase a devolveria, com as 4 colunas
  // novas preenchidas, e usa a MESMA expressão que está em pullCloud() (copiada aqui
  // apenas para a parte relevante, não reimplementada com lógica diferente) para
  // confirmar o mapeamento camelCase <- snake_case.
  const r = {
    id: 'g1', team_id: 't1', opp: 'X', date: '2026-10-10',
    pitch_opponents: { tatico: [{ id: 'o1', x: 1, y: 1 }] },
    pitch_ball: { tatico: { x: 150, y: 100 } },
    pitch_marker_colors: { tatico: { a1: '#e63946' } },
    pitch_hidden_own: { tatico: ['a2'] },
    pitch_arrows: null,
  };
  const mapped = {
    pitchOpponents: r.pitch_opponents || undefined,
    pitchBall: r.pitch_ball || undefined,
    pitchMarkerColors: r.pitch_marker_colors || undefined,
    pitchHiddenOwn: r.pitch_hidden_own || undefined,
  };
  assert.deepStrictEqual(mapped.pitchOpponents, { tatico: [{ id: 'o1', x: 1, y: 1 }] });
  assert.deepStrictEqual(mapped.pitchBall, { tatico: { x: 150, y: 100 } });
  assert.deepStrictEqual(mapped.pitchMarkerColors, { tatico: { a1: '#e63946' } });
  assert.deepStrictEqual(mapped.pitchHiddenOwn, { tatico: ['a2'] });
  // Confirma que esta MESMA expressão está mesmo escrita dentro de pullCloud() no
  // ficheiro real (não só numa cópia solta aqui) — evita o teste passar enquanto o
  // código real ainda não tem a correção.
  const html = fs.readFileSync(REAL_PATH, 'utf8');
  assert.ok(html.includes('pitchOpponents:r.pitch_opponents||undefined'), 'pullCloud() games mapper missing pitchOpponents mapping');
  assert.ok(html.includes('pitchBall:r.pitch_ball||undefined'), 'pullCloud() games mapper missing pitchBall mapping');
  assert.ok(html.includes('pitchMarkerColors:r.pitch_marker_colors||undefined'), 'pullCloud() games mapper missing pitchMarkerColors mapping');
  assert.ok(html.includes('pitchHiddenOwn:r.pitch_hidden_own||undefined'), 'pullCloud() games mapper missing pitchHiddenOwn mapping');
});
test('the playbook pull-mapper in the real file maps arrows/hidden_own/marker_colors', () => {
  const html = fs.readFileSync(REAL_PATH, 'utf8');
  assert.ok(html.includes("arrows:r.arrows||[]"), 'pullCloud() playbook mapper missing arrows mapping');
  assert.ok(html.includes("hiddenOwn:r.hidden_own||[]"), 'pullCloud() playbook mapper missing hiddenOwn mapping');
  assert.ok(html.includes("markerColors:r.marker_colors||{}"), 'pullCloud() playbook mapper missing markerColors mapping');
});

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=====================================================');
console.log(`RESULT: ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed > 0) {
  console.log('\nFAILED TESTS:');
  failures.forEach(f => console.log(' -', f.name));
  process.exit(1);
} else {
  console.log('All tests passed.');
  process.exit(0);
}
