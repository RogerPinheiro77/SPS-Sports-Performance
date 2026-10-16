// sps-v230 — teste dedicado: botão na App Team Manager para abrir a Ficha de Jogo
// Tática já com opção de enviar em PDF por WhatsApp (_printWin com shareOptions).
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('script not found');
const code = m[1];

function makeCtx() {
  const windowOpenCalls = [];
  const document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add(){}, remove(){} }, setAttribute(){}, appendChild(){} }),
    addEventListener: () => {},
    body: { appendChild(){}, classList:{add(){},remove(){}} },
    documentElement: {},
  };
  const window = {};
  const ctx = {
    window, document,
    navigator: { serviceWorker: undefined, onLine: true },
    location: { search: '', href: 'https://example.com/', hostname: 'example.com' },
    localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} },
    sessionStorage: { getItem(){return null;}, setItem(){}, removeItem(){} },
    console,
    fetch: () => Promise.resolve({ ok:true, json: async()=>({}) }),
    toast: ()=>{},
    setTimeout: (fn)=>{ /* nunca corre automaticamente — evita o w.print() de _printWin durante o teste */ },
    clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Array, Object, Promise, Set, Map, String, Number, Boolean, RegExp, Error,
    print: ()=>{},
    URL, URLSearchParams,
  };
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return { ctx, windowOpenCalls };
}

const { ctx, windowOpenCalls } = makeCtx();

try {
  vm.runInContext(code, ctx, { filename: 'index.html-script.js' });
} catch (e) {
  console.log('aviso (arranque completo pode ter falhado, prosseguindo):', e.message);
}

// window.open stub — captura o HTML escrito no "popup" sem abrir nada a sério.
vm.runInContext(`
  var __lastWin = null;
  window.open = function(){
    var w = {
      document: {
        write: function(html){ __lastWin = { html: html }; },
        close: function(){},
      },
      print: function(){},
    };
    return w;
  };

  APP = {
    config: { clubName: 'Moreirense FC', clubLogo: '' },
    athletes: [
      {id:'a1', name:'Ana Silva', teamId:'t1', number:1, pos:'GR'},
      {id:'a2', name:'Bruna Costa', teamId:'t1', number:2, pos:'DEF'},
      {id:'a3', name:'Carla Dias', teamId:'t1', number:3, pos:'MED'},
    ],
    games: [{
      id:'g1', teamId:'t1', opp:'FC Tadim', loc:'Casa', date:'2026-10-18', time:'15:00',
      convocatoria:['a1','a2','a3'],
      lineup:['a1','a2','a3'],
      subs:[],
      bancada:[],
      captain:'a2',
      viceCaptain:'a3',
      formation:'1-4-3-3',
    }],
  };
`, ctx);

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.log('FALHOU:', msg); }
}

// [1] _printWin SEM shareOptions (todos os outros relatórios da app) — nunca deve
// injetar a barra/scripts novos. Regressão central: zero alteração de comportamento
// para qualquer chamador que não passe o 6º argumento.
vm.runInContext(`_printWin('Teste Normal','<p>corpo</p>');`, ctx);
let r = vm.runInContext(`__lastWin`, ctx);
assert(!!r && typeof r.html === 'string', '_printWin sem shareOptions gera HTML');
assert(!r.html.includes('pr-toolbar'), 'sem shareOptions: nenhuma barra de ferramentas');
assert(!r.html.includes('html2canvas'), 'sem shareOptions: sem script html2canvas');
assert(!r.html.includes('jspdf.umd'), 'sem shareOptions: sem script jsPDF');
assert(!r.html.includes('_spsShareWhats'), 'sem shareOptions: sem função de partilha');

