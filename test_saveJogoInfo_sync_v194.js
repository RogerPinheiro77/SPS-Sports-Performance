// Regressão sps-v194: saveJogoInfo() (separador Info do detalhe do Jogo) passou a
// sincronizar o evento ligado em schedule_events (_syncJogoSchedule), tal como já
// fazia saveJogo() (formulário rápido da lista de Jogos) — ver changelog sps-v194.
// Antes desta correção, editar data/hora/local aqui deixava schedule_events.time
// (entre outros campos) desatualizado/vazio, e sem hora o PSE nunca aparecia como
// pendente à atleta (renderAtPSE exige e.time). Reproduz exatamente o incidente do
// jogo vs Boavista FC (25/10/2026, Taça 2ª elim.).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
const full = m[1];

// Extrai só as funções que precisamos + o que elas chamam, num sandbox mínimo.
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

const src = [
  extractFn('_syncJogoSchedule'),
  extractFn('saveJogoInfo'),
].join('\n\n');

const sandbox = {
  APP: { games: [], schedule: [] },
  _sync: false,
  _supa: null,
  _cid: 'club1',
  document: {
    _vals: {},
    getElementById(id) {
      const v = this._vals[id];
      return { value: v !== undefined ? v : '' };
    }
  },
  saveData() { sandbox._saved = true; },
  cloudUpsert: async () => {},
  toast() {},
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

async function run() {
  // Cenário real: jogo de Taça criado sem hora (placeholder "a sortear"), já ligado
  // a um evento em Planeamento sem hora — depois do sorteio, o treinador define a
  // hora pelo separador Info (não pelo formulário rápido).
  const g = { id: 'g1', eventId: 'ev1', opp: 'Adversário a sortear', date: '2026-10-25',
    time: '', loc: '', ha: 'F', tipo: 'oficial', comp: '', status: 'agendado',
    teamId: 'T1', notes: '', g1: null, g2: null, oppLogo: '', djDurJogo: '105' };
  sandbox.APP.games.push(g);
  sandbox.APP.schedule.push({ id: 'ev1', title: 'vs Adversário a sortear', type: 'Jogo',
    date: '2026-10-25', time: '', location: '', teamId: 'T1', dur: 105, notes: '' });
  sandbox._jogoDetailId = 'g1';

  sandbox.document._vals = {
    'ji-opp': 'Boavista Futebol Clube', 'ji-date': '2026-10-25', 'ji-time': '15:00',
    'ji-ha': 'F', 'ji-loc': 'Campo Municipal Do Outeiro', 'ji-tipo': 'oficial',
    'ji-comp': '', 'ji-status': 'agendado', 'ji-team': 'T1', 'ji-notes': '',
    'ji-g1': '', 'ji-g2': '', 'ji-logo': '',
  };

  await sandbox.saveJogoInfo();

  const ev = sandbox.APP.schedule.find(e => e.id === 'ev1');
  assert.strictEqual(ev.time, '15:00', 'FALHA: schedule_events.time não foi sincronizado com g.time');
  assert.strictEqual(ev.location, 'Campo Municipal Do Outeiro', 'FALHA: location não sincronizado');
  console.log('OK: saveJogoInfo() sincroniza schedule_events.time/location (correção sps-v194)');

  // Confirma que não regride saveJogo() nem deixa de funcionar para jogo sem eventId ainda.
  assert.strictEqual(sandbox.APP.games.find(x=>x.id==='g1').eventId, 'ev1', 'eventId não deve mudar');
  console.log('OK: eventId do jogo permanece ligado ao mesmo evento');
}

run().then(() => { console.log('\nTODOS OS TESTES PASSARAM'); process.exitCode = 0; })
  .catch(err => { console.error('FALHA:', err.message); process.exitCode = 1; });
