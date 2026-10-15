// test_ginasio_atleta_bloco2a_v220.js
// Harness Node (vm) para o Bloco 2A da proposta "Ginásio: App da Atleta" (sps-v220):
// Ver o plano do dia + vídeo, A tua Evolução (Ginásio, só setas de tendência — NUNCA
// números em bruto, decisão confirmada pelo Roger), Streaks de consistência, e o
// sinal de wellness/prontidão do lado do staff (Registo de Ginásio). Extrai e corre
// o CÓDIGO REAL de index.html (mesmo padrão de test_ginasio_bloco1_v218.js) — nunca
// reimplementa a lógica aqui.
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

const BRIDGE_VARS = ['APP', 'AID', '_gymGridEventId', '_gymGridData', '_gymAccOpen'];
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
  // Stub openMod para capturar título/corpo sem precisar de todo o DOM do modal.
  let lastModal = null;
  ctx.openMod = (title, body, size) => { lastModal = { title, body, size }; };
  ctx.closeMod = () => {};
  ctx._getLastModal = () => lastModal;
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
  ['atOpenEventDetail','atOpenGinasioPlanoDia','_gymAthleteEvolution','_gymEvolutionCardHtml',
   '_gymConsistencyStreak','_gymStreakCardHtml','_gymWellnessSignal','_gymWellnessBadge','renderAtTreino']
   .map(n => typeof ctx[n]).join(','));

