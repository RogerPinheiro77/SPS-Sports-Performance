// sps-v248: Registo de Peso — autorregisto da atleta (pedido do Roger, 17/11/2026).
// Testa o código REAL extraído do index.html: atSavePeso() (escrita do lado da atleta),
// _pesoDirInfo/_pesoTrendHtml (seta de tendência ±0.3kg, cores neutras) e, sobretudo,
// a exigência explícita do Roger de que o autorregisto NUNCA se cruza com os dias da
// avaliação profissional da nutricionista — mesma tabela nutrition_records, mas sempre
// separadas por `source`, nunca misturadas para histórico nem para cálculo de tendência.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
const full = m[1];

function extractFn(name) {
  const re = new RegExp('(?:async\\s+)?function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const start = full.search(re);
  assert.ok(start >= 0, 'função ' + name + ' não encontrada');
  let depth = 0, i = full.indexOf('{', start), end = -1;
  for (; i < full.length; i++) {
    if (full[i] === '{') depth++;
    else if (full[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return full.slice(start, end);
}
function extractConst(name) {
  const re = new RegExp('const ' + name + '\\s*=.*?;');
  const mm = full.match(re);
  assert.ok(mm, 'constante ' + name + ' não encontrada');
  return mm[0];
}

const src = [
  extractConst('PESO_FLAT_THRESHOLD').replace('const ', 'var '),
  extractFn('_pesoDirInfo'),
  extractFn('_pesoTrendHtml'),
  extractFn('atSavePeso'),
].join('\n\n');

let n = 0;
function ok(cond, msg) { assert.ok(cond, 'FALHA: ' + msg); n++; console.log('OK: ' + msg); }

function freshSandbox() {
  const sandbox = {
    APP: { nutritionAssessments: [] },
    AID: 'athlete1',
    _sync: true,
    _syncCalls: [],
    document: { _vals: {}, getElementById(id) { const v = this._vals[id]; return v !== undefined ? { value: v } : null; } },
    uid: (() => { let c = 0; return () => 'uid_' + (c++); })(),
    today: () => '2026-11-17',
    saveData() { sandbox._saved = true; },
    cloudUpsert: async (table, row) => { sandbox._syncCalls.push({ table, row: { ...row } }); },
    toast: (msg, type) => { sandbox._lastToast = { msg, type }; },
    renderAtNutri() { sandbox._rendered = true; },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

// ── 1) _pesoDirInfo: limiar ±0.3kg, cores neutras (nunca verde/vermelho) ──────────
{
  const sb = freshSandbox();
  const flat1 = sb._pesoDirInfo(61.0, 61.0);
  ok(flat1.dir === 'flat' && flat1.color === '#6b7572', 'diff=0.0 → flat (cinza)');
  const flat2 = sb._pesoDirInfo(61.2, 61.0);
  ok(flat2.dir === 'flat', 'diff=+0.2 (dentro do limiar) → flat');
  const up = sb._pesoDirInfo(61.3, 61.0);
  ok(up.dir === 'up' && up.color === '#b5541a' && up.arrow === '↑', 'diff=+0.3 (no limiar) → up (laranja), nunca "bom/mau"');
  const down = sb._pesoDirInfo(60.7, 61.0);
  ok(down.dir === 'down' && down.color === '#2563a8' && down.arrow === '↓', 'diff=-0.3 (no limiar) → down (azul)');
  ok(sb._pesoDirInfo(null, 61.0) === null, 'valores em falta → null (sem seta)');
}

// ── 2) _pesoTrendHtml: formatação com sinal ────────────────────────────────────
{
  const sb = freshSandbox();
  const htmlUp = sb._pesoTrendHtml(62.0, 61.0);
  ok(htmlUp.includes('+1') && htmlUp.includes('#b5541a') && htmlUp.includes('↑'), '_pesoTrendHtml formata subida com sinal + e cor laranja');
  const htmlDown = sb._pesoTrendHtml(60.0, 61.0);
  ok(htmlDown.includes('-1') && htmlDown.includes('#2563a8'), '_pesoTrendHtml formata descida com cor azul');
}

// ── 3) atSavePeso: cria registo novo, 1x/dia (substitui, nunca duplica) ──────────
{
  const sb = freshSandbox();
  sb.document._vals['at-peso-input'] = '61.5';
  sb.atSavePeso();
  ok(sb.APP.nutritionAssessments.length === 1, 'primeiro registo do dia é criado');
  const rec1 = sb.APP.nutritionAssessments[0];
  ok(rec1.source === 'atleta', 'registo da atleta é sempre tagged source:"atleta"');
  ok(rec1.weight === '61.5' && rec1.date === '2026-11-17' && rec1.athleteId === 'athlete1', 'campos do registo corretos');
  ok(sb._syncCalls.length === 1 && sb._syncCalls[0].table === 'nutrition_records', 'cloudUpsert chamado em nutrition_records');

  // Segundo registo no MESMO dia substitui o primeiro (mesmo id, sem duplicar)
  sb.document._vals['at-peso-input'] = '61.2';
  sb.atSavePeso();
  ok(sb.APP.nutritionAssessments.length === 1, '1x/dia: segundo registo do mesmo dia substitui, não duplica');
  ok(sb.APP.nutritionAssessments[0].id === rec1.id, 'substituição mantém o mesmo id (upsert correto na cloud)');
  ok(sb.APP.nutritionAssessments[0].weight === '61.2', 'peso atualizado para o novo valor');
}

// ── 4) atSavePeso: validação rejeita valores inválidos sem gravar ───────────────
{
  const sb = freshSandbox();
  ['', '0', '-5', 'abc'].forEach(bad => {
    sb.document._vals['at-peso-input'] = bad;
    sb.atSavePeso();
  });
  ok(sb.APP.nutritionAssessments.length === 0, 'valores inválidos (vazio/zero/negativo/não-numérico) não criam registo');
  ok(sb._lastToast && sb._lastToast.type === 'err', 'toast de erro mostrado para valor inválido');
}

// ── 5) INDEPENDÊNCIA (exigência explícita do Roger): autorregisto nunca colide ───
//      nem se cruza com o dia da avaliação da nutricionista, mesmo no MESMO dia.
{
  const sb = freshSandbox();
  // A nutricionista já tem uma avaliação profissional completa feita hoje, no mesmo dia.
  sb.APP.nutritionAssessments.push({
    id: 'nutri_aval_1', athleteId: 'athlete1', date: '2026-11-17', weight: '61.0',
    bodyFat: '19.5', source: 'nutricionista', registeredBy: 'Teresa Ferreira',
  });
  sb.document._vals['at-peso-input'] = '61.4';
  sb.atSavePeso();

  ok(sb.APP.nutritionAssessments.length === 2, 'autorregisto da atleta cria um 2º registo — nunca sobrescreve a avaliação da nutricionista, mesmo no mesmo dia');
  const nutriRec = sb.APP.nutritionAssessments.find(a => a.id === 'nutri_aval_1');
  ok(nutriRec.weight === '61.0' && nutriRec.bodyFat === '19.5', 'avaliação da nutricionista permanece intacta (peso e % gordura inalterados)');
  const selfRec = sb.APP.nutritionAssessments.find(a => a.source === 'atleta');
  ok(selfRec.weight === '61.4', 'autorregisto da atleta é o seu próprio registo separado');

  // Filtros usados em renderAtNutri (avals = nutricionista, selfAvals = atleta) e em
  // renderNutriDash/renderNutriPesagens devem particionar sem sobreposição.
  const avals = sb.APP.nutritionAssessments.filter(a => a.athleteId === 'athlete1' && a.source !== 'atleta');
  const selfAvals = sb.APP.nutritionAssessments.filter(a => a.athleteId === 'athlete1' && a.source === 'atleta');
  ok(avals.length === 1 && avals[0].id === 'nutri_aval_1', 'filtro "avals" (nutricionista) exclui o autorregisto');
  ok(selfAvals.length === 1 && selfAvals[0].id === selfRec.id, 'filtro "selfAvals" (atleta) exclui a avaliação da nutricionista');
  const overlap = avals.filter(a => selfAvals.some(s => s.id === a.id));
  ok(overlap.length === 0, 'as duas séries nunca se sobrepõem (partição total, mesmo dia)');
}

console.log(`\n${n} verificações OK — sps-v248 Registo de Peso (autorregisto da atleta)`);
