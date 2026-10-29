// sps-v244: registo do Yo-Yo IR1/IR2 por "Etapa" (pedido do Roger, 29/10/2026) — "no registo,
// eu só quero registar a etapa em que está a atleta... o audio diz Stage 1 (etapa 1), eu só
// quero colocar isso e tu calculas o resto". Testa _yoyoEtapaToLevelPatamar/
// _yoyoLevelPatamarToEtapa (código REAL extraído do index.html) contra a tabela oficial
// YOYO_LEVEL_SHUTTLES (5:1,9:1,11:2,12:3,13:4,14-25:8 cada).
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
  extractLine('YOYO_LEVELS_ORDER').replace('const ', 'var '),
  extractFn('_yoyoLevelLabel'),
  extractFn('_yoyoDistance'),
  extractFn('_yoyoEtapaToLevelPatamar'),
  extractFn('_yoyoLevelPatamarToEtapa'),
].join('\n\n');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const S = sandbox;

let n = 0;
function ok(cond, msg) {
  assert.ok(cond, 'FALHA: ' + msg);
  n++;
  console.log('OK: ' + msg);
}

// ── Mapeamento esperado (cumulativo, a partir da tabela oficial) ──
// etapa 1  -> 5.1   (nível 5, único patamar)
// etapa 2  -> 9.1   (nível 9, único patamar)
// etapa 3  -> 11.1  (nível 11, 1º de 2)
// etapa 4  -> 11.2  (nível 11, 2º de 2)
// etapa 5  -> 12.1  (nível 12, 1º de 3)
// etapa 7  -> 12.3  (nível 12, último de 3)
// etapa 8  -> 13.1  (nível 13, 1º de 4)
// etapa 11 -> 13.4  (nível 13, último de 4)
// etapa 12 -> 14.1  (nível 14, 1º de 8 — início do primeiro bloco de 8)
// etapa 19 -> 14.8  (nível 14, último de 8)
// etapa 20 -> 15.1  (nível 15, 1º de 8)
// etapa 107 -> 25.8 (nível 25, último patamar de toda a tabela)
// etapa 108 -> além do máximo -> null

ok(S._yoyoEtapaToLevelPatamar(1) === '5.1', 'etapa 1 -> 5.1');
ok(S._yoyoEtapaToLevelPatamar(2) === '9.1', 'etapa 2 -> 9.1');
ok(S._yoyoEtapaToLevelPatamar(3) === '11.1', 'etapa 3 -> 11.1');
ok(S._yoyoEtapaToLevelPatamar(4) === '11.2', 'etapa 4 -> 11.2');
ok(S._yoyoEtapaToLevelPatamar(5) === '12.1', 'etapa 5 -> 12.1');
ok(S._yoyoEtapaToLevelPatamar(7) === '12.3', 'etapa 7 -> 12.3');
ok(S._yoyoEtapaToLevelPatamar(8) === '13.1', 'etapa 8 -> 13.1');
ok(S._yoyoEtapaToLevelPatamar(11) === '13.4', 'etapa 11 -> 13.4');
ok(S._yoyoEtapaToLevelPatamar(12) === '14.1', 'etapa 12 -> 14.1 (início do nível 14)');
ok(S._yoyoEtapaToLevelPatamar(19) === '14.8', 'etapa 19 -> 14.8 (fim do nível 14)');
ok(S._yoyoEtapaToLevelPatamar(20) === '15.1', 'etapa 20 -> 15.1 (início do nível 15)');
ok(S._yoyoEtapaToLevelPatamar(107) === '25.8', 'etapa 107 (máximo da tabela) -> 25.8');
ok(S._yoyoEtapaToLevelPatamar(108) === null, 'etapa 108 (além do máximo) -> null');
ok(S._yoyoEtapaToLevelPatamar(0) === null, 'etapa 0 -> null (inválida)');
ok(S._yoyoEtapaToLevelPatamar(-3) === null, 'etapa negativa -> null');
ok(S._yoyoEtapaToLevelPatamar('') === null, 'etapa vazia -> null');
ok(S._yoyoEtapaToLevelPatamar('abc') === null, 'etapa não numérica -> null');
ok(S._yoyoEtapaToLevelPatamar('12') === '14.1', 'etapa como string "12" -> 14.1 (funciona igual a número)');

// distância coerente: etapa N deve sempre dar distância = N*40 (cada etapa é 1 patamar de 40m)
for (const et of [1,2,3,4,5,7,8,11,12,19,20,50,91,107]) {
  const lp = S._yoyoEtapaToLevelPatamar(et);
  const dist = S._yoyoDistance(lp);
  ok(dist === et*40, `etapa ${et} -> distância ${et*40}m (via nível.patamar ${lp})`);
}

// ── Inverso: nível.patamar -> etapa ──
ok(S._yoyoLevelPatamarToEtapa('5.1') === 1, '5.1 -> etapa 1');
ok(S._yoyoLevelPatamarToEtapa('14.1') === 12, '14.1 -> etapa 12');
ok(S._yoyoLevelPatamarToEtapa('25.8') === 107, '25.8 -> etapa 107 (máximo)');
ok(S._yoyoLevelPatamarToEtapa('19.4') === null || typeof S._yoyoLevelPatamarToEtapa('19.4') === 'number', '19.4 (caso real do sps-v242) resolve sem rebentar');
// exemplo concreto do próprio teste v242 (nível 19, patamar 4): 1+1+2+3+4+8*5(14-18)+4 = 11+40+4=55 -> 2200m
ok(S._yoyoLevelPatamarToEtapa('19.4') === 55, '19.4 -> etapa 55 (1+1+2+3+4 + 8×5 níveis 14-18 + 4)');
ok(S._yoyoLevelPatamarToEtapa('6.1') === null, 'nível 6 não existe na tabela -> null');

// roundtrip: etapa -> nível.patamar -> etapa, para todas as 107 etapas válidas
let roundtripOk = true;
for (let et = 1; et <= 107; et++) {
  const lp = S._yoyoEtapaToLevelPatamar(et);
  const back = S._yoyoLevelPatamarToEtapa(lp);
  if (back !== et) { roundtripOk = false; console.log('FALHA roundtrip em etapa', et, '->', lp, '->', back); }
}
ok(roundtripOk, 'roundtrip etapa->nível.patamar->etapa consistente para as 107 etapas da tabela');

console.log(`\nTODOS OS ${n} TESTES PASSARAM`);
