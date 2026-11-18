// sps-v251: banner de acesso rápido à Hidratação no Home da App Atleta — pedido do
// Roger: "colocar acesso a esse card no home do tipo código de conduta e gameday,
// logo a seguir a estes, e aparecer quer nos dias de treino e dias de jogo".
// Testa _atHidraHomeBannerHtml() extraída diretamente do index.html:
//  1) ausente em dias sem Treino nem Jogo (nunca aparece "à toa")
//  2) estado Pendente — sem pré ainda (Treino: pede autorregisto de peso; Jogo: pede
//     pré-jogo manual)
//  3) estado Parcial — pré feito, falta o pós (texto menciona o peso pré e o que falta)
//  4) estado Completo — pós já registado (✓, menciona perda e reposição, sem seta —
//     deixa de pedir ação, mesmo padrão já usado no Código de Conduta confirmado)
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
function extractConstObj(name) {
  const re = new RegExp('const ' + name + '\\s*=\\s*\\{');
  const start = full.search(re);
  assert.ok(start >= 0, 'constante ' + name + ' não encontrada');
  let depth = 0, i = full.indexOf('{', start), end = -1;
  for (; i < full.length; i++) {
    if (full[i] === '{') depth++;
    else if (full[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return full.slice(start, end) + ';';
}

const src = [
  extractConstObj('HYDRATION_DEFAULTS'),
  extractFn('_hydraBands'),
  extractFn('_hydraSweatRate'),
  extractFn('_hydraWeightLossPct'),
  extractFn('_hydraReplacementTarget'),
  extractFn('_hydraWeightColor'),
  extractFn('_hydraRecordFor'),
  extractFn('saveHydraRecord'),
  extractFn('_hydraAllSessions'),
  extractFn('_hydraSessionById'),
  extractFn('_atHidraTodaySessions'),
  extractFn('_atHidraHomeBannerHtml'),
  'const escHtml=s=>String(s||\'\').replace(/&/g,\'&amp;\').replace(/</g,\'&lt;\').replace(/>/g,\'&gt;\').replace(/"/g,\'&quot;\');',
].join('\n\n');

let n = 0;
function ok(cond, msg) { assert.ok(cond, 'FALHA: ' + msg); n++; console.log('OK: ' + msg); }

function freshSandbox(opts = {}) {
  const sandbox = {
    APP: {
      config: { hydrationGuidelines: { default: {}, athletes: {} } },
      hydrationRecords: [],
      nutritionAssessments: opts.nutritionAssessments || [],
      athletes: opts.athletes || [{ id: 'athlete1', name: 'Beatriz Nogueira', teamId: 'T1' }],
      games: opts.games || [],
      schedule: opts.schedule || [],
    },
    AID: 'athlete1',
    _atHidraSelType: opts.selType !== undefined ? opts.selType : null,
    _sync: true,
    _cid: 'club1',
    _syncCalls: [],
    _SESSION: opts.session !== undefined ? opts.session : { userId: 'athlete1', role: 'atleta', name: 'Beatriz Nogueira' },
    getSession() { return sandbox._SESSION; },
    today: () => opts.today || '2026-11-18',
    cloudUpsert: (table, row) => { sandbox._syncCalls.push({ table, row: { ...row } }); },
    saveData() { sandbox._saved = true; },
    toast: (msg, type) => { sandbox._lastToast = { msg, type }; },
    _hydraRerender() {},
    console, Date, Math, isNaN,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

// ── 1) Sem Treino nem Jogo hoje → banner ausente ─────────────────────────────────
{
  const sb = freshSandbox({ schedule: [], games: [], today: '2026-11-19' });
  ok(sb._atHidraHomeBannerHtml() === '', 'sem sessão hoje → banner não aparece no Home (string vazia)');
}

// ── 2) TREINO, Pendente — atleta ainda não se pesou hoje ────────────────────────
{
  const sb = freshSandbox({
    schedule: [{ id: 'ev_treino_18', type: 'Treino', date: '2026-11-18', teamId: 'T1', dur: 90 }],
    today: '2026-11-18',
    nutritionAssessments: [],
  });
  const html = sb._atHidraHomeBannerHtml();
  ok(html.includes('Hidratação — Treino'), 'banner de Treino identifica a sessão no título');
  ok(html.includes('Ainda não te pesaste hoje'), 'estado Pendente (Treino): pede para ir ao Registo de Peso primeiro');
  ok(html.includes('rgba(245,158,11'), 'estado Pendente usa a cor âmbar');
  ok(html.includes('ti-chevron-right'), 'estado Pendente mostra seta (ação necessária)');
}

// ── 3) JOGO, Pendente — pré-jogo ainda não foi registado ─────────────────────────
{
  const sb = freshSandbox({
    games: [{ id: 'g1', opp: 'FC Ferreirense', date: '2026-11-22', teamId: 'T1', djDurJogo: 90 }],
    today: '2026-11-22',
  });
  const html = sb._atHidraHomeBannerHtml();
  ok(html.includes('Hidratação — Jogo vs FC Ferreirense'), 'banner de Jogo identifica o adversário');
  ok(html.includes('Regista o teu peso pré-jogo'), 'estado Pendente (Jogo): pede o pré-jogo manual');
}

// ── 4) TREINO, Parcial — autorregisto de peso feito hoje, pós ainda não ─────────
{
  const sb = freshSandbox({
    schedule: [{ id: 'ev_treino_18', type: 'Treino', date: '2026-11-18', teamId: 'T1', dur: 90 }],
    today: '2026-11-18',
    nutritionAssessments: [{ id: 'self1', athleteId: 'athlete1', date: '2026-11-18', weight: '60.4', source: 'atleta' }],
  });
  const html = sb._atHidraHomeBannerHtml();
  ok(html.includes('Pré registado (60.4 kg)'), 'estado Parcial mostra o peso pré já obtido do Registo de Peso');
  ok(html.includes('falta o pós-treino'), 'estado Parcial (Treino) indica que falta o pós-treino');
  ok(html.includes('rgba(56,189,248'), 'estado Parcial usa a cor azul informativa (mesma do Gameday "próximo jogo")');
}

// ── 5) JOGO, Completo — pós já registado, mostra resultado e tira a seta ────────
{
  const sb = freshSandbox({
    games: [{ id: 'g1', opp: 'FC Ferreirense', date: '2026-11-22', teamId: 'T1', djDurJogo: 90 }],
    today: '2026-11-22',
  });
  sb.saveHydraRecord('athlete1', 'g1', 'Jogo', { preWeight: 61.0, postWeight: 59.6 });
  const html = sb._atHidraHomeBannerHtml();
  ok(html.includes('Registo de hoje completo'), 'estado Completo anuncia o registo feito');
  ok(html.includes('perda') && html.includes('%'), 'estado Completo mostra a % de perda');
  ok(html.includes('repor') && html.includes('L'), 'estado Completo mostra a reposição recomendada');
  ok(!html.includes('ti-chevron-right'), 'estado Completo NÃO mostra seta — já não pede ação (mesmo padrão do Código de Conduta confirmado)');
  ok(html.includes('rgba(34,197,94'), 'estado Completo usa a cor verde');
}

// ── 6) Abrir o banner navega para a Nutrição e salta para o card de Hidratação ──
{
  const sb = freshSandbox({
    schedule: [{ id: 'ev_treino_18', type: 'Treino', date: '2026-11-18', teamId: 'T1', dur: 90 }],
    today: '2026-11-18',
  });
  const html = sb._atHidraHomeBannerHtml();
  ok(html.includes("_atNavTo('nutri')"), 'toca no banner → navega para a aba Nutrição');
  ok(html.includes('at-hidra-card'), 'toca no banner → salta diretamente para o card de Hidratação (scrollIntoView), não só a aba genérica');
}

// ── 7) Jogo + Treino no mesmo dia → por omissão mostra o Jogo (mesma preferência já usada no card da Nutrição) ──
{
  const sb = freshSandbox({
    games: [{ id: 'g1', opp: 'FC Ferreirense', date: '2026-11-18', teamId: 'T1', djDurJogo: 90 }],
    schedule: [{ id: 'ev_treino_18', type: 'Treino', date: '2026-11-18', teamId: 'T1', dur: 90 }],
    today: '2026-11-18',
  });
  const html = sb._atHidraHomeBannerHtml();
  ok(html.includes('Hidratação — Jogo vs FC Ferreirense'), 'com Treino e Jogo no mesmo dia, o banner mostra o Jogo por omissão');
}

console.log(`\n${n} verificações OK — sps-v251 banner de Hidratação no Home`);
