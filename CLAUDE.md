# SPS Sports Performance — regras de trabalho nesta pasta

Este projeto é usado a partir de **dois PCs diferentes** (Roger). O GitHub
(`https://github.com/RogerPinheiro77/SPS-Sports-Performance.git`, branch `main`)
é a **única fonte de verdade** — nunca confiar numa cópia local (deste PC, do
outro PC, ou de qualquer pasta sincronizada por Google Drive/OneDrive/Dropbox)
como referência do estado atual do código. Uma dessas cópias secundárias já
ficou presa num commit de 05/08/2026 ("Add files via upload"), muito
desatualizada — isto só se descobre comparando com o GitHub, nunca por
inspeção visual da pasta.

## Antes de começar a trabalhar

```
git fetch origin
git status
git pull origin main   # ou merge/rebase conforme o estado
```

Se `git status` mostrar a branch atrás do `origin/main`, ou com divergência,
não continuar sem perceber porquê — pode ser sinal de que outra sessão (neste
PC ou no outro) fez alterações entretanto.

## Antes de terminar a sessão

1. `git status` — confirmar que não há alterações relevantes por commitar.
2. Se houver, `git add`/`git commit`/`git push` antes de fechar.
3. Nunca deixar trabalho "só local" de uma sessão para a seguinte — a próxima
   sessão (neste PC ou no outro) só vê o que está no GitHub.

## Histórico desta pasta (04-07/09/2026)

Até 07/09/2026, esta pasta **não era um clone git** — era só uma pasta de
ficheiros. Cada sessão clonava o repositório para uma pasta temporária à
parte, copiava `index.html`/`sw.js` para lá, e fazia commit+push a partir
dessa cópia temporária (que era destruída no fim). Isto foi corrigido a
07/09/2026: a pasta passou a ser um clone git real, ligado ao `origin`, sem
perder nenhum dos ficheiros que já aqui estavam (confirmado que `index.html`/
`sw.js` já batiam certo, byte a byte, com o HEAD do GitHub nessa altura).

Nessa mesma limpeza, encontraram-se e corrigiram-se duas divergências entre
esta pasta e o GitHub: uma pasta `_test/plano101.pdf` residual no repositório
(removida), e 6 ícones (Fisio/Nutri) que existiam no GitHub mas não nesta
pasta (copiados para cá).

## Ficheiros fora do git, e porquê

**Versionados nesta limpeza** (estavam soltos, passaram a fazer parte do
repositório, a pedido do Roger): `ANALISE_PROJETO.md`, `RESUMO.md`,
`moreirense_fc_database.sql`, `sport_performance_platform*.html` (incluindo os
`.bak*`), `sport_performance_system.html`, `supabase_*.sql`, pasta `sps-app/`.
São versões antigas/documentação histórica do projeto — mantidos por valor de
arquivo, não porque façam parte da app atual (essa é só `index.html` + `sw.js`
+ `assets/`).

**Deixados fora do git de propósito** (ver `.gitignore`):
- `backups/` — dumps diários (JSON) de toda a base de dados do Supabase,
  incluindo dados pessoais e de saúde das atletas (wellness, PSE, anamnese
  clínica). Nunca deve ir para o git, nem em repositório privado.
- `Guia_App_Atleta_SPS.pdf`, `Manual_SPS_Gameday.pdf`, `Manual_SPS_Ginasio.pdf`,
  `SPS_Analise_Comparativa_Mercado.docx`/`.pdf`,
  `proposta_sistema_carga_wellness_ciclo.md`, `qr_app_atleta.png`,
  `screenshots_app_atleta/`, `slide_qr_acesso_app.png` — deliverables já
  entregues ao Roger fora do fluxo do site (manuais, análises, materiais de
  divulgação). Podem passar a versionados a qualquer momento — bastar remover
  a linha correspondente do `.gitignore` e fazer `git add`.

## Deploy

O deploy é sempre direto para `main` (GitHub Pages serve a partir daí, ver
memória `reference_sps_github_push_token.md` para o fluxo de push). Antes de
publicar qualquer alteração a `index.html`/`sw.js`: validar sintaxe
(`node --check`), testar a lógica nova com um harness `vm` extraindo as
funções reais do ficheiro, e só depois `git add`/commit/push.

## Bloqueio conhecido: `git push` direto a partir da sandbox cloud

