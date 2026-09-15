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

## Risco recorrente: `clubs.meta.games` (e outros campos do blob `meta`) pode reverter sozinho

**Incidente confirmado a 15/09/2026:** os 7 jogos reais da 1ª Fase (Série B)
do Campeonato — preenchidos por SQL direto a 08/09/2026 com adversário/local
reais (ver memória `project_sps_calendario_serie_b_2026_27`) — voltaram a
aparecer como `"Adversário a sortear"` / local vazio na aba Jogos, e as 3
jornadas extra (`g_cnf_1_f_j8`/`j9`/`j10`) que tinham sido apagadas
voltaram a aparecer também. Confirmado por SQL que `schedule_events`
(Planeamento) manteve sempre os dados corretos — só `clubs.meta.games`
reverteu. Reposto por SQL direto a partir de `schedule_events` (mesmo
processo do incidente de 18/08, ver `feedback_sps_meta_staleness_guard` /
`feedback_sps_full_meta_blob_overwrite_risk` na memória).

**Causa:** é a mesma classe de bug já documentada nesses dois incidentes
anteriores — `pushAppMeta()` continua a gravar o campo `games` (entre
outros) como parte do blob `meta` inteiro, e a guarda de staleness (sps-v18)
faz *merge por id* entre o que está em memória no dispositivo que está a
gravar e o que vem da cloud. Isso protege bem contra duas sessões da APP a
escrever ao mesmo tempo, mas **não protege contra uma alteração feita por
fora da app** (SQL direto, como o preenchimento do calendário): se algum
separador tiver `APP.games` desatualizado em memória (aberto antes da
alteração SQL, sem ter feito `pullCloud()` entretanto) e gravar qualquer
coisa, o merge "local ganha por id" faz o dispositivo reescrever esses
mesmos jogos com a versão antiga que tinha em memória — apagando
silenciosamente a alteração feita por SQL.

**Atualização (15/09/2026):** o `oppLogo` dos 7 jogos (emblemas dos
adversários) foi reposto por SQL direto, a pedido do Roger ("trata dos
emblemas"), reusando os mesmos 6 URLs já conhecidos (5 via Claude in Chrome
em zerozero.pt — busca correta é `https://www.zerozero.pt/pesquisa?search_txt=NOME`,
não `pesquisa.php?search=`; FC Ferreirense já vinha da memória) e encontrando
o 7º (Rio Ave FC - SAD "B") do mesmo modo — emblema do clube principal
(`https://cdn-img.staticzz.com/img/logos/equipas/31_imgbank_1682584600.png`),
confirmado via a página da equipa feminina em zerozero.pt. Os 7 jogos da 1ª
Fase têm agora `opp`/`loc`/`ha`/`oppLogo` completos e verificados por SQL.

**Ainda por fazer (risco estrutural continua a existir):** o risco de
`clubs.meta.games` reverter sozinho persiste — a correção estrutural (mover `games`
para tabela dedicada, mesmo padrão já usado para `athletes`/`staff_users`,
opção "(b)" já listada em `feedback_sps_full_meta_blob_overwrite_risk`)
continua por fazer — é a única forma de eliminar este risco na raiz para
`games` (e os outros campos do blob `meta`: `evaluations`, `convocatorias`,
`scouting`, `microcycles`, `sessions`). `trainings` já saiu do blob — ver
incidente #2 abaixo.

## Incidente #2 confirmado a 15/09/2026: `clubs.meta.trainings` (Unidades de Treino) dessincronizado do Planeamento

O Roger reportou "as unidades de treino deixaram outra vez de coincidir com
o planeamento" e pediu um check profundo. Confirmado por SQL, mesma classe
de bug do incidente #1 acima, mas em forma **parcial** (não um revert total):

- 121 das 135 Unidades de Treino tinham o campo `title` (ex. "UT57") **um
  número acima** do que o evento ligado (`eventId`) mostra em
  `schedule_events`/Planeamento (ex. treino ligado ao evento "UT56"). Delta
  constante de +1 em todos os 121 casos (`mc1t_ut16` a `mc1t_ut136`).
- `mc1t_ut11` estava em falta do array (não é perda de dados real — o
  conteúdo dessa UT existe, só ficou com o id `mc1t_ut12` e título "UT11").
- `mc1t_ut16` tinha também a própria `date` errada (17/09 em vez do 16/09
  real do evento ligado).
