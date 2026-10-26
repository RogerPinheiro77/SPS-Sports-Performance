// sps-v240: PSE & Wellness ganha a categoria "PSE Jogo" própria, separada de
// "PSE Outros" (que antes juntava Jogo/Reabilitação/Ativação). Testa a função
// real _pseGroup extraída do index.html, mais as constantes de cor/rótulo e a
// construção dos 4 grupos usados nos gráficos/legenda/tabela.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
const full = m[1];

function extractConst(name) {
  const re = new RegExp('const ' + name + '\\s*=\\s*\\{[^}]*\\};');
  const mm = full.match(re);
  assert.ok(mm, 'constante ' + name + ' não encontrada');
  return mm[0];
}
function extractFn(name) {
  const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const start = full.search(re);
  assert.ok(start >= 0, 'função ' + name + ' não encontrada');
  let depth = 0, i = full.indexOf('{', start), end = -1;
  for (; i < full.length; i++) {
    if (full[i] === '{') depth++;
    else if (full[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return full.slice(start, end);
}

// top-level `const` dentro de vm.runInContext não fica exposto como propriedade do
// sandbox (só `var` fica) — mesmo gotcha já documentado noutros harnesses deste
// projeto. Troca-se para `var` só nesta extração isolada, sem tocar no ficheiro real.
const src = [
  extractConst('PSE_GROUP_COLORS').replace('const ', 'var '),
  extractConst('PSE_GROUP_LABELS').replace('const ', 'var '),
  extractFn('_pseGroup'),
].join('\n\n');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

// 1) sessionType -> grupo
assert.strictEqual(sandbox._pseGroup('Treino'), 'treino');
assert.strictEqual(sandbox._pseGroup(''), 'treino');
assert.strictEqual(sandbox._pseGroup(undefined), 'treino');
assert.strictEqual(sandbox._pseGroup('Ginásio'), 'ginasio');
assert.strictEqual(sandbox._pseGroup('Jogo'), 'jogo');
assert.strictEqual(sandbox._pseGroup('Reabilitação'), 'outros');
assert.strictEqual(sandbox._pseGroup('Ativação'), 'outros');
console.log('OK: _pseGroup separa Jogo das restantes categorias, Reabilitação/Ativação continuam em Outros');

// 2) cor do Jogo reaproveitada de EV_COLORS.Jogo (nunca 2 cores diferentes para a
// mesma categoria em sítios diferentes da app — mesmo princípio já aplicado ao Ginásio)
const evColorsMatch = full.match(/const EV_COLORS=\{[^}]*\}/);
assert.ok(evColorsMatch, 'EV_COLORS não encontrado');
const jogoEvColor = evColorsMatch[0].match(/Jogo:'(#[0-9a-f]+)'/i)[1];
assert.strictEqual(sandbox.PSE_GROUP_COLORS.jogo, jogoEvColor, 'FALHA: cor do PSE Jogo não bate com EV_COLORS.Jogo');
console.log('OK: cor de PSE Jogo (' + sandbox.PSE_GROUP_COLORS.jogo + ') é a mesma usada em todo o lado para Jogo (EV_COLORS)');

// 3) 4 grupos, todos com cor e rótulo definidos
['treino','ginasio','jogo','outros'].forEach(g => {
  assert.ok(sandbox.PSE_GROUP_COLORS[g], 'falta cor para ' + g);
  assert.ok(sandbox.PSE_GROUP_LABELS[g], 'falta rótulo para ' + g);
});
console.log('OK: os 4 grupos (treino/ginasio/jogo/outros) têm cor e rótulo definidos');

// 4) colunas da tabela individual e colspans atualizados para 9 (Atleta,Pos,4xPSE,Aguda,Crónica,ACWR)
const tableHeaderMatch = full.match(/<th>Atleta<\/th><th>Pos<\/th>[^`]*?<th>ACWR<\/th>/);
assert.ok(tableHeaderMatch, 'cabeçalho da tabela Individual não encontrado');
const thCount = (tableHeaderMatch[0].match(/<th/g) || []).length;
assert.strictEqual(thCount, 9, 'FALHA: esperadas 9 colunas no cabeçalho, encontradas ' + thCount);
console.log('OK: cabeçalho da tabela Individual tem as 9 colunas esperadas (com PSE Jogo)');

console.log('\nTODOS OS TESTES PASSARAM');