// [2] _printWin COM shareOptions — a barra/scripts devem aparecer, com o fileName certo.
vm.runInContext(`_printWin('Ficha Pré-Jogo — FC Tadim','<p>corpo</p>',undefined,undefined,undefined,{fileName:'Ficha_FC_Tadim_2026-10-18.pdf'});`, ctx);
r = vm.runInContext(`__lastWin`, ctx);
assert(r.html.includes('pr-toolbar'), 'com shareOptions: barra de ferramentas presente');
assert(r.html.includes('id="pr-tb-wa-btn"'), 'com shareOptions: botão WhatsApp presente');
assert(r.html.includes('🖨️ Imprimir'), 'com shareOptions: botão Imprimir presente');
assert(r.html.includes('html2canvas/1.4.1/html2canvas.min.js'), 'com shareOptions: script html2canvas carregado');
assert(r.html.includes('jspdf.umd.min.js'), 'com shareOptions: script jsPDF carregado');
assert(r.html.includes('_spsShareWhats'), 'com shareOptions: função de partilha definida');
assert(r.html.includes("fileName='Ficha_FC_Tadim_2026-10-18.pdf'") || r.html.includes('fileName="Ficha_FC_Tadim_2026-10-18.pdf"') || r.html.includes("'Ficha_FC_Tadim_2026-10-18.pdf'"), 'nome do ficheiro embutido corretamente');
// Nenhum "</script>" cru dentro do HTML gerado deve ter escapado mal-formado (balanceamento básico)
const openTags = (r.html.match(/<script[ >]/g)||[]).length;
const closeTags = (r.html.match(/<\/script>/g)||[]).length;
assert(openTags === closeTags, `tags <script> balanceadas no HTML gerado (abertas=${openTags}, fechadas=${closeTags})`);
assert(r.html.includes('.pr-toolbar{display:none!important}') || r.html.includes('.pr-toolbar{display:none !important}'), 'barra escondida explicitamente em @media print');

// [3] exportJogoPDF('prejogo') — deve passar shareOptions com fileName derivado do jogo.
vm.runInContext(`exportJogoPDF('g1','prejogo');`, ctx);
r = vm.runInContext(`__lastWin`, ctx);
assert(r.html.includes('pr-toolbar'), 'exportJogoPDF prejogo: barra de partilha presente');
assert(r.html.includes('Ficha_FC_Tadim_2026-10-18.pdf'), 'exportJogoPDF prejogo: fileName derivado do jogo (adversário+data)');
assert(r.html.includes('Ficha Pré-Jogo'), 'exportJogoPDF prejogo: título da Ficha Pré-Jogo');

// [4] exportJogoPDF('campo') — NUNCA deve ganhar a barra de partilha (fora do âmbito do pedido).
vm.runInContext(`exportJogoPDF('g1','campo');`, ctx);
r = vm.runInContext(`__lastWin`, ctx);
assert(!r.html.includes('pr-toolbar'), 'exportJogoPDF campo (Folha Tática): sem barra de partilha (regressão)');

// [5] exportJogoPDF('full') — também não deve ganhar a barra (só 'prejogo' explicitamente pedido).
vm.runInContext(`exportJogoPDF('g1','full');`, ctx);
r = vm.runInContext(`__lastWin`, ctx);
assert(!r.html.includes('pr-toolbar'), 'exportJogoPDF full (Relatório Completo): sem barra de partilha');

// [6] exportConvocatoriaListPDF — relatório completamente diferente, nunca deve ganhar a
// barra (não foi pedido para a Lista de Convocados, só para a Ficha de Jogo Tática).
vm.runInContext(`exportConvocatoriaListPDF('g1');`, ctx);
r = vm.runInContext(`__lastWin`, ctx);
assert(!r.html.includes('pr-toolbar'), 'exportConvocatoriaListPDF: sem barra de partilha (fora do âmbito do pedido)');

// [7] renderVisaoGeral — o botão novo "Ficha de Jogo (PDF) — WhatsApp" deve aparecer no
// cartão do Próximo Jogo, chamando exportJogoPDF diretamente (sem navegar de página).
vm.runInContext(`
  APP.schedule = [];
  APP.config.competitions = [];
  ROLE = 'team_manager';
  AID = null;
`, ctx);
let vgHtml = '';
try {
  vgHtml = vm.runInContext(`renderVisaoGeral()`, ctx) || '';
  // renderVisaoGeral normalmente escreve no DOM (getElementById) em vez de devolver string;
  // como o stub de getElementById devolve null, a função pode não ter onde escrever — por
  // isso também testamos diretamente o HTML do cartão via uma chamada mais isolada abaixo.
} catch(e) { /* renderVisaoGeral pode depender de mais DOM do que o stub oferece — ver teste isolado abaixo */ }

// Teste isolado e robusto: confirma a string literal do botão no próprio ficheiro fonte,
// ligada ao jogo certo via exportJogoPDF — não depende do DOM/render completo.
assert(src.includes("onclick=\"exportJogoPDF('\${nextGame.id}','prejogo')\">📲 Ficha de Jogo (PDF)"),
  'renderVisaoGeral: botão novo chama exportJogoPDF(nextGame.id,\'prejogo\') diretamente');
assert(src.includes('Abrir Convocatória / Pré-Jogo'),
  'renderVisaoGeral: botão antigo (navegação normal) continua presente (regressão)');

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