- Ao verificar "outras partes" (pedido do Roger): o mesmo tipo de
  desalinhamento existia em `clubs.meta.games` — os 7 jogos reais da 1ª
  Fase sem `time` preenchido (ficou a dever-se esse campo na reposição do
  incidente #1), e as 16 datas placeholder da 2ª Fase (ainda por sortear)
  desalinhadas da sua contraparte em `schedule_events`. Mais grave: o jogo
  particular real contra o **Leixões Sport Club** (`mtfqrhbhd9lm`) tem
  data/hora diferentes entre `clubs.meta.games` (domingo 20/09 17:00) e
  `schedule_events` (sábado 19/09 14:00) — **por confirmar com o Roger qual
  está certo antes de tocar**, ainda não foi mexido.

**Causa mais provável:** a mesma classe do incidente #1 — alguém apagou uma
Unidade de Treino antiga e as seguintes foram renumeradas uma a uma; a meio
desse processo, um separador desatualizado fez `saveData()` e reescreveu o
blob `meta` inteiro com a versão antiga de `APP.trainings` que tinha em
memória — só as primeiras ~4 UTs já tinham chegado à cloud antes disso, o
resto ficou preso na numeração antiga. `schedule_events`, por ser tabela
dedicada com upsert por linha, nunca é afetada por este tipo de
sobrescrita — por isso ficou sempre com a numeração certa e serviu de novo
como fonte fiável para a reposição.

**Reposto (15/09/2026):** SQL direto sincronizando `title`+`date` de
`clubs.meta.trainings`, e `date`+`time` de `clubs.meta.games` (exceto o
jogo do Leixões), a partir de `schedule_events`. Confirmado por SQL: 0
divergências entre as 135 Unidades de Treino e os respetivos eventos.

**Correção estrutural (feita no mesmo dia, a pedido explícito do Roger —
"avança"):** `trainings` saiu do blob `meta` e passou a ter tabela
dedicada própria (`public.trainings`, RLS `anon_all` igual às outras),
exatamente o mesmo padrão já usado para `athletes`/`staff_users`/
`schedule_events`/`exercises`/`gym_sheets`:
- Tabela criada e os 135 registos existentes migrados por SQL a partir do
  `clubs.meta.trainings` antigo (já corrigido nesse momento).
- `pullCloud()`: nova entrada no array `pulls` a puxar de `trainings`;
  deixou de ler `m.trainings` do blob `meta`.
- `pushAppMeta()`: `trainings` removido do objeto `meta` construído (deixa
  de ser enviado) e do `_localSnap` da fusão de staleness — como bónus, os
  esquemas (`drawing`) dos exercícios deixam de ser cortados para caber no
  blob (cada UT é agora a sua própria linha, sem limite partilhado).
- `_CLOUD_TABLE_SCHEMA`: nova entrada `trainings` com as colunas/renomeações
  (camelCase → snake_case).
- Todos os pontos que gravam uma Unidade de Treino passaram a chamar
  também `cloudUpsert('trainings', tr)`: criar (`openTrainingUnit`,
  `_createNewUT`), guardar (`saveTreinoPatch`), importar PDF
  (`handleImportTreinoPDF`), e os editores de exercício (adicionar/editar/
  apagar exercício, esquema/drawing, link de vídeo). `deleteTreino` passou
  a `async` e apaga diretamente na cloud (mesmo padrão de `deleteUser`),
  já não precisa de `_markDeleted`. `forceSyncAll()` (sincronização
  forçada) ganhou também `upsertAll('trainings', APP.trainings)`.
- SW bump para `sps-v158` (a mudança não é só de dados, é lógica nova de
  sync — forçar atualização em todos os dispositivos).
- Testado: `node --check` ao ficheiro inteiro, teste isolado da nova
  entrada de `_CLOUD_TABLE_SCHEMA` (round-trip camelCase→snake_case→
  camelCase incluindo `exercises[].drawing`), e um upsert/select/delete
  real contra a tabela nova na Supabase antes de publicar.

**Ainda por fazer:** o mesmo continua pendente para `games` — é o próximo
candidato mais urgente a sair do blob (grande volume de escrita: Gameday
ao vivo, convocatórias, resultados). `evaluations`/`convocatorias`/
`scouting`/`microcycles`/`sessions` continuam no blob, risco menor por
escreverem com menos frequência.

**Nota sobre o "link de calendário":** o preenchimento de adversário/local a
partir do link da FPF (`resultados.fpf.pt/Competition/Details`) **não é
automático** — não há nenhum botão/sincronização na app que faça isto
sozinho (bloqueio de CORS+WAF da FPF a pedidos automáticos, ver
`project_sps_fpf_calendario_import` na memória). É sempre um processo
manual: o Roger envia o link/calendário quando sai um sorteio novo, e uma
sessão do Claude navega lá (Claude in Chrome) e atualiza os Jogos — por
isso o link em si não tem "bug", o que falhou foi a gravação ficar
persistida depois de atualizada.
