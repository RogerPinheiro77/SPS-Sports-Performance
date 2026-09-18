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

**Ainda por fazer:** `games` já saiu do blob também — ver incidente #3
abaixo (mesmo dia). `evaluations`/`convocatorias`/`scouting`/`microcycles`/
`sessions` continuam no blob, risco menor por escreverem com menos
frequência.

**Nota sobre o "link de calendário":** o preenchimento de adversário/local a
partir do link da FPF (`resultados.fpf.pt/Competition/Details`) **não é
automático** — não há nenhum botão/sincronização na app que faça isto
sozinho (bloqueio de CORS+WAF da FPF a pedidos automáticos, ver
`project_sps_fpf_calendario_import` na memória). É sempre um processo
manual: o Roger envia o link/calendário quando sai um sorteio novo, e uma
sessão do Claude navega lá (Claude in Chrome) e atualiza os Jogos — por
isso o link em si não tem "bug", o que falhou foi a gravação ficar
persistida depois de atualizada.

## Incidente #3 (mesmo dia, 15/09/2026): `games` saiu do blob `meta`, mesmo padrão de `trainings`

Depois de reportar o incidente #2 (acima) e da correção estrutural das
Unidades de Treino, o Roger pediu explicitamente para resolver também o
risco pendente de `games`: **"trata disso, assim fica já tudo resolvido"**,
em resposta à nota que listava `games` como próximo candidato.

`games` era, de longe, o campo do blob com mais pontos de escrita da app
inteira — dezenas de funções `_gd*` (SPS-Gameday: cronómetro, eventos ao
vivo, substituições, cartões, penáltis), `_opp*`/`_pitch*` (Campo Tático,
4 quadros de bolas paradas), Pré-Jogo, Resultado, Convocatória — todas a
mutar um jogo (`g`) e chamar `saveData()`. Precisamente por isso já tinha
proteções bespoke que `trainings` nunca teve: `_gdIsLiveUnlaunched` (nunca
deixar um `pullCloud()` sobrepor uma sessão ao vivo em risco neste
dispositivo) e `_gdMergeGamesForPush`/`_gdGameRichness` (fusão por
"riqueza" — o jogo mais completo ganha — dentro de `pushAppMeta()`,
criada a 07/09/2026 depois de 2 incidentes reais: jogo vs Aldeia Nova a
30/08 e Rio Ave/Esposende a 04-07/09, ver memória
`feedback_sps_gameday_pullcloud_overwrite`). Essas proteções resolviam os
sintomas mas não a causa: o array inteiro continuava a viver num blob
partilhado, por isso qualquer separador desatualizado que gravasse
QUALQUER outra coisa (config, avaliações, scouting...) continuava a
reescrever `games` por cima — só a comparação de riqueza é que evitava
perder dados, não impedia a escrita em si.

**Desafio específico de `games` (vs. `trainings`):** não dava para simplesmente
copiar o padrão "cada função de escrita chama `cloudUpsert` explicitamente" —
são dezenas de sítios, muitos deles no meio de um jogo ao vivo real, e
esquecer um só deles teria o mesmo efeito do incidente #2 (só que a acontecer
a meio de uma partida). Solução: `saveData()` passou a sincronizar
centralmente o jogo "em vista" — todas essas dezenas de funções (`_gd*`/
`_opp*`/`_pitch*`) só correm com um Jogo aberto no ecrã de detalhe
(`_jogoDetailId`, definido por `openJogo()`), e `_renderJogoDetailFull()`/
todos os `onclick` desses ecrãs usam sempre `g.id===_jogoDetailId`. Por
isso `saveData()` agora faz, sempre que `_jogoDetailId` está definido:
```js
const _hotGame=(APP.games||[]).find(x=>x.id===_jogoDetailId);
if(_hotGame)cloudUpsert('games',_hotGame);
```
um único sítio central cobre todos os pontos de gravação do Gameday/Campo
Tático/Pré-Jogo/Resultado, sem precisar de tocar em cada função. Os dois
casos que não têm `_jogoDetailId` definido no momento do `saveData()` —
criar um Jogo novo e apagar um Jogo — ganharam `cloudUpsert`/`delete`
explícitos em `saveJogo()`/`deleteJogo()`.

**Trade-off aceite conscientemente:** ao passar para upsert por linha, a
fusão por riqueza (`_gdMergeGamesForPush`) deixou de ser chamada — já não
é precisa para o problema que resolvia (um dispositivo desatualizado a
apagar OUTROS jogos ao gravar o array inteiro), porque cada escrita agora
só toca na linha do jogo em edição. Fica uma proteção mais estreita por
resolver: dois dispositivos a editar exatamente o MESMO jogo ao mesmo
tempo (ex: dois telemóveis no Gameday do mesmo jogo) passam a ter
"última escrita ganha" nessa linha, sem comparação de riqueza — cenário
raro (só um dispositivo corre o Gameday ao vivo de cada jogo, na prática)
e já é o comportamento normal de todas as outras tabelas dedicadas
(`athletes`, `trainings`, etc.). A proteção mais importante — nunca deixar
um `pullCloud()` sobrepor a sessão ao vivo deste dispositivo com uma cópia
antiga da cloud a meio de um jogo — continua intacta (`_gdIsLiveUnlaunched`,
agora a correr sobre os dados vindos da tabela `games` em vez do blob).
As funções antigas (`_gdMergeGamesForPush`, `_gdGameRichness`,
`_gdForceLocalGameIds`) ficaram no código, sem chamadores, por não haver
necessidade de as remover na mesma alteração que já mexe numa área tão
sensível.

**Cuidado técnico importante (bug apanhado antes de publicar, não chegou a
produção):** a 1ª tentativa de migração usava `coalesce(campo,'{}'::jsonb)`
no SQL para os campos jsonb sem valor (ex: `liveSession` de um jogo que
nunca teve a aba Ao Vivo aberta). Isso transformava uma chave AUSENTE no
blob original (`undefined`/falsy) num objeto vazio `{}` — TRUTHY — na
tabela nova. `_gdInit(g)` e várias funções `_gd*`/`_opp*`/`_pitch*` decidem
se inicializam uma estrutura pela 1ª vez com `if(!g.liveSession)`/
`if(!g.oppTactical)` etc.; um `{}` truthy fazia essas inicializações serem
saltadas, e código como `ls.events.push(...)` partia com "Cannot read
properties of undefined" na 1ª ação de um jogo nunca aberto no Gameday.
Corrigido antes de publicar: colunas jsonb sem `default`, migração sem
`coalesce` (NULL fica NULL, exatamente como no blob original), e
`pullCloud()` mapeia cada campo jsonb com `||undefined` (nunca `||{}`/
`||[]`) para preservar o mesmo falsy-check que o resto do código espera.
Verificado com um teste isolado (função `pulls` de `games` extraída e
corrida em Node contra linhas reais da tabela) antes e depois da correção.

**Feito (15/09/2026):**
- Tabela `public.games` criada (RLS `anon_all`), os 41 jogos existentes
  migrados por SQL a partir de `clubs.meta.games` (sem `coalesce` para
  jsonb, ver acima) — confirmado 41/41, incluindo os 3 jogos com sessão
  ao vivo real (Aldeia Nova completo, Rio Ave e Vitória SC Sub-19 em
  rascunho) com todos os eventos/estatísticas intactos.
- `pullCloud()`: nova entrada no array `pulls` para `games`, com a mesma
  proteção `_gdLiveGamesAtRisk` que já existia (nunca sobrepor uma sessão
  ao vivo em risco neste dispositivo); deixou de ler `m.games` do blob.