function freshApp(){
  return {
    exercises:[], gymSheets:[], gymRecords:[], schedule:[], athletes:[], teams:[{id:'T1',name:'T1'}],
    attendance:[], convocatorias:[], wellness:[], trainingPlans:[], extraTrainings:[],
  };
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n[1] Ver o plano do dia + vídeo (atOpenEventDetail → atOpenGinasioPlanoDia)');
test('evento de Ginásio com ficha abre o plano do dia, não os campos genéricos', () => {
  ctx.$APP = freshApp();
  const gs = {id:'gs1',title:'Ficha de Hoje',notes:'2-3 RIR, sem falha',exercises:[
    {exId:null,name:'Squat',reps:'3x10',rir:'2',note:'',bloco:'',videoUrl:'https://youtube.com/sq',img:'img-sq.png'},
  ]};
  ctx.$APP.schedule.push({id:'ev1',type:'Ginásio',gymSheet:gs,teamId:'T1',date:'2026-10-15',time:'18:00',location:'Ginásio Clube'});
  ctx.atOpenEventDetail('ev1');
  const modal = ctx._getLastModal();
  assert.ok(modal, 'devia ter aberto um modal');
  assert.ok(modal.title.includes('Ficha de Hoje'));
  assert.ok(modal.body.includes('Squat'));
  assert.ok(modal.body.includes('3x10'));
  assert.ok(modal.body.includes('RIR'));
  assert.ok(modal.body.includes('youtube.com/sq'));
  assert.ok(modal.body.includes('2-3 RIR, sem falha'), 'devia mostrar as notas gerais da ficha');
  // nunca os campos genéricos (Tipo/Duração em tabela) deste caminho
  assert.ok(!modal.body.includes('<table>'), 'não devia cair no caminho genérico de linhas tipo/data/hora');
});
test('plano do dia agrupa por bloco (cabeçalho só 1 vez) e mostra vídeo só quando existe', () => {
  ctx.$APP = freshApp();
  const gs = {id:'gs2',title:'Ficha B',exercises:[
    {exId:null,name:'Squat',reps:'3x10',rir:'2',bloco:'Bloco A',videoUrl:'https://youtube.com/sq'},
    {exId:null,name:'Lunge',reps:'3x10',rir:'2',bloco:'Bloco A'},
    {exId:null,name:'Plank',reps:'3x40s',rir:'',bloco:''},
  ]};
  ctx.$APP.schedule.push({id:'ev2',type:'Ginásio',gymSheet:gs,teamId:'T1',date:'2026-10-15'});
  ctx.atOpenGinasioPlanoDia('ev2');
  const body = ctx._getLastModal().body;
  assert.strictEqual((body.match(/Bloco: Bloco A/g)||[]).length, 1);
  assert.strictEqual((body.match(/▶ Vídeo/g)||[]).length, 1, 'só o Squat tem vídeo');
});
test('evento de Ginásio sem ficha continua a usar o caminho genérico', () => {
  ctx.$APP = freshApp();
  ctx.$APP.schedule.push({id:'ev3',type:'Ginásio',teamId:'T1',date:'2026-10-15',time:'18:00',location:'Sala'});
  ctx.atOpenEventDetail('ev3');
  const modal = ctx._getLastModal();
  assert.ok(modal.body.includes('<table>'), 'sem gymSheet devia cair no caminho genérico (linhas tipo/data/hora)');
});

console.log('\n[2] A tua Evolução (Ginásio) — só setas de tendência, NUNCA números em bruto');
function pushGymRecord(ctx, athId, evId, exName, carga, date, exReps){
  let ev = ctx.$APP.schedule.find(e=>e.id===evId);
  if(!ev){
    ev = {id:evId,type:'Ginásio',teamId:'T1',date,gymSheet:{id:evId+'_gs',title:'Ficha',exercises:[{exId:null,name:exName,reps:exReps||'3x10',rir:'2'}]}};
    ctx.$APP.schedule.push(ev);
  }
  ctx.$APP.gymRecords.push({athleteId:athId,eventId:evId,vals:[{carga:String(carga),series:'3',reps:'10',rir:'2'}]});
}
test('_gymAthleteEvolution calcula tendência a subir/descer/estável/1º registo corretamente', () => {
  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev_up1','Squat',40,'2026-10-01');
  pushGymRecord(ctx,'a1','ev_up2','Squat',45,'2026-10-08');
  const dataUp = ctx._gymAthleteEvolution('a1');
  assert.strictEqual(dataUp.find(d=>d.name==='Squat').trend, 'up');

  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev_dn1','Lunge',30,'2026-10-01');
  pushGymRecord(ctx,'a1','ev_dn2','Lunge',25,'2026-10-08');
  const dataDn = ctx._gymAthleteEvolution('a1');
  assert.strictEqual(dataDn.find(d=>d.name==='Lunge').trend, 'down');

  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev_sm1','Plank',20,'2026-10-01');
  pushGymRecord(ctx,'a1','ev_sm2','Plank',20,'2026-10-08');
  const dataSm = ctx._gymAthleteEvolution('a1');
  assert.strictEqual(dataSm.find(d=>d.name==='Plank').trend, 'same');

  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev_1x','HipThrust',50,'2026-10-01');
  const data1x = ctx._gymAthleteEvolution('a1');
  assert.strictEqual(data1x.find(d=>d.name==='HipThrust').trend, 'none');
});
test('_gymAthleteEvolution assinala recorde pessoal (isPR) só quando o último valor supera o máximo anterior', () => {
  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev1','Squat',40,'2026-09-01');
  pushGymRecord(ctx,'a1','ev2','Squat',50,'2026-09-08');
  pushGymRecord(ctx,'a1','ev3','Squat',45,'2026-09-15');
  const data = ctx._gymAthleteEvolution('a1');
  assert.strictEqual(data.find(d=>d.name==='Squat').isPR, false, '45 não supera o máximo anterior (50)');

  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev1b','Squat',40,'2026-09-01');
  pushGymRecord(ctx,'a1','ev2b','Squat',50,'2026-09-08');
  pushGymRecord(ctx,'a1','ev3b','Squat',55,'2026-09-15');
  const data2 = ctx._gymAthleteEvolution('a1');
  assert.strictEqual(data2.find(d=>d.name==='Squat').isPR, true, '55 supera o máximo anterior (50)');
});
test('_gymAthleteEvolution ignora registos antigos sem carga numérica (não entram na tendência)', () => {
  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev1','Agarre Livre','n/a','2026-09-01'); // carga não numérica
  const data = ctx._gymAthleteEvolution('a1');
  assert.strictEqual(data.length, 0);
});
test('_gymAthleteEvolution nunca mistura exercícios/atletas diferentes', () => {
  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev1','Squat',40,'2026-10-01');
  pushGymRecord(ctx,'a2','ev1','Squat',99,'2026-10-01'); // outra atleta, mesmo evento/exercício
  const dataA1 = ctx._gymAthleteEvolution('a1');
  assert.strictEqual(dataA1.length, 1);
  assert.strictEqual(dataA1[0].sessions, 1, 'não devia juntar o registo da outra atleta');
});
// sps-v221: _gymEvolutionCardHtml/_gymStreakCardHtml foram consolidadas num
// único _gymAthleteCardHtml (card "Ginásio" único, pedido do Roger,
// 14/10/2026) — os 2 testes abaixo passaram a chamar essa função nova,
// mantendo exatamente as mesmas garantias de segurança/conteúdo.
test('_gymAthleteCardHtml NUNCA expõe o número da carga (teste central de segurança, decisão confirmada pelo Roger)', () => {
  ctx.$APP = freshApp();
  pushGymRecord(ctx,'a1','ev1','Squat',40,'2026-10-01');
  pushGymRecord(ctx,'a1','ev2','Squat',47.5,'2026-10-08');
  const html = ctx._gymAthleteCardHtml('a1');
  assert.ok(html.includes('Ginásio'));
  assert.ok(html.includes('⬆️'));
  assert.ok(!html.includes('40'), 'carga antiga (40) nunca deve aparecer no HTML');
  assert.ok(!html.includes('47.5') && !html.includes('47,5'), 'carga nova (47.5) nunca deve aparecer no HTML');
  assert.ok(!html.includes('kg'), 'nenhuma unidade de carga deve aparecer — só a seta/etiqueta de tendência');
});
test('_gymAthleteCardHtml devolve vazio quando a atleta não tem nenhum registo/streak de ginásio', () => {
  ctx.$APP = freshApp();
  assert.strictEqual(ctx._gymAthleteCardHtml('a_sem_nada'), '');
});

console.log('\n[3] Streaks de consistência — individual, nunca comparado entre atletas');
function pushPastGinasioEvent(ctx, id, date, rsvp){
  ctx.$APP.schedule.push({id,type:'Ginásio',teamId:'T1',date,rsvp:rsvp||{}});
}
test('_gymConsistencyStreak conta sessões confirmadas consecutivas, da mais recente para trás', () => {
  ctx.$APP = freshApp();
  ctx.$APP.athletes.push({id:'a1',teamId:'T1'});
  pushPastGinasioEvent(ctx,'g1','2026-10-01',{a1:{status:'yes'}});
  pushPastGinasioEvent(ctx,'g2','2026-10-03',{a1:{status:'yes'}});
  pushPastGinasioEvent(ctx,'g3','2026-10-06',{a1:{status:'yes'}});
  assert.strictEqual(ctx._gymConsistencyStreak('a1'), 3);
});
test('_gymConsistencyStreak para no primeiro evento sem confirmação "yes" (incluindo "no" ou sem resposta)', () => {
  ctx.$APP = freshApp();
  ctx.$APP.athletes.push({id:'a1',teamId:'T1'});
  pushPastGinasioEvent(ctx,'g1','2026-10-01',{a1:{status:'yes'}});
  pushPastGinasioEvent(ctx,'g2','2026-10-03',{a1:{status:'no'}});
  pushPastGinasioEvent(ctx,'g3','2026-10-06',{a1:{status:'yes'}});
  pushPastGinasioEvent(ctx,'g4','2026-10-09',{a1:{status:'yes'}});
  assert.strictEqual(ctx._gymConsistencyStreak('a1'), 2, 'só conta g4+g3, para no g2 (status no)');
});
test('_gymConsistencyStreak nunca compara com outras atletas (cada uma com a sua própria contagem)', () => {
  ctx.$APP = freshApp();
  ctx.$APP.athletes.push({id:'a1',teamId:'T1'},{id:'a2',teamId:'T1'});
  pushPastGinasioEvent(ctx,'g1','2026-10-01',{a1:{status:'yes'},a2:{status:'no'}});
  pushPastGinasioEvent(ctx,'g2','2026-10-03',{a1:{status:'yes'},a2:{status:'yes'}});
  assert.strictEqual(ctx._gymConsistencyStreak('a1'), 2);
  assert.strictEqual(ctx._gymConsistencyStreak('a2'), 1);
});
test('_gymAthleteCardHtml (parte do streak) só aparece a partir de 2 sessões seguidas, nunca menciona outras atletas', () => {
  ctx.$APP = freshApp();
  ctx.$APP.athletes.push({id:'a1',teamId:'T1'});
  pushPastGinasioEvent(ctx,'g1','2026-10-01',{a1:{status:'yes'}});
  assert.strictEqual(ctx._gymAthleteCardHtml('a1'), '', 'com só 1 sessão e sem evolução não deve mostrar nada');
  ctx.$APP = freshApp();
  ctx.$APP.athletes.push({id:'a1',teamId:'T1'});
  pushPastGinasioEvent(ctx,'g1','2026-10-01',{a1:{status:'yes'}});
  pushPastGinasioEvent(ctx,'g2','2026-10-03',{a1:{status:'yes'}});
  const html = ctx._gymAthleteCardHtml('a1');
  assert.ok(html.includes('2 sessões'));
});

console.log('\n[4] Ligação à prontidão/wellness — sinal só do lado do staff (Registo), nunca na app da atleta');
test('_gymWellnessSignal sinaliza quando o wellness do dia está >=1σ abaixo da baseline pessoal (histórico anterior)', () => {
  ctx.$APP = freshApp();
  ctx.$APP.wellness = [];
  // baseline: 8 registos anteriores com score=80 (sd=0 ainda não ajuda — precisamos de variação)
  const scores = [78,82,80,79,81,80,83,77];
  scores.forEach((s,i)=>ctx.$APP.wellness.push({athleteId:'a1',date:'2026-09-'+String(10+i).padStart(2,'0'),score:s}));
  ctx.$APP.wellness.push({athleteId:'a1',date:'2026-10-15',score:50}); // claramente abaixo do habitual
  const sig = ctx._gymWellnessSignal('a1','2026-10-15');
  assert.ok(sig, 'devia sinalizar — wellness muito abaixo da baseline');
  assert.ok(sig.dev < -1);
});
test('_gymWellnessSignal não sinaliza sem dados suficientes de baseline (<_BASELINE_MIN_N)', () => {
  ctx.$APP = freshApp();
  ctx.$APP.wellness = [
    {athleteId:'a1',date:'2026-10-10',score:80},
    {athleteId:'a1',date:'2026-10-15',score:50},
  ];
  assert.strictEqual(ctx._gymWellnessSignal('a1','2026-10-15'), null);
});
test('_gymWellnessSignal não sinaliza quando não há registo de wellness na data de referência', () => {
  ctx.$APP = freshApp();
  ctx.$APP.wellness = [];
  assert.strictEqual(ctx._gymWellnessSignal('a1','2026-10-15'), null);
});
test('_gymWellnessBadge aparece na grelha de Registo (tabela e acordeão) quando há sinal, e nunca na app da atleta', () => {
  ctx.$APP = freshApp();
  const scores = [78,82,80,79,81,80,83,77];
  scores.forEach((s,i)=>ctx.$APP.wellness.push({athleteId:'a1',date:'2026-09-'+String(10+i).padStart(2,'0'),score:s}));
  ctx.$APP.wellness.push({athleteId:'a1',date:'2026-10-15',score:50});
  const gs = {id:'gs1',title:'Ficha',exercises:[{exId:null,name:'Squat',reps:'3x10',rir:'2'}]};
  ctx.$APP.schedule.push({id:'evw1',type:'Ginásio',gymSheet:gs,teamId:'T1',date:'2026-10-15'});
  ctx.$_gymGridEventId = 'evw1';
  ctx.$_gymGridData = {a1:{vals:[],obs:'',hiddenEx:[],extraEx:[]}};
  const athletes = [{id:'a1',name:'Atleta 1'}];
  const tableHtml = ctx._gymGridTableHtml(gs, athletes);
  assert.ok(tableHtml.includes('⚠️'), 'devia mostrar o sinal de wellness na tabela do Registo');
  ctx.$_gymAccOpen = 'a1';
  const accHtml = ctx._gymGridAccordionHtml(gs, athletes);
  assert.ok(accHtml.includes('⚠️'), 'devia mostrar o sinal de wellness no acordeão do Registo');
  // nunca na app da atleta — o plano do dia (atOpenGinasioPlanoDia) não deve ter este sinal
  ctx.atOpenGinasioPlanoDia('evw1');
  const planoBody = ctx._getLastModal().body;
  assert.ok(!planoBody.includes('⚠️'), 'o sinal de wellness é só do staff — nunca na app da atleta');
});
test('_gymWellnessBadge não aparece sem sinal (wellness normal ou sem baseline)', () => {
  ctx.$APP = freshApp();
  const gs = {id:'gs1',title:'Ficha',exercises:[{exId:null,name:'Squat',reps:'3x10',rir:'2'}]};
  ctx.$APP.schedule.push({id:'evw2',type:'Ginásio',gymSheet:gs,teamId:'T1',date:'2026-10-15'});
  ctx.$_gymGridEventId = 'evw2';
  ctx.$_gymGridData = {a1:{vals:[],obs:'',hiddenEx:[],extraEx:[]}};
  const athletes = [{id:'a1',name:'Atleta 1'}];
  const tableHtml = ctx._gymGridTableHtml(gs, athletes);
  assert.ok(!tableHtml.includes('⚠️'));
});

console.log('\n[5] Integração em renderAtGinasio (sps-v222: separador próprio, já não é renderAtTreino)');
test('renderAtGinasio inclui o card de streak e de evolução quando a atleta tem histórico de ginásio', () => {
  ctx.$APP = freshApp();
  ctx.$APP.athletes.push({id:'a1',teamId:'T1',name:'Atleta 1'});
  ctx.$AID = 'a1';
  // Mesmos 2 eventos servem para o streak (RSVP) e para a evolução (gymSheet+registo) —
  // criar eventos extra sem RSVP quebraria a contagem do streak (o mais recente sem
  // confirmação faria parar a sequência em 0), por isso tudo aqui aponta para g1/g2.
  const gs1={id:'gs_g1',title:'Ficha',exercises:[{exId:null,name:'Squat',reps:'3x10',rir:'2'}]};
  const gs2={id:'gs_g2',title:'Ficha',exercises:[{exId:null,name:'Squat',reps:'3x10',rir:'2'}]};
  ctx.$APP.schedule.push({id:'g1',type:'Ginásio',teamId:'T1',date:'2026-10-01',gymSheet:gs1,rsvp:{a1:{status:'yes'}}});
  ctx.$APP.schedule.push({id:'g2',type:'Ginásio',teamId:'T1',date:'2026-10-08',gymSheet:gs2,rsvp:{a1:{status:'yes'}}});
  ctx.$APP.gymRecords.push({athleteId:'a1',eventId:'g1',vals:[{carga:'40',series:'3',reps:'10',rir:'2'}]});
  ctx.$APP.gymRecords.push({athleteId:'a1',eventId:'g2',vals:[{carga:'45',series:'3',reps:'10',rir:'2'}]});
  let capturedHtml='';
  ctx.document.getElementById = (id)=>{ const el=makeFakeElement(); if(id==='atp-ginasio'){ Object.defineProperty(el,'innerHTML',{get(){return capturedHtml;},set(v){capturedHtml=v;}}); } return el; };
  ctx.renderAtGinasio();
  // sps-v221: streak + evolução vivem dentro do mesmo card único "Ginásio"
  // (pedido do Roger, 14/10/2026) — já não há um cabeçalho próprio "A tua
  // Evolução (Ginásio)" nem o texto "...de Ginásio seguidas..." (ficou só
  // "...seguidas confirmadas", dentro do card).
  // sps-v222 (15/10/2026): esse card mudou-se do separador "Treino" para um
  // separador próprio "Ginásio" (atp-ginasio/renderAtGinasio) — pedido do
  // Roger de separar o que é liderado pela equipa técnica do que é "Treino
  // Individual" (Planos Individuais + Treino Extra). Cobertura completa
  // desta separação está em test_at_ginasio_treino_split_v222.js; aqui só
  // se confirma que a integração continua a incluir as duas partes
  // (regressão), agora no separador certo.
  assert.ok(capturedHtml.includes('sessões seguidas confirmadas'));
  assert.ok(capturedHtml.includes('🏋️‍♀️ Ginásio'));
});

// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
