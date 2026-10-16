// sps-v229 — teste dedicado: Lista de Convocados sem Capitã/Vice-Capitã nem Bancada,
// coluna "Assinatura" realmente em branco e alinhada com o seu cabeçalho.
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('script not found');
const code = m[1];

// Stubs mínimos de DOM/ambiente necessários para carregar o ficheiro inteiro.
function makeCtx() {
  const calls = [];
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
    toast: (msg,kind)=>{ calls.push(['toast',msg,kind]); },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Array, Object, Promise, Set, Map, String, Number, Boolean, RegExp, Error,
    print: ()=>{},
    URL, URLSearchParams,
  };
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return { ctx, calls };
}

const { ctx, calls } = makeCtx();

// _printWin precisa de ser capturada ANTES do resto do código correr, por isso
// avaliamos o script e, a seguir, substituímos _printWin por um stub que guarda o HTML.
try {
  vm.runInContext(code, ctx, { filename: 'index.html-script.js' });
} catch (e) {
  // Algum código de arranque (ex: listeners reais) pode falhar em ambiente stub — tentamos
  // continuar, desde que as funções que precisamos já tenham sido definidas.
  console.log('aviso (arranque completo pode ter falhado, prosseguindo):', e.message);
}

// Nota: APP/_initG/_displayName/fmtDate/escHtml/_pdfCompactStyleHtml/_pdfRowScale/
// _printWin/toast são todos declarados com "let"/"function" no topo do script real —
// bindings do ambiente léxico global deste contexto vm, não propriedades do objeto
// global. Por isso têm de ser reatribuídos por assignment simples ("APP = ...", sem
// "globalThis." pela frente) para a mesma ligação léxica ser atualizada; um
// "globalThis.APP = ..." cria só uma propriedade nova no objeto global, invisível ao
// resto do código que referencia a variável "APP" diretamente.
vm.runInContext(`
  var __lastPdf = null;
  _printWin = function(title, html) { __lastPdf = {title, html}; };
  toast = function(msg, type) { /* no-op no teste */ };

  APP = {
    config: { clubName: 'Moreirense FC' },
    athletes: [
      {id:'a1', name:'Ana Silva', teamId:'t1', number:1, pos:'GR'},
      {id:'a2', name:'Bruna Costa', teamId:'t1', number:2, pos:'DEF'},
      {id:'a3', name:'Carla Dias', teamId:'t1', number:3, pos:'MED'},
      {id:'a4', name:'Diana Reis', teamId:'t1', number:4, pos:'AV'},
      {id:'a5', name:'Eva Pinto', teamId:'t1', number:5, pos:'DEF'},
    ],
    games: [{
      id:'g1', teamId:'t1', opp:'FC Tadim', loc:'Casa', date:'2026-10-18', time:'15:00',
      convocatoria:['a1','a2','a3','a4','a5'],
      lineup:['a1','a2','a3'],
      subs:['a4'],
      bancada:['a5'],
      captain:'a2',
      viceCaptain:'a3',
    }],
  };
`, ctx);

vm.runInContext(`exportConvocatoriaListPDF('g1');`, ctx);

const result = vm.runInContext(`__lastPdf`, ctx);

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.log('FALHOU:', msg); }
}

assert(result && typeof result.html === 'string', 'gerou HTML do PDF');
const html = result.html;

assert(!/Capit/i.test(html), 'não deve mencionar "Capitã"/"Capitão" em nenhum sítio');
assert(!/Vice-Capit/i.test(html), 'não deve mencionar "Vice-Capitã"');
assert(!/>C<\/td>/.test(html) && !/>VC<\/td>/.test(html), 'não deve haver célula com "C"/"VC"');
assert(!/>B<\/td>/.test(html), 'não deve haver célula "B" de Bancada');
assert(!/title="Bancada/.test(html), 'não deve haver tooltip de Bancada no cabeçalho');
assert(!/>Banco</.test(html), 'cabeçalho "Banco" removido');

// Cabeçalho deve ter exatamente 5 colunas: Nome, Nº, Posição, Convocada, Assinatura
const theadMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
assert(!!theadMatch, 'tem thead');
const thCount = (theadMatch[1].match(/<th/g) || []).length;
assert(thCount === 5, 'thead tem exatamente 5 colunas (tinha ' + thCount + ')');
assert(/Assinatura/.test(theadMatch[1]), 'cabeçalho inclui Assinatura');

// Cada linha de atleta deve ter exatamente 5 <td>, e a última deve estar vazia (Assinatura)
const rowMatches = [...html.matchAll(/<tr><td>([\s\S]*?)<\/tr>/g)];
assert(rowMatches.length === 5, 'gerou 5 linhas de atleta (tinha ' + rowMatches.length + ')');
for (const rm of rowMatches) {
  const tds = rm[0].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
  assert(tds.length === 5, 'linha tem exatamente 5 <td> (tinha ' + tds.length + '): ' + rm[0].slice(0,60));
  const lastTd = tds[tds.length - 1];
  const innerLast = lastTd.replace(/<td[^>]*>/, '').replace(/<\/td>/, '');
  assert(innerLast === '', 'última célula (Assinatura) está vazia, era: "' + innerLast + '"');
}

// Convocada ainda deve mostrar o visto verde para as 5 (todas em g.convocatoria)
const checks = (html.match(/color:#16a34a/g) || []).length;
assert(checks === 5, 'visto verde aparece nas 5 linhas (apareceu ' + checks + ')');

// Rodapé não deve mencionar capitã/vice
const footerMatch = html.match(/Convocadas: \d+ de \d+[^<]*/);
assert(!!footerMatch, 'tem linha de rodapé Convocadas');
assert(footerMatch[0] === 'Convocadas: 5 de 5', 'rodapé é só "Convocadas: 5 de 5", era: "' + footerMatch[0] + '"');

console.log(`\n${pass} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