- `pushAppMeta()`: `games` removido do objeto `meta` construído e do
  `_localSnap`/fusão de staleness; as duas chamadas a
  `_gdMergeGamesForPush` removidas (ficou só a função, sem chamadores).
- `_CLOUD_TABLE_SCHEMA`: nova entrada `games`, 57 colunas (a maioria dos
  campos de um Jogo — Pré-Jogo, Campo Tático, bolas paradas, Gameday ao
  vivo — como colunas jsonb ou texto simples, mesmo padrão de `trainings`).
- `saveData()` passou a sincronizar o jogo em `_jogoDetailId` (ver acima);
  `openJogo()` define `_jogoDetailId` ANTES do 1º `saveData()`;
  `saveJogo()`/`deleteJogo()` ganharam `cloudUpsert`/`delete` explícitos;
  `deleteJogo()` já não precisa de `_markDeleted` (mesmo motivo do
  `deleteTreino` no incidente #2).
- SW bump para `sps-v159`.
- Testado: `node --check` ao ficheiro inteiro; simulação em Node do
  payload real que `cloudUpsert('games',g)` envia (57 colunas, renomeação
  camelCase→snake_case) contra a tabela real via `execute_sql`
  (`jsonb_populate_record`, o mais próximo possível de um upsert real sem
  acesso direto à REST API da Supabase a partir desta sandbox); teste
  isolado da função de pull de `games` (extraída do próprio ficheiro,
  corrida em Node) contra linhas reais, incluindo o caso do jogo sem
  sessão ao vivo (confirma `undefined`, não `{}`) e o caso da proteção
  "sessão ao vivo em risco" (confirma que a versão local com eventos reais
  sobrevive a um pull com uma cópia fresca mas mais pobre da cloud).

**Ainda por fazer:** `evaluations`/`convocatorias`/`scouting`/
`microcycles`/`sessions` continuam no blob `meta` — risco menor por
escreverem com muito menos frequência que `games`/`trainings`.

## Incidente #4 (17/09/2026): emblemas (`oppLogo`) da 1ª Fase reverteram pela 3ª vez — causa raiz confirmada e URLs finais registados

O Roger reportou outra vez "continua a não ter os emblemas dos clubes a
aparecer" (já tinha sido "corrigido" a 08/09 e a 15/09 — ver nota de
14/09/2026 acima, dentro do Incidente #1). Confirmado por SQL: os 7 jogos
da 1ª Fase (`g_cnf_1_f_j1`...`j7`) tinham `opp_logo` vazio **tanto na
tabela nova `public.games` como no blob antigo `clubs.meta.games`** — ou
seja, os emblemas já tinham sido revertidos outra vez antes da migração do
Incidente #3 correr, e essa migração só copiou fielmente o estado (já
corrompido) do blob para a tabela nova.

**Causa raiz confirmada:** as duas correções anteriores (08/09 e 15/09)
foram sempre aplicadas por SQL direto contra `clubs.meta.games` (o blob
partilhado) — nunca durável contra o padrão "dispositivo desatualizado
sobrescreve o blob inteiro" que é precisamente o bug que os Incidentes #1-3
documentam. A partir de agora isto deixa de poder acontecer: os emblemas
foram reaplicados diretamente na tabela dedicada `public.games` (upsert por
linha, imune a esse overwrite), o mesmo motivo pelo qual `games` saiu do
blob no Incidente #3.

**Investigação/recolha (Claude in Chrome, zerozero.pt):** dos 7 clubes, 2
URLs já eram conhecidos do histórico (Rio Ave FC "B" e FC Ferreirense); os
outros 5 foram pesquisados de novo (`https://www.zerozero.pt/pesquisa?search_txt=NOME`
→ link "Equipas" → página da equipa → `meta[property="og:image"]`, mais
fiável do que percorrer `<img>` da página). Todos os 7 URLs foram
confirmados com `fetch` (200, `image/type: image/png`) antes de aplicar.

**URLs finais aplicados a `public.games.opp_logo` (registo definitivo —
para nunca mais ser preciso repetir esta pesquisa manual):**
- `g_cnf_1_f_j1` (Destreza Aventura): `https://cdn-img.staticzz.com/img/logos/equipas/264723_imgbank_1762218757.png`
- `g_cnf_1_f_j2` (U.D.S. Roriz): `https://cdn-img.staticzz.com/img/logos/equipas/12000_imgbank.png`
- `g_cnf_1_f_j3` (FC Tadim): `https://cdn-img.staticzz.com/img/logos/equipas/10930_imgbank.png`
- `g_cnf_1_f_j4` (Rio Ave FC - SAD "B"): `https://cdn-img.staticzz.com/img/logos/equipas/31_imgbank_1682584600.png`
- `g_cnf_1_f_j5` (Águias Negras Tabuadelo): `https://cdn-img.staticzz.com/img/logos/equipas/8024_imgbank.png`
- `g_cnf_1_f_j6` (FC Ferreirense): `https://cdn-img.staticzz.com/img/logos/equipas/84/33684_logo_fc_ferreirense_20260422160127.png`
- `g_cnf_1_f_j7` (A.D. Várzea FC): `https://cdn-img.staticzz.com/img/logos/equipas/14963_imgbank.png`

