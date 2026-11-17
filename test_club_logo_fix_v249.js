// sps-v249: Config → Clube chamava searchMyClub() no oninput do nome do clube, mas essa
// função nunca tinha sido escrita (só existiam searchClub/searchClubDetail, para o
// adversário nos Jogos) — por isso o emblema do PRÓPRIO clube nunca era preenchido e o
// card "Próximo Jogo" (Home) mostrava sempre a bola genérica do lado de casa, mesmo com o
// emblema do adversário a aparecer bem (reportado pelo Roger com screenshot). Testa o
// código REAL extraído do index.html: searchMyClub() delega em _doClubSearch() com os ids
// certos do Config, e selectMyClub() preenche nome/logo/preview exatamente como
// selectClubQuick/selectClubDetail já faziam para o adversário.
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
function extractLine(name) {
  const re = new RegExp('let ' + name + '.*?;');
  const mm = full.match(re);
  assert.ok(mm, 'declaração ' + name + ' não encontrada');
  return mm[0];
}

const src = [
  extractLine('_clubSearchTimer'),
  extractFn('_doClubSearch'),
  extractFn('searchMyClub'),
  extractFn('selectMyClub'),
].join('\n\n');

let n = 0;
function ok(cond, msg) { assert.ok(cond, 'FALHA: ' + msg); n++; console.log('OK: ' + msg); }

function makeEl() {
  return { value: '', textContent: '', innerHTML: '', style: {}, appendChild() {}, removeChild() {} };
}

function freshSandbox() {
  const els = {
    'cfg-club-dropdown': { ...makeEl(), style: { display: 'none' } },
    'cfg-club': makeEl(),
    'cfg-club-logo': makeEl(),
    'cfg-logo-preview': makeEl(),
  };
  const sandbox = {
    document: {
      getElementById(id) { return els[id] || null; },
      createElement() { return makeEl(); },
    },
    _els: els,
    setTimeout,
    clearTimeout,
    fetch: async () => { throw new Error('fetch não deveria ser chamado neste teste'); },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

// ── 1) searchMyClub existe e delega em _doClubSearch com os ids do CONFIG (sps-v249: ──
//      antes desta correção, esta função nem sequer existia — o oninput do campo de
//      nome no Config chamava algo indefinido e nunca acontecia nada).
{
  const sb = freshSandbox();
  ok(typeof sb.searchMyClub === 'function', 'searchMyClub() agora existe (antes era undefined)');
  ok(typeof sb.selectMyClub === 'function', 'selectMyClub() agora existe');
  sb.searchMyClub('ab'); // menos de 3 chars: _doClubSearch sai cedo, sem tocar no dropdown
  ok(sb._els['cfg-club-dropdown'].style.display === 'none', 'query curta (<3 chars) não mexe no dropdown do Config, sem lançar erro');
}

// ── 2) selectMyClub preenche nome + logo (hidden input) + preview — mesmo padrão de ──
//      selectClubQuick/selectClubDetail, mas nos ids do Config
{
  const sb = freshSandbox();
  sb.selectMyClub('Moreirense Futebol Clube', 'https://exemplo.pt/escudo-moreirense.png');
  ok(sb._els['cfg-club'].value === 'Moreirense Futebol Clube', 'nome do clube preenchido no campo cfg-club');
  ok(sb._els['cfg-club-logo'].value === 'https://exemplo.pt/escudo-moreirense.png', 'URL do emblema guardada no hidden cfg-club-logo (lido depois por saveConfig)');
  ok(sb._els['cfg-club-dropdown'].style.display === 'none', 'dropdown fecha depois de escolher');
}

// ── 3) selectMyClub sem logo (resultado sem imagem) cai para o fallback ⚽, nunca quebra ──
{
  const sb = freshSandbox();
  sb.selectMyClub('Clube Sem Imagem', '');
  ok(sb._els['cfg-club'].value === 'Clube Sem Imagem', 'nome preenchido mesmo sem logo disponível');
  ok(sb._els['cfg-club-logo'].value === '', 'logo vazio não escreve URL inválida no hidden input');
}

console.log(`\n${n} verificações OK — sps-v249 fix emblema do próprio clube`);
