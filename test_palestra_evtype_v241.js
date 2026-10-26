// sps-v241: novo tipo de evento "Palestra" no Planeamento (EV_TYPES/EV_COLORS), pedido
// do Roger a partir do formulário "Novo Evento" — quer poder agendar palestras como um
// tipo de evento próprio, além da lista predefinida já existente. Testa o código REAL
// extraído do index.html: Palestra aparece na lista/cores, tem cor própria distinta de
// todas as outras, e continua fora de _isTrainingType/MC_TRAINING_EV_TYPES/
// CARGA_PLAN_EV_TYPES (não é um tipo de treino nem tem carga física própria — mesmo
// tratamento já dado a Reunião/Consulta Nutri/Fisio).
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
function extractArrow(name) {
  const re = new RegExp('const ' + name + '\\s*=.*?;');
  const mm = full.match(re);
  assert.ok(mm, 'constante ' + name + ' não encontrada');
  return mm[0];
}

const src = [
  extractConst('EV_TYPES').replace('const ', 'var '),
  extractConst('EV_COLORS').replace('const ', 'var '),
  extractArrow('_isTrainingType').replace('const ', 'var '),
  extractConst('MC_TRAINING_EV_TYPES').replace('const ', 'var '),
  extractConst('CARGA_PLAN_EV_TYPES').replace('const ', 'var '),
].join('\n\n');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

// 1) Palestra está na lista de tipos, e tem cor própria
assert.ok(sandbox.EV_TYPES.includes('Palestra'), 'FALHA: Palestra não está em EV_TYPES');
assert.ok(sandbox.EV_COLORS.Palestra, 'FALHA: Palestra sem cor em EV_COLORS');
console.log('OK: Palestra está em EV_TYPES e tem cor em EV_COLORS (' + sandbox.EV_COLORS.Palestra + ')');

// 2) cor não colide com nenhuma das outras já existentes
const outras = Object.entries(sandbox.EV_COLORS).filter(([t]) => t !== 'Palestra');
outras.forEach(([t, c]) => assert.notStrictEqual(c, sandbox.EV_COLORS.Palestra, 'FALHA: cor de Palestra igual à de ' + t));
console.log('OK: cor de Palestra (' + sandbox.EV_COLORS.Palestra + ') é distinta das ' + outras.length + ' outras já usadas');

// 3) Palestra nunca conta como tipo de treino (mesmo tratamento de Reunião/Fisio/Consulta Nutri)
assert.strictEqual(sandbox._isTrainingType('Palestra'), false, 'FALHA: Palestra não devia contar como treino');
assert.ok(!sandbox.MC_TRAINING_EV_TYPES.includes('Palestra'), 'FALHA: Palestra não devia estar em MC_TRAINING_EV_TYPES');
assert.ok(!sandbox.CARGA_PLAN_EV_TYPES.includes('Palestra'), 'FALHA: Palestra não devia estar em CARGA_PLAN_EV_TYPES (sem carga física própria)');
console.log('OK: Palestra fica fora de treino/microciclo/carga planeada, tal como Reunião/Fisio/Consulta Nutri');

console.log('\nTODOS OS TESTES PASSARAM');
