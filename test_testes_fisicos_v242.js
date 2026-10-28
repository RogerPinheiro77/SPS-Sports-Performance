// sps-v242: aba "Testes Físicos" (Yo-Yo Intermittent Recovery Test, IR1 + IR2) —
// pedido do Roger: catálogo de testes, registo por atleta, bandas vermelho/amarelo/
// verde (científicas por defeito, editáveis pelo staff), e ranking visível à atleta
// sem nomear/mostrar as colegas. Testa o código REAL extraído do index.html.
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
function extractLine(name) {
  const re = new RegExp('const ' + name + '\\s*=.*?;');
  const mm = full.match(re);
  assert.ok(mm, 'constante ' + name + ' não encontrada');
  return mm[0];
}
function extractFn(name) {
  // extrai "function name(...){ ... }" fazendo brace-matching real
  const startRe = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const sm = startRe.exec(full);
  assert.ok(sm, 'função ' + name + ' não encontrada');
  let i = sm.index + sm[0].length;
  let depth = 1;
  const bodyStart = i;
  while (depth > 0 && i < full.length) {
    if (full[i] === '{') depth++;
    else if (full[i] === '}') depth--;
    i++;
  }
  return full.slice(sm.index, i);
}

const src = [
  extractConst('YOYO_LEVEL_SHUTTLES').replace('const ', 'var '),
  extractLine('YOYO_LEVELS_ORDER').replace('const ', 'var '),
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

// ── 1) _yoyoDistance: estrutura real de patamares por nível ──
// Nível 5 tem 1 patamar (5.1) → total = 1 patamar = 40m
ok(S._yoyoDistance('5.1') === 40, '5.1 → 40m (nível 5 tem só 1 patamar)');
// Nível 9 tem 1 patamar → acumulado: 5(1)+9(1)=2 patamares=80m
ok(S._yoyoDistance('9.1') === 80, '9.1 → 80m (acumulado 2 patamares)');
// Nível 11 tem 2 patamares → 11.2 = 5(1)+9(1)+11(2)=4 patamares=160m
ok(S._yoyoDistance('11.2') === 160, '11.2 → 160m');
// Nível 13 tem 4 patamares → 13.4 = 1+1+2+3+4=11 patamares=440m
ok(S._yoyoDistance('13.4') === 440, '13.4 → 440m');
// Nível 14 (1º com 8 patamares) → 14.1 = 11(anteriores)+1=12 patamares=480m
ok(S._yoyoDistance('14.1') === 480, '14.1 → 480m (primeiro patamar do nível 14)');
// 19.4 — valor usado no mockup aprovado pelo Roger, cross-checado contra a tabela oficial
// (theyoyotest.com/table-YYIR1.htm): acumulado até ao fim do nível 18 = 1+1+2+3+4+8*5=51
// patamares; 19.4 = 51+4=55 patamares = 2200m
ok(S._yoyoDistance('19.4') === 2200, '19.4 → 2200m (cross-check com a tabela oficial)');
// Nível/patamar inválido (patamar fora do intervalo do nível)
ok(S._yoyoDistance('5.2') === null, '5.2 → null (nível 5 só tem 1 patamar)');
ok(S._yoyoDistance('6.1') === null, '6.1 → null (nível 6 não existe na tabela real)');
ok(S._yoyoDistance('abc') === null, 'entrada não numérica → null');
ok(S._yoyoDistance('') === null, 'entrada vazia → null');
// Aceita vírgula como separador decimal (input PT)
ok(S._yoyoDistance('19,4') === 2200, '19,4 (vírgula) → 2200m, igual a 19.4');

// ── 2) VO2max (Bangsbo, Iaia & Krustrup 2008) ──
ok(S.PHYSICAL_TESTS.yoyo_ir1.vo2max(2200) === +(2200*0.0084+36.4).toFixed(1), 'VO2max IR1 usa a fórmula Bangsbo 2008');
ok(S.PHYSICAL_TESTS.yoyo_ir1.vo2max(null) === null, 'VO2max IR1 sem distância → null');
ok(S.PHYSICAL_TESTS.yoyo_ir2.vo2max(1000) === +(1000*0.0136+45.3).toFixed(1), 'VO2max IR2 usa a sua própria fórmula (distinta do IR1)');

// ── 3) Bandas por idade (Emmonds et al. 2022) — pontos exatos da tabela e interpolação ──
let b = S._yoyoIr1BandsForAge(19);
ok(b.p25 === 1085 && b.p75 === 1659, 'bandas IR1 aos 19 anos = ponto exato da tabela (1085/1659)');
b = S._yoyoIr1BandsForAge(20); // meio entre 19 (1085/1659) e 21 (1201/1786)
ok(b.p25 === Math.round((1085+1201)/2) && b.p75 === Math.round((1659+1786)/2), 'bandas IR1 aos 20 anos = interpolação linear entre 19 e 21');
b = S._yoyoIr1BandsForAge(5); // abaixo do mínimo da tabela (13)
ok(b.p25 === 754 && b.p75 === 1249, 'idade abaixo do mínimo da tabela usa o primeiro ponto (clamp)');
b = S._yoyoIr1BandsForAge(40); // acima do máximo da tabela (29)
ok(b.p25 === 1447 && b.p75 === 1906, 'idade acima do máximo da tabela usa o último ponto (clamp)');
b = S._yoyoIr1BandsForAge(null); // idade desconhecida
ok(b.p25 != null && b.p75 != null, 'idade desconhecida não rebenta, devolve bandas do ponto médio');

// ── 4) _physicalTestBandsFor / _physicalTestColor — precedência manual > automático > nenhum ──
S.APP.config.physicalTestBands = null;
let bands = S._physicalTestBandsFor('yoyo_ir1', 19);
ok(bands.p25 === 1085 && bands.p75 === 1659, 'sem config manual, IR1 usa bandas científicas por idade');
ok(S._physicalTestBandsFor('yoyo_ir2', 19) === null, 'IR2 sem bandas manuais nem científicas → null (staff ainda não definiu)');

ok(S._physicalTestColor('yoyo_ir1', 1000, 19) === 'r', 'distância abaixo do p25 → vermelho');
ok(S._physicalTestColor('yoyo_ir1', 1085, 19) === 'y', 'distância exatamente no p25 → amarelo (fronteira inferior incluída)');
ok(S._physicalTestColor('yoyo_ir1', 1659, 19) === 'g', 'distância exatamente no p75 → verde (fronteira superior incluída)');
ok(S._physicalTestColor('yoyo_ir1', 1300, 19) === 'y', 'distância entre p25 e p75 → amarelo');
ok(S._physicalTestColor('yoyo_ir1', 2000, 19) === 'g', 'distância acima do p75 → verde');
ok(S._physicalTestColor('yoyo_ir2', 1500, 19) === null, 'IR2 sem bandas definidas → cor neutra (null), nunca inventada');
ok(S._physicalTestColor('yoyo_ir1', null, 19) === null, 'sem distância → null');

// Override manual do staff tem sempre prioridade, mesmo para um teste com default científico
S.APP.config.physicalTestBands = { yoyo_ir1: { mode: 'manual', p25: 500, p75: 700 } };
ok(S._physicalTestColor('yoyo_ir1', 600, 19) === 'y', 'bandas manuais do staff sobrepõem-se ao default científico (IR1)');
ok(S._physicalTestColor('yoyo_ir1', 400, 19) === 'r', 'bandas manuais do staff — abaixo do p25 manual');
// Staff define manualmente para o IR2 (sem ciência disponível)
S.APP.config.physicalTestBands = { yoyo_ir2: { mode: 'manual', p25: 1000, p75: 1500 } };
ok(S._physicalTestColor('yoyo_ir2', 1200, 19) === 'y', 'IR2 passa a ter cor depois do staff definir bandas manuais');
S.APP.config.physicalTestBands = null; // reset

// ── 5) _physicalTestLatestByAthlete — 1 resultado por atleta (o mais recente), ordenado desc ──
S.APP.physicalTestResults = [
  { id: 'r1', athleteId: 'a1', teamId: 'T1', testId: 'yoyo_ir1', date: '2026-09-01', distance: 1200 },
  { id: 'r2', athleteId: 'a1', teamId: 'T1', testId: 'yoyo_ir1', date: '2026-10-01', distance: 1400 }, // mais recente de a1
  { id: 'r3', athleteId: 'a2', teamId: 'T1', testId: 'yoyo_ir1', date: '2026-10-05', distance: 1600 },
  { id: 'r4', athleteId: 'a3', teamId: 'T1', testId: 'yoyo_ir1', date: '2026-10-02', distance: 900 },
  { id: 'r5', athleteId: 'a4', teamId: 'T2', testId: 'yoyo_ir1', date: '2026-10-02', distance: 2000 }, // outra equipa
  { id: 'r6', athleteId: 'a1', teamId: 'T1', testId: 'yoyo_ir2', date: '2026-10-01', distance: 800 }, // outro teste
];
let latest = S._physicalTestLatestByAthlete('yoyo_ir1', 'T1');
ok(latest.length === 3, 'latestByAthlete: 3 atletas de T1 com resultado em yoyo_ir1 (a4 é de T2, excluída)');
ok(latest[0].athleteId === 'a2' && latest[0].distance === 1600, 'ordenado desc: a2 (1600) em 1º');
ok(latest[1].athleteId === 'a1' && latest[1].distance === 1400, 'a1 usa o resultado MAIS RECENTE (1400, não 1200)');
ok(latest[2].athleteId === 'a3' && latest[2].distance === 900, 'a3 (900) em último');

// ── 6) _physicalTestRankFor — posição + percentil, nunca nomes/valores de outras ──
let rank = S._physicalTestRankFor('yoyo_ir1', 'T1', 'a2');
ok(rank.pos === 1 && rank.total === 3 && rank.pct === 100, 'a2 (melhor resultado) → 1º lugar de 3, percentil 100');
rank = S._physicalTestRankFor('yoyo_ir1', 'T1', 'a1');
ok(rank.pos === 2 && rank.total === 3 && rank.pct === 50, 'a1 (resultado intermédio) → 2º de 3, percentil 50');
rank = S._physicalTestRankFor('yoyo_ir1', 'T1', 'a3');
ok(rank.pos === 3 && rank.total === 3 && rank.pct === 0, 'a3 (pior resultado) → 3º de 3, percentil 0');
ok(S._physicalTestRankFor('yoyo_ir1', 'T1', 'nao-existe') === null, 'atleta sem resultado neste teste → null');
ok(Object.keys(rank).sort().join(',') === 'pct,pos,total', 'rank devolve só {pos,total,pct} — nunca nomes/valores de colegas');

// Caso de 1 única atleta com resultado → percentil 100 (sem divisão por zero)
S.APP.physicalTestResults = [{ id: 'r1', athleteId: 'solo', teamId: 'T9', testId: 'yoyo_ir1', date: '2026-10-01', distance: 1000 }];
rank = S._physicalTestRankFor('yoyo_ir1', 'T9', 'solo');
ok(rank.pos === 1 && rank.total === 1 && rank.pct === 100, 'única atleta da equipa com resultado → 1º de 1, percentil 100 (sem NaN)');

console.log(`\nTODOS OS ${n} TESTES PASSARAM`);