**Ainda por fazer:** nenhuma ação de código pendente — o risco estrutural
que causava a reversão já não existe (`games` é tabela dedicada desde o
Incidente #3). Se o Roger voltar a reportar emblemas em falta, o mais
provável é serem jogos NOVOS (ex. 2ª Fase, ainda por sortear) que nunca
tiveram `oppLogo` preenchido — não uma reversão dos 7 acima.

## sps-v160 (17/09/2026): aba "Competições" própria — registo completo por competição + links de Calendário/Resultados

Na mesma mensagem do incidente #4 (emblemas), o Roger pediu também: "que te
parece criar uma aba competições, local onde coloco as competições onde a
equipa participa, e os links de acesso ao calendário, resultados, etc.
Analisa, investiga, propõem" — pedido explícito de análise+proposta antes
de implementar (ver `feedback_sps_confirm_before_major_changes` na
memória). Investigado o modelo de dados atual antes de propor: até aqui
"competição" era só uma etiqueta `{name,icon}` dentro de Configurações
(`APP.config.competitions`), sem nenhum link; a Classificação (import
manual FPF/ZeroZero, sps-v133/147) vivia numa aba dentro de Jogos, separada
da lista de competições; e não existia nenhum sítio com o link direto para
o calendário/resultados de uma competição — era tudo manual, jogo a jogo
(`g.fpfUrl` é por Jogo, não por competição).

**Proposta apresentada e aprovada pelo Roger** ("podemos avançar tudo junto
criando as competições como propões?"): página própria "Competições" no
menu principal, com cada competição a passar a ser um registo completo —
nome, ícone, tipo (Liga/Campeonato, Taça, Particulares), e 2 links opcionais
(Calendário, Resultados/Classificação) — e não só uma etiqueta.

**Implementado:**
- `APP.config.competitions[]` ganhou `tipo`/`calendarUrl`/`resultsUrl` (além
  de `name`/`icon` já existentes); `_compObj()` normaliza entradas antigas
  (string, ou `{name,icon}` de antes desta versão) com valores por omissão
  (`tipo:'liga'`, urls `''`) — nunca obriga a re-configurar competições já
  criadas.
- Página nova `competicoes` registada em `ALL_PAGES`/`_NAV_TITLES`/`renders`
  (dentro de `navTo()`), com o mesmo ícone 🏆 usado nos Jogos; acrescentada
  a `ROLE_DEFS` de `team_manager`/`diretor` (os outros cargos com acesso
  total via `_ALL_PAGE_IDS` ganham-na automaticamente).
- `renderCompeticoes()` (substitui `_classificacaoTabHtml()`, que foi
  removida): formulário "Nova Competição" (nome/tipo/ícone/links), painel
  de importação da Classificação (igual ao que já existia, só mudou de
  página), um card por competição (`_classifCompCardHtml()`, reescrita) com
  cabeçalho (tipo + botões 📅 Calendário/📊 Resultados, cinzentos se sem
  link definido + botão ✏️ Links para editar) e, dentro do mesmo card, a
  tabela de classificação (se importada) e a lista de Jogos associados a
  essa competição (`_compGamesFor()`, nova — mesma correspondência por
  nome/prefixo já usada em `_jogoIcon()`, sem duplicar nenhum dado de
  `APP.games`), com atalho "📂 Abrir" (`_abrirJogoDeCompeticao()` — muda de
  página com `navTo('jogos')` e só depois chama `openJogo()`, porque este
  não troca de página sozinho). Ficaram também nesta página, tal como já
  estavam antes (só mudaram de sítio): o campo manual da fase da Taça e o
  resumo de Amistosos.
- A aba "Classificação" foi removida da lista de separadores de Jogos
  (`renderJogos()`) — só ficaram Próximos/Realizados/Ranking; um separador
  antigo `_jogoTab==='classificacao'` guardado em memória (não deve
  acontecer, mas por segurança) cai para "Próximos".
- O card "Competições da Época" que existia em Configurações foi reduzido a
  um aviso + botão a apontar para a nova página (evita duas UIs a gerir a
  mesma lista); `addCompetition()`/`removeCompetition()` passaram a ler os
  campos da página nova; `editCompetitionLinks()` (nova, por `prompt()`,
  mesmo padrão simples já usado em `_onCompChange()`) edita os 2 links de
  uma competição já criada sem precisar de um formulário de edição inteiro.
- SW bump para `sps-v160`.
- Testado: `node --check` ao ficheiro inteiro; teste isolado em Node de
  `_compObj`/`_compList`/`_compGamesFor`/`_classifCompCardHtml` extraídas do
  próprio ficheiro, contra uma competição legada (sem `tipo`/links, migrada
  automaticamente) e uma nova (com links), confirmando a normalização, a
  correspondência correta dos Jogos por competição, e a geração de HTML sem
  exceções em ambos os casos (com e sem classificação importada).

**Ainda por fazer:** nada pendente para esta funcionalidade em si. Possível
evolução futura, se o Roger achar útil mais tarde: mover também o link
`fpfUrl` de cada Jogo para ficar associado à competição em vez de a cada
jogo individual — não fez parte deste pedido, por isso não foi mexido.

## sps-v161 (17/09/2026): numeração de Microciclos e Macrociclos, a partir do 1º treino

Pedido do Roger: "consegues identificar numericamente os microciclos e
macrociclos, a iniciar da data do primeiro treino?". Até aqui, ambos só
eram identificados por intervalo de datas (ex. "Semana 08/09 — 14/09",
"Pré-Época — 01/08 a 31/08") — sem nenhum número sequencial.

**Cálculo, sempre derivado (nunca guardado como campo próprio) — mesmo
espírito de `_macroForWeek`, já existente:**
- `_firstTrainingDate(teamId)`: primeiro treino real da equipa — o mais
  antigo de `APP.schedule` cujo `type` está em `MC_TRAINING_EV_TYPES`
  (`Treino`/`Ativação`/`Recuperação`/`Ginásio`, a mesma lista já usada para
  decidir se um dia "conta como treino" no resto dos Microciclos).
- `_microcicloNumFor(weekStart,teamId)`: nº de semanas de calendário
  (Segunda-Domingo) entre a semana do 1º treino (essa é a nº 1) e a semana
  pedida. `null` sem treinos ainda registados, ou para uma semana anterior
  à do 1º treino (não há microciclo antes da época começar).
- `_macroNumFor(macro,teamId)`: posição cronológica da fase entre as fases
  da própria equipa, ordenadas por `startDate` — a mesma ordem em que já
  apareciam na lista/timeline de "Época (Macrociclos)".

**Onde passou a aparecer:** cabeçalho da semana em Microciclos ("Microciclo
N — Semana ..."), badge da Fase da Época na mesma página ("Macrociclo N —
Nome da Fase"), lista de fases em "Época (Macrociclos)" ("Macrociclo N —
Nome"), e todos os exports que já existiam (PDF de Microciclo/Macrociclo,
Relatório do Microciclo) — sem criar nenhum export novo, só a numeração
nos títulos/cabeçalhos já existentes.

Como o número é sempre calculado a partir dos dados reais do Planeamento e
das Fases já configuradas, nunca é preciso corrigir manualmente se um
treino for movido/apagado ou se uma fase for inserida antes de outra já
existente — recalcula sozinho na próxima vez que a página é aberta.

SW bump para `sps-v161`. Testado: `node --check` ao ficheiro inteiro; teste
isolado em Node de `_firstTrainingDate`/`_microcicloNumFor`/`_macroNumFor`
extraídas do próprio ficheiro, com uma equipa com treinos (1ª semana = nº1,
semanas seguintes incrementam corretamente, semana anterior ao 1º treino
dá `null`) e uma equipa sem nenhum treino ainda (`null` em vez de crashar),
e 3 fases fora de ordem de inserção a ordenar corretamente por `startDate`.

## sps-v162 (17/09/2026): Plano Nutricional — Dia de Jogo (comum a toda a equipa)

Pedido do Roger: na parte da Nutrição, um espaço para um "Plano para Dia de
Jogo", comum a todas as atletas (não individualizado), definido pela
nutricionista na sua app, e refletido na app da atleta. Pedido feito como
"analisa, investiga, sugere" — antes de implementar, foi feita uma proposta
(3 pontos: plano único para toda a equipa; substitui o texto genérico que
já existia no timeline "Dia de Jogo"; default genérico se ainda não houver
nada definido) e confirmada pelo Roger antes de qualquer código.

**Contexto encontrado na investigação:** já existia um timeline "Dia de
Jogo" (`_diaJogoTimeline`/`_atOpenDiaJogo`) que a atleta usa em cada jogo,
com 5 momentos de domínio nutricional (ao acordar, refeição pré-jogo,
hidratação, snack, recuperação pós-jogo) — mas o texto de cada um estava
fixo no código, igual para todas as atletas e todos os jogos, apesar do
próprio ecrã já dizer "ajusta com a fisio/nutricionista se tiveres
indicação diferente". Não havia forma de a nutricionista definir esse
texto. `nutritionPlans` (Planos Nutricionais) já existia mas é um conceito
diferente — plano individual por atleta, para o dia a dia, não para dia de
jogo — por isso não serve este pedido (confirmado com o Roger antes de
avançar).

**O que foi construído:**
- Tabela nova dedicada `nutrition_gameday_plan` (Supabase), 1 única linha
  por clube (`id='gameday-'+club_id`) — mesmo padrão de upsert-por-id das
  restantes tabelas dedicadas, nunca no blob `clubs.meta`. Campos:
  `wake`/`pre_game_meal`/`hydration`/`snack`/`post_game` (texto de cada
  momento) + `updated_at`/`updated_by`/`updated_by_id`.
- Página nova `nutri-gameday` ("Plano Dia de Jogo") na app da Nutri —
  registada em `ALL_PAGES`/`ROLE_DEFS.nutri`/`_NAV_TITLES`/`renders`
  (dentro de `navTo()`); os cargos com acesso total via `_ALL_PAGE_IDS`
  (treinador/treinador_adj) ganham-na automaticamente. Card novo em
  `renderNutriHome()` a apontar para lá, com estado (definido / a usar
  texto genérico).
- `renderNutriGameday()`: formulário com 5 campos de texto (um por
  momento), pré-preenchidos com o que já estiver guardado; campo em branco
  = mantém o texto genérico só nesse momento (não obriga a preencher tudo
  de uma vez). `saveNutriGameday()` grava em `APP.nutritionGameDayPlan` +
  `cloudUpsert('nutrition_gameday_plan', ...)`.
- `_djNutriText(key)` (nova): devolve o texto definido pela nutricionista
  para esse momento, ou o texto genérico original (`_DJ_NUTRI_DEFAULTS`) se
  ainda não houver nada guardado ou o campo estiver vazio — nunca fica sem
  texto. `_diaJogoTimeline()` passou a chamar esta função nos 5 itens de
  domínio `nutri`, em vez de ter o texto escrito diretamente no código —
  é o mesmo ecrã que a atleta já usa (Dia de Jogo, com checklist), não foi
  criado nenhum ecrã novo do lado da atleta.
- `pullCloud`/`_CLOUD_TABLE_SCHEMA` atualizados com a tabela nova, mesmo
  padrão das restantes (RLS "allow all" igual a `nutrition_plans`/
  `nutrition_appointments`, únicas tabelas deste projeto Supabase).

SW bump para `sps-v162`. Testado: `node --check` ao ficheiro inteiro; teste
isolado em Node de `_djNutriText` confirmando fallback para o texto
genérico quando não há plano, quando um campo está vazio/só espaços, e
override correto quando o campo está preenchido.

**Ainda por fazer:** nada pendente para este pedido em si. Ficou de fora
por não ter sido pedido (mencionado como bónus opcional na proposta, sem
confirmação do Roger): um resumo persistente deste plano na aba "Nutrição"
da atleta fora do contexto de jogo — hoje só aparece dentro do ecrã "Dia de
Jogo" de cada jogo, como já acontecia antes.

## sps-v163 (17/09/2026): Regularidade do ciclo menstrual — Condição do Plantel

Sequência do pedido: análise comparativa com o mercado (plataformas de
sports performance/athlete management), da qual saiu "tracking de ciclo
menstrual mais estruturado" como prioridade #1 — pedido explícito do Roger
para analisar/estudar/propor antes de implementar. A proposta inicial
sugeria um novo "Diário do Ciclo" (tabela dedicada, a atleta regista o 1º
dia de cada período). O Roger sugeriu algo mais simples: já recolhemos a
fase do ciclo todos os dias no wellness — dava para partir daí, sem pedir
nada de novo à atleta. Concordámos, e essa é a versão implementada: **sem
tabela nova**, tudo derivado de `APP.wellness` (mesmo padrão "derivado,
nunca guardado" da numeração de Microciclos).

**Sobre o LEAF-Q** (questionário validado para risco de baixa
disponibilidade energética/RED-S, também sugerido inicialmente pelo Roger
como algo a incluir já): investigação adicional encontrou um estudo de
2023 (Sports Medicine Open) que testou especificamente a sua validade em
futebolistas femininas e concluiu que **não é recomendado nesta
modalidade** — foi desenhado para atletas de resistência, e a subescala de
lesões fica sistematicamente enviesada em desportos de impacto (68% das
atletas ficavam acima do limiar de risco só por seleção, sem risco real).
A única parte do LEAF-Q com bom desempenho no estudo foi precisamente a
deteção de estado menstrual — que é o que esta funcionalidade já cobre.
Por isso o LEAF-Q ficou fora desta fase (documentado na análise
comparativa, não implementado).

**O que foi construído — alinhado de propósito com o "minimum standard" do
consenso UEFA 2025 sobre tracking do ciclo em futebol feminino**, que é
explícito: *"bleeding tracking cannot and should not be used to predict
menstrual phases"* (só tiras de LH diárias dão fase real). Por isso nada
aqui tenta prever fase — só regularidade/saúde:

- `_cycleStartsFor(athleteId, atDate)`: olha só para os dias de wellness
  marcados `cycle==='Menstruação'` e conta um novo início de período
  sempre que passam mais de 10 dias desde o último dia marcado assim
  (limite escolhido por ser seguro face à duração típica de hemorragia,
  3-7 dias — robusto a dias sem preenchimento de wellness entre períodos,
  que é o caso mais comum na prática, em vez de depender de a atleta picar
  ativamente outra fase nos dias "off").
- `_cycleRegularityAt(athleteId, atDate)`: com ≥3 inícios detetados,
  calcula a duração de cada ciclo e sinaliza: fora do intervalo típico
  (21-35 dias) → risco; variabilidade >7 dias entre o ciclo mais curto e o
  mais longo → atenção; caso contrário → regular. Com menos de 3 inícios,
  devolve "dados insuficientes" (não arrisca sinalizar sem base). Sinaliza
  também, independentemente da quantidade de dados, ausência de novo
  início há mais de 90 dias (possível amenorreia).
- Integrado em `_condicaoJogoCompute()` como `cycleReg` por atleta — mas
  **de propósito fora do semáforo diário** (`overallLvl`) da Condição do
  Plantel: é um sinal de saúde de médio prazo que não muda de um dia para
  o outro, ao contrário de ACWR/wellness/faltas: misturá-lo no mesmo
  pior-vence diluiria os alertas de prontidão para treinar hoje.
- `renderCondicaoPlantel()` e `printCondicaoPlantel()` (PDF): nova coluna
  "Regularidade" na tabela principal, e uma caixa de destaques própria
  "🩸 Sinais de regularidade do ciclo" (separada da caixa "🔍 Destaques —
  atletas em risco" já existente, mesmo motivo acima). `printAnaliseCumulativa`
  (o PDF de pré-jogo ligado a uma Unidade de Treino específica) não foi
  alterado — é um relatório de prontidão aguda, não o sítio certo para um
  sinal de saúde de médio prazo.

O campo diário "Fase do Ciclo" + "Impacto" (já existente) não foi alterado
— continua a mesma UI, mesmo comportamento.

SW bump para `sps-v163`. Testado: `node --check` ao ficheiro inteiro; 9
testes isolados em Node de `_cycleStartsFor`/`_cycleRegularityAt`
extraídas do próprio ficheiro — sem dados, dados insuficientes (1 e 2
inícios), ciclo regular (28/28 dias), ciclo fora do intervalo (28/40
dias), variabilidade alta (22/34 dias), amenorreia possível (139 dias sem
registo, mesmo com só 1 início), dias consecutivos marcados "Menstruação"
a contar como um único início, e o limite de 10 dias a funcionar
corretamente nos dois sentidos (10d = mesmo período, 11d = novo início).

**Ainda por fazer:** nada pendente. Se mais tarde o Roger quiser rastrear
disponibilidade energética/RED-S de forma mais ampla, o caminho mais
seguro é a nutricionista avaliar isso clinicamente via Anamnese (já
existe) — não um questionário automático sem validação para futebol.

## sps-v164 (17/09/2026): Carga Planeada vs. Realizada — Microciclo/Macrociclo

Pedido do Roger: "Microciclo e Macrociclo comparação carga planeada e carga
realizada, nos relatórios, analisa, investiga e aconselha" — outra vez
análise/proposta antes de código. A proposta (documentada na doc "SPS vs
Mercado", secção 1.1, que já tinha esta ideia apontada como "única evolução
que faria sentido" na comparação inicial com o mercado) foi confirmada com
"avança" sem alterações.

**Grounding usado antes de desenhar:** duas fontes de ciência do desporto —
uma meta-análise (Sports Medicine Open, 2022, 725 atletas, vários desportos
coletivos) que mostra boa concordância geral entre RPE planeado pelo
treinador e RPE percebido pelo atleta, EXCETO em sessões fáceis/recuperação,
onde o atleta reporta sistematicamente menos do que o planeado (efeito
moderado); e um estudo de 2026 em basquetebol profissional (carga externa
por GPS) que confirma o mesmo padrão mesmo em elite (~5% abaixo do planeado
em média, mais acentuado em dias de carga alta/véspera de jogo), com os
autores a dizerem explicitamente que "algum desalinhamento é inevitável".
Conclusão usada no desenho: banda de tolerância em vez de alvo exato, e
nunca alarme isolado em dias de baixa intensidade.

**O que foi construído — tudo derivado, sem tabela nova (mesmo padrão da
Regularidade do Ciclo, sps-v163):**
- `CARGA_TOLERANCIA` (±15%) e `CARGA_PLAN_EV_TYPES` (Treino/Ativação/
  Recuperação/Ginásio + Jogo — fora ficam Reunião/Consulta Nutri/Fisio, sem
  exigência física própria) — constantes novas.
- `_mcPlannedUaForDay(dt,teamId,mc,gameDate)`: carga planeada de um dia =
  duração agendada (Planeamento) × ponto médio do RPE-alvo da tipologia
  resolvida desse dia (override de conteúdo do dia, se existir, senão o
  molde partilhado da equipa) — mesma fórmula duração×RPE (Foster) já usada
  na carga realizada. Nota importante deixada no código: reaproveita
  `_mcResolveDayType`, que já antes desta alteração resolve a tipologia a
  partir da variável global `_mcTeam` (não de um parâmetro) — por isso só dá
  resultado correto com `teamId===_mcTeam`, sempre o caso nos 3 pontos que a
  chamam (não é um problema introduzido agora, só documentado).
- `_mcRealizedUaForDay(dt,teamId)`: média do UA (PSE×duração) das atletas da
  equipa que registaram PSE nesse dia — `null` (nunca 0) se ninguém
  registou, para distinguir "sem carga" de "sem dados".
- `_mcCargaStatus(plannedUa,realizedUa)`: `'sem-alvo'` / `'sem-registo'` /
  `'ok'` (dentro de ±15%) / `'acima'` / `'abaixo'`.
- `_mcDayLoadCompliance`, `_mcWeekLoadCompliance` (rollup semanal, usado na
  vista semanal e no Relatório da Semana) e `_macroLoadWeeks` (rollup semana
  a semana dentro de uma fase, para o gráfico da Época).
- **Vista semanal do Microciclo** (📅 Semana): novo cartão "🎯 Carga Planeada
  vs. Realizada" — planeado/realizado por dia + badge de estado, e total da
  semana com % de cumprimento.
- **Relatório da Semana** (📊, já existente): a tabela "Semana — tipologia
  real por dia" ganhou coluna de carga planeada/realizada por dia; os KPIs
  ganharam "UA planeado total" e "% Cumprimento da carga"; a conclusão
  automática (`_mcConclusaoTxt`) passou a incluir uma linha sobre o
  cumprimento da semana.
- **Época (Macrociclos)**: cada fase ganhou um gráfico (Chart.js, barras
  planeado + linha realizado, uma semana por ponto) da tendência de carga ao
  longo da fase — esta vista não tinha nenhum dado de carga antes. Estado
  vazio ("Ainda sem dados de carga nesta fase") quando não há treinos/PSE no
  período, em vez de gráfico vazio.
- Badge de estado (`_cargaStatusBadge`) partilhado: dias de baixa
  intensidade (intensidade "Baixa" no molde, ou sem RPE-alvo definido) fora
  da banda mostram o número mas sem cor/seta de alerta — desvio esperado, não
  é sinal de sub/sobrecarga a corrigir, conforme a literatura acima.

SW bump para `sps-v164`. Testado: `node --check` ao ficheiro inteiro; 20
testes isolados em Node das funções novas extraídas do próprio ficheiro
(`_mcPlannedUaForDay`/`_mcRealizedUaForDay`/`_mcCargaStatus`/
`_mcDayLoadCompliance`/`_mcWeekLoadCompliance`/`_macroLoadWeeks`) — dia
normal dentro da banda, fora da banda com alerta, dia de baixa intensidade
fora da banda sem alerta, folga sem alvo, dia com alvo sem PSE ainda,
override de RPE do dia a ter prioridade sobre o molde, limite exato de
±15% dos dois lados, rollup semanal a somar só os dias com alvo/registo, e
nº de semanas cobertas por um macrociclo.

**Ainda por fazer:** nada pendente para este pedido em si. A doc "SPS vs
Mercado" (secção 1.1) tem o desenho completo, incluindo as decisões
conscientes de granularidade (planeado só ao nível da equipa, não por
atleta — para não pedir mais introdução manual de dados).

## sps-v165 (18/09/2026): Avaliação Antropométrica completa + Plano Dia de Jogo na aba Nutrição

Pedido veio de uma conversa por WhatsApp com a nutricionista, colada pelo
Roger, sobre upgrade da aba Nutrição. Dois pedidos distintos, ambos
"analisa, investiga, propõe" primeiro (proposta na doc "SPS vs Mercado",
secção 5.1), depois confirmados por partes: a estrutura da avaliação
antropométrica foi pedida logo para já; o cálculo automático de % Gordura e
Massa Muscular — inicialmente proposto como ideia para "mais tarde" — foi
depois pedido também para já, com uma condição explícita do Roger: "com
calculo automatico, mas que permita edição da parte da nutricionista, ou
seja por defeito automático e editável, e se a nutri quiser ela edita".

**1. Avaliação Antropométrica — protocolo ISAK de 8 pregas + perímetros:**
- Novos campos de pregas cutâneas (mm): Tricipital, Bicipital, Subescapular,
  Suprailíaca, Abdominal, Supraespinal, Crural, Geminal — os 8 pontos do
  protocolo ISAK completo, conforme pedido pela nutricionista.
- Novo campo automático "Soma das 8 Pregas" (`_naSkinfSum`) — só calcula
  quando as 8 estão preenchidas (uma soma parcial não é uma Σ8SF válida
  para comparar com curvas de referência da literatura); fica vazio
  enquanto faltar alguma.
- Novos perímetros (cm): Braço, Coxa, Gémeo, Cintura, Ancas — e um novo
  campo automático "Rácio Cintura-Ancas" (`_naWHR`, Cintura/Ancas).
- % Gordura mantido (pedido do Roger: "podemos manter"); Massa Muscular
  passou de % para kg (pedido explícito). Como o campo antigo `muscle`
  guardava %, foi criado um campo novo `muscleKg` em vez de reinterpretar o
  antigo — os registos antigos continuam a mostrar-se corretamente
  identificados como "% (antigo)" no histórico, nunca reinterpretados como
  kg. Corrigido de caminho um bug pré-existente no cartão do Plantel
  (`anthroBlock`): lia `lastAnthro.fatPct`, campo que nunca existiu com
  esse nome nos dados guardados (era `bodyFat`) — por isso "% Massa Gorda"
  nunca aparecia ali; agora lê o campo certo.

**2. Cálculo automático de % Gordura e Massa Muscular (kg) — editável:**

Padrão de UI novo (distinto do IMC, que é só leitura): o campo vem
pré-preenchido automaticamente, mas continua a ser um `<input>` normal —
a nutricionista pode sempre escrever por cima. Um botão 🧮 ao lado força
o recálculo mesmo que já exista um valor (útil se ela quiser voltar ao
valor sugerido depois de editar). Nunca sobrescreve silenciosamente um
valor já escrito, exceto com o botão.

Antes de escolher as equações, pesquisa dedicada em fontes de ciência do
desporto (mesmo padrão de grounding do sps-v163/sps-v164, não confiar em
memória de treino):
- **% Gordura — Evans et al. (2005).** Equação de pregas cutâneas escolhida
  por ter sido validada especificamente numa população equivalente à do
  SPS: um estudo de 2026 comparou-a com DXA em futebolistas femininas de
  elite e obteve R²=0,70–0,83 sem viés significativo, o melhor desempenho
  entre as equações testadas nesse estudo para este desporto/sexo — melhor
  do que usar uma equação genérica "para atletas" sem validação no futebol
  feminino. Usa 3 das 8 pregas (Tricipital+Abdominal+Crural).
- **Massa Muscular (kg) — Lee et al. (2000), versão simplificada "Lee-2".**
  Só peso+altura+idade+sexo (sem perímetros) — versão escolhida porque
  reduz o nº de inputs obrigatórios para a nutri conseguir um valor
  automático (a versão completa do Lee pede mais perímetros/medições
  específicas que não fazem parte deste formulário). **Limitação conhecida
  e assumida:** por isto, este campo não usa ainda os novos perímetros
  (Braço/Coxa/Gémeo/Cintura/Ancas) que foram adicionados no mesmo pedido —
  ficam disponíveis para a nutri consultar e, se um dia se quiser trocar
  para a versão completa do Lee (mais precisa, mas mais exigente em
  inputs), já lá estão. Precisa da idade da atleta na data da avaliação —
  calculada a partir da data de nascimento já existente no Plantel
  (`_ageAtDate`), por isso recalcula também ao mudar de atleta ou de data
  da avaliação, não só peso/altura.

**Nota de transparência importante (comunicada também ao Roger em chat,
não só aqui):** as duas equações publicadas originalmente incluem um termo
de "raça"/etnia. Esse termo foi **omitido de propósito** em ambas — esta
app não recolhe dado de raça/etnia (é dado sensível ao abrigo do RGPD,
art.º 9, e nem a nutricionista nem o Roger pediram isso), e inventar ou
adivinhar essa categoria seria pior do que assumir a categoria de
referência do estudo. Isto equivale matematicamente a usar o termo racial
de referência (coeficiente 0) — uma simplificação consciente, documentada
em comentário no código junto de cada função (`_naAutoFat`, `_naAutoMuscle`)
para quem for rever isto no futuro. O termo de sexo está fixo em feminino
(toda a equipa é feminina).

**3. Plano Dia de Jogo — agora também residente na aba Nutrição:**

Antes só aparecia dentro do ecrã "Dia de Jogo", ativo apenas num dia de
jogo real. Pedido do Roger: "quero que além de ficar ativo no dia de jogo,
resida num espaço na aba nutrição para consulta em qualquer dia". Sem
duplicar dados — novo cartão `<details>` (recolhível, mesmo padrão já usado
na Referência de Ciclo Menstrual) em `renderAtNutri()`, lendo os mesmos 5
campos via `_djNutriText()` (a mesma função já usada por `_diaJogoTimeline`,
com o mesmo fallback para o texto genérico quando a nutricionista ainda não
definiu nada). Aparece sempre na aba Nutrição da atleta, qualquer dia,
sem gatilho de jogo.

**Schema Supabase:** 14 colunas novas em `nutrition_records` (as 6 pregas
que faltavam, soma, 5 perímetros, WHR, `muscle_kg`) — criadas primeiro como
`text` e depois corrigidas para `numeric` numa segunda migração, depois de
verificar `information_schema.columns` e confirmar que colunas irmãs
existentes (peso, altura, imc, body_fat, tricipital, suprailiaca, muscle)
são todas `numeric`. `_CLOUD_TABLE_SCHEMA.nutrition_records` (push) e o
mapeamento de `pullCloud()` (pull) atualizados os dois em conjunto — só
mudar um dos lados teria feito os campos novos desaparecerem
silenciosamente depois de um refresh da cloud (mesma classe de bug já
documentada nos Incidentes #1-3 deste ficheiro).

SW bump para `sps-v165`. Testado: `node --check` ao ficheiro inteiro; 16
testes isolados em Node das funções novas extraídas do próprio ficheiro
(`_naSkinfSum`/`_naAutoFat`/`_naAutoMuscle`/`_ageAtDate`/`_naWHR`) — soma
parcial fica vazia, soma completa calcula e dispara a sugestão de %
gordura, %gordura e massa muscular não sobrescrevem valor manual sem
`force=true` mas recalculam com o botão 🧮, inputs incompletos não
rebentam e deixam o campo vazio, idade calculada corretamente à volta do
aniversário (dia antes vs. dia exato), atleta sem data de nascimento não
gera erro.

**Ainda por fazer:** nada pendente para este pedido. Se a nutricionista
quiser no futuro trocar a Massa Muscular para a versão completa do Lee et
al. (usando os perímetros já recolhidos), é uma troca localizada dentro de
`_naAutoMuscle`, sem alterações de schema.

## sps-v166 (18/09/2026): PDF de Evolução da Avaliação Antropométrica

Pedido do Roger a partir de uma folha de referência (Excel: atletas em linha,
meses em coluna, Peso + Soma de Pregas por mês, células coloridas, coluna de
texto "Avaliação") — queria algo "mais evoluído", em PDF, com informação da
atleta (incl. foto) e identificação da nutricionista. Proposto na doc "SPS
vs Mercado", secção 5.2, antes de implementar (padrão de confirmar decisões
de design/scope maiores). Duas perguntas fechadas antes de avançar:
1. Por atleta (não equipa toda por mês, como a folha de referência) —
   confirmado pelo Roger ("1 por atleta").
2. Identificação da nutricionista: sempre o "Responsável" configurado no
   clube (`APP.config.nutriResponsavelId`), não quem registou o registo em
   concreto — confirmado pelo Roger ("2 a responsavel").

**O que foi construído — tudo reaproveitando o motor de PDF já existente
(`_printWin`), sem tabela nova (mesmo padrão dos relatórios anteriores):**
- `_naTrendB64(labels,data,label,color)`: gráfico de tendência genérico de 1
  métrica ao longo do tempo (canvas off-screen + Chart.js + `toDataURL`,
  mesmo padrão de `_pseTrendB64`/`_wellTrendB64`), com `spanGaps:true`
  porque nem toda avaliação tem todos os campos preenchidos.
- `_naTrendCls(cur,prev,favDir)`: cor de uma célula (verde/amarelo/vermelho)
  comparando com a avaliação anterior. Usada só em 3 métricas onde a
  "direção favorável" está bem estabelecida em composição corporal de
  atletas — % Gordura e Soma das 8 Pregas (↓ favorável), Massa Muscular (↑
  favorável) — mesmo espírito da coluna "Soma Pregas" já colorida na folha
  do próprio Roger. Peso, perímetros e Rácio Cintura-Ancas ficam sempre sem
  cor: não há uma direção "melhor" universal para eles nesta app, e não
  queríamos impor um juízo clínico que não foi pedido.
- `_naEvolutionFindings(avals)`: conclusão automática por regras (sem IA,
  sem custo — mesmo motor de `_athleteNarrative`/`findings` do Relatório de
  Atleta), comparando a 1ª com a última avaliação da atleta. Nunca inventa
  números — só fala de uma métrica se ela existir nas duas avaliações
  usadas para a comparação; sem dados suficientes, mostra uma mensagem
  neutra em vez de inventar uma conclusão.
- `printNaEvolutionPDF()`: junta tudo — cabeçalho com foto/nome/alcunha/
  posição/idade da atleta (mesmo bloco `.profile-header` do Relatório de
  Atleta) + bloco "Avaliado por" (nome + foto do Responsável configurado,
  ou aviso neutro se não estiver configurado); tabela de evolução (uma
  coluna por avaliação, linhas = Peso/IMC/%Gordura/Massa Muscular/Soma das
  8 Pregas/WHR/5 perímetros — IMC mantém a classificação absoluta já
  existente na app, as 3 métricas de tendência usam `_naTrendCls`); até 4
  gráficos (Peso, Soma das 8 Pregas, %Gordura, Massa Muscular — só entra
  gráfico de uma métrica com pelo menos 2 pontos de dados); conclusão
  automática. PDF em paisagem (tabela naturalmente larga com várias datas
  em coluna).
- Botão "🖨️ PDF Evolução" + seletor de atleta no cabeçalho da página
  Avaliações (só lista atletas com pelo menos 1 avaliação; com menos de 2,
  `printNaEvolutionPDF()` avisa em vez de gerar um PDF sem evolução para
  mostrar).

SW bump para `sps-v166`. Testado: `node --check` ao ficheiro inteiro; 21
testes isolados em Node das duas funções de lógica extraídas do próprio
ficheiro (`_naTrendCls`/`_naEvolutionFindings`) — sem/com dados em falta,
tendência favorável/desfavorável/estável nas 3 métricas coloridas, campos
de string vazia tratados como "sem dado" (nunca como 0), e a mensagem de
fallback quando não há dados suficientes para nenhuma métrica. Verificação
visual ao vivo não foi feita nesta sessão (a funcionalidade só existe no
código ainda não publicado) — confiança assenta no harness contra o código
real + reaproveitamento direto de padrões já validados noutros relatórios
(`_printWin`, `.profile-header`, `_pseTrendB64`/`_wellTrendB64`); pedir ao
Roger para confirmar visualmente no primeiro PDF gerado a sério.

**Ainda por fazer:** nada pendente para este pedido. Se um dia fizer
sentido, a vista "equipa toda por mês" da folha de referência do Roger fica
registada na doc (5.2) como possível extensão futura, não pedida agora.

## sps-v167 (18/09/2026): "A tua Evolução" — card motivador na Nutrição da app da atleta

Pedido do Roger: dar à atleta acesso à própria evolução antropométrica na
aba Nutrição da sua app, "algo motivador para ela ir vendo". Antes de
desenhar, fui à literatura de ciência do desporto (proposto na doc "SPS vs
Mercado", secção 5.3) — e a orientação mais recente e mais forte que
encontrei vai **contra** a leitura mais literal do pedido.

**Grounding usado antes de desenhar:** revisão crítica + inquérito do
subgrupo REDs do COI (2023, 125 profissionais, 61 desportos, 26 países) —
recomenda tratar dados de composição corporal como informação confidencial
com acesso restrito da própria atleta, mostra que a tendência da prática é
para menos exposição direta (não mais), com interpretação cada vez mais
feita por um nutricionista/dietista, nunca autosservida; a mesma fonte
mostra a preocupação de que o foco em composição corporal cause distress
alimentar/RED-S a subir de 69% para 78% dos profissionais inquiridos numa
década. Uma revisão sistemática de 2024 (27 estudos, amostras só de
mulheres atletas) encontrou associação consistente entre %massa gorda/IMC e
insatisfação corporal, e nota que pesagens de equipa já foram associadas a
mais restrição alimentar. Um estudo qualitativo de 2026 mostra que quando o
staff comunica sobre o corpo em termos de função/desempenho em vez de
números, o dano psicológico é menor. Esta é exatamente a mesma área de
risco do LEAF-Q (sps-v163, mulheres atletas + dados corporais/energéticos)
onde já se tinha decidido não avançar como pedido inicialmente pela mesma
razão. Recomendei ao Roger não dar à atleta acesso direto ao gráfico/tabela
de %Gordura/Massa Muscular/Soma das Pregas nem à conclusão automática
construída para o PDF do staff (`_naEvolutionFindings`, sps-v166) — ele
concordou com a abordagem, pedindo só que ficasse "algo simples e gráfico
que seja motivador" dentro dela.

**O que foi construído:**
- Novo campo `athleteNote` em `nutritionAssessments` — texto curto,
  opcional, escrito pela nutricionista no formulário de avaliação ("💬 Nota
  para a Atleta"), com enquadramento dela (ex.: "Continuas a evoluir bem na
  força"), nunca um número cru nem uma conclusão automática. Coluna
  `athlete_note` (text, a condizer com `notes`) adicionada a
  `nutrition_records` no Supabase; `_CLOUD_TABLE_SCHEMA` e `pullCloud()`
  atualizados em conjunto (mesma disciplina de sps-v165, para não deixar o
  campo desaparecer num refresh da cloud).
- `_naEvolutionCardHtml(avalsDesc)`: card "📈 A tua Evolução" na aba
  Nutrição da app da atleta (`renderAtNutri()`), com duas coisas só —
  **nunca** um valor de peso/gordura/massa muscular:
  - Uma linha do tempo gráfica de pontos (um por avaliação, até 12
    visíveis + indicador "+N" para avaliações mais antigas), o mais recente
    maior e destacado — visual, simples, motivador por mostrar consistência
    de acompanhamento, sem expor nenhum número de composição corporal.
  - A Nota da Nutricionista mais recente, se existir, num cartão com
    citação — nunca notas antigas, só a mais recente.
  - Sem avaliações registadas, o card não aparece (não força um estado
    vazio a pedir à atleta para "começar a acompanhar o peso").
- Peso e IMC continuam exatamente como já estavam (KPI da última
  avaliação) — não foi adicionado nenhum gráfico de tendência a essas
  métricas nem a nenhuma métrica de composição corporal na app da atleta.

SW bump para `sps-v167`. Testado: `node --check` ao ficheiro inteiro; 12
testes isolados em Node de `_naEvolutionCardHtml` — sem avaliações não
mostra card, singular vs. plural na contagem, data "desde" correta,
**nenhum número de peso/%gordura/massa muscular escapa para o HTML** (teste
central de segurança desta funcionalidade), só a nota mais recente aparece
(nunca uma antiga), sem nota não mostra o bloco, texto da nota escapado
(HTML), e o indicador "+N" com mais de 12 avaliações. Verificação visual ao
vivo não foi feita nesta sessão (funcionalidade nova, ainda não publicada).

**Ainda por fazer:** nada pendente para este pedido. Combinado com o Roger:
confirmar visualmente com uma atleta real assim que estiver no ar.

## sps-v168 (18/09/2026): PDF de Avaliação Individual + Guias de Referência por Cor

Pedido do Roger: (1) um PDF de uma só avaliação (só tínhamos o de evolução,
sps-v166); (2) cada medida com código de cor verde/amarelo/vermelho segundo
guidelines científicas, com bandas por género (masculino/feminino),
automático por defeito e editável pela nutricionista — edição sempre
prevalece, na ausência usa-se o automático. Proposto e confirmado na doc
"SPS vs Mercado", secção 5.4, antes de implementar.

**Grounding usado antes de decidir o desenho — achado importante: nem
todas as métricas podem ter banda absoluta.** % Gordura tem tabela do
American Council on Exercise (ACE) por sexo (mulheres: Essencial 10-13% /
Atletas 14-20% / Fitness 21-24% / Aceitável 25-31% / Obesidade 32%+;
homens: Essencial 2-5% / Atletas 6-13% / Fitness 14-17% / Aceitável 18-24%
/ Obesidade 25%+). Rácio Cintura-Ancas (WHR) tem o limiar de risco da OMS
(2008): >0,85 mulheres / >0,90 homens. Massa Muscular (kg) e Soma das 8
Pregas (mm) **não têm** — uma revisão de nutrição clínica mostra cortes de
massa muscular a variar entre 14,3kg e 27,8kg só consoante a fórmula
usada, e um estudo de referência em atletas de topo mostra somas de pregas
entre ~40mm e ~118mm consoante o desporto — ambos os campos recomendam
medidas normalizadas (altura², percentil por desporto/sexo), nunca um
corte absoluto em bruto. Por isso estas 2 métricas continuam sem banda
absoluta (mesmo princípio já usado no PDF de Evolução, sps-v166 —
`_naTrendCls`/`_naEvolutionFindings`, cor só por tendência); IMC mantém a
classificação universal da OMS já existente, sem divisão por género.

**Cuidado deliberado no extremo baixo de %Gordura, ligado ao LEAF-Q
(sps-v163):** a posição do ACSM sobre a Tríade da Atleta avisa contra
cortes rígidos de %gordura — a teoria de que gordura baixa causa
diretamente problemas hormonais foi refutada, o que importa é
disponibilidade energética, não a %gordura isolada. Por isso a banda
**não** marca "baixo" como simplesmente vermelho: 14-20% (faixa "Atletas")
fica verde, 10-13% (faixa "Essencial") fica **amarelo** — não vermelho —
só abaixo de 10% é que fica vermelho. A zona amarela do WHR (entre o
"ideal" e o limiar de risco) é uma margem de precaução nossa, não uma
citação separada — só o corte final (0,85/0,90) vem mesmo da OMS.

**O que foi construído:**
- `NA_GUIDE_DEFAULTS`: bandas por defeito (feminino/masculino), 6 cortes
  cada (4 de %Gordura, 2 de WHR). Como o plantel é inteiramente feminino
  (mesma assunção do sps-v165, sem campo de género na atleta), a banda
  feminina é sempre a aplicada automaticamente; a masculina fica guardada
  e editável, pronta para o dia em que fizer falta, sem forçar já um campo
  que hoje não tem uso real.
- `_naGuideBands(sex)`: junta os defeitos científicos com as edições da
  nutricionista **campo a campo** — um corte editado prevalece sempre; um
  campo deixado em branco volta ao valor por defeito (nunca é
  tudo-ou-nada, como pedido pelo Roger).
- `_naBodyFatColor(v,bands)` / `_naWhrColor(v,bands)`: devolvem cor +
  legenda curta (nunca só a cor, sempre com uma frase de contexto).
- `APP.config.naGuidelines`: novo bloco de configuração (estrutura já
  presente em `APP.config`, sem migração de dados necessária).
- `_naGuidelinesEditorHtml()` + `_setNaGuideline`/`_resetNaGuidelines`: novo
  card recolhível "🎯 Guias de Referência — Composição Corporal" na
  Nutrição → Dashboard (ao lado do seletor de Responsável já existente,
  mesmo espírito), com um input por corte, por género, e um botão de reset
  por género para voltar aos valores da literatura.
- `printNaSinglePDF(id)`: novo PDF de uma avaliação — cabeçalho com
  foto/nome/idade da atleta (mesmo bloco dos outros relatórios), tabela de
  valores com badges de cor em %Gordura e WHR (+ legenda) e na
  classificação já existente do IMC; Massa Muscular e Soma das Pregas
  aparecem sem cor, com nota explícita ("sem intervalo absoluto — depende
  do tamanho corporal/desporto"); bloco "Avaliado por" (Responsável
  configurado, igual ao PDF de Evolução); notas da avaliação, se
  existirem. Botão "🖨️" novo por linha na tabela de Avaliações, ao lado do
  🗑️ já existente.

SW bump para `sps-v168`. Testado: `node --check` ao ficheiro inteiro; 23
testes isolados em Node de `_naGuideBands`/`_naBodyFatColor`/`_naWhrColor`
— defeitos corretos por género, edição parcial prevalece só no campo
editado (resto continua no valor por defeito), sexo desconhecido cai para
feminino, as 5 zonas de %Gordura (incl. o teste central: 11% fica amarelo,
nunca vermelho — a salvaguarda do ACSM), as 3 zonas de WHR, limites exatos
nas fronteiras, e edição de um corte a mudar mesmo o resultado da cor.
Verificação visual ao vivo não foi feita nesta sessão (funcionalidade
nova, ainda não publicada).

**Ainda por fazer:** nada pendente para este pedido.

## sps-v169 (18/09/2026): Visto nas pregas medidas no PDF de Avaliação Individual

Pedido do Roger: no PDF de uma avaliação (`printNaSinglePDF`, sps-v168), ver
as 8 pregas cutâneas individuais com um visto (✓) só nas que foram de facto
medidas nessa avaliação — nem toda avaliação tem as 8 preenchidas (a "Soma
das 8 Pregas" só calcula quando estão todas, mas pode haver registos
parciais), e ele quer ver de relance o que faltou medir. Pedido mecânico/
incremental (acrescentar informação a um relatório já existente), não
precisou de proposta prévia na doc.

**O que foi construído:**
- `NA_SKINFOLD_FIELDS`: as mesmas 8 pregas já usadas no formulário
  (`_NA_SKINFOLD_IDS`), mas como par campo-do-registo+rótulo em vez de id
  de input — reutilizável fora do formulário.
- `printNaSinglePDF`: nova secção "Pregas Cutâneas (protocolo ISAK)" — uma
  grelha com as 8 pregas, cada uma com ✓ (verde) + valor em mm se medida,
  ou — (cinzento) se não. Uma linha de resumo "N de 8 pregas medidas",
  com aviso extra se for menos de 8 (explica porque a Soma pode não
  aparecer). `0` conta como medida real (não é tratado como "em falta" —
  só string vazia/`null`/`undefined` conta como não medida).

SW bump para `sps-v169`. Testado: `node --check` ao ficheiro inteiro; 8
testes isolados em Node da lógica de "medida vs. não medida" — os 8 campos
na ordem certa, avaliação completa (8/8), avaliação parcial (só 3 vistos),
campos ausentes do registo (não só vazios) tratados como não medidos, e o
caso de fronteira do valor `0` a contar como medição real.

**Ainda por fazer:** nada pendente para este pedido.
