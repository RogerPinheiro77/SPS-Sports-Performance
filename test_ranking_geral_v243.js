// sps-v243: Ranking Geral (percentil médio entre testes) + Ficha de Campo em PDF — pedido do
// Roger: "quero tambem na app atleta alem do ranking por exercicio como definimos um ranking
// geral quando tivermos mais que 1 exercicio" + "em cada teste que criarmos quero uma ficha
// em pdf tamanho a4 ... para recolher os dados / resultados no campo". Testa o código REAL
// extraído do index.html.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
const full = m[1];

function extractConst(name) {
  const re = new RegExp('const ' + name + '\\s*=\\s*[\\[{][^;]*?[\\]}];');
  const mm = full.match(re);
  assert.ok(mm, 'constante ' + name + ' não encontrada');
  return mm[0];
}
function extractFn(name) {
  const startRe = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const sm = startRe.exec(full);
  assert.ok(sm, 'função ' + name + ' não encontrada');
  let i = sm.index + sm[0].length;
  let depth = 1;
  while (depth > 0 && i < full.length) {
    if (full[i] === '{') depth++;
    else if (full[i] === '}') depth--;
    i++;
  }
  return full.slice(sm.index, i);
}

const src = [
  extractConst('YOYO_LEVEL_SHUTTLES').replace('const ', 'var '),
  full.match(/const YOYO_LEVELS_ORDER\s*=.*?;/)[0].replace('const ', 'var '),
  extractFn('_yoyoLevelLabel'),
  extractFn('_yoyoDistance'),
  extractConst('YOYO_IR1_AGE_BANDS').replace('const ', 'var '),
  extractFn('_yoyoIr1BandsForAge'),
  extractConst('PHYSICAL_TESTS').replace('const ', 'var '),
  extractFn('_physicalTestBandsFor'),
  extractFn('_physicalTestColor'),
  extractConst('PHYSICAL_TEST_COLOR_HEX').replace('const ', 'var '),
  extractConst('PHYSICAL_TEST_COLOR_LABEL').replace('const ', 'var '),
  extractFn('_physicalTestLatestByAthlete'),
  extractFn('_physicalTestRankFor'),
  extractFn('_physicalOverallScores'),
  extractFn('_physicalOverallRankFor'),
].join('\n\n');