A sandbox cloud onde o Claude corre (não o PC do Roger) está bloqueada de
fazer `git push` diretamente para este repositório: o proxy de git interno
da Anthropic recusa com `access denied by the git proxy:
RogerPinheiro77/SPS-Sports-Performance is not in this session's authorized
repository set`. Confirmado (10/09/2026) como bug conhecido e não resolvido
do lado da Anthropic (GitHub issue `anthropics/claude-code#76248`), não
relacionado com credenciais/tokens — não há fix do lado do utilizador nem
do Claude.

A alternativa seria o Claude correr `git am`/`git push` diretamente no PC
do Roger via `device_bash` (ligação ao PC "fabrica"), mas esse canal está,
desde o início desta sessão e confirmado de novo a 11/09/2026, também
bloqueado: `sandbox-helper: no Plan9 drive shares mounted`. A mensagem de
erro do próprio Claude confirma a causa: uma atualização do Windows
lançada a 8/09/2026 impede o acesso da sandbox aos ficheiros do PC; é um
problema já identificado e a ser acompanhado pela Anthropic (não afeta o
Claude Code CLI, só este modo). Pode resolver-se sozinho numa atualização
futura, sem nada a fazer aqui — vale a pena testar `device_bash` de vez em
quando para ver se já voltou.

**Enquanto os dois bloqueios acima persistirem**, o fluxo de trabalho é:
1. Claude faz commit local na sandbox cloud (`git add`/`commit`, nunca
   `push`).
2. Claude gera um patch (`git format-patch -1 HEAD --stdout`) e envia-o
   via `SendUserFile` + `device_commit_files` para a pasta do clone no PC
   do Roger.
3. Roger corre, na pasta do clone:
   ```
   git fetch origin
   git status                 # confirmar alinhado com origin/main antes de aplicar
   git am <ficheiro>.patch
   git push origin main
   ```
4. Depois do push, a sandbox cloud fica com um commit local de hash
   diferente do que ficou no GitHub (mesmo conteúdo, objeto de commit
   diferente por causa do `git am`) — resincronizar com
   `git fetch origin && git diff origin/main -- index.html` (confirmar
   vazio) e depois `git reset --hard origin/main`.

Nota cosmética: no PC "fabrica" aparece quase sempre, depois de
fetch/am/push, o prompt `Deletion of directory '.git/objects/xx' failed.
Should I try again? (y/n)` — é inofensivo (contenção de lock do
OneDrive/antivírus na pasta `.git/objects`), resolve-se com Ctrl+C. Pode
ser eliminado à partida correndo `git config gc.auto 0` uma vez nesse
clone (desativa o garbage-collection automático que dispara essa limpeza).

## Atualização (14/09/2026): Claude Code CLI local configurado na "fabrica"

Instalado e confirmado o Claude Code CLI (`npm install -g @anthropic-ai/claude-code`,
v2.1.270) diretamente no PC "fabrica", a correr nesta mesma pasta do clone
(`C:\Users\Utilizador\Documents\Claude\Projects\APP COACH RP`). Testado com
sucesso, a partir dessa CLI local:
- `git remote -v` — `origin` aponta corretamente para este repositório.
- `git fetch origin` — sem pedir credenciais.
- `git push origin main` — autenticação funciona, push chega ao GitHub sem
  erro (testado com working tree alinhada, "Everything up-to-date").

Isto dá um caminho de push direto que **não depende do `device_bash` nem do
bloqueio do proxy de git da sandbox cloud** descritos acima — esse
bloqueio é específico de sessões a correr no ambiente cloud da Anthropic
(Cowork), não afeta o Claude Code CLI a correr localmente no PC do Roger.

**A partir de agora**: para trabalho de edição de código com necessidade de
commit/push, o caminho preferido é abrir o Claude Code CLI diretamente
nesta pasta, no PC "fabrica" (ou no outro PC, depois de instalado da mesma
forma: `npm install -g @anthropic-ai/claude-code`, depois `claude` dentro
da pasta do clone). O fluxo de patch (`git format-patch` → `SendUserFile`
→ `device_commit_files` → `git am`) descrito acima passa a ser só o
fallback para sessões Cowork/cloud sem esta CLI disponível no momento, ou
enquanto o bloqueio de `device_bash` (mount Plan9, ver secção acima) não
for resolvido.