const sandbox = {
  APP: { config: { physicalTestBands: null }, physicalTestResults: [] },
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const S = sandbox;

let n = 0;
function ok(cond, msg) {
  assert.ok(cond, 'FALHA: ' + msg);
  n++;
  console.log('OK: ' + msg);
}

// ── Cenário: 4 atletas, T1 ──
// a1: só fez IR1 (desde sps-v246 já entra no geral, com nTests=1 — ver nota no índex)
// a2: fez IR1 e IR2, melhor nos dois
// a3: fez IR1 e IR2, intermédia
// a4: fez IR1 e IR2, pior nos dois
S.APP.physicalTestResults = [
  { id: 'r1', athleteId: 'a1', teamId: 'T1', testId: 'yoyo_ir1', date: '2026-10-01', distance: 1000 },
  { id: 'r2', athleteId: 'a2', teamId: 'T1', testId: 'yoyo_ir1', date: '2026-10-01', distance: 2000 },
  { id: 'r3', athleteId: 'a3', teamId: 'T1', testId: 'yoyo_ir1', date: '2026-10-01', distance: 1500 },
  { id: 'r4', athleteId: 'a4', teamId: 'T1', testId: 'yoyo_ir1', date: '2026-10-01', distance: 800 },
  { id: 'r5', athleteId: 'a2', teamId: 'T1', testId: 'yoyo_ir2', date: '2026-10-01', distance: 1200 },
  { id: 'r6', athleteId: 'a3', teamId: 'T1', testId: 'yoyo_ir2', date: '2026-10-01', distance: 900 },
  { id: 'r7', athleteId: 'a4', teamId: 'T1', testId: 'yoyo_ir2', date: '2026-10-01', distance: 600 },
];

// ── 1) _physicalOverallScores — só entram quem tem ≥1 resultado; nTests reflete quantos testes distintos ──
let scores = S._physicalOverallScores('T1');
ok(scores.length === 4, '_physicalOverallScores inclui as 4 atletas com pelo menos 1 resultado (incl. a1, que só fez 1 teste)');
let a1row = scores.find(r => r.athleteId === 'a1');
ok(a1row.nTests === 1, 'a1 (só IR1) tem nTests=1');
ok(a1row.avgPct === 33, 'a1 (nTests=1) tem avgPct = o próprio percentil desse 1 teste (33), sem distorção');
let a2row = scores.find(r => r.athleteId === 'a2');
ok(a2row.nTests === 2, 'a2 (IR1+IR2) tem nTests=2');
// a2 é a melhor nos 2 testes → pct=100 em ambos → média 100
ok(a2row.avgPct === 100, 'a2 (melhor nos 2 testes) tem avgPct=100');
// a4 é a pior nos 2 testes → pct=0 em ambos → média 0
let a4row = scores.find(r => r.athleteId === 'a4');
ok(a4row.avgPct === 0, 'a4 (pior nos 2 testes) tem avgPct=0');
ok(scores[0].athleteId === 'a2', 'scores ordenado desc por avgPct — a2 em 1º');

// ── 2) _physicalOverallRankFor — sps-v246 (pedido do Roger: "quero que já exista Ranking
// Geral, mesmo que só haja um teste") — entra com ≥1 teste; a1 (só IR1) já conta ──
let r1 = S._physicalOverallRankFor('T1', 'a1');
ok(r1 !== null, 'a1 (1 só teste) já entra no Ranking Geral — não é mais null');
ok(r1.pos === 3 && r1.total === 4 && r1.pct === 33 && r1.nTests === 1, 'a1 → 3º lugar de 4 (agora com todas as atletas), percentil 33, nTests=1');
let r2 = S._physicalOverallRankFor('T1', 'a2');
ok(r2.pos === 1 && r2.total === 4 && r2.pct === 100, 'a2 → 1º lugar de 4, percentil 100');
let r3 = S._physicalOverallRankFor('T1', 'a3');
ok(r3.pos === 2 && r3.total === 4 && r3.pct === 67, 'a3 (intermédia) → 2º de 4, percentil 67');
let r4 = S._physicalOverallRankFor('T1', 'a4');
ok(r4.pos === 4 && r4.total === 4 && r4.pct === 0, 'a4 → 4º de 4 (última, incluindo a1), percentil 0');
ok(r2.nTests === 2 && r2.avgPct === 100, 'rank devolve também nTests/avgPct para o cartão da atleta');
ok(S._physicalOverallRankFor('T1', 'nao-existe') === null, 'atleta inexistente → null');
ok(S._physicalOverallRankFor('T9', 'a2') === null, 'equipa sem nenhum resultado → null');

// ── 3) Caso de empate/único elegível — sem divisão por zero ──
S.APP.physicalTestResults = [
  { id: 'x1', athleteId: 'solo', teamId: 'T9', testId: 'yoyo_ir1', date: '2026-10-01', distance: 1000 },
  { id: 'x2', athleteId: 'solo', teamId: 'T9', testId: 'yoyo_ir2', date: '2026-10-01', distance: 500 },
];
let solo = S._physicalOverallRankFor('T9', 'solo');
ok(solo.pos === 1 && solo.total === 1 && solo.pct === 100, 'única atleta elegível → 1º de 1, percentil 100 (sem NaN)');

// ── 4) Caso central do sps-v246 — atleta sozinha, 1 SÓ teste feito, já entra ──
S.APP.physicalTestResults = [
  { id: 'y1', athleteId: 'novata', teamId: 'T8', testId: 'yoyo_ir1', date: '2026-10-29', distance: 1200 },
];
let novata = S._physicalOverallRankFor('T8', 'novata');
ok(novata !== null, 'atleta com 1 só teste feito, sozinha na equipa, já entra no Ranking Geral (null seria o comportamento antigo)');
ok(novata.pos === 1 && novata.total === 1 && novata.nTests === 1, 'novata → 1º de 1, nTests=1 (card do Home pode já mostrar "1º de 1 · Geral")');

console.log(`\nTODOS OS ${n} TESTES PASSARAM`);
