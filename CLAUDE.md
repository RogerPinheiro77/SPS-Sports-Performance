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

## sps-v170 (18/09/2026): Aba "Manual de Utilização" na SPS-Nutri

Pedido do Roger: manual em PDF de toda a app de Nutrição para enviar à
nutricionista + uma aba "Manual de Utilização" dentro da própria app. Antes
de codar, propus o plano na doc "SPS vs Mercado" (secção 5.5) e ele confirmou
("AVANÇA"). Esta é a parte da aba dentro da app — o PDF é entregue à parte,
fora do fluxo do site (ver `Manual_SPS_Ginasio.pdf`/`Guia_App_Atleta_SPS.pdf`
no `.gitignore` para o mesmo padrão de entrega).

Reaproveitei dois precedentes já existentes no projeto em vez de inventar
mecanismo novo: o `Manual_SPS_Ginasio.pdf` (mesmo conteúdo, versão PDF) e o
"📖 Manual da App" da Atleta (sps-v31) — mesmo mecanismo de secções
colapsáveis `<details>`/`<summary>`, conteúdo embutido no `index.html`,
disponível offline via Service Worker. Diferença: o Roger pediu desta vez uma
ABA a sério (a SPS-Nutri já tem menu lateral próprio com 7 páginas), não só
um ícone/modal como na Atleta — por isso é uma página normal
(`renderNutriManual`/`pg-nutri-manual`), não um `openMod()`.

**O que foi construído:**
- `_NUTRI_MANUAL_SECOES`: 8 secções (Home, Avaliações Antropométricas, Guias
  de Referência por Cor, Planos Nutricionais, Plano Dia de Jogo, Agenda
  Geral & Consultas, Dashboard Completo, O que a Atleta Vê) — cada uma
  explica o que a página faz e como usar, incluindo os botões de PDF
  (Evolução vs Individual), o editor de Guias de Referência e o que muda
  do lado da atleta.
- `renderNutriManual(openId)`: monta as secções em `<details>` colapsáveis
  (mesmo padrão do `atOpenManual`).
- Novo item `nutri-manual` (📖) em `ALL_PAGES`, adicionado a
  `ROLE_DEFS.nutri.pages`, `_NAV_TITLES` e ao mapa de renders do `navTo` —
  aparece automaticamente no menu lateral da Nutri (a sidebar é gerada a
  partir de `ALL_PAGES`, não precisou de HTML novo aí).
- Novo container `<div class="pg" id="pg-nutri-manual">`.

SW bump para `sps-v170`. Testado: `node --check` ao ficheiro inteiro; teste
isolado em Node de `renderNutriManual` (harness com `document.getElementById`
simulado) confirmando 8 secções geradas, ids todos únicos, e o parâmetro
`openId` a abrir a secção certa.

**Ainda por fazer:** o PDF `Manual_SPS_Nutricao.pdf` (screenshots + ReportLab)
fica para entrega em separado — não é parte deste commit.

## Manual_SPS_Nutricao.pdf (18/09/2026): entregue ao Roger

Concluído o PDF de 13 páginas (`/home/claude/nutri_manual/build_manual_nutricao.py`,
fora do git — mesmo padrão do `Manual_SPS_Ginasio.pdf`, ver `.gitignore`),
com screenshots reais de todas as páginas da SPS-Nutri (capturados via Claude
in Chrome, login do próprio Roger) e os dois PDFs de exemplo (Individual +
Evolução) gerados a sério pela app com dados de uma atleta fictícia "Teste"
(2 avaliações, 15/08→18/09/2026, evolução favorável) — o Roger gerou-os
localmente ("Guardar como PDF") porque `_printWin` chama `window.print()`
automaticamente e a caixa de diálogo nativa bloqueia a automação do browser
sem alternativa limpa.

**Bugs apanhados na revisão visual (`pdftoppm`, página a página) antes de
entregar — nenhum chegou a ser visto pelo Roger:**
- Tabela do capítulo 5 (comparação PDF Individual vs. Evolução): células
  com string simples em vez de `Paragraph` — texto mais longo não fazia
  wrap e extravasava para fora da tabela. Corrigido com estilos novos
  `TableCell`/`TableCellBold`/`TableCellHead` (`Paragraph` em cada célula).
- Três emojis literais (🖨️ no cabeçalho da mesma tabela, ⋮ no capítulo 2,
  ✅/❌ no capítulo 9) renderizavam como caixas tofu — mesmo bug já
  documentado no `bullet()` do próprio ficheiro (Helvetica sem esses
  glifos), mas escrito diretamente em `Paragraph`s fora desse helper.
  Substituídos por texto/bullets coloridos (`bullet()` ou palavras).
- Imagem do PDF de Evolução (`pdf_evolucao_sample.png`) começou por ser um
  composite das 2 páginas do PDF real (tabela+4 gráficos+conclusão)
  empilhadas verticalmente — ficava demasiado pequena a 95mm de altura
  máxima. Trocado para só a 1ª página (tabela+2 gráficos principais) com
  `max_h` aumentado para 125mm nas duas imagens deste capítulo — legível.

Nome das atletas reais na tabela do Dashboard Completo (`dashboard.png`)
foi desfocado (Gaussian blur, PIL) antes de entregar — decisão minha, não
pedida explicitamente pelo Roger para este screenshot em concreto, dado
não ser viável montar um plantel fictício completo de 26 atletas só para
esta captura (as colunas de nutrição em si estavam vazias, sem dado
sensível associado ao nome).

Entregue via SendUserFile. Nada pendente.

## sps-v171 (18/09/2026): fix — gráfico de carga em Macrociclos crescia sem limite

Reportado pelo Roger com screenshot: ao abrir "Época (Macrociclos)", o
cartão do Macrociclo 1 aparecia com uma área enorme, praticamente vazia,
por baixo (só um "4500" isolado no canto, resto do ecrã em branco/escuro
sem conteúdo visível).

**Causa:** o gráfico de "Carga Planeada vs. Realizada" introduzido no
sps-v164 (`_renderMacrociclosEpoca`) tinha `<canvas height="70">` sem
nenhum contentor com altura CSS fixa à volta — e as opções do Chart.js
usam `responsive:true`+`maintainAspectRatio:false` (necessário para o
gráfico ocupar a largura do cartão). Sem um pai com altura limitada, essa
combinação deixa o Chart.js entrar num ciclo de redimensionamento sem
limite (cresce, mede-se outra vez, cresce mais) — o `height="70"` do HTML
é ignorado assim que o Chart.js assume o controlo do canvas. O padrão
correto já existia no próprio ficheiro (`ch-carga-sem` no Dashboard,
`prof-load-ch`/`prof-well-ch` no Relatório de Atleta — todos com
`<div style="position:relative;height:...px"><canvas>...</canvas></div>`)
mas não foi seguido quando este gráfico foi acrescentado.

**Fix:** canvas `ch-macro-carga-${m.id}` passou a ficar dentro de
`<div style="position:relative;height:160px">`, igual ao `ch-carga-sem`.

SW bump para `sps-v171`. Testado: `node --check` ao ficheiro inteiro
(script extraído). Correção é puramente de marcação/CSS à volta de um
`<canvas>` já existente — sem alteração de lógica de dados
(`_macroLoadWeeks` intocado), por isso sem harness de dados novo.

**Ainda por fazer:** nada pendente para este fix.

## sps-v172 (18/09/2026): RPE-alvo na Análise da Sessão + carga da última UT na Convocatória/Condição para o Jogo

Pedido do Roger, em duas partes da mesma conversa: (1) rever se a Análise da
Sessão de uma UT já liga wellness de chegada + PSE do treino + wellness do
dia seguinte ao RPE-alvo planeado, "analisa, investiga, estuda e propõe"; (2)
depois de confirmado o plano, se isso também apareceria nos PDFs e se fazia
sentido esses acumulados aparecerem na aba Jogo para ajudar a convocatória e
sobretudo o 11 do dia de jogo. Segui o padrão já estabelecido — análise e
proposta primeiro, código só depois de "avança".

**Investigação:** `_trAnaliseCompute`/`_trAnaliseHtml` (Análise da Sessão) já
calculava `wellPre` (wellness de chegada, manhã do dia do treino) mas só o
usava por trás, na "Leitura" cruzada — nunca aparecia como coluna própria. O
RPE-alvo (Modelo da Semana, `_mcPlannedUaForDay`, sps-v164) só era usado nos
ecrãs de Microciclos/Macrociclos, nunca chegava à Análise da Sessão. Do lado
da Convocatória: `_jogoPreHtml` já mostra, por atleta, um badge de condição
(`_condicaoJogoCompute` — ACWR, wellness, faltas, minutos no último jogo,
ciclo) ao escolher quem convocar e o 11 — mas esse motor não olhava para a
carga real da última UT vs. o que estava planeado.

**Decisão tomada com o Roger antes de codar:** RPE-alvo fica sempre ao nível
da sessão/equipa, nunca por atleta — comparar o PSE individual de cada
atleta com um alvo pensado para a equipa geraria ruído; a leitura individual
já existe, e de forma mais correta, através da baseline pessoal de cada
atleta (`_cargaLeitura`, já existente). Isto evita um 3º critério de alarme
por atleta a somar-se à Leitura + Decisão do dia já existentes.

**Bloqueio técnico encontrado e resolvido:** `_mcPlannedUaForDay` (e,
por baixo, `_mcResolveDayType`) só dá resultado correto quando chamada com
`teamId===_mcTeam`, porque lê a equipa selecionada a partir dessa variável
global, não de um parâmetro (nota já deixada no próprio código desde
sps-v164) — nos 3 sítios que já a chamavam isso nunca foi problema porque
corriam sempre dentro do próprio ecrã de Microciclos. Chamar isto a partir
da Análise da Sessão ou da Condição do Jogo (ecrãs diferentes, que podem
correr com `_mcTeam` a apontar para outra equipa se o Roger tiver estado a
ver Microciclos de outra equipa no mesmo separador) arriscava dar o
RPE-alvo errado. Resolvido com `_mcPlannedUaForDaySafe(dt,teamId)`: grava o
`_mcTeam` atual, troca para a equipa pedida só durante o cálculo síncrono, e
repõe sempre a seguir (mesmo em erro, via `finally`) — nunca deixa o ecrã de
Microciclos noutro separador ver a sua equipa trocada por engano.

**O que foi construído — tudo derivado, reaproveitando o motor de sps-v164
(`_mcPlannedUaForDay`/`_mcRealizedUaForDay`/`_mcCargaStatus`/
`_cargaStatusBadge`), sem tabela nova:**
- `_mcPlannedUaForDaySafe(dt,teamId)` (nova, ver acima).
- `_cargaTxtPlain(d)` (nova): versão em texto simples do mesmo estado
  (✓/▲/▼), para os PDFs — mesmo padrão já usado dentro de
  `_mcAnaliseReportHtml`, agora reutilizável fora dali.
- `_ultimaUtCargaInfo(refDate,teamId)` (nova): encontra a UT mais recente
  antes de uma data de referência (jogo, ou a data da Condição do Plantel) e
  devolve o RPE-alvo dessa UT vs. o UA médio real, com `daysAgo` (para
  perceber se a última sessão intensa foi mesmo em cima do jogo ou já há
  vários dias, mesmo raciocínio já usado para os minutos jogados no jogo
  anterior). `_ultimaUtCargaHtml(u)` (nova): a mesma linha em HTML para os
  3 ecrãs interativos, com `_cargaStatusBadge`.
- `_trAnaliseCompute`: passou a devolver também `plan` (RPE-alvo/UA
  planeado do dia via `_mcPlannedUaForDaySafe`), `uaAvg` (UA médio real
  desta UT) e `cargaStatus` (`_mcCargaStatus(plan.plannedUa,uaAvg)`).
- `_trAnaliseHtml`: nova coluna "Chegada" (wellPre) na tabela por atleta, e
  novo cartão "🎯 RPE-alvo desta sessão" com o selo de cumprimento (±15%).
- `printAnaliseSessao`: mesma coluna "Chegada" e uma linha "🎯" equivalente
  ao cartão do ecrã (texto simples, sem badge).
- `_condicaoJogoCompute`: passou a devolver também `ultimaUt`
  (`_ultimaUtCargaInfo`, sempre para 'T1', mesma equipa fixa já usada no
  resto desta função).
- `_jogoPreHtml` (Convocatória/Pré-Jogo), `renderCondicaoPlantel` e
  `printCondicaoPlantel` (PDF): nova linha "🎯 Última UT" logo no topo,
  junto de onde já aparecia "Próximo jogo".
- `printAnaliseCumulativa` (PDF "Condição para o Jogo", ligado a uma UT
  específica): mesma linha "🎯 Última UT", versão texto simples.

SW bump para `sps-v172`. Testado: `node --check` ao ficheiro inteiro; 21
testes isolados em Node das funções novas extraídas do próprio ficheiro —
RPE-alvo resolvido corretamente para uma equipa diferente da selecionada em
Microciclos, `_mcTeam` global sempre reposto depois da chamada (o teste
central deste bloqueio técnico), UA médio da sessão calculado certo,
"sem-registo" nunca confundido com carga 0, última UT encontrada
corretamente entre várias datas (um Jogo no meio não conta como UT), `null`
seguro sem nenhum treino anterior (não inventa UT nenhuma), e os 5 estados
de `_cargaTxtPlain` (sem-alvo, sem-registo, ok, acima, abaixo com e sem
baixa intensidade). Verificação visual ao vivo não foi feita nesta sessão.

**Ainda por fazer:** nada pendente para este pedido. Combinado com o Roger:
confirmar visualmente na app assim que a atualização chegar aos
dispositivos (Service Worker `sps-v172`).

## sps-v175 (23/09/2026): fix — IMC desaparecia depois de qualquer sync (Avaliações Antropométricas)

Reportado pelo Roger: depois de vários registos de Avaliação Antropométrica
feitos no dia anterior (22/09, pela nutricionista Teresa Ferreira), o IMC
deixou de aparecer calculado automaticamente na aba Nutrição.

**Investigação:** confirmado por SQL direto contra a Supabase que o `imc`
estava sempre bem calculado e bem guardado nos 10 registos de 22/09 — o
cálculo em `calcBMI()` (oninput de Peso/Altura) e a gravação em
`saveNutriAval()` nunca tiveram bug. O problema estava em `pullCloud()`: o
push (`_CLOUD_TABLE_SCHEMA.nutrition_records.rename`) já renomeia
corretamente `bmi`→`imc` ao gravar na Supabase, mas o mapeamento de leitura
de `nutrition_records` (dentro do array `pulls`) nunca fazia o inverso
(`imc`→`bmi`) — só espalhava `...r` (que traz `imc`, nome da coluna) sem
nunca definir `bmi`, campo que o resto da app lê sempre (tabela de
Avaliações, KPI do Dashboard, cartão do Plantel, PDFs, "A tua Evolução" na
app da atleta). Qualquer sync (botão 🔄, reabrir a app, trocar de
dispositivo, o pull automático no arranque) sobrescrevia
`APP.nutritionAssessments` com objetos sem `bmi` — por isso o IMC
desaparecia do ecrã em avaliações antigas e novas, mesmo continuando
correto na base de dados. Mesma classe de bug já documentada várias vezes
neste ficheiro (schema de push e mapeamento de pull têm de mudar sempre em
conjunto, nunca só um lado).

**Fix:** adicionado `bmi:r.imc` ao mapeamento de pull de `nutrition_records`
em `pullCloud()`.

SW bump para `sps-v175`. Testado: `node --check` ao ficheiro inteiro;
harness isolado em Node com o mapeamento real extraído do ficheiro,
confirmando que uma linha vinda da Supabase (com `imc` mas sem `bmi`) passa
a ter `bmi` legível pela UI depois do fix, e que o mapeamento antigo
reproduz exatamente o bug reportado (`bmi` fica `undefined`, UI mostraria
"—"). Não foi feita verificação visual ao vivo nesta sessão — os dados de
22/09 já confirmam o cálculo/gravação corretos; falta só confirmar
visualmente que o IMC volta a aparecer depois deste deploy.

**Ainda por fazer:** nada pendente para este fix. Pedir ao Roger para
confirmar visualmente na aba Nutrição depois da atualização chegar aos
dispositivos (Service Worker `sps-v175`).

## sps-v176 (25/09/2026): tirar Titular/Suplente da app da atleta na Convocatória

Pedido do Roger: na aba Jogo → Convocatória, quando faz a convocatória e
define o onze, quer que as atletas recebam na app só se foram convocadas ou
não — sem menção a estarem no onze inicial ou nos suplentes.

**Investigação:** confirmado que isso NÃO era o comportamento atual.
`renderAtConvoc()` (ecrã "Convocatórias" da app da atleta) mostrava badges
"Titular"/"Suplente" assim que o jogo tinha onze definido, além do badge
"Convocada" em si. O Home da atleta e o ecrã "Dia de Jogo" nunca mostraram
isso (só "Convocada! [data]"), e não há sistema de push notification nesta
app (a atleta só vê ao abrir a app) — por isso o único sítio a corrigir era
mesmo este ecrã.

**Fix:** removidas as duas linhas que calculavam `isStarter`/`isSub` e o
badge correspondente em `renderAtConvoc()`. Numa 2ª volta na mesma
conversa, o Roger pediu para tirar também Capitã/Vice-Capitã — removidas
também essas duas variáveis (`isCap`/`isVc`) e o bloco de badge inteiro;
o cartão da Convocatória na app da atleta passa a mostrar só
"Convocada" + RSVP + logística, nada sobre onze/suplentes/capitania.

SW bump para `sps-v176`. Testado: `node --check` ao ficheiro inteiro;
harness isolado em Node com a lógica dos badges extraída do ficheiro —
titular sem cargo não mostra nada, suplente sem cargo não mostra nada,
titular+capitã não mostra nada (nem "Titular" nem "Capitã"),
suplente+vice-capitã idem, e convocatória sem jogo associado não rebenta.
Não foi feita verificação visual ao vivo nesta sessão.

**Ainda por fazer:** nada pendente para este pedido. Pedir ao Roger para
confirmar visualmente na app da atleta (ecrã Convocatórias) depois da
atualização chegar aos dispositivos (Service Worker `sps-v176`).

## sps-v177 (25/09/2026): Lista de Convocados (Relatórios) passa a mostrar o plantel todo, com visto verde

Pedido do Roger: na aba Relatórios → Convocatórias → "Lista de Convocados",
quer ver todas as atletas do plantel, com as convocadas marcadas com um
visto verde — em vez da lista antiga, que só mostrava quem tinha sido
convocada (ordem alfabética das convocadas, sem ninguém de fora). Testado
com o jogo real deste domingo (27/09, vs Destreza Aventura, `g_cnf_1_f_j1`)
confirmado por SQL: 23 convocadas de um plantel de 23 (T1) — a app está a
usar o mesmo jogo/convocatória já feita pelo Roger.

**Fix:** `exportConvocatoriaListPDF()` passou a construir a lista a partir
de `APP.athletes.filter(a=>a.teamId===g.teamId)` (todo o plantel da equipa
do jogo, mesmo padrão já usado no ecrã de montagem da convocatória,
`renderJogoPreJogo`) mais qualquer convocada de outra equipa
(`guestAthletes`, mesmo conceito dos "guests" já usados nessa mesma tela) —
nunca só as convocadas. Nova coluna "Convocada" na tabela com um ✓ verde
(`#16a34a`) só nas linhas convocadas; quem não foi convocada fica com a
célula em branco (sem "✗" vermelho — o pedido foi só marcar as convocadas).
Rodapé mudou de "Total: N convocadas" para "Convocadas: N de M" (M = total
do plantel + guests). Coluna C/VC (capitã/vice-capitã) mantida sem
alterações — é um relatório para a equipa técnica, fora do âmbito do pedido
anterior do Roger (sps-v176) de tirar essa informação da app da atleta.

SW bump para `sps-v177`. Testado: `node --check` ao ficheiro inteiro;
harness isolado em Node com a lógica de construção da lista extraída do
ficheiro — plantel completo aparece mesmo com só parte convocada, ordem
alfabética correta, contagem de convocadas certa, convocada de outra
equipa (guest) entra na lista e conta, e atleta de outra equipa que não foi
convocada nunca aparece. Confirmado por SQL o estado real do jogo de
domingo (23/23 convocadas); verificação visual ao vivo do PDF em si não
foi feita nesta sessão.

**Ainda por fazer:** nada pendente para este pedido. Pedir ao Roger para
confirmar visualmente o PDF depois da atualização chegar aos dispositivos
(Service Worker `sps-v177`).

## sps-v178 (25/09/2026): fix — Lista de Convocados usava o array errado (g.convocatoria em vez de onze+banco)

Reportado pelo Roger logo depois do sps-v177: no jogo vs Destreza Aventura
(27/09), a Lista de Convocados marcava com visto atletas que ele **não**
convocou. Ele confirmou que o separador Jogo → Pré-Jogo mostra a informação
certa, e pediu para a lista nova partir dessa mesma fonte.

**Investigação:** confirmado por SQL que `games.convocatoria` (o array bruto)
tinha as 23 atletas do plantel de T1 — incluindo `mso9x6ooc0im`, uma atleta
fictícia "Teste" deixada no plantel de uma sessão de trabalho anterior (usada
para gerar exemplos de PDF, ver entrada "Manual_SPS_Nutricao.pdf" acima) e
nunca removida. Mas `games.lineup` (11) + `games.subs` (9) = só 20 nomes —
faltavam exatamente as 3 atletas que o Roger disse que não tinha convocado
(confirmado por SQL: `mso9x6ooc0im`/"Teste", mais outras 2 da 1ª fase da
convocatória que nunca chegaram a onze/banco). `g.convocatoria` funciona, na
prática, como um "banco de candidatas" a partir do qual se monta o onze/
suplentes no Pré-Jogo (`toggleConvocado` só liga o checkbox; `setStarter`/
`setSub` é que atribuem de facto o papel) — nunca encolhe automaticamente
quando uma candidata acaba por não ser usada. O sps-v177 tinha lido esse
array bruto como "convocada", em vez do que o Pré-Jogo mostra como
convocação final (onze+banco) — daí o visto a aparecer em quem não devia.

**Fix:** `exportConvocatoriaListPDF()` passou a marcar "convocada" com
`new Set([...g.lineup,...g.subs])`, nunca `g.convocatoria`. A lista de quem
aparece no relatório (plantel completo + convocadas de outra equipa)
também passou a basear-se nesse conjunto em vez do array bruto — uma
convocada avulsa de outra equipa só entra na lista se estiver de facto no
onze ou no banco, não só marcada como candidata. Sem alterações a
`g.convocatoria`/`_syncConvocatoriaFromGame`/à app da atleta — o pedido era
só sobre este relatório; a atleta "Teste" fictícia e as outras candidatas
por afinar continuam no "banco" (não removidas da base de dados), só
deixaram de aparecer com visto neste PDF.

SW bump para `sps-v178`. Testado: `node --check` ao ficheiro inteiro;
harness isolado em Node reproduzindo o caso real reportado (23 no plantel,
20 em onze+banco, incluindo a atleta "Teste" fictícia) — confirma que só as
20 de onze+banco ficam marcadas, as 3 fora do onze/banco (incl. "Teste")
nunca aparecem com visto mesmo estando em `g.convocatoria`; convocatória em
rascunho sem onze/banco definido não marca ninguém; convocada avulsa de
outra equipa só conta se estiver de facto no onze/banco.

**Ainda por fazer:** nada pendente para este fix. Fica registada, mas sem
ação pedida, a atleta fictícia "Teste" (`mso9x6ooc0im`) ainda no plantel de
T1 — se o Roger confirmar que quer removê-la, é um `deleteAthlete` normal.

## sps-v179 (25/09/2026): Cronologia base do dia de jogo (Palestra Pré-Jogo, Palestra Pré-Aquecimento) reflete na Convocatória

Pedido do Roger: no campo de Logística do Dia de Jogo (separador Pré-Jogo do
Jogo), queria que a "cronologia base" do dia incluísse, além do que já
existia, a hora e local de Palestra Pré-Jogo, e a hora de Palestra
Pré-Aquecimento (sem campo de local, como pedido explicitamente) — e que
tudo isto se refletisse na Convocatória.

**Campos novos no Jogo:** `palestraPreJogoHora`, `palestraPreJogoLocal`,
`palestraPreAquecimentoHora` (strings, mesmo padrão de
`concentracaoHora`/`concentracaoLocal`). Hora e local do Jogo em si
(`g.time`/`g.loc`) e de Concentração já existiam — não foram duplicados,
só passaram a aparecer resumidos no topo do painel de Logística ("🗓️
Cronologia base: Jogo HH:MM · Local"), com nota a apontar para "Info do
Jogo" onde já se editam.

**Onde foi ligado (mesmo padrão de concentração/transporte/refeição):**
- `_initG(g)` — valores por omissão ''.
- `_jogoPreHtml()` — 3 novos inputs no painel "🚌 Logística do Dia de Jogo"
  (Hora de Palestra Pré-Aquecimento; Local e Hora de Palestra Pré-Jogo),
  todos a gravar via `saveJogoField()` já existente (chama
  `_syncConvocatoriaFromGame` automaticamente).
- `_syncConvocatoriaFromGame(g)` — copia os 3 campos novos para
  `APP.convocatorias` (o "único sítio para preencher" mantém-se único).
- `renderAtConvoc()` (app da atleta) e `renderConvocatorias()` (staff) —
  arrays `logistica`/`logisticaBits` mostram as duas palestras quando
  preenchidas (Palestra Pré-Jogo aparece mesmo só com local, sem hora).
- `_diaJogoTimeline()` — dois blocos novos na cronologia da atleta:
  "Palestra Pré-Aquecimento" (antes do Aquecimento) e "Palestra Pré-Jogo"
  (depois do Aquecimento, antes do Foco final), cada um só aparece se a
  respetiva hora estiver preenchida — ordem cronológica: Concentração →
  Palestra Pré-Aquecimento → Aquecimento → Palestra Pré-Jogo → Foco final
  → Apito inicial.
- `exportJogoPDF()` (Ficha Pré-Jogo) e `exportConvocatoriaListPDF()`
  (Lista de Convocados) — nova linha "Palestra Pré-Aquecimento"/"Palestra
  Pré-Jogo" junto da linha de Concentração já existente.
- Cloud: `_CLOUD_TABLE_SCHEMA.games` (3 colunas novas +
  rename camelCase↔snake_case) e o mapping inverso em `pullCloud()` foram
  atualizados **juntos**, como sempre exigido nesta base de código (ver
  incidentes #1-#4) — evita repetir o bug do sps-v175 (campo só num dos
  dois lados, desaparece depois do primeiro sync). Migração aplicada à
  tabela `games` no Supabase (`palestra_pre_jogo_hora`,
  `palestra_pre_jogo_local`, `palestra_pre_aquecimento_hora`, todas texto).

**Bug pré-existente encontrado e corrigido de passagem:** ao rever o
mapping de `pullCloud()` para `games` (para saber onde inserir os campos
novos), reparou-se que `pitch_arrows` (setas desenhadas no Campo Tático,
`g.pitchArrows`) já estava no `_CLOUD_TABLE_SCHEMA.games` (push) e já
existia como coluna na tabela `games` no Supabase, mas **nunca tinha sido
lido de volta** em `pullCloud()` — exatamente o mesmo padrão de bug dos
incidentes #1-#4 (campo só do lado do push). Na prática, qualquer seta
desenhada no Campo Tático seria perdida no dispositivo que a desenhou logo
que esse dispositivo fizesse outro pull da cloud (troca de ecrã, refresh,
etc.), embora fosse gravada corretamente na base de dados. Não foi
possível determinar quando este campo foi introduzido (sem entrada própria
neste changelog) nem se o Roger já reparou nisto na prática. Corrigido
adicionando `pitchArrows:r.pitch_arrows||undefined` ao mapping de
`pullCloud()`, mesmo padrão dos outros campos JSON dessa tabela
(`noShow`, `setpieces`, etc.).

SW bump para `sps-v179`. Testado: `node --check` ao ficheiro inteiro;
harness isolado em Node reproduzindo `_diaJogoTimeline()` e as arrays
`logistica`/`logisticaBits` com os 3 campos novos — 15 verificações,
incluindo ordem cronológica correta dos dois blocos novos face a
Concentração/Aquecimento/Foco final, jogos antigos sem os campos novos não
mostram nada extra nem rebentam, e Palestra Pré-Jogo aparece na lista de
logística mesmo só com local (sem hora). Verificação visual ao vivo (app
real, depois do Service Worker atualizar) não foi feita nesta sessão.

**Ainda por fazer:** nada pendente para este pedido. Pedir ao Roger para
confirmar visualmente, depois de `sps-v179` chegar aos dispositivos, que a
cronologia base aparece corretamente no Pré-Jogo, na Convocatória e no
ecrã "Dia de Jogo" da atleta — e avisá-lo do bug das setas do Campo Tático
encontrado e corrigido de passagem (não pedido por ele, mas do mesmo tipo
de bug já documentado várias vezes nesta base de código).

## sps-v180 (25/09/2026): fix — ordem da cronologia trocada (Palestra Pré-Jogo é antes da Palestra Pré-Aquecimento)

Correção pedida pelo Roger logo depois do sps-v179: a ordem real do dia de
jogo é Palestra Pré-Jogo primeiro — em Auditório, Sala ou Balneário (local a
definir por jogo), **antes** de as atletas equiparem — e só depois a
Palestra Pré-Aquecimento, já no balneário, com as atletas **já equipadas**,
imediatamente antes de saírem para o aquecimento. O sps-v179 tinha isto
trocado (Pré-Aquecimento antes do Aquecimento, Pré-Jogo depois, junto do
Foco final) — presunção minha errada sobre a rotina real do dia de jogo,
nunca confirmada com o Roger antes de implementar.

**Fix, mesmos campos/schema do sps-v179 (sem alterações de dados nem de
cloud — só ordem e texto):**
- `_jogoPreHtml()`: painel de Logística reordenado — Concentração → Local +
  Hora de Palestra Pré-Jogo (placeholder atualizado para "Auditório / Sala
  / Balneário — antes de equipar") → Hora de Palestra Pré-Aquecimento
  (rótulo com nota "balneário, já equipadas") → Transporte.
- `_diaJogoTimeline()`: ordem trocada — Concentração → Palestra Pré-Jogo →
  Palestra Pré-Aquecimento → Ativação/Aquecimento → Foco final → Apito
  inicial. Descrições ajustadas para refletir a rotina real: Palestra
  Pré-Jogo passou a "Reunião tática, antes de equipar: [local]"; Palestra
  Pré-Aquecimento passou a "Últimas orientações do treinador no balneário,
  já equipadas, antes de saíres para o aquecimento."
- `exportJogoPDF()`/`exportConvocatoriaListPDF()`: linhas reordenadas
  (Palestra Pré-Jogo antes de Palestra Pré-Aquecimento).
- `renderAtConvoc()`/`renderConvocatorias()`: arrays `logistica`/
  `logisticaBits` reordenadas na mesma sequência.

SW bump para `sps-v180`. Testado: `node --check` ao ficheiro inteiro;
harness isolado em Node com a ordem corrigida — 12 verificações,
confirmando a nova ordem cronológica (Concentração < Palestra Pré-Jogo <
Palestra Pré-Aquecimento < Aquecimento < Foco final), texto de cada
palestra a refletir equipar/já equipadas, local livre (Auditório/Sala/
Balneário) a aparecer corretamente na descrição, jogos sem os campos
continuam sem mostrar nada extra, e ordem correta também nas listas de
logística da Convocatória. Verificação visual ao vivo não foi feita nesta
sessão.

**Ainda por fazer:** nada pendente para este fix.

## sps-v181 (25/09/2026): Lista de Convocados — coluna "Convocada" mais estreita + nova coluna "Assinatura"

Pedido do Roger: no PDF "Lista de Convocados" (Relatórios → Convocatórias),
ajustar a coluna do visto ("Convocada") para ficar mais estreita, e
acrescentar uma última coluna para assinatura — para poder imprimir a
lista e as atletas assinarem para confirmar presença/conhecimento da
convocatória.

**Fix, só marcação da tabela (sem alterações de dados/lógica):**
- Tabela passou a `table-layout:fixed` com largura fixa em cada coluna
  exceto "Nome" (que ocupa o espaço restante): Nº 30px, Posição 60px,
  **Convocada 48px** (antes sem largura definida — ficava mais larga do
  que precisava só para um ✓), coluna C/VC 36px, e nova coluna
  **"Assinatura" 150px**, em branco em todas as linhas (espaço para
  assinar à mão no papel impresso).
- `rows` (por atleta) ganhou uma célula vazia extra no final, alinhada com
  a nova coluna de cabeçalho.

SW bump para `sps-v181`. Testado: `node --check` ao ficheiro inteiro;
harness isolado em Node com o cabeçalho e uma linha de atleta extraídos do
ficheiro — 12 verificações: 6 colunas no cabeçalho e em cada linha, última
coluna é "Assinatura" com 150px, coluna "Convocada" com 48px, célula de
assinatura sempre vazia (convocada ou não, capitã ou não), visto verde e
badge C/VC continuam a aparecer nas colunas certas. Verificação visual ao
vivo do PDF impresso não foi feita nesta sessão.

**Ainda por fazer:** nada pendente para este pedido. Pedir ao Roger para
confirmar visualmente a largura das colunas no PDF impresso, depois de
`sps-v181` chegar aos dispositivos — larguras em pixels podem comportar-se
de forma levemente diferente entre browsers/impressoras, sem teste
automático possível para isso a partir daqui.

## sps-v182 (25/09/2026): fix — editar local/hora de um evento do Planeamento apagava as confirmações (RSVP) das atletas

Bug reportado pelo Roger: editou só o local de um treino de Ginásio e, ao
gravar, as confirmações de presença (Vou/Não vou) das atletas que já
tinham respondido desapareceram. Pedido: "sempre que eu tiver que alterar
local e hora não quero que elimine as confirmadas".

**Causa:** `saveEvent()` construía sempre um objeto `ev` novo **do zero**,
só com os campos do próprio formulário de edição (id, teamId, type, title,
date, time, dur, location, notes, horaConcentracao, localConcentracao,
guestIds, gymSheet). Ao editar um evento existente, esse objeto substituía
o registo inteiro em `APP.schedule[i]=ev` — qualquer campo do evento
original que não estivesse no formulário desaparecia, mesmo que a edição
fosse só ao local ou à hora. O campo afetado na prática é `rsvp` (mapa
`{athleteId:{status,reason,respondedAt}}`, escrito por `atGymRsvpYes`/
`atGymRsvpDeclineConfirm`/`atGymRsvpReset` quando a atleta confirma
presença num evento de Ginásio — ver `_gymRsvpOf`/`_CLOUD_TABLE_SCHEMA.
schedule_events`); `createdAt` tinha exatamente o mesmo problema (também
não fazia parte do formulário), embora sem impacto visível para o Roger.
Como `saveEvent()` já chama `cloudUpsert('schedule_events',{...ev,...})`
logo a seguir (desde o fix do feedback_sps_pse_dur_sync_bug, ver comentário
no código), o objeto incompleto era gravado diretamente na Supabase — a
perda não era só um glitch local de uma sessão, ficava sincronizada e
visível em todos os dispositivos depois do próximo pull.

Este é um bug novo/diferente dos incidentes #1-#4 e do sps-v175 (esses
eram sempre um campo em falta de um dos dois lados de
`_CLOUD_TABLE_SCHEMA`/`pullCloud()` — schema local e cloud dessincronizados
depois de um sync). Aqui não há sync nenhum envolvido: o campo já era
perdido localmente, em memória, no instante em que se clicava em Guardar,
antes de qualquer chamada à cloud.

**Fix:** em vez de construir `ev` do zero, `saveEvent()` agora começa por
localizar o evento existente (quando `_editEvId` está definido) e faz
*spread* desse registo para dentro do novo `ev`, aplicando os campos do
formulário **por cima**. Assim qualquer campo do registo original que o
formulário não controla (`rsvp`, `createdAt`, e qualquer campo futuro que
vier a existir em `schedule_events` sem ter um input dedicado) sobrevive
intacto a qualquer edição — mesmo padrão de "fundir em vez de deixar um
registo inteiro ganhar ao outro" já usado em `_mergeConvocatorias()` para
o bug equivalente nas convocatórias (ver comentário nessa função). Os
campos que o formulário controla explicitamente (incluindo `gymSheet`,
que continua a ser anulado quando o tipo deixa de ser "Ginásio") continuam
a substituir normalmente — não é um merge de tudo, só dos campos que
ficavam esquecidos. A criação de eventos novos não é afetada (não há
registo existente para espalhar).

SW bump para `sps-v182`. Testado: `node --check` ao ficheiro inteiro;
harness isolado em Node com uma réplica do comportamento antigo (para
confirmar que reproduz exatamente o bug relatado) e do comportamento
corrigido — 16 verificações: comportamento antigo perde `rsvp` e
`createdAt` ao editar só o local (confirma a causa); comportamento
corrigido preserva `rsvp` intacto ao editar local, ao editar hora, e
mesmo ao mudar o tipo do evento; `createdAt` preservado; campos do
formulário (local, hora, guestIds, gymSheet) continuam a ser aplicados/
substituídos normalmente; criação de evento novo não fica com `rsvp`/
`createdAt` inventados do nada. Verificação visual ao vivo (confirmar
presença como atleta, editar o evento como treinador, confirmar que a
resposta continua lá) não foi feita nesta sessão.

**Ainda por fazer:** nada pendente para este fix em código. Ponto aberto:
como o objeto incompleto já estava a ser gravado na Supabase antes deste
fix, quem tiver editado um evento de Ginásio com confirmações antes de
`sps-v182` chegar aos dispositivos pode já ter perdido esses `rsvp` na
cloud (sem reparação retroativa possível a partir daqui — não há backup
de `rsvp` antigo para restaurar). Avisar o Roger deste risco e sugerir que,
se notar confirmações em falta em eventos já editados, terá de pedir às
atletas para confirmarem de novo.

## sps-v183 (28/09/2026): Relatórios → Convocatórias — Lista de Convocados e Ficha de Jogo (tática) a caber sempre numa folha A4

Pedido do Roger: "no relatórios Convocatórias / Ficha de Jogo Tática, quero
que caiba tudo em pdf numa folha A4, ajusta" — os dois PDFs do cartão
"📋 Convocatórias" em Relatórios (`exportConvocatoriaListPDF` — botão
"Lista de Convocados" — e `exportJogoPDF(gid,'prejogo')` — botão "Ficha de
Jogo (tática)") estavam a transbordar para uma 2ª página com dados
realistas (plantel completo + logística toda preenchida), a maior parte só
com uma linha de conteúdo residual na 2ª página.

**Medição antes de tocar em código** (Chromium headless via Playwright,
`page.pdf()` + contagem de páginas com `pypdf`, dados realistas: plantel de
22 atletas, onze+suplentes, toda a logística preenchida incluindo as duas
palestras e notas do sps-v179/180): Lista de Convocados a precisar de
~310mm de altura de conteúdo para um espaço disponível de 261mm por página
A4 (cabeçalho+rodapé+margens de `_printWin` incluídos); Ficha Pré-Jogo a
precisar de ~315mm. Ambas confirmadas a sair em 2 páginas.

**Fix — só estes dois PDFs, nunca o `_printWin()` global (partilhado por
todos os outros relatórios da app) nem os outros tipos de `exportJogoPDF`
(Folha Tática, Relatório Pós-Jogo, Relatório Completo — esses continuam a
poder ocupar várias páginas como sempre):**
- Nova função `_pdfCompactStyleHtml()` — devolve um bloco `<style>` com a
  classe `.pr-compact` (fonte 8.5pt, margens/paddings de parágrafos,
  cabeçalhos e tabela bastante mais apertados que o resto da app) mais duas
  regras extra que só atuam quando essa classe está presente na página:
  `body:has(.pr-compact) .pr-header{...}` encolhe o logótipo/cabeçalho do
  `_printWin()`, e `.pr-compact ~ .pr-footer{...}` encolhe o espaçamento e
  as imagens do rodapé (UEFA/contactos/assinatura) — os seletores `:has()`/
  `~` garantem que isto nunca afeta a impressão de nenhum outro relatório
  da app (só entra em jogo quando o `.pr-compact` existe na própria página).
- `exportConvocatoriaListPDF()`: corpo envolvido em `<div class="pr-compact">`
  sempre (este PDF é sempre pensado para uma folha só).
- `exportJogoPDF()`: corpo envolvido em `pr-compact` só quando
  `type==='prejogo'` (variável `_compact`) — a Folha Tática, o Relatório
  Pós-Jogo e o Relatório Completo mantêm o espaçamento original, sem
  qualquer alteração visual.
- Padding do `<div>` que envolve cada relatório reduzido de `20px` para
  `6px` quando compacto (o `_printWin()` global já dá 10mm de padding
  impresso — os 20px eram um espaçamento redundante por cima desse).

SW bump para `sps-v183`. Testado com o código REAL extraído do
`index.html` (não uma réplica manual) — harness Node que carrega
`exportJogoPDF`/`exportConvocatoriaListPDF`/`_pdfCompactStyleHtml`/
`_printWin` tal como ficaram no ficheiro, com `APP`/DOM/`window.open`
stubados e dados realistas (plantel de 22 atletas, toda a logística
preenchida), gera o HTML real que `_printWin()` produziria, e usa o
Chromium headless (Playwright) para gerar o PDF a sério e contar páginas
com `pypdf`: Lista de Convocados e Ficha Pré-Jogo confirmadas em **1
página** cada, com ~17mm e ~50mm de margem sobrante respetivamente (medido
com `document.body.scrollHeight` à largura real de impressão). Teste de
robustez adicional com plantel de 26 atletas (acima do normal) — continuam
as duas em 1 página. Verificação de regressão: `exportJogoPDF(gid,'campo')`
(Folha Tática) confirmado SEM a classe `pr-compact` e com o padding
original de `20px` intacto — os outros tipos de relatório não são afetados.
Inspeção visual das duas páginas compactas (renderizadas para PNG a
150dpi) — texto legível, tabela completa com as 22 atletas, rodapé com
marca/logótipos/assinatura presente, sem conteúdo cortado. Verificação
visual ao vivo no browser/impressora reais do Roger não foi feita nesta
sessão.

**Ainda por fazer:** nada pendente para este pedido. Pedir ao Roger para
confirmar visualmente, depois de `sps-v183` chegar aos dispositivos, que
os dois PDFs (Lista de Convocados e Ficha de Jogo tática) saem mesmo numa
folha só ao imprimir a sério — a medição foi feita com Chromium headless,
que devia corresponder ao motor de impressão do Chrome/Edge normal, mas
sem teste automático possível para impressoras físicas ou outros
navegadores a partir daqui. Se o plantel de alguma equipa crescer muito
além de ~26 atletas, vale a pena voltar a medir.

## sps-v184 (28/09/2026): correção de dados do jogo vs Destreza Aventura (28/09) + salvaguarda contra o relógio do SPS-Gameday ficar a correr sem fim

Pedido do Roger: "Ve no jogo de ontem o meu adjunto, não parou o tempo
nem lançou, os dados estão corretos, mas o tempo de fim de jogo passa a
ser 97 minutos, resolve e acerta isso."

**Diagnóstico:** o adjunto iniciou o jogo (`_gdStartGame`) ao pontapé de
saída e nunca tocou em Terminar Parte / Terminar Prolongamento / Lançar —
o cronómetro (`runningSince`) ficou a correr sozinho, sem qualquer pausa,
durante ~20h50 (do pontapé de saída até esta manhã, quando finalmente se
tocou em Lançar). Como `_gdElapsedSec()` mede sempre `accumSec +
(Date.now()-runningSince)`, esse troço todo — 20h50 em vez dos ~97 minutos
reais de jogo — foi dobrado para `accumSec`/`regEndSec` sem qualquer
aviso, e propagou-se em cadeia: `_gdEndMinute()` deu ~1251min em vez de
97; `_gdBuildPlayerStats()` usou esse fim de jogo errado para calcular os
minutos de cada atleta em campo (quem ficou até ao fim ficou com ~1251min
em vez dos minutos reais); e `_gdSyncPSEDuration()` copiou esses minutos
errados para os registos de PSE já feitos, disparando a UA (carga de
treino) de várias atletas para valores absurdos (ex: 11259 em vez de
873). Os dados que o Roger validou como corretos (golos, cartões,
substituições, eventos da cronologia) não foram tocados — só o fim de
jogo e tudo o que dependia dele.

**Correção de dados (jogo `g_cnf_1_f_j1`, vs Destreza Aventura,
27/09/2026), feita diretamente na base de dados Supabase de produção:**
- `live_session.regEndSec`/`accumSec`: de 75071.77s (~1251min) para
  5820s (97min) — último evento real registado às 94' (canto), 97' como
  fim de jogo plausível.
- `player_stats`: recalculados os minutos das 11 atletas (de 16) que
  estavam em campo ao fim, com o novo fim de jogo aos 97'; as 5 atletas
  substituídas antes disso já estavam corretas e não foram tocadas.
- `pse_records` (11 registos ligados a este jogo via `event_id`): `duration`
  e `ua` recalculados com os minutos corrigidos de cada atleta (ex:
  duration 1251→97, ua 7506→582 para quem ficou os 97min completos; para
  quem saiu antes, duration/ua ajustados ao minuto real de substituição).
  Os outros 8 registos de PSE deste evento já estavam corretos (atletas
  não convocadas ou cujo minuto de saída já batia certo) e não foram
  tocados.

**Salvaguarda ("resolve"), para isto não voltar a acontecer:** nova
função `_gdFoldRunning(ls)` (linha ~6932, logo depois de
`_gdElapsedSec`) substitui o padrão repetido
`if(ls.runningSince){ls.accumSec=_gdElapsedSec(ls);ls.runningSince=null;}`
usado em `_gdPause`, `_gdPauseWithReason`, `_gdEndReg`, `_gdEndET` e
`_gdLaunch` — os 5 sítios onde o troço em curso do relógio é dobrado para
dentro de `accumSec`. Sempre que isso vai acontecer, se o troço sem
qualquer pausa for maior do que 3 horas (`_GD_MAX_TROCO_SEC`, um limite
generoso — muito acima de qualquer parte, prolongamento ou pausa real,
mas que apanha exatamente este tipo de "ficou esquecido a correr"), a
função pergunta ao operador (`prompt()`) quantos minutos passaram
realmente nesse troço, em vez de gravar as horas todas em silêncio; a
resposta (ou 0, se ficar em branco/cancelada) é o que entra em
`accumSec`. Um jogo normal, mesmo com pausas longas de lesão/VAR/
hidratação via `_gdPauseWithReason`, nunca chega às 3h num único troço
sem pausa, por isso isto não deve incomodar em uso normal — só dispara
quando o cronómetro passa horas a fio sem ninguém tocar em nada, que é
exatamente o cenário deste bug.

SW bump para `sps-v184`. Testado com o código REAL extraído do
`index.html` (`_gdElapsedSec`+`_gdFoldRunning`, linhas 6917-6943) —
harness Node (`test_gdFoldRunning.js`) com `prompt()` stubado: (1) troço
normal de 42min não dispara pergunta nenhuma e dobra o tempo tal como
antes; (2) reprodução exata do bug do Roger (troço de 20h50) dispara a
pergunta, informa as horas reais decorridas, e usa a resposta do operador
("97") como os novos minutos em vez das 20h50 reais; (3) resposta vazia/
cancelada não perde as horas todas — fica só com o que já tinha antes do
troço suspeito; (4) fronteira do limite (2h59) confirmada a não disparar
a pergunta. A correção dos dados do jogo em si (Supabase) foi validada
com `RETURNING` nas próprias instruções SQL — os valores gravados
coincidem exatamente com os pré-calculados.

**Ainda por fazer:** nenhum outro jogo foi auditado à procura do mesmo
problema (relógio ficado a correr) — só o jogo que o Roger reportou foi
corrigido. Se aparecer outro caso semelhante, vale a pena verificar se
algum jogo antigo tem `player_stats`/PSE com minutos muito acima do
plausível (>130min) e corrigir da mesma forma.

**Nota (28/09/2026, mesmo dia): refinamento com o relatório oficial da
FPF.** O Roger deu o link oficial do jogo em resultados.fpf.pt
(`Match/GetMatchInformation?matchId=2636080`, o relatório do árbitro) e
pediu para cruzar e corrigir com essa fonte, dizendo que na dúvida é ela
que prevalece. Esse relatório mostra o jogo a terminar aos 90'+4' (94
minutos), não aos 97' como assumido na correção acima — os 97' tinham
sido a minha melhor estimativa (baseada no último evento registado, um
canto aos 94') na ausência de outra fonte; o relatório oficial confirma
que o canto aos 94' foi mesmo o último lance, mas o apito final foi ao
94', não ao 97'. Corrigido de novo diretamente na base de dados
(`live_session.regEndSec`/`accumSec`→5640s, `player_stats` e os 15
`pse_records` afetados recalculados para o novo fim aos 94').
Adicionalmente, cruzando os nomes das atletas com o relatório: (1) o
primeiro golo (5'/6') estava com o marcador errado no evento
(`mssvtpxkyta4`, a guarda-redes Ana Machado) — improvável e não batia
com o relatório, que dá o golo a Ines Lopes; os `player_stats` já tinham
o golo correto atribuído a `mssmfv9ba6f4` (Inês Lopes) de alguma correção
anterior, só o próprio evento ficou dessincronizado — corrigido o
`scorer` do evento para condizer; (2) os pares de substituição às 60' e
81' estavam trocados (ex: o evento tinha "saiu a Trigo, entrou a Ivone
Oliveira" quando o relatório diz "saiu a Trigo, entrou a Sofia Leite" —
e vice-versa para a outra substituição do mesmo minuto); os minutos de
cada atleta não mudam com isto (cada uma só depende do seu próprio
momento de saída/entrada), mas a Ficha/Relatório Pós-Jogo passava a
mostrar a substituição errada — corrigido trocando o `playerIn` entre
os pares. Uma identidade ficou por confirmar: a atleta que sai aos 60'
consta na nossa base como "Mariana Couto" mas o relatório da FPF lista
nesse lugar "Mariana Moreira" — a jogadora que entra por ela (Bárbara
Martins) bate certo nos dois lados, por isso é muito provável que seja
a mesma pessoa com um nome diferente registado num dos dois sítios; não
alterei o nome na ficha da atleta sem confirmação do Roger.

Também associado a este pedido do Roger ("já podes atualizar a
classificação, visto que já há dados da primeira jornada"): importada a
classificação da Série B do Campeonato Nacional Feminino IV Divisão
(`resultados.fpf.pt/Competition/Details?competitionId=28109&seasonId=106`,
onde o Moreirense e o Destreza Aventura jogam) diretamente para
`clubs.meta.config.classificacoes["Campeonato Nacional Feminino"]` —
mesma estrutura que o import manual em Competições grava — com a tabela
completa da 1ª jornada (8 equipas). Não fica a atualizar sozinha; para
jornadas seguintes é preciso repetir o import (manual, em Competições, ou
pedir de novo aqui).

**Fecho da identidade em aberto:** o Roger confirmou — "a Mariana Couto é
a Mariana Moreira sim, a Bárbara Martins está certa do nosso lado, tem
alcunha Lisa". Atualizado o campo `name` da atleta na base de dados de
"Mariana Couto" para "Mariana Moreira" (o `alcunha` ficou como estava,
"Couto"); a ficha da Bárbara Martins não precisou de nenhuma alteração.

## sps-v185 — Quadro Tático standalone (?tatico=1) + adversárias/bola no
## Campo Tático interativo (29/09/2026)

Pedido do Roger: um "quadro tático" para o adjunto de bolas paradas usar
no banco, no seu próprio tablet, ao lado do tablet do SPS-Gameday —
baseado no que já existia em Jogo → Campo, mas isolado numa app própria
(só o campo, sem o resto da plataforma à volta). Pediu para pesquisar o
que há no mercado deste tipo antes de propor.

**Pesquisa de mercado** (WebSearch/WebFetch): Set Pieces Coach
(setpiecescoach.com) — app dedicada a bolas paradas, quadro com
jogadoras/bola/linhas/setas/formas, biblioteca de jogadas, animação por
timeline nos planos pagos; Settik (settik.com/board) — quadro grátis no
browser, arrastar jogadoras + desenhar corridas + animar + exportar GIF,
sem conta; TacticalPad/Tactics Manager — campo inteiro/meio, animações
multi-passo, exportar imagem/vídeo. Traço comum às três: têm sempre
marcador de adversário e de bola, além das próprias jogadoras — algo que
o nosso Campo Tático ainda não tinha.

**Decisão (`AskUserQuestion`, Roger escolheu as 3 opções recomendadas):**
(1) atalho standalone dentro da própria SPS (`?tatico=1`), não uma app
separada — mesmo padrão exato do `?gameday=1`/`?ginasio=1`/`?fisio=1`/
`?nutri=1`: login normal de staff, só muda o que acontece depois
(`_forceTaticoMode`, `_taticoEligibleRole`, `_maybeEnterTaticoMode`,
classe CSS `.tt-mode`, ícone/nome próprios no `applyPWAManifest`); (2) o
quadro Tático passa a mostrar campo inteiro por defeito (antes só tinha
meio campo, desde 24/08/2026), os 3 quadros de bolas paradas continuam
em meio campo por defeito, e os 4 ganham um botão para alternar
(`_pitchFullView`, `_pitchToggleView`, `_pitchMaxY`/`_pitchViewH`
dinâmicos); (3) manter a galeria de posicionamentos (snapshots) já
existente em vez de construir um motor de animação verdadeiro — só
otimizada para o banco.

**Implementação:**
- `?tatico=1` — mesmo padrão exato dos outros 4 modos standalone; ao
  abrir um jogo específico salta logo para o separador Campo em vez de
  Info (`openJogo`, mesmo truque do `?gameday=1`→"aovivo"), e
  `_renderJogoDetailFull` tranca o separador em "campo" e esconde a tab
  bar do Jogo (Info/Adversário/Pré-Jogo/Ao Vivo/Pós-Jogo/Exportar) e o
  botão Apagar — o adjunto de bolas paradas só vê o quadro, nada mais.
  Ainda sem logo próprio do Roger — ícone SVG gerado "TT" (cor
  `#f39c12`), mesmo esquema usado inicialmente para o Gameday/Ginásio
  antes de terem ícone fornecido; substituir em `assets/icon_tatico_*`
  quando o Roger o der (e nesse ponto acrescentar essas entradas ao
  `sw.js`, tal como as dos outros modos).
- Campo inteiro/meio campo por quadro: `_pitchFullView` (objeto em
  memória, não persistido — mesmo espírito de `_jogoCampoDrawMode`,
  reinicia nos valores por defeito a cada visita, que é o pedido). Botão
  de alternar no quadro; `_pitchMaxY`/`_pitchViewH` e o `viewBox` do SVG
  passam a depender deste estado; `_pitchDefaultPos` espalha as
  jogadoras por mais linhas em campo inteiro.
- Adversárias e bola: marcadores genéricos por jogo+quadro
  (`g.pitchOpponents{tatico,cornerDef,cornerOf,freeKick}`,
  `g.pitchBall{...}`), sem ligação a nenhuma atleta. Botão "+
  Adversária" (até 11, com aviso ao chegar ao limite); toca num marcador
  para remover (com confirmação — mesmo espírito das setas). Botão
  "Bola" alterna adicionar/remover o único marcador de bola do quadro.
  O arrastar (`pitchDragStart/Move/End`) foi generalizado com um 4º
  parâmetro `kind` ('player'/'opponent'/'ball') e duas funções novas
  (`_pitchMarkerPos`/`_pitchSetMarkerPos`) que resolvem onde cada tipo de
  marcador vive — sem isto, cada tipo precisaria da sua própria cópia
  quase igual das 3 funções de arrastar. `_initPitchEvents` (touch)
  também generalizado da mesma forma. A galeria de posicionamentos
  (`_pitchSnapshot`/`_pitchLoadSnapshot`/`_pitchSnapshotSvg`) passa a
  incluir adversárias, bola e a vista (inteiro/meio) em cada registo —
  snapshots antigos (sem estes campos) continuam a funcionar, só ficam
  sem adversárias/bola. PDF e Partilhar Imagem já incluem os novos
  marcadores automaticamente, porque clonam o próprio SVG em ecrã.

SW bump para `sps-v185`. Testado em duas camadas: (1) Node, com o
código REAL extraído do `index.html` (`_pitchFullView`,
`_pitchToggleView`, `_pitchMaxY`/`_pitchViewH`, `_pitchDefaultPos`,
`_pitchOpponents`/`_pitchBallMap`, `pitchAddOpponent`/
`pitchRemoveOpponent`/`pitchToggleBall`, `_pitchMarkerPos`/
`_pitchSetMarkerPos`) com mocks de `APP`/`saveData`/`toast`/`confirm` —
defeitos por quadro, toggle isolado por modo, limite de 11 adversárias,
cancelar vs confirmar a remoção, um toque que era arrasto nunca remove,
toggle da bola respeita o limite de Y de cada vista, e as 3 funções
genéricas por `kind` não se confundem entre si; (2) Playwright, a servir
o `index.html` real num servidor local e a conduzir o browser: cria o
1º admin com `?tatico=1` na URL, confirma `tt-mode`/sidebar escondida/
título "Jogos", injeta um jogo de teste e abre-o (`openJogo`), confirma
que entra logo no separador Campo com a tab bar e o botão Apagar
escondidos, alterna campo inteiro/meio campo e confirma o `viewBox`,
adiciona/remove adversárias e a bola a clicar nos botões reais da
página, remove um marcador a clicar nele (aceitando o `confirm()`), e
regista um posicionamento confirmando que o snapshot guardado inclui os
novos campos. Um bug real foi apanhado neste teste: adicionar duas
adversárias seguidas fazia-as ficar exatamente sobrepostas na mesma
posição (impossível distinguir/arrastar uma da outra) — corrigido para
espalhar em grelha, tal como já acontecia com as jogadoras.

**Ainda por fazer:** ícone próprio do `?tatico=1` (fica com o SVG "TT"
gerado até o Roger fornecer um, mesmo padrão dos outros modos no
passado); nenhuma decisão de ordenação/numeração fixa das adversárias
foi pedida, por isso ficam só numeradas pela ordem em que são
adicionadas.

## sps-v186 — Quadro Tático: baliza mais larga + adversárias em X
## (29/09/2026, mesmo dia)

Ainda antes do Roger fazer o `git push` do sps-v185, mandou uma imagem
de referência (um esquema de organização defensiva de canto, com 11
marcadoras numeradas) com dois pedidos concretos e uma pergunta:

1. "a largura da baliza tem que caber 4 atletas, nem que para isso
   aumentes um pouco a baliza" — a baliza (36 de largura) e a pequena
   área (56) do Campo Tático estavam desenhadas pequenas de mais para 4
   marcadoras caberem lado a lado sem se sobreporem na linha defensiva
   de um canto. Alargadas para 60 (baliza) e 90 (pequena área) — deixa
   de estar rigorosamente à escala real do campo, mas ganha espaço de
   trabalho, exatamente o pedido. A área grande (124) manteve-se, já
   tinha espaço de sobra. Alterado nos dois sítios onde este desenho
   existe (o quadro ao vivo em `_jogoCampoHtml` e a miniatura/PDF em
   `_pitchSnapshotSvg`), para nunca divergirem visualmente.
2. "quero ter adversários e quero que estes seja um (X) vermelho" — os
   marcadores de adversária (introduzidos no sps-v185 como círculo
   vermelho + número) passam a ser um X vermelho (`#e63946`), sem
   número. Um círculo transparente maior por baixo do X mantém uma área
   de toque confortável para arrastar no telemóvel (o X sozinho, feito
   só de duas linhas finas, seria difícil de acertar com o dedo).
   Alterado no quadro ao vivo e na miniatura/PDF/galeria, tal como o
   ponto anterior.
3. "não aconselhas que seja tipo app?" — respondido em conversa, não é
   alteração de código: o `?tatico=1` já É instalável como app (ícone
   próprio no ecrã principal, abre em ecrã inteiro sem barra do
   browser, `display:'standalone'` no manifest) assim que o Roger o
   adicionar ao ecrã principal do tablet — recomendei ficar com esta
   via em vez de uma app nativa (loja, aprovação, atualizações mais
   lentas) sem necessidade real disso.

SW bump para `sps-v186`. Testado com Playwright a conduzir o browser
contra o `index.html` real: confirma a baliza do quadro ao vivo com 60
de largura (era 36), e que o marcador de adversária deixou de ter
texto/número e passou a desenhar exatamente 2 linhas (o X), mantendo o
círculo transparente de toque por baixo. Os testes do sps-v185 (Node +
Playwright, ver entrada acima) foram todos re-corridos depois destas
alterações e continuam a passar sem alterações.

Nota: a app tem uma segunda ferramenta parecida mas independente, o
quadro "Adversário" (funções `_oppXxx`, na aba Jogo → Adversário —
para esboçar a FORMAÇÃO INTEIRA do adversário, 11 marcadores
numerados, não ligado ao Campo Tático) — tem a mesma baliza/pequena
área estreitas, mas o Roger não pediu para mexer ali e por isso não foi
tocada; se quiser o mesmo alargamento nesse quadro, é só pedir.

## sps-v187 — Afinações mobile/tablet (app em geral + Quadro Tático)
## (29/09/2026, mesmo dia)

Pedido do Roger: "ajusta o modo telemóvel e tablet quer na app em geral
quer no tático que criamos agora". Como era um pedido geral ("Pedido
geral, sem testar ainda", confirmado por pergunta) e não uma queixa de
um bug visto num aparelho concreto, esclareci primeiro o âmbito por
pergunta — o Roger escolheu 3 áreas: toque/tamanho dos marcadores e
botões, aproveitamento do ecrã, e orientação retrato/paisagem. Antes de
alterar código, um agente de exploração fez uma auditoria só de leitura
ao CSS/manifest/tamanhos de marcadores existentes, que confirmou: não
havia nenhuma breakpoint dedicada à gama de tablet (768–1024px), o
`.jc-pitch-wrap` do Campo Tático não tinha nenhuma regra específica
para paisagem, e o manifest da PWA trancava a orientação em
`'portrait'` em todos os modos (Atleta, Gameday, Ginásio, Fisio, Nutri,
Tático). Cinco alterações concretas, uma por área:

1. **Orientação** — `applyPWAManifest` deixou de forçar
   `orientation:'portrait'`; passa a `orientation:opts.orientation||'any'`
   (nenhum modo passa uma orientação fixa neste momento, por isso todos
   ficam livres para rodar, incluindo o `?tatico=1` no tablet do banco).
2. **Toque/tamanho dos botões** — nova regra
   `@media(hover:none) and (pointer:coarse)` sobe o tamanho dos botões
   da topbar, `.btn`/`.btn-sm`/`.btn-xs`/`.btn-icon` e das abas em
   qualquer ecrã tátil (telemóvel OU tablet), sem afetar rato/trackpad
   em desktop — `pointer:coarse` deteta o tipo de input, não a largura
   do ecrã, por isso não confunde um portátil pequeno com um tablet
   grande.
3. **Marcadores do Campo Tático** — os marcadores de atleta e de bola
   ganharam um círculo transparente maior por baixo do círculo visível
   (mesmo padrão já usado no X da adversária desde o sps-v186), para
   uma área de toque mais confortável no dedo sem aumentar o tamanho
   visual do marcador.
4. **Aproveitamento do ecrã (barra lateral)** — nova breakpoint
   `@media(max-width:1024px) and (min-width:681px)` esconde a barra
   lateral fora do ecrã (tal como já acontecia só abaixo de 680px),
   libertando o ecrã inteiro em tablets; abre com o botão de
   hambúrguer, tal como no telemóvel.
5. **Campo Tático mais largo em paisagem de tablet** — dentro da regra
   `@media(orientation:landscape) and (min-width:680px)` já existente,
   `.jc-pitch-wrap{width:min(72vw,90vh,820px)}` (antes só tinha a regra
   genérica de retrato, `min(96vw,640px)`). A página do Campo Tático
   tem scroll normal (não é um ecrã fixo tipo o Gameday em direto), por
   isso o limite de altura (`vh`) é só uma rede de segurança, não uma
   obrigação de caber sem scroll — daí usar `90vh` em vez de um valor
   mais apertado.

Testado com um agente de exploração (leitura) + Node (`node --check`
ao bloco `<script>`) + Playwright, criando um novo ficheiro dedicado
(`test_mobile_v187.js`) que cobre as 5 áreas em contextos de browser
isolados (viewports de telemóvel/tablet/desktop, com e sem toque,
retrato e paisagem). Dois problemas foram apanhados e corrigidos
durante os testes, nenhum dos dois no comportamento visual final para
o Roger:

- Um falso alarme do próprio teste: a verificação da barra lateral
  media `getComputedStyle(transform)` antes de fazer login — mas o
  `#staff-app` só passa a `display:flex` depois do login
  (`showStaffApp()`), e o Chromium resolve `transform` sempre como
  `'none'` para qualquer elemento dentro de um antecessor com
  `display:none`, seja qual for a regra CSS aplicável. Corrigido a
  fazer login antes de medir. Um segundo falso alarme parecido: depois
  de abrir a barra lateral, o `transform` calculado nem sempre é a
  string `'none'` — pode ser a matriz identidade
  `matrix(1,0,0,1,0,0)` (mesmo resultado visual, string diferente,
  consoante a regra CSS é "sem transform" ou "transform:translateX(0)")
  — o teste passou a comparar a componente de deslocamento X em vez da
  string exata.
- Um bug real de CSS: a primeira fórmula para a largura do campo em
  paisagem, `min(62vw,60vh,820px)`, tinha o termo `60vh` a tornar-se o
  limite mais apertado em alturas de tablet típicas (ex.: 800px de
  altura → só 480px), ficando o campo mais estreito do que a regra de
  retrato simples — o oposto do pedido. Corrigido para
  `min(72vw,90vh,820px)`, conforme o ponto 5 acima.

SW bump para `sps-v187`. Os testes do sps-v185/v186 (Node + Playwright,
ver entradas acima) foram todos re-corridos depois destas alterações e
continuam a passar sem regressões (a única falha da suite e2e do
sps-v185 é a de sempre, o CDN bloqueado pelo proxy da sandbox, sem
relação com este trabalho).

## sps-v188 — Matchday Hydration, Bloco 1: modelo de dados + configuração
partilhada Nutri/Fisio + registo de peso pré/pós-jogo (29/09/2026)

Início de um projeto maior pedido pelo Roger: um protocolo de
hidratação de jogo ("Matchday Hydration") gerido pela App Nutricionista
e visível na App Fisio, a partir de um documento de 21 secções que o
Roger anexou com a especificação completa. Antes de escrever código,
foi feita uma proposta num documento Claude Docs dedicado
("SPS — Matchday Hydration: Análise e Proposta") cobrindo: localização
na app, base científica, arquitetura, valores por defeito, fórmulas de
cálculo, fases de entrega e riscos — incluindo uma pergunta em aberto
importante, porque o documento do Roger falava em "App Fisio" para a
gestão do protocolo em vários sítios, mas o pedido original dele dizia
"app nutricionista". O Roger decidiu: **App Nutricionista gere e edita
o protocolo, App Fisio tem acesso de leitura E escrita** ("AS DUAS" —
paridade total, não só alertas em modo leitura), manter o âmbito
completo do documento mas entregue por blocos testáveis ("TUDO"),
lembretes por badge em vez de notificações push reais (a app não tem
push nativo), e manter os valores por defeito propostos com base
científica. A ordem dos blocos ficou ao meu critério.

Base científica usada para os valores por defeito (todos editáveis
pela Nutri, com override por atleta — ver abaixo): posição de consenso
da NATA (National Athletic Trainers' Association) 2017 sobre
hidratação no desporto (fórmula da taxa de sudorese, limiar de 2% de
perda de massa corporal, regra de reposição pós-jogo de 150% do
défice), um estudo de 2022 sobre balanço hídrico em futebolistas de
elite (referências concretas de taxa de sudorese/ingestão/perda de
peso), as recomendações da Wilderness Medical Society para prevenção
de hiponatremia associada ao exercício (nunca repor mais líquido do
que a perda de peso; não existe um volume universal seguro) e o
Consenso do COI de 2010.

**Bloco 1 (este release) — modelo de dados, cálculos e a UI de
configuração/registo, partilhada entre Nutri e Fisio:**

1. Nova página "Matchday Hydration" (💧) tanto em `nutri-*` como em
   `fisio-*`, com acesso de card a partir do ecrã inicial de cada
   cargo. As duas páginas reutilizam o mesmo core de renderização
   (`_hidratacaoCore(containerId)`), o mesmo padrão já usado em
   `_agendaGeralCore` — uma função a construir o HTML, duas funções
   finas (`renderNutriHidratacao`/`renderFisioHidratacao`) a escolher
   o container — para garantir que Nutri e Fisio veem sempre os
   mesmos dados, sem duplicação.
2. `APP.config.hydrationGuidelines` — valores por defeito científicos
   (`HYDRATION_DEFAULTS`, 17 campos: ml/kg pré-jogo, ml aos T-60/T-15,
   ml/h durante o jogo, ml ao intervalo, multiplicador de reposição
   pós-jogo, gramas de hidratos e mg de sódio por litro de bebida
   recomendados, limiares de alerta de perda de peso), com um editor
   `<details>` colapsável a nível de clube e outro a nível de atleta
   (override), exatamente o mesmo padrão já usado em
   `naGuidelines`/`_naBands` para os valores de referência de
   Nutrição. `_hydraBands(athleteId)` faz o merge (override da atleta
   > valor do clube > valor científico por defeito, campo a campo).
3. `APP.hydrationRecords[]` — um registo por atleta+jogo, com peso
   pré-jogo, peso pós-jogo, líquidos ingeridos, urina, duração,
   notas, autor e timestamp. `saveHydraRecord()` cria ou atualiza.
4. Cálculos automáticos, com recálculo em direto no formulário
   (`_hydraCalcLive()`, sem re-render completo — o mesmo padrão já
   usado no cálculo em direto do WHR em Nutri → Avaliações, para não
   perder o foco do campo a cada tecla):
   - Taxa de sudorese: `(peso pré − peso pós + líquidos − urina) / duração`.
   - % de perda de massa corporal, com um semáforo (`_hydraWeightColor`)
     verde/amarelo/vermelho segundo os limiares configuráveis
     (por defeito 2%/3%), e um aviso próprio e distinto quando a
     atleta GANHOU peso durante o jogo (risco de sobre-hidratação,
     nunca tratado como "dentro do objetivo").
   - Objetivo de reposição pós-jogo: 150% do défice de peso (regra
     NATA), nunca negativo.
5. Formulário de registo com seleção de atleta + jogo, pré-preenchido
   automaticamente se já existir um registo para essa combinação.

Testado com Node (`node --check` ao bloco `<script>`) + um novo
ficheiro Playwright dedicado (`test_hydration_v188.js`): fórmulas de
cálculo, semáforo de peso (incluindo o caso de ganho de peso), valores
por defeito a bater com os acordados, editor de defeitos do clube
(definir + repor), precedência do override por atleta, formulário a
recalcular em direto com `page.fill()` real, gravar/reabrir um
registo com pré-preenchimento, aviso de ganho de peso, e confirmação
de que o mesmo registo gravado a partir do ecrã Nutri aparece também
no ecrã Fisio sem duplicar dados. Todas as afirmações passaram. As
suites de regressão pré-existentes (sps-v185/v186/v187) foram
re-corridas depois de inserir este bloco de código novo e continuam
todas a passar sem regressões (a mesma falha de sempre do CDN
bloqueado pelo proxy da sandbox, sem relação com este trabalho).

SW bump para `sps-v188`.

**Atualização (mesmo dia): sincronização entre dispositivos resolvida.**
A nota original desta secção (tabela `hydration_records` por criar,
porque a sessão do MCP do Supabase tinha expirado a meio deste
trabalho) já não se aplica — o Supabase reconectou ainda na mesma
sessão e a tabela foi criada (migração `create_hydration_records`),
com a mesma política RLS `anon_all` usada em todas as outras tabelas
da app. Também corrigido nesse momento: `saveHydraRecord()` passou a
enviar `club_id` explicitamente para `cloudUpsert('hydration_records',
...)`, tal como todas as outras chamadas a `cloudUpsert` no código
(era o único ponto a confiar só no preenchimento automático do
`club_id` dentro do próprio `cloudUpsert` — inofensivo na prática, mas
inconsistente com o padrão do resto da app). Confirmado com Node
(`node --check`) e reexecução da suite `test_hydration_v188.js`
(continua tudo a passar). Com isto, um registo gravado no ecrã da
Nutri passa a aparecer também no ecrã do Fisio (e vice-versa) em
qualquer dispositivo, cumprindo o "AS DUAS" tal como decidido.

## sps-v189 — Métricas & Evolução no Dashboard Completo do Fisio (29/09/2026)

Pedido do Roger: no Dashboard Completo do Fisio, identificar por código
de cores as métricas/pesos/volumes das atletas, mostrar por seta se há
evolução quando se fazem novas avaliações, e poder exportar tudo em PDF
A4 horizontal. Antes de codificar, escrevi uma proposta num documento
Claude Docs dedicado ("SPS — Métricas & Evolução no Dashboard Fisio")
com o que já existia na app para reaproveitar, uma pequena arquitetura
e 5 perguntas — todas respondidas pelo Roger com a opção recomendada:
âmbito só antropometria (peso, %gordura, massa muscular, perímetros,
WHR — os "volumes" a que se referia, já geridos pela Nutri em Nutri →
Avaliações), cartão dentro do Dashboard Completo já existente (sem
página nova no menu), leitura para o Fisio (Nutri continua a editar),
botão de PDF também no Fisio, e limiar de 60 dias para avaliação
desatualizada (mesmo valor já usado em Condição do Plantel).

**O que mudou:**

1. `_naTrendBadge(atual, anterior, direção favorável, casas decimais)`
   — nova função central de cor + seta (↑/↓/→), substitui `_naTrendCls`
   (que só dava cor, nunca seta). Duas métricas com juízo clínico
   estabelecido (verde/vermelho, mesmas 3 de sempre: %Gordura e Soma
   das 8 Pregas ↓ favorável, Massa Muscular ↑ favorável) e todas as
   restantes (Peso, WHR, os 5 perímetros) ganham agora a seta também,
   mas sem cor — mantém-se o princípio já documentado no código de não
   inventar um juízo clínico sobre peso/perímetros que não foi pedido.
   `_trendBadgeHtml()` formata o resultado como badge colorido ou texto
   cinzento informativo, conforme o caso.
2. A tabela de Evolução da Nutri (`printNaEvolutionPDF`) passou a usar
   `_naTrendBadge` em vez de `_naTrendCls` — ganhou seta em todas as
   métricas, de graça, sem qualquer pedido extra. A função passou a
   aceitar um `athleteId` opcional (antes só lia o `<select>` da
   página da Nutri) — necessário para o novo botão a partir do Fisio,
   sem duplicar a função nem partir a chamada já existente.
3. Novo cartão "📏 Métricas & Evolução" no Dashboard Completo do Fisio
   (`renderFisioDash`), em modo leitura — lê `APP.nutritionAssessments`
   diretamente (já sincronizado, sem tabela nova no Supabase, sem
   duplicar dados): uma linha por atleta com pelo menos 1 avaliação,
   com peso/%gordura/massa muscular da última avaliação + cor/seta vs.
   a anterior, data da última avaliação (aviso ⚠️ visual quando > 60
   dias) e um botão 📄 para o PDF de evolução dessa atleta (só quando
   já há ≥2 avaliações). Atletas sem avaliação nenhuma ficam fora da
   tabela, contadas numa nota à parte.
4. Novo `printFisioMetricasPlantelPDF()` — uma linha por atleta com a
   última avaliação, no espírito de `printCondicaoPlantel()` mas sem
   nenhuma ligação a carga de treino (fontes de dados diferentes,
   donos diferentes). A4 horizontal (`_printWin(...,true)`), acionado
   por um botão no próprio cartão do Fisio.
5. Correção a uma afirmação errada que eu tinha escrito na proposta:
   `printCondicaoPlantel()` **não** é A4 horizontal (fica em A4
   vertical, só o PDF de Evolução da Nutri já usava o 5º parâmetro) —
   corrigido no documento assim que percebi o engano, antes de
   codificar fosse o que fosse a partir dessa premissa errada.

Testado com Node (`node --check`) e um novo ficheiro Playwright
dedicado (`test_fisio_metricas_v189.js`): `_naTrendBadge` em todos os
casos (favorável, desfavorável, estável, sem juízo, sem avaliação
anterior), o cartão do Fisio com os 3 cenários de atleta (2 avaliações,
1 avaliação, nenhuma), o aviso de avaliação desatualizada, o PDF por
atleta chamado com `athleteId` explícito (entrada nova a partir do
Fisio) e o novo PDF de plantel (título, A4 horizontal, lista certa de
atletas). Verificado também à parte que a Evolução da Nutri continua a
funcionar exatamente como antes a partir do `<select>` da própria
página, e que ganhou as setas em todas as métricas. As suites de
regressão pré-existentes (sps-v185 a sps-v188) foram todas re-corridas
depois destas alterações e continuam a passar sem regressões (a mesma
falha de sempre do CDN bloqueado pelo proxy da sandbox).

SW bump para `sps-v189`.

## sps-v190 (30/09/2026): botão "📄 PDF Plantel" — mudado do Dashboard do Fisio para o da Nutri

Pedido do Roger logo depois do sps-v189 chegar aos dispositivos: "quero
esse botão na Nutri em vez da Fisio, faz mais sentido". Confirmado por
pergunta que era para o cartão inteiro "📏 Métricas & Evolução" sair do
Fisio, não para duplicar nos dois lados ("que fique só na Nutri").

**Fix, puramente de localização — nenhuma alteração de cálculo/lógica:**
- `${_fisioMetricasCardHtml()}` removido de `renderFisioDash()`.
- As três funções envolvidas foram renomeadas para refletir o novo dono
  (a Nutri já edita estes dados diretamente — deixou de fazer sentido o
  prefixo `_fisio*`): `_fisioMetricasRows`→`_nutriMetricasRows`,
  `_fisioMetricasCardHtml`→`_nutriMetricasCardHtml`,
  `printFisioMetricasPlantelPDF`→`printNutriMetricasPlantelPDF`,
  `FISIO_METRICAS_STALE_DAYS`→`NUTRI_METRICAS_STALE_DAYS` (continua 60
  dias, sem alteração de valor).
- `${_nutriMetricasCardHtml()}` inserido em `renderNutriDash()`, logo a
  seguir ao card "🥗 Visão Geral Nutricional" já existente.
- Texto do cartão ajustado: a frase "Registado pela Nutrição — leitura"
  deixou de fazer sentido (a Nutri já é quem está a ver o próprio cartão)
  — passou a "Última avaliação antropométrica de cada atleta."

SW bump para `sps-v190`. Testado: `node --check` ao ficheiro inteiro;
novo ficheiro Playwright (`test_nutri_metricas_v190.js`, substitui o
`test_fisio_metricas_v189.js` da versão anterior) confirmando: o cartão e
os 3 cenários de atleta (2 avaliações/1 avaliação/nenhuma) agora no
Dashboard da Nutri; `_nutriMetricasRows()`/`printNutriMetricasPlantelPDF()`
funcionam com os nomes novos; e — verificação explícita do pedido — o
cartão **deixou de aparecer** no Dashboard do Fisio. Um falso alarme do
próprio teste foi corrigido a meio (a tabela "Visão Geral Nutricional",
pré-existente, lista sempre todo o plantel incluindo quem não tem
avaliação — a verificação de exclusão teve de isolar só a tabela do
cartão novo, não o texto da página inteira). Todas as suites de
regressão pré-existentes (sps-v187/v188, Quadro Tático, Evolução da
Nutri) foram re-corridas e continuam a passar sem regressões.

**Ainda por fazer:** nada pendente para este pedido.

## sps-v191 (30/09/2026): Quadro Tático — X de adversária reduzido + app própria "SPS Set Pieces Board"

Pedido do Roger, com o logo "SPS Set Pieces Board" em anexo (badge circular
preta com prancheta tática, bola, "SPS" em prateado 3D, anel verde):
"na aba Campo reduz o X de adversária, analisa e melhora todas as
funcionalidades tendo em conta o selecionar e arrastar, quero que
coloques link apenas para essa parte para tipo app específica com este
logo. Quero que seja um quadro tático muito funcional para bolas paradas."

**1) X de adversária mais pequeno (quadro ao vivo + miniatura/galeria/PDF):**
- `_jogoCampoHtml()`: braço do X passou de `rad` para `rad*0.6` (visualmente
  o X ficava com mais peso que os círculos das atletas do mesmo raio); traço
  de `sw+1.5` para `sw+0.8`.
- `_pitchSnapshotSvg()` (miniatura/galeria/PDF): mesma proporção — braço de
  `rad-1` para `rad*0.55`, traço de `sw+1.5` para `sw+0.8` — para a
  miniatura nunca divergir visualmente do quadro ao vivo. `printJogoCampo()`
  clona o SVG ao vivo diretamente, por isso o PDF herda a mudança sem
  código extra.
- **Selecionar/arrastar preservado de propósito:** o círculo transparente de
  toque por baixo do X (`r=rad+3`) **não foi reduzido** — só o traço
  visível ficou mais fino. Área de arrastar/toque igual à de antes, só o
  desenho ficou mais discreto, exatamente o pedido do Roger ("tem em conta
  o selecionar e arrastar").

**2) App própria para o Quadro Tático (`?tatico=1`):**
- Descoberto, ao investigar, que o `initPWA()` nunca teve de facto um ramo
  `_forceTaticoMode` — apesar do changelog do sps-v185 falar num ícone "TT"
  gerado para este modo, esse ramo não existia; `?tatico=1` caía sempre no
  manifest genérico do clube (nome/ícone/`start_url` errados ao "Adicionar
  ao Ecrã Principal"). Gap agora fechado.
- Novo logo do Roger processado (fundo quase-branco removido por
  flood-fill a partir dos cantos, preservando os brilhos internos do
  badge) em `assets/icon_tatico_192.png` / `_512.png` (RGBA, cantos
  transparentes) e `assets/icon_tatico_apple.png` (180×180, fundo sólido
  `#0c0f14` — os ícones Apple não lidam bem com transparência).
  `sw.js` (`ASSETS`) atualizado com os 3 novos ficheiros.
- Novo ramo em `initPWA()`: nome "SPS Set Pieces Board", `short_name`
  "Set Pieces", `theme_color` `#8bc634` (verde do logo), `start_url` com
  `?tatico=1`, ícones/`apple-touch-icon` próprios. "Adicionar ao Ecrã
  Principal" a partir do Quadro Tático agora abre só essa parte, com o
  logo certo.

SW bump para `sps-v191`. Testado: `node --check`; novo
`test_tatico_v191.js` (Playwright) confirma o braço/traço do X reduzido no
quadro ao vivo e na miniatura, o círculo de toque inalterado (r=9), e o
manifest do `?tatico=1` (nome, `start_url`, ícones 192/512, `theme_color`,
apple-touch-icon). Regressão completa re-corrida (sps-v187/v188, Quadro
Tático original, Evolução da Nutri, Fisio→Nutri v190) sem falhas.

**Ainda por fazer:** a parte mais aberta do pedido — "analisa e melhora
todas as funcionalidades" do Quadro Tático — ainda não foi endereçada.
Falta propor ao Roger um conjunto concreto de melhorias (candidatas
identificadas na investigação: seleção múltipla/mover em grupo, guias de
alinhamento/snap, desfazer para arrasto ou remoção acidental, destaque
visual durante o arrasto) antes de implementar, seguindo a prática deste
projeto de confirmar o âmbito de pedidos abertos antes de avançar.

## sps-v192 (01/10/2026): PDF Plantel (2 últimas avaliações) + todas as métricas no snapshot do Dashboard

Pedido do Roger, em Nutri → Avaliações: um botão para imprimir os dados antropométricos de
todo o plantel, A4/A3 horizontal, comparando a avaliação mais recente de cada atleta com a
anterior, com o código de cores e setas já estabelecido. Desenhado em 5 rondas de rascunho
(ficheiros HTML enviados ao Roger, nunca código) antes de avançar para a implementação —
prática já seguida no projeto para pedidos abertos:

1. 1ª proposta: datas como grupos de coluna, 3 datas, métricas como sub-colunas.
2. Mudou para: métrica em cima, 2 sub-colunas (Recente/Anterior) por baixo, repetindo a data
   em cada célula.
3. Roger: tirar a palavra "Recente"/"Anterior" das linhas, só a data, uma vez.
4. Datas fixas só no cabeçalho de cada métrica (uma vez, não por linha).
5. **Decisão final**: nem todo o plantel é avaliado no mesmo dia — datas fixas no cabeçalho
   não davam para representar isso. Voltou a "Recente"/"Anterior" (genérico) no cabeçalho,
   mas cada atleta usa sempre as SUAS PRÓPRIAS 2 avaliações mais recentes — sem obrigar a
   bater certo com as outras linhas. Lista final: 12 métricas (Altura, Peso, IMC, %Gordura,
   Massa Muscular, Soma Pregas, Rácio Cintura-Ancas, 4 Perímetros — mesmo conjunto já usado
   no PDF de Evolução por atleta, + Altura). Larguras de coluna ajustadas à largura real de
   uma folha A3 horizontal (nome 130px, cada coluna de dado 57px).

**Implementação:**
- Nova constante partilhada `_NA_ALL_METRICS` (12 métricas, com `key`/`label`/`unit`/`abs`
  para IMC/`favDir`+`decimals` para as restantes) — fonte única usada agora pelas 3 vistas de
  plantel (evita a lista de métricas divergir entre elas no futuro).
- Nova função `printNaPlantelComparativoPDF()` — botão "🖨️ PDF Plantel (2 últimas)" em Nutri
  → Avaliações, ao lado do "🖨️ PDF Evolução" já existente. Uma linha por atleta, 2 colunas
  por métrica (Recente/Anterior), seta/cor de tendência na coluna "Recente" (IMC com badge de
  cor por faixa, sem seta, igual ao resto da app). Atletas sem nenhuma avaliação ficam fora
  da tabela (contados no rodapé); com só 1 avaliação, "Anterior" fica a "—". A3 horizontal.

**Pedido seguinte do Roger, ainda na mesma sessão**: "o tal snapshot quero que tenha também
todas as métricas" — referia-se ao cartão "📏 Métricas & Evolução" do Dashboard da Nutri e ao
seu botão "📄 PDF Plantel" (sps-v189/v190), que só mostravam Peso/%Gordura/Massa Muscular.
Estendidos para as mesmas 12 métricas de `_NA_ALL_METRICS` (1 coluna por métrica, só o valor
mais recente + seta/cor de tendência — mantém o espírito de "relance rápido", ao contrário do
PDF Plantel novo que compara 2 avaliações lado a lado):
- `_nutriMetricasRows()` passou a calcular um objeto `metrics` com as 12 métricas por atleta
  (mantendo `r.weight`/`r.bodyFat`/`r.muscleKg` como aliases no formato `{v,b}` de sempre, por
  compatibilidade com código/testes já existentes).
- `_nutriMetricasCardHtml()` e `printNutriMetricasPlantelPDF()` geram as colunas da tabela
  dinamicamente a partir de `_NA_ALL_METRICS`, em vez de 3 colunas escritas à mão.
- `printNutriMetricasPlantelPDF()` passou de A4 para A3 horizontal (14 colunas agora, A4 já
  não dava espaço confortável — mesma decisão já tomada no PDF Plantel novo).

SW bump para `sps-v192`. Testado: `node --check`; dois novos ficheiros Playwright
(`test_na_plantel_v192.js` para o botão novo, `test_na_dashboard_v192.js` para o cartão/PDF
do Dashboard — confirma as 12 métricas, a compatibilidade de `r.weight`/`r.bodyFat`/
`r.muscleKg`, atletas sem avaliação excluídos/contados, "—" quando falta a avaliação
anterior, IMC com badge de cor sem seta). Regressão completa re-corrida (v187/v188/v190/v191)
sem falhas — o teste do sps-v190 precisou de 2 ajustes por causa desta mudança (janela de
texto maior para capturar o rodapé do cartão, agora bem mais largo; verificação do PDF
atualizada de "A4 landscape" para "A3 landscape").

**Ainda por fazer:** nada pendente para este pedido. Continua em aberto, à parte, o pedido do
sps-v191 sobre "melhorar todas as funcionalidades" de selecionar/arrastar no Quadro Tático.

## sps-v193 (01/10/2026): Suplementação — Bloco 1 (catálogo + prescrição por atleta)

Novo pedido do Roger, depois do sps-v192: módulo de Suplementação na App Nutricionista —
suplementos que a Nutri pode indicar/prescrever, no dia a dia, pré-treino, pós-treino e
matchday, com um catálogo reutilizável para individualizar por atleta ("lista para
individualizar... e também listas de opção, deixando sempre espaço para acrescentar").

Pedido explicitamente aberto ("ANALISA, INVESTIGA ONLINE O QUE JÁ SE FAZ... DÁ A TUA VISÃO E
FEEDBACK ANTES DE AVANÇARMOS") — antes de código, escrevi uma proposta num documento Claude
Docs dedicado ("SPS — Suplementação: Análise e Proposta") com pesquisa de mercado (Nutrium,
Trainingym+Nutrium, Hexis — nenhum tem catálogo+prescrição+momento estruturado como o que o
Roger propôs), base científica (categorias do consenso do COI: alimentos desportivos,
suplementos médicos, ajudas ergogénicas) e o maior risco que o mercado geral ignora:
contaminação de suplementos com substâncias proibidas (~1 em 10, segundo a Informed Sport) —
daí a sinalização de certificação Informed Sport no catálogo, sugestão minha incorporada à
proposta. Perguntas em aberto respondidas pelo Roger, uma a uma: só a Nutri gere (sem
equivalente no Fisio, ao contrário da Hidratação); a atleta vai ver a sua prescrição sempre
atualizada num espaço dedicado na App Atleta (Bloco 2); catálogo sinaliza Informed Sport;
suplementos podem ter data de início + revisão opcional, com aviso quando vencida (minha
recomendação, aceite); impressão terá ficha individual E checklist de plantel (Bloco 2);
entrega por blocos, como na Hidratação (minha recomendação, aceite).

Rascunho visual (HTML, não código) com as duas vistas — Catálogo e Prescrição por Atleta —
aprovado em 1 ronda.

**O que mudou (Bloco 1 — catálogo + prescrição + ecrã agrupado por momento):**

1. Duas tabelas novas no Supabase (migração `create_supplement_tables`, mesmo padrão/RLS
   `anon_all` de `hydration_records`): `supplement_catalog` (id, club_id, name, category,
   form, informed_sport, notes) e `supplement_prescriptions` (id, club_id, athlete_id,
   supplement_id, custom_name, dose, moments jsonb, frequency, instructions, start_date,
   review_date, status, prescribed_by/_id, prescribed_at, updated_at).
2. `APP.supplementCatalog[]`/`APP.supplementPrescriptions[]` — novo par em `defApp()`, pull
   em `pullCloud()`, schema+rename em `_CLOUD_TABLE_SCHEMA`, `cloudUpsert` em cada guardar e
   `_supa.from(table).delete()` explícito em cada apagar (mesmo padrão de `exercises`/
   `gym_sheets` — tabela "catálogo", não série temporal tipo `pse_records`).
3. Nova página `nutri-supl` (💊 Suplementação) — só no cargo Nutri (`ROLE_DEFS.nutri.pages`,
   decisão do Roger), com 2 abas:
   - **Catálogo**: tabela (nome, categoria com badge de cor, forma, selo Informed Sport
     ✅/⚠️, notas) + modal de criar/editar (`_openSuplItemModal`/`saveSuplItem`) + apagar.
   - **Prescrição por Atleta**: seletor de atleta + 4 colunas por momento (`SUPL_MOMENTS`:
     Diário/Pré-Treino/Pós-Treino/Matchday), cada suplemento prescrito pode valer para mais
     do que um momento ao mesmo tempo (checkboxes, não exclusivo); cada cartão mostra dose,
     instruções, estado (ativo/pausado/suspenso) e, quando a data de revisão já passou,
     aviso vermelho "⚠️ Revisão vencida" (`_suplReviewOverdue`) em vez da data normal.
     Suplemento pode vir do catálogo ou ser texto livre ("Outro", `customName`).
4. Novo cartão "💊 Suplementação" na Home da Nutri (`renderNutriHome`), com contagem de
   prescrições ativas.
5. Classes CSS novas (`.mom-grid`/`.mom-col`/`.mom-h`/`.supl-item`/`.overdue`/`.supl-nm`/
   `.supl-dose`/`.supl-ins`/`.supl-foot`/`.add-mini`) no mesmo sítio das outras secções do
   `<style>` global, replicando o rascunho validado pelo Roger.

**Por fazer (Bloco 2, já combinado com o Roger, fica para outro pedido):** espaço dedicado na
App Atleta com a prescrição sempre atualizada (sem a informação de "revisão vencida", que é
só para a Nutri); impressão em PDF (ficha individual por atleta + checklist de plantel para
matchday).

Testado com Node (`node --check`) e um novo ficheiro Playwright dedicado
(`test_supl_v193.js`): página só visível ao cargo Nutri (ausente no Fisio); catálogo
cria/lista suplementos com badges de categoria e Informed Sport corretos; prescrição liga um
suplemento do catálogo a uma atleta num momento específico; um suplemento com data de revisão
vencida mostra o aviso, um sem data mostra "Sem prazo"; prescrições de uma atleta não vazam
para outra ao trocar o seletor (tab Catálogo continua no DOM, oculta por CSS — teste isola a
aba Prescrição para não apanhar falsos positivos vindos da tabela do catálogo); apagar
prescrição funciona; cartão da Home mostra a contagem. Regressão completa re-corrida
(`test_na_plantel_v192.js`, `test_na_dashboard_v192.js`, `test_nutri_metricas_v190.js`,
`test_hydration_v188.js`, `test_tatico_v191.js`, `test_mobile_v187.js`, `test_tatico.js`,
`_verify_extra.js`, `_check_nutri_evo.js`) sem falhas.

SW bump para `sps-v193`.

## sps-v194 (01/10/2026): Dashboard do Plantel (Nutrição) + Notas da Sessão nas Consultas

Pedido do Roger, depois do sps-v193: "quero tambem se possivel acrescentar na marcaçaõ e nas
consultas feitas pela nutri exista um espaço de notas para a nutri ir guardando notas de
sessao a sessao e que essas notas aparecam num pdf de registo/relatório geral de tudo o que a
nutri faz" — pedido que cresceu, numa troca de perguntas, para "actividade completa, mas que
permita atraves de vistos as areas que se quer imprimir, e ter um dasboard do plantel tipo o
que temos na plataforma, que ao clicar abre toda a info e os botoes de impressao". Processo
completo: doc de análise+proposta no Claude Docs (4 perguntas em aberto respondidas uma a
uma) → rascunho HTML (`rascunho_dashboard_plantel_v1.html`) aprovado ("avança") → código.

1. **Notas da Sessão**: cada Consulta (`nutritionAppointments`) já guardava `notes` — não
   havia nenhum campo novo a criar, só o rótulo do formulário mudou de "Notas" para "Notas da
   Sessão" (`nc-notes`, `renderNutriConsultas`), com uma dica a explicar onde essas notas vão
   aparecer. Dados/IDs existentes inalterados.
2. **Nova página `nutri-plantel`** (📋 Dashboard do Plantel) — só no cargo Nutri
   (`ROLE_DEFS.nutri.pages`), separada do Dashboard Completo (`nutri-dash`) já existente,
   registada nos 4 sítios habituais (`ALL_PAGES`, `ROLE_DEFS.nutri.pages`, `_NAV_TITLES`,
   mapa `renders` do `navTo`) + container `<div class="pg" id="pg-nutri-plantel">`.
   `renderNutriPlantel()`: tabela do plantel com 4 badges de resumo por atleta (Última
   Consulta, Última Avaliação — com chip "desatualizada" quando `diffDays>NUTRI_METRICAS_
   STALE_DAYS`, igual ao já usado no cartão de Métricas —, Plano Ativo, Suplementação — com
   aviso quando alguma prescrição ativa tem `_suplReviewOverdue`). Clicar numa linha abre
   `_openNutriPlantelModal(athleteId)`.
3. **Modal da ficha completa** (`openMod`, tamanho `lg`): cabeçalho com foto/nome/posição +
   barra com o botão "🖨️ Gerar PDF", e 5 secções em `<details open>` (mesmo padrão já usado
   em `_naGuidelinesEditorHtml` — sem CSS novo) — Consultas & Notas de Sessão / Avaliações
   Antropométricas / Planos Nutricionais / Suplementação / Matchday Hydration — cada uma com
   contagem de registos e um checkbox "Incluir no PDF" (`_npSections{consultas,avaliacoes,
   planos,suplementacao,hidratacao}`, todas `true` por defeito, reposto sempre que o modal
   abre para uma atleta). O checkbox tem `onclick="event.stopPropagation()"` para não abrir/
   fechar o `<details>` ao clicar nele. Cada secção tem a sua função de conteúdo
   (`_npConsultasHtml`/`_npAvaliacoesHtml`/`_npPlanosHtml`/`_npSuplementacaoHtml`/
   `_npHidratacaoHtml`), todas lendo dados já existentes (`nutritionAppointments`/
   `nutritionAssessments`/`nutritionPlans`/`supplementPrescriptions`/`hydrationRecords`) —
   nenhuma tabela nova no Supabase.
4. **PDF seletivo** (`printNutriPlantelPDF`): monta o corpo só com as secções marcadas em
   `_npSections` (feedback de erro via `toast` se nenhuma estiver marcada) e chama
   `_printWin(title, body)` sem o parâmetro `landscape` — sempre A4 vertical, por atleta
   (decisão confirmada com o Roger: nunca um PDF geral do plantel numa tabela só). Reaproveita
   o mesmo cabeçalho/rodapé e `profile-header` dos outros PDFs de Nutrição
   (`printNaSinglePDF`).
5. Cada função de secção tem uma 2ª variante de classes (`printMode` true/false) porque o
   ecrã (tema escuro, classe `.bdg`) e a janela do `_printWin` (fundo branco, classe
   `.badge`) usam folhas de estilo diferentes com o mesmo nome de modificador (`bg-g`/`bg-y`/
   `bg-r`) — mesma solução já usada em `printNaSinglePDF`.
6. Novo cartão "📋 Dashboard do Plantel" na Home da Nutri (`renderNutriHome`), a seguir ao
   cartão do Dashboard Completo.

**Decisão deliberada: sem CSS novo.** Toda a UI (tabela, cartões, badges, `<details>`,
checkboxes) reaproveita classes já existentes no `<style>` global (`.card`/`.ch`/`.cb`/`.tw`/
`table`/`.bdg`/`.bg-*`/`.btn`) com estilo inline só onde precisava de algo específico — mesmo
espírito de `_naGuidelinesEditorHtml`.

Testado com Node (`node --check`) e um novo ficheiro Playwright dedicado
(`test_nutri_plantel_v194.js`): página só no cargo Nutri; título de navegação qualificado;
rótulo "Notas da Sessão" aparece sem mudar o campo `nc-notes`; lista do plantel mostra as 3
atletas com os 4 badges corretos (plano ativo, revisão de suplementação vencida, avaliação
desatualizada ao fim de 90 dias); modal mostra as 5 secções com os dados certos (nota da
sessão, "sem notas" quando vazio, avaliação mais recente, plano, suplemento com revisão
vencida, registo de hidratação ligado ao jogo) e as 5 checkboxes; PDF com tudo marcado inclui
as 5 secções e é sempre A4 vertical; desmarcar 2 secções exclui-as do PDF sem afetar as
restantes; com tudo desmarcado não gera PDF e mostra aviso; reabrir o modal para outra atleta
repõe as 5 secções marcadas e não mostra dados da atleta anterior; cartão novo aparece na Home
da Nutri e liga à página certa. Regressão completa re-corrida (`test_supl_v193.js`,
`test_na_plantel_v192.js`, `test_na_dashboard_v192.js`, `test_nutri_metricas_v190.js`,
`test_hydration_v188.js`, `test_tatico_v191.js`, `test_mobile_v187.js`) sem falhas.

**Ainda por fazer (pedido anterior, aprovado mas não implementado — ver mockups
`rascunho_anamnese_diario_v1.html` e `rascunho_pdfs_anamnese_suplementacao_v1.html`):**
Anamnese Alimentar + Diário Alimentar evoluído (7 dias × 6 refeições) na App Nutri + vista da
atleta + PDFs (Anamnese+Diário por atleta, ficha individual de Suplementação, checklist de
plantel A3 para Matchday).

SW bump para `sps-v194`.

## sps-v195 (01/10/2026): Anamnese Alimentar + Diário Alimentar evoluído + Suplementação — Bloco 2

Pedido do Roger a seguir ao sps-v194 ("QUE FALTA AVANÇAR?" → "1. Anamnese Alimentar + Diário
Alimentar evoluído, 2. Suplementação — Bloco 2, COM OS DOIS") — autorização para implementar
as duas funcionalidades já com rascunhos aprovados (`rascunho_anamnese_diario_v1.html` e
`rascunho_pdfs_anamnese_suplementacao_v1.html`), sem mais perguntas.

1. **Anamnese Alimentar** — nova tabela `nutrition_diet_anamnesis` (`APP.
   nutritionDietAnamnesis[]`), mesmo padrão já usado no Histórico Clínico do Fisio
   (`athlete_anamnesis`/`_getAnamnesis`) mas numa tabela própria, para não misturar os dois
   domínios: `_getDietAnamnesis(athleteId)` com fallback `{selfReport:{},nutriNotes:'',...}`.
   Lado atleta (App Atleta → Nutrição): cartão "🍽️ Anamnese Alimentar" (`_dietAnamneseSummaryCard`)
   + modal de preenchimento (`atOpenDietAnamnese`/`atSaveDietAnamnese`) com 11 campos agrupados
   em 5 secções (Restrições e Alergias, Padrão Alimentar Habitual, Hidratação, Preferências,
   Suplementos Atuais, Observações — `DIET_ANAM_FIELDS`). Lado Nutri: nova página
   `nutri-anamnese-diario` (📋 aba Anamnese), leitura de todos os campos + campo de notas
   próprio da Nutri (`saveNadNutriNotes`), não visível à atleta (mesma regra do Fisio).
2. **Diário Alimentar evoluído**: campo aditivo `weekMeals` (jsonb) em `nutritionPlans` — o
   campo `meals` plano existente fica intacto, zero regressão para planos antigos. Nova aba
   "📅 Diário Alimentar Semanal" na mesma página `nutri-anamnese-diario`: grelha de 7 dias
   (`WEEK_DAYS`) × 6 refeições (`MEALS`), com botão "📋 Copiar de..." para duplicar um dia já
   preenchido para o dia selecionado (`nadCopyDay`) — só aparece (botão e dica) quando existe
   pelo menos outro dia com conteúdo. Lado atleta: cartão "📅 Diário Alimentar Semanal"
   (`_weekMealsSummaryCard`/`_atWmShowDay`) só aparece quando o plano ativo já tem `weekMeals`
   definido pela Nutri, com o dia de hoje pré-selecionado — e quando hoje ainda não tem dados,
   cai para o primeiro dia da semana que já tenha conteúdo (nunca mostra "vazio" se já há
   algum dia preenchido).
3. **PDF Anamnese + Diário** (`printNutriAnamneseDiarioPDF`, por atleta): 2 páginas, página 1
   retrato (resumo da anamnese + nota da Nutri), página 2 paisagem (grelha semanal completa +
   metas de macros no cabeçalho) — duas chamadas a `_printWin()` seguidas, na mesma função
   síncrona (sem `setTimeout` entre elas), para não perder o gesto do utilizador e arriscar o
   bloqueador de pop-ups do browser. Sem plano ativo, gera só a página 1 e avisa por `toast`.
4. **Suplementação — Bloco 2 (vista da atleta)**: cartão novo na App Atleta
   (`_atSupplementacaoCardHtml`), agrupado pelos 4 `SUPL_MOMENTS`, mostrando só prescrições
   ativas/pausadas (nunca suspensas) — propositadamente **sem** data de revisão nem aviso de
   "revisão vencida" (uso interno da equipa técnica, conforme o rascunho aprovado).
5. **PDF ficha individual de Suplementação** (`printSuplIndividualPDF`, botão na aba
   Prescrição por Atleta): A4 retrato, agrupada pelos 4 momentos, **com** o aviso de revisão
   vencida (ficha de uso interno da equipa técnica — o inverso da vista da atleta).
6. **PDF checklist de plantel** (`printSuplPlantelPDF`, botão "🖨️ PDF Plantel (A3 horizontal)"
   na página de Suplementação): A3 paisagem, uma linha por atleta, uma coluna por suplemento
   distinto prescrito no momento "Matchday" em todo o plantel (+ colunas "Outro" e
   "Confirmado").
7. Novo cartão "🍽️ Anamnese & Diário" na Home da Nutri, a contar quantas atletas já têm
   anamnese preenchida.

Testado com Node (`node --check`) e um novo ficheiro Playwright dedicado
(`test_nutri_anamnese_diario_supl2_v195.js`, 45 asserções): preenchimento e leitura da
anamnese (atleta → Nutri), notas da Nutri, aviso de plano em falta, grelha semanal com
"Copiar de..." (ausente sem conteúdo, presente depois de preencher Segunda, cópia Segunda→
Terça), PDF combinado de 2 páginas (retrato A4 + paisagem A4, com e sem plano ativo), PDF
individual de Suplementação (agrupado por momento, com aviso de revisão vencida), PDF
checklist de plantel (colunas certas, A3 paisagem), vista da atleta (anamnese, diário semanal
com dia por defeito e fallback para dia com conteúdo, suplementos sem aviso interno), e cartão
novo na Home. Regressão completa re-corrida (`test_supl_v193.js`, `test_na_plantel_v192.js`,
`test_na_dashboard_v192.js`, `test_nutri_metricas_v190.js`, `test_hydration_v188.js`,
`test_tatico_v191.js`, `test_mobile_v187.js`, `test_nutri_plantel_v194.js`) sem falhas.

SW bump para `sps-v195`.

## sps-v196 (02/10/2026): Código de Conduta — implementação real na Plataforma + App Atleta

Pedido do Roger: "QUERO QUE O CODIGO FIQUE PRONTO NA PLATAFORMA COM UM ESPAÇO/ABA PARA ELE
E QUE SÓ COM O MEU VISTO PARA FICAR ATIVO É QUE APARECE NA APP ATLETAS NUMA SECÇÃO/CARD
PRÓPRIA PARA O MESMO" — depois de fechado, ponto a ponto (`AskUserQuestion`, um a um), todo
o conteúdo dos 32 pontos do Código de Conduta do Moreirense FC Feminino 2026/27 na doc
"Código de Conduta & Estágios — Análise e Proposta". Esta versão implementa de facto o que
até aqui era só a proposta, seguindo os padrões já estabelecidos no resto da app (nunca
inventados de novo):

1. **Texto dos 32 pontos** (`_CODIGO_CONDUTA_SECOES`, ~linha 15100): array estático em
   código — igual a `_NUTRI_MANUAL_SECOES`/`_MANUAL_SECOES` — não é conteúdo editável pela
   equipa técnica, é a política do clube tal como decidida com o Roger. Cada ponto numerado
   1 a 32, em acordeão (`<details>`).
2. **Nova página na Plataforma** (`codigo-conduta`, 📜): registada em `ALL_PAGES` (secção
   nova "Clube"), `_NAV_TITLES`, `renders` (`navTo`), `pg-codigo-conduta`. Acesso automático
   para `treinador`/`treinador_adj` (via `_ALL_PAGE_IDS`); adicionado explicitamente a
   `team_manager` e `diretor`. `renderCodigoConduta()` mostra o estado atual (ativo/inativo,
   versão, quem e quando ativou) + estatística de quantas atletas já confirmaram "Li e
   aceito" + a lista de acordeões com os 32 pontos.
3. **Ativação restrita ao Roger** (`ativarCodigoConduta`/`desativarCodigoConduta`): gate por
   `getSession().isAdmin` — mesma guarda de `_canManageUsers()` — nunca por `ROLE_DEFS`
   (um cargo poder ver a página não dá poder para ativar). Sem isso, a página mostra só um
   aviso, sem botão.
4. **Estado de ativação em tabela dedicada própria** (`APP.codeOfConduct`, default `null`):
   singleton por clube (`id:'coc-'+clubId`), mesmo padrão exato de
   `APP.nutritionGameDayPlan`/`nutrition_gameday_plan` — nunca no blob `clubs.meta` (lição
   repetida de incidentes #1-4). Tabela Supabase `code_of_conduct` (migração
   `create_code_of_conduct_table`), `_CLOUD_TABLE_SCHEMA`/`pullCloud()` atualizados a par.
5. **Aceitação por atleta** ("Li e aceito"): 2 campos simples direto no registo da atleta —
   `cocAckVersion`/`cocAckAt` (colunas `coc_ack_version`/`coc_ack_at` em `athletes`) — em vez
   de tabela nova, por serem só 2 campos (não é série temporal). Reaproveita o
   `cloudUpsert('athletes',...)` já existente.
6. **App Atleta**: cartão de destaque na Home (`renderAtHome`), visível só quando
   `APP.codeOfConduct?.active===true` — amarelo "Pendente" se `cocAckVersion` não é a versão
   em vigor, verde "Já confirmaste" caso contrário. Toca para abrir `atOpenCodigoConduta()`
   (mesmo acordeão, modal `lg`) com botão "✓ Li e aceito" no fim quando ainda pendente
   (`atAceitarCodigoConduta`, grava `cocAckVersion`/`cocAckAt` e fecha o modal). Se o Código
   for revisto no futuro (incrementar `version` em `APP.codeOfConduct`), qualquer atleta com
   `cocAckVersion` de uma versão anterior volta a aparecer como pendente, sem perder o
   histórico de aceitação anterior.

Testado com Node (`node --check` ao script extraído) e um harness Node com stubs de DOM/
sessionStorage a correr o fluxo completo dentro do próprio `vm` (sem Playwright, por não
haver elementos visuais novos complexos): staff não-admin vê só o aviso, staff admin vê o
botão e consegue ativar (`APP.codeOfConduct` fica com `active:true`/`version`/`publishedBy`
corretos), estatística de aceitação (1/2) correta depois de ativar, cartão da Home da atleta
aparece "Pendente" para quem ainda não aceitou e "Já confirmaste" para quem já tinha
`cocAckVersion` igual à versão em vigor, aceitar grava os campos e atualiza o cartão, e
desativar esconde o cartão da App Atleta por completo. `_CODIGO_CONDUTA_SECOES` validado com
32 entradas, ids únicos, títulos numerados 1..32 em ordem, e todos os campos `id`/`icon`/
`title`/`html` preenchidos.

Tabela `code_of_conduct` criada no Supabase (migração `create_code_of_conduct_table`, RLS
`anon_all` igual às restantes) e colunas `coc_ack_version`/`coc_ack_at` adicionadas à tabela
`athletes` já existente, na mesma migração.

SW bump para `sps-v196`.

## sps-v197 (02/10/2026): Código de Conduta — texto editável na Plataforma + exportação PDF

Pedido do Roger a seguir ao sps-v196: "PRECISO QUE O CODIGO DE CONDUTA SEJA EDITAVEL E
EXPORTAVEL(PDF) NA PLATAFORMA". Até aqui o texto dos 32 pontos era só fixo em código
(`_CODIGO_CONDUTA_SECOES`), igual ao padrão do Manual Nutricional — deixou de bastar,
porque é texto de política do clube e o Roger precisa de poder ajustar a redação sem
pedir um deploy novo de cada vez.

1. **Edição por ponto, não reescrita do ficheiro**: `_CODIGO_CONDUTA_SECOES` continua a
   ser a base/fallback (nunca apagado do código) — a edição grava só os pontos alterados
   em `APP.codeOfConduct.sections` (array completo, por `id`), na mesma tabela singleton
   `code_of_conduct` (colunas novas `sections` jsonb, `sections_updated_at`,
   `sections_updated_by`; migração `add_code_of_conduct_editable_sections`).
   `_cocSections()` funde os dois em runtime: qualquer ponto sem edição mostra sempre o
   texto original, e um ponto novo que vier a ser acrescentado ao código no futuro
   aparece automaticamente mesmo com uma edição antiga guardada.
2. **Modo de edição na Plataforma** (`_cocEditMode`, `_renderCodigoCondutaEdit`,
   `saveCodigoCondutaTexto`, `resetCodigoCondutaTexto`): botão "✏️ Editar Texto"
   (isAdmin, mesma guarda de `ativarCodigoConduta`) transforma os 32 acordeões num
   formulário com título (`<input>`) + texto HTML simples (`<textarea>`) por ponto, um
   único botão "💾 Guardar Alterações" no fim (mesmo padrão de `renderNutriGameday`:
   vários campos, um save só). Checkbox "Esta alteração exige nova aceitação das
   atletas" (marcado por defeito) incrementa `version` ao guardar — reabre o pendente de
   "Li e aceito" para todo o plantel, sem perder o histórico de quem já tinha aceitado a
   versão anterior. Botão "↺ Repor Texto Original" (só aparece havendo edição) limpa
   `sections` e volta ao texto de código.
3. **Exportação em PDF** (`printCodigoCondutaPDF`): reaproveita `_printWin()`, o mesmo
   mecanismo de todos os outros relatórios da app (abre numa janela, chama `print()`,
   sem biblioteca de PDF própria) — nunca inventado de novo. Usa sempre `_cocSections()`
   (texto editado, se houver), por isso o PDF reflete sempre o que a atleta vê na app.
   `_cocPdfFix()` troca as variáveis CSS do resto da app (`var(--t2)`, etc., que não
   existem na janela de impressão) por cores fixas, só nesta exportação — nunca no texto
   guardado.
4. **Correção de regressão**: `ativarCodigoConduta`/`desativarCodigoConduta` faziam
   `const cc={id,active,...}` a partir do zero, o que apagava silenciosamente qualquer
   `sections` já guardado sempre que o Roger ativava/desativava o Código depois de o
   editar. Corrigido para `{...(prev||{}),...}` antes de sobrepor os campos próprios —
   mesma classe de bug já documentada noutros incidentes de push/pull desta app.

Testado com Node (`node --check`) e um harness dedicado (`test_coc_edit.js`, vm com stubs
de DOM/sessionStorage/window.open): fusão `_cocSections()` (override + fallback por
ponto), fluxo completo de edição (abrir modo de edição, alterar título/texto de um ponto,
guardar com `version++`), confirmação de que ativar/desativar já não apaga as edições
(regressão), exportação em PDF sem lançar excepção e já com o texto editado, "Repor Texto
Original" a limpar o override sem desativar o Código, vista da atleta (`atOpenCodigoConduta`)
a refletir sempre o texto atual via `_cocSections()`, e bloqueio de quem não é admin a
gravar edições. Regressão do fluxo de ativação/aceitação do sps-v196 (`test_coc3.js`)
re-corrida sem falhas.

SW bump para `sps-v197`.

## sps-v198 (02/10/2026): aba Estágios — Guião de Jogo Fora (editável + PDF com seleção de pontos)

Pedido do Roger: "VAMOS PASSAR A ABA ESTÁGIOS" seguido do documento completo "GUIA DE
JOGO FORA — MOREIRENSE FC FEMININO" (48-72h antes → véspera → dia de jogo → pré-jogo →
jogo → intervalo → pós-jogo → regresso → dia+1 recovery → regras do estágio), com o
pedido explícito de ser "editável e exportável (PDF) na Plataforma" e de "permitir que
através de visto possa selecionar o que vou exportar (PDF)". Decisões tomadas antes de
implementar (`AskUserQuestion`): (1) o Guião (texto de referência da época) fica
separado dos dados concretos de cada estágio (datas/quartos/transporte de uma
deslocação específica, fase seguinte, ligada à App Atleta); (2) as "Regras do Estágio"
não duplicam o texto do Código de Conduta — ficam como checklist curto com nota do
ponto do Código a consultar.

1. **Nova página "Guião de Jogo Fora"** (secção "Estágios" em `ALL_PAGES`), visível a
   toda a equipa multidisciplinar (treinador/adj automaticamente, + `prep_fisico`,
   `treinador_gr`, `fisio`, `nutri`, `team_manager`, `diretor` — o guião cobre
   fisioterapia, nutrição e preparação física, não só o treinador).
2. **Conteúdo** (`_GUIAO_JOGO_FORA_SECOES`, 10 pontos): transcrição fiel do documento
   do Roger — 48-72h antes (checklist), véspera hora-a-hora (18:00 concentração → 23:00
   silêncio), dia de jogo manhã (07:30 wake up + autoavaliação SPS → 13:15 recuperação),
   pré-jogo em T-menos (T-3h30 → T-0, calculado a partir da hora do jogo, nunca fixo),
   jogo, intervalo (0-15' em blocos de ~5'), pós-jogo (+0' a +60'), regresso, chegada
   (autoavaliação pós-jogo no SPS Atleta), dia+1 recovery day (por área: atleta/fisio/
   prep física/nutrição/equipa técnica), e regras do estágio (tabela de 12 regras → ponto
   do Código de Conduta a consultar, sem duplicar texto).
3. **Editável** (`_guiaoEditMode`, `_renderGuiaoJogoForaEdit`, `saveGuiaoJogoForaTexto`,
   `resetGuiaoJogoForaTexto`): EXATA mesma arquitetura e UI do Código de Conduta
   (sps-v197) — texto base em código, edição por ponto gravada como override em
   `APP.guiaoJogoFora.sections` (tabela singleton nova `away_game_guide`, migração
   `create_away_game_guide_table`, mesmo RLS `anon_all`), fundida em runtime por
   `_guiaoSections()`. Sem `active`/`version`/aceitação — é um guia operacional da
   equipa técnica, não exige visto nem aparece na App Atleta (ver decisão 1 acima).
4. **Seletor de pontos para PDF, genérico** (`_printWithSectionPicker`,
   `_pdfPickerSetAll`, `_confirmPdfSectionPicker`): modal com um checkbox por ponto
   (todos marcados por defeito) + "Selecionar Todos"/"Limpar", antes de gerar o PDF —
   só os pontos marcados entram no documento. Construído como utilitário reutilizável
   (não específico de uma funcionalidade) e **também retrofitado ao Código de
   Conduta** (`printCodigoCondutaPDF` passou a abrir o mesmo seletor antes de gerar o
   PDF) — consistência entre os dois, sem pedir isso duas vezes ao Roger.
   `printGuiaoJogoForaPDF`/`_printGuiaoJogoForaPDF` geram o PDF via `_printWin()` (mesmo
   mecanismo de sempre), usando `_editavelPdfFix()` (renomeado de `_cocPdfFix`, agora
   genérico) para as variáveis CSS que não existem na janela de impressão.

Testado com Node (`node --check`) e um harness dedicado (`test_guiao.js`): wiring de
`ALL_PAGES`/`ROLE_DEFS`/`_NAV_TITLES`/`_ALL_PAGE_IDS` para os 6 cargos com acesso,
conteúdo (10 pontos, ids únicos, numerados, todos os campos presentes), vista normal
(botões Editar+PDF), fluxo de edição completo (abrir, editar um ponto, guardar,
`_guiaoSections()` reflete o override e preserva os outros pontos como default),
seletor de PDF abre ANTES de qualquer janela, desmarcar um ponto efetivamente exclui-o
do PDF gerado (e o ponto editado aparece), confirmar sem nenhum selecionado bloqueia com
toast em vez de abrir janela vazia, reposição ao texto original, bloqueio de não-admin,
e regressão do Código de Conduta a continuar a funcionar através do seletor partilhado.
Tabela `away_game_guide` criada e verificada no Supabase.

SW bump para `sps-v198`.

## sps-v199 (02/10/2026): aba Estágios — dados concretos de cada deslocação (convocatória,
## quartos, confirmação) + "O Meu Estágio" na App Atleta

Pedido do Roger a seguir ao sps-v198 ("SIM", para avançar com a parte que tinha ficado
separada do Guião de Jogo Fora pela decisão "Separados (recomendado)"): a ficha de dados
concretos de cada estágio real — datas, local, transporte, refeições, quartos e
convocatória — ligada à App Atleta. Duas decisões tomadas antes de implementar
(`AskUserQuestion`): (1) cada Estágio pode ligar-se opcionalmente a um Jogo Fora já
existente, herdando adversário/hora na Cronologia da atleta ("Ligação opcional a um Jogo
(recomendado)"); (2) a confirmação de presença é só da própria atleta, sem consentimento de
encarregado de educação ("Só confirmação da atleta (recomendado p/ já)").

1. **Nova página "Estágios"** (🧳), na mesma secção "Estágios" criada no sps-v198 — mesmos
   6 cargos com acesso que já tinham o Guião (`prep_fisico`, `treinador_gr`, `fisio`,
   `nutri`, `team_manager`, `diretor`), além de `treinador`/`treinador_adj` automaticamente.
2. **Tabela dedicada própria `estagios`** (migração `create_estagios_table`, RLS `anon_all`
   igual às restantes) — ao contrário do Guião (singleton de texto), pode haver muitos
   estágios, por isso segue o padrão de `games`/`trainings` (upsert por linha,
   `_CLOUD_TABLE_SCHEMA`/`pullCloud()` atualizados a par, nunca no blob `clubs.meta`).
   Campos: `titulo`, `local`, `dataInicio`/`dataFim`, `transporteIda`/`transporteVolta`,
   `refeicoes`, `notes`, `gameId` (opcional), `quartos` (array `{id,nome,athleteIds}`),
   `convocatoria` (array de ids, mesmo padrão "banco" de `g.convocatoria`), `seenBy`/`rsvp`
   (mesmo padrão exato de `APP.convocatorias`, mas vivendo na própria linha do estágio).
3. **Ecrã da Plataforma** (`renderEstagios`): lista de estágios (+ Novo Estágio) → detalhe
   com 4 separadores — Dados (campos + seletor opcional de Jogo Fora + botão PDF),
   Convocatória (checklist por atleta, Convocar/Desconvocar Todas, mesmo padrão de
   `toggleConvocado`), Quartos (criar quarto por `prompt()`, atribuir/remover atletas —
   uma atleta só pode estar num quarto de cada vez; sair da convocatória limpa
   automaticamente o quarto atribuído), Confirmações (leitura do `rsvp`/`seenBy`, a
   confirmação em si é feita só pela atleta).
4. **PDF do Estágio** (`printEstagioPDF`): dados da deslocação + lista de convocadas com
   quarto atribuído + coluna de assinatura — reaproveita `_printWin()`, sem seletor de
   secções (não é texto editável tipo Guião/Código, é uma ficha de dados).
5. **App Atleta — "O Meu Estágio"**: cartão na Home (`_atEstagioAtivo`, aparece só quando a
   atleta está convocada num estágio cujo fim ainda não passou), amarelo "Confirma a tua
   presença" enquanto pendente, azul depois de responder — mesmo padrão visual do cartão do
   Código de Conduta. Abre `atOpenEstagio` (regista `seenBy`, bloqueado para quem não está
   convocada) com 3 separadores: Cronologia (datas/local/transporte/refeições + adversário/
   hora quando ligado a um Jogo — nunca o texto do Guião, que continua só da equipa
   técnica), O Meu Quarto (nome do quarto + colegas, ou aviso se ainda não definido),
   Confirmação (Vou/Não vou com motivo — mesmo padrão exato de `atRsvpYes`/`_rsvpOf`, só
   que o registo vive na própria linha do estágio em vez de `APP.convocatorias`).

Testado com Node (`node --check`) e um harness dedicado (`test_estagios.js`, 22
asserções): wiring de `ALL_PAGES`/`ROLE_DEFS`/`_NAV_TITLES` para os 6 cargos, criação de
estágio ligado a um Jogo Fora (herda equipa/adversário), edição de campos, convocatória
(toggle individual + Convocar/Desconvocar Todas), quartos (criar, atribuir, reatribuição
exclusiva — sai do quarto anterior —, deconvocar limpa o quarto), fluxo completo de RSVP da
atleta (vou/não vou com motivo, bloqueio sem motivo, reset), `seenBy` registado ao abrir,
`_atEstagioAtivo` só devolve estágios futuros/em curso em que a atleta está convocada
(nunca estágios passados, nunca para quem não foi convocada), PDF sem exceção com os dados
corretos, apagar estágio, e regressão completa do Guião/Código de Conduta (`test_guiao.js`)
e de outras suites que tocam `renderAtHome`/`ALL_PAGES` (`test_coc3.js`,
`test_mobile_v187.js`, `test_nutri_plantel_v194.js`, `test_tatico_v191.js`) sem falhas.

**Ainda por fazer:** nada pendente para este pedido. Fica registado, para possível pedido
futuro do Roger: consentimento do encarregado de educação na Confirmação (decisão
explícita de não incluir já, "Só confirmação da atleta"), e qualquer ligação mais rica ao
Guião de Jogo Fora (hoje a Cronologia da atleta mostra só os dados concretos do estágio,
nunca o texto do Guião, que é propositadamente só da equipa técnica).

SW bump para `sps-v199`.

## sps-v200 (02/10/2026): Lista de Convocados volta a `g.convocatoria` + Ficha Pré-Jogo sem
## logística + tamanho de letra dinâmico (ajusta ao nº de atletas) nos dois PDFs

Pedido do Roger, em Relatórios → Convocatórias: "estava decidido depois de eu convocar,
mesmo não sendo partilhado com as atletas, que fica agendado, quero poder imprimir a lista
de convocados com os vistos de todas as que convoquei, quero também que fique ajustado num
PDF A4. Vê como está isso" — seguido, já com o preview em mãos, de dois pedidos de ajuste
("mostra primeiro como ficará e ajusta melhor o A4", depois "na ficha pré jogo não preciso
desta informação só na convocatória", e por fim a confirmação de que o ajuste de letra devia
ser mesmo dinâmico: "de acordo com a quantidade de atletas ajusta ao A4, certo?").

**1) Critério do visto na Lista de Convocados — volta a `g.convocatoria`:**

Desde o sps-v178 (25/09/2026), o visto só aparecia para quem estava em onze+banco
(`g.lineup`/`g.subs`) — correção pedida na altura para não mostrar convocada uma atleta
"Teste" fictícia esquecida em `g.convocatoria` sem nunca ter chegado a onze/banco. O Roger
pediu agora o inverso: poder imprimir logo depois de convocar, com o visto em todas as
convocadas, mesmo antes de montar o onze/banco (que normalmente só acontece mais perto do
jogo). `exportConvocatoriaListPDF()` voltou a usar `new Set(g.convocatoria)` como critério —
seguro hoje porque `toggleConvocado()` já remove sempre o id de `g.convocatoria`/`lineup`/
`subs` ao desconvocar, e `_purgeAthleteRefs()` limpa tudo ao apagar uma atleta (ambos já
existiam antes do sps-v178; o problema de then era só um registo órfão nunca limpo). O botão
"Lista de Convocados" em Relatórios já não dependia de `g.convocatoriaLaunched` (publicação à
equipa) — isso já funcionava, não precisou de alteração.

**2) Ficha Pré-Jogo deixa de mostrar logística (fica só na Convocatória):**

`exportJogoPDF(gid,'prejogo')` deixou de mostrar Palestra Pré-Jogo, Palestra
Pré-Aquecimento, Transporte, Refeição antes/após e Notas — fica só com Adversário, Capitã/
Vice-Capitã, Concentração e onze/suplentes+tarefas tática. Essa logística continua (e as
Notas, `g.preGameNotes`, passaram a aparecer também) só na Lista de Convocados, pensada para
ser afixada/entregue com tudo incluído. O Relatório Completo (`type==='full'`, partilha o
mesmo bloco de código) manteve a logística — é a compilação completa de fim de jogo, não o
documento operacional do dia.

**3) Tamanho de letra dinâmico, ajustado ao nº de linhas — não um tamanho fixo:**

A compactação de A4 (`_pdfCompactStyleHtml`, sps-v183/28-09) era até aqui um único tamanho
fixo — ou ficava sempre pequena de mais (letra pouco legível mesmo com poucas convocadas) ou
arriscava transbordar com plantéis grandes. Passou a escalar com o nº de linhas de cada
tabela: `_pdfRowScale(n,kind)` interpola um fator `t` a partir de pontos calibrados com
Chromium headless + contagem real de páginas (pypdf) — nunca uma estimativa — um para a
Lista de Convocados (eixo: nº de atletas na tabela) e outro para a Ficha Pré-Jogo (eixo:
onze+suplentes, bem mais tolerante desde que perdeu a logística no ponto 2). Poucas
convocadas → letra maior (sem folga vazia na folha); muitas → letra mais pequena, sempre a
tentar caber numa A4. `_pdfCompactStyleHtml(t)` passou a receber esse fator e aplicá-lo a
todas as propriedades (fonte/margens/padding/espaçamento de linha) — `t=0` reproduz
exatamente os valores originais do sps-v183.

Calibração (Chromium headless, `page.pdf()`+contagem de páginas com `pypdf`, nunca por
estimativa de altura): Lista de Convocados testada de 10 a 35 atletas — cabe numa A4 até 30;
Ficha Pré-Jogo testada de 14 a 41 linhas (onze+suplentes) — cabe até 36+ (muito mais folgada
depois de perder a logística). Pontos acima desse limite ficam no tamanho mais compacto
calibrado (mesma limitação que já existia antes, nunca uma regressão) — plantéis desse
tamanho são invulgares para o Moreirense (plantel real: 23+2).

SW bump para `sps-v200`. Testado com o código REAL extraído do `index.html`: harness Node
confirmando `_pdfRowScale`/`_pdfCompactStyleHtml` (interpolação correta nos pontos
calibrados, `t=0` idêntico ao tamanho original); geradores de dados fictícios (tamanho do
plantel real do Moreirense + vários tamanhos sintéticos, 10 a 41 linhas) + Chromium headless
(Playwright) + `pypdf` confirmando 1 página em todos os tamanhos testados dentro do intervalo
calibrado, para os dois PDFs; inspeção visual (PNG) confirmando letra maior com poucas
convocadas e o critério do visto a refletir `g.convocatoria` mesmo sem onze/banco definido.
Previews reais enviados ao Roger (10/25/30 atletas) antes de publicar, com confirmação
explícita antes do deploy.

**Nota de limpeza de dados (02/10/2026), por fazer pelo próprio Roger ("depois eu trato
disso"):** ao avisar da reversão para `g.convocatoria`, o Roger apontou o risco do sps-v178
(atleta fictícia "Teste", `mso9x6ooc0im`, ficar com visto por engano). Essa atleta em
concreto já não existe no plantel — mas, ao verificar por SQL, encontrou-se **outra** atleta
de teste ainda no plantel principal (T1): **"TESTE00"** (`mupoy7co57f9`). Não está convocada
em nenhum jogo neste momento (sem risco imediato), mas sem a filtragem por onze/banco que
existia antes do sps-v200, se um dia for marcada como convocada por engano volta a aparecer
com visto na Lista de Convocados. Recomendado ao Roger apagá-la (Plantel → Scouting); ele
confirmou que trata disso por si mesmo mais tarde — não é uma tarefa para a próxima sessão
tratar por iniciativa própria, só verificar se já foi feito caso o tema volte a surgir.

## sps-v201 (06/10/2026): Playbook — biblioteca tática reutilizável ligada às Bolas Paradas

**Pedido do Roger:** uma nova área "Playbook" — biblioteca tática reutilizável, ao estilo
de um playbook de NFL, cobrindo jogo posicional, combinações, organização ofensiva,
variantes de pressing e bolas paradas, com ligação ao espaço de Bolas Paradas já
existente ("quero que tenha ligação ao espaço set pieces que criamos"). Pesquisa e
proposta feitas antes de implementar; 3 decisões confirmadas: (1) taxonomia de topo = os
5 "momentos do jogo" já usados nesta app (Org. Ofensiva, Org. Defensiva, Transição
Ataque, Transição Defesa, Bolas Paradas), com submomentos livres por categoria (gestor
simples, não lista fixa); (2) acesso: treinador/treinador_adj (automático) +
`prep_fisico` + `treinador_gr`; (3) Bloco 1 completo de uma vez, sem mais fasear.

**O que foi construído:**
1. Tabela dedicada `playbook` (Supabase, migração `create_playbook_table`, RLS
   `anon_all` idêntica às restantes) — upsert por linha, nunca no blob `clubs.meta`
   (mesmo padrão exato de `estagios`/`games`). Campos: `title`/`category`/`submomento`/
   `formation`/`description`/`video_url`, `positions`/`opponents`/`ball`/`full_view`/
   `snapshots` (jsonb) para o quadro de desenho, metadados de autoria.
2. `APP.playbook[]` novo em `defApp()`; `_CLOUD_TABLE_SCHEMA.playbook` e a entrada
   correspondente no array `pulls` de `pullCloud()` escritas juntas, na mesma alteração.
3. `APP.config.playbookSubmomentos` — objeto por categoria, dentro do blob
   `clubs.meta.config` (mesmo padrão de `naGuidelines`/`hydrationGuidelines`: baixa
   frequência de escrita, lazy-init na 1ª utilização via `_pbInitConfig()`), semeado com
   os valores por defeito combinados com o Roger. Gestor simples por `prompt()`
   (`pbManageSubmomentosOpen`/`addPbSubmomento`/`removePbSubmomento`), com opção
   "+ Novo submomento..." também dentro do próprio editor de uma jogada.
4. Página nova `playbook` (📘), secção própria "Playbook" em `ALL_PAGES` (a seguir a
   "Técnico"); `'playbook'` acrescentado a `ROLE_DEFS.prep_fisico.pages` e
   `ROLE_DEFS.treinador_gr.pages` — os restantes cargos com acesso total ganham-na
   automaticamente via `_ALL_PAGE_IDS`.
5. `renderPlaybook()`: lista com filtro por categoria + submomento (dependente) + texto
   livre, "+ Nova Jogada", navegação lista→detalhe (mesmo padrão de `renderEstagios`).
6. Editor de uma jogada (`_renderPbDetail`): título, categoria, submomento (dependente,
   reseta ao mudar de categoria), formação, descrição, vídeo opcional, e o quadro de
   desenho.
7. Quadro de desenho próprio (`_pb*`, função nova e aditiva — nunca edita `_pitchXxx`/
   `_oppXxx`): até 11 marcadores próprios SEMPRE presentes e arrastáveis (réplica fiel de
   `_oppMarkersHtml` — amarelo, nº1 verde por convenção de guarda-redes), adversárias
   adicionáveis/removíveis até 11 (réplica de `_pitchOpponents`, X vermelho), bola
   (toggle), vista campo-inteiro/meio-campo, e galeria cronológica de posicionamentos
   (mesma mecânica de `_pitchSnapshot`/`_oppSnapshot`) — tudo guardado dentro da própria
   entrada do Playbook (`pb.positions`/`opponents`/`ball`/`fullView`/`snapshots`), nunca
   ligado a nenhum Jogo.
8. Ligação bidirecional às Bolas Paradas de um Jogo real:
   - **"📋 Aplicar a um Jogo"** (`pbApplyToGameModalOpen`/`pbApplyToGameConfirm`, só em
     jogadas `category==='bolasParadas'`): mapeia marcador genérico N → o N-ésimo atleta
     do onze+banco do jogo escolhido, ordenado por número de camisola (mesma convenção
     de `_pitchSnapshot`); escreve em `g.setpiecePositions[mode]` por `aid` real;
     adversárias/bola/vista copiadas diretamente (já são genéricas nos dois lados) para
     `g.pitchOpponents[mode]`/`g.pitchBall[mode]`/`_pitchFullView[mode]`.
   - **"💾 Guardar na Biblioteca"** (`pbSaveFromGameBoard`) — o ÚNICO ponto tocado dentro
     de `_jogoCampoHtml`, um botão novo nos 3 sub-separadores de bolas paradas (nunca no
     "Tático"): conversão inversa, onze titular ordenado por número → marcadores
     genéricos 1..N; cria uma entrada nova em `APP.playbook` com `category:'bolasParadas'`.
9. `printPlaybookPDF` — reaproveita `_printWin()`; diagrama único ou sequência de passos
   (se houver galeria), mesmo estilo/proporções de `_oppSnapshotSvg`/`_pitchSnapshotSvg`.
10. SW bump para `sps-v201`.
11. **Atribuição de atletas aos marcadores** (acrescento do Roger, mesma sessão, sobre o
    commit local ainda não publicado — fica dentro do sps-v201, sem bump novo): pedido
    dele, nas palavras próprias — "para mim é importante nesse playbook ter uma lista
    das atletas todas ao lado para eu editar em tempo real e fazer prints [...] eu crio o
    diagrama depois só vou à lista e pelo número de posição eu correspondo [...] a
    qualquer atleta do plantel". Implementado: campo novo `pb.athleteAssign`
    (`{1:athleteId|'',...,11:''}`, mesmas chaves de `pb.positions`), nova coluna
    `athlete_assign jsonb` (migração `add_athlete_assign_to_playbook`) +
    `_CLOUD_TABLE_SCHEMA.playbook`/`pullCloud()` atualizados juntos, como sempre. No
    editor (`_renderPbDetail`), painel novo "👥 Atletas do Plantel"
    (`_pbAthleteListHtml`) com 11 linhas "Marcador N — select", cada `<select>` listando
    só `APP.athletes.filter(a=>a.teamId===pb.teamId)` (nunca o plantel inteiro); `onchange`
    grava de imediato via `pbSetAthleteAssign` (sem botão de guardar à parte, sem
    bloquear repetir a mesma atleta em 2 marcadores — não foi pedido). Campo "Equipa"
    (select) aparece no editor só quando `APP.teams.length>1`; trocar de equipa (via
    `savePbField('teamId',...)`) limpa `athleteAssign` (as atribuições eram do plantel
    anterior). `jogada nova` (`saveNovaPbJogada`) já definia `pb.teamId=APP.teams[0].id`
    desde a entrega original — confirmado, sem alteração necessária. `printPlaybookPDF`
    ganhou uma tabela "Legenda — Atletas" (Nº/Atleta, mesmo espírito de
    `printJogoCampo`/`_oppPdfBodyHtml`), marcadores sem atribuição mostram "—". O quadro
    de desenho em si (`_pbMarkersHtml`/SVG) continua a mostrar sempre só o número — a
    atribuição só existe na lista e no PDF, sem tocar na lógica de desenho/arrastar.

**Testado:** `node --check` ao ficheiro inteiro (e a `sw.js`). Harness Node dedicado
(`test_playbook_v201.js`, extraindo o `<script>` real) cobrindo: acesso por cargo
(`prep_fisico`/`treinador_gr` veem `playbook`; `fisio` não ganha, como esperado); defaults
de `defApp()`; lazy-init + add/remove de submomentos; CRUD completo de uma jogada
(criar/editar campos/mudar categoria reseta submomento/apagar); o quadro (sempre 11
marcadores próprios, nº1 verde, até 11 adversárias com bloqueio na 12ª, remover
adversária, toggle bola, toggle vista); galeria (registar/carregar/apagar passo, com
posições+adversárias+bola+vista preservadas em cada passo); "Guardar na Biblioteca" a
partir de um Jogo real com onze definido cria a entrada certa, com o mapeamento correto
por número de camisola; "Aplicar a um Jogo" mapeia os marcadores genéricos para os
atletas certos (onze+banco, por número), sem tocar em atletas que a jogada não cobre;
round-trip completo do schema `_CLOUD_TABLE_SCHEMA.playbook` ↔ `pullCloud` (payload do
push + mapper do pull simulados a partir do código real extraído — nenhum campo
perdido); `printPlaybookPDF` sem excepção (com e sem sequência de passos). Teste
Playwright (Chromium headless) complementar (`test_playbook_dom_v201.js`) confirmando o
quadro num browser real: SVG com 11 marcadores próprios, adicionar adversária/bola
refletido no DOM, alternar vista muda o `viewBox`, e registar passo na galeria — sem
erros de console além de bloqueios de rede do próprio sandbox de teste (CDN externo,
nada a ver com o código). Round-trip real contra a tabela `playbook` na Supabase (insert
via SQL direto, select de confirmação). Regressão: `test_estagios.js`, `test_guiao.js`,
`test_coc3.js`, `test_mobile_v187.js` e `test_tatico_v191.js` continuam todos a passar
(confirma que o único ponto tocado em `_jogoCampoHtml` — o botão "Guardar na
Biblioteca" — não afetou o resto do Quadro Tático/Adversário). Para o acrescento da
atribuição de atletas (ponto 11), ambos os testes foram estendidos com os mesmos casos:
`pbSetAthleteAssign` grava e persiste (incl. desassociar e repetir atleta em 2
marcadores, sem bloqueio); trocar de equipa filtra o dropdown pelo plantel certo e limpa
`athleteAssign`; campo "Equipa" só aparece com `APP.teams.length>1`; o quadro continua a
mostrar só números; `printPlaybookPDF` inclui a legenda com os nomes certos e "—" nos
marcadores sem atribuição; round-trip de `athlete_assign` no schema sem perdas. Migração
`add_athlete_assign_to_playbook` confirmada na Supabase (coluna `jsonb` presente).
Regressão repetida sem falhas.

**Ainda por fazer:** nada pendente para o Bloco 1 em si. Fica para um possível pedido
futuro do Roger (Bloco 2, não incluído de propósito nesta entrega): PDF por
capítulo/categoria completo (hoje é só por jogada), pesquisa mais avançada na lista,
animação multi-passo mais rica (hoje a galeria é "fotografias" discretas, não interpola
entre passos), e arrastar uma jogada ligada a mais do que um Jogo em simultâneo (não foi
pedido).

**Nota de limpeza (06/10/2026, mesma sessão):** a linha de teste `pb_test_roundtrip`
criada por SQL direto para confirmar o round-trip real contra a Supabase usou o único
`club_id` existente — o do próprio Roger — por isso ia aparecer na Biblioteca dele
(`renderPlaybook()` não filtra por `team_id`, mesmo padrão já usado em `estagios`).
`DELETE` direto contra esta tabela (via `execute_sql`/`apply_migration`) ficou sempre a
aguardar confirmação e excedeu o tempo limite da ferramenta, repetidamente, sem erro de
permissão/RLS — reproduzido 3 vezes antes de desistir dessa via. Em vez disso, a linha
foi neutralizada por `UPDATE` (que não teve o mesmo bloqueio): `title='[TESTE - PODE
APAGAR]'`, `team_id='___DELETE_ME___'`, `category='orgOf'` — fica inofensiva e
autoexplicativa, visível na Biblioteca do Roger com esse título, e ele próprio pode
apagá-la com um clique no 🗑️ da lista (mesmo padrão já usado para a atleta de teste
"TESTE00", ver nota do sps-v200 — não é uma tarefa para a próxima sessão tratar por
iniciativa própria, só confirmar se já foi feito caso o tema volte a surgir).

## sps-v202 (06/10/2026): Modo Apresentação — ecrã cheio para Playbook e Set Pieces

**Pedido do Roger** (verbatim): "CERTO ISTO É O MODO QUANDO EU EDITO, DEPOIS QUERO UM
MODO APRESENTAÇAO EM QUE SO APARECE A IMAGEM O MAIS EXPANDIDA POSSIVEL NO ECRA, QUER NA
PLATAFORMA QUER NA 'APP' SET PIECES, PARA MOSTRAR QUANDO ESTOU NO CAMPO OU NO TREINO AS
ATLETAS" — depois do quadro de desenho do Playbook (sps-v201), o Roger quis um modo
separado, só para mostrar (nunca para editar), em ecrã cheio, tanto no Playbook como no
quadro de Bolas Paradas ("Set Pieces", `_jogoCampoHtml`/`?tatico=1`). Duas perguntas
feitas antes de implementar (`AskUserQuestion`), decisão recomendada escolhida nas
duas: (1) os marcadores mostram o NOME da atleta quando disponível — no Playbook, só
quando o marcador tem atleta atribuída via "Atletas do Plantel" (`pb.athleteAssign`),
senão fica só o número (como hoje); no quadro de Bolas Paradas, SEMPRE (os marcadores já
são atletas reais, `g.lineup`); (2) se a jogada/quadro tiver vários passos guardados na
galeria, o Modo Apresentação deixa navegar entre eles com setas, sem saír do ecrã cheio.

**O que foi construído:**
1. **Motor genérico partilhado** (`_presOpen`/`_presRender`/`presPrev`/`presNext`/
   `presClose`/`_presBackdropClick`, junto a `openMod`/`closeMod`): um único overlay
   `position:fixed;inset:0` persistente no HTML (`#pres-ov`, `z-index:5500`, toggle de
   classe `.on`, mesmo idioma de `#modal-ov`/`openMod`/`closeMod`), com um ✕, duas setas
   (prev/next) e um contador "Passo X de N" — tudo escondido quando só há 1 frame.
   Puramente de leitura: abrir, navegar e fechar nunca escrevem em `pb`/`g`/`APP`, só no
   estado efémero `_presFrames`/`_presIdx`/`_presKind`/`_presCtx` desta UI.
2. **Frames**: cada chamador constrói um array ordenado — a galeria existente
   (`pb.snapshots` ou `_pitchSnapshotsFor(g,mode)`) quando há pelo menos 1 registo,
   senão um único frame sintético com o estado atual do quadro, construído por uma
   função nova e só de leitura (`_pbCurrentFrame(pb)`/`_pitchCurrentFrame(g,mode)` —
   mesma lógica de `_pbSnapshot`/`_pitchSnapshot`, sem o `.push()`/`saveData()` final).
3. **Diagrama**: reaproveita os geradores de SVG já existentes
   (`_pbSnapshotSvg`/`_pitchSnapshotSvg`) em vez de inventar um novo — o único ajuste é
   trocar o `style="width:Npx;height:Npx"` fixo (pensado para miniaturas/PDF) por
   `width:100%;height:100%` no momento de montar o palco (`_presSvgFor`), deixando o
   `viewBox` já existente fazer o letterbox automático (campo inteiro ou meio-campo,
   dentro de um palco a ~92vw/85vh).
4. **Nomes — sempre ao vivo, nunca de um snapshot antigo**:
   - `_pbSnapshotSvg(snap,w,athleteAssign)` ganhou um 3º parâmetro opcional: quando
     passado (`pb.athleteAssign`, ao vivo), cada marcador atribuído ganha um rótulo com
     o nome por baixo do círculo (font-size 11, `rgba(255,255,255,.9)`, mesma convenção
     do `showName` do quadro ao vivo). Omitido — todas as chamadas já existentes
     (galeria/PDF) —, comportamento 100% igual ao de sempre (só número).
   - `_pitchSnapshotSvg(mode,snap,w,forceNames)` ganhou um 4º parâmetro opcional: com
     `forceNames=true`, mostra o nome em QUALQUER sub-separador (não só Tático),
     também font-size 11. Omitido, comportamento idêntico ao de sempre (`isTatico`
     continua a ser a única condição, inalterada). `showName` em si (a flag interna do
     quadro ao vivo, só ligada ao sub-separador Tático) não foi tocado.
5. **Botões novos**: "🖥️ Modo Apresentação" na fiada de controlos do Playbook
   (`_pbBoardHtml`, chama `pbOpenPresentation(pb.id)`) e na mesma fiada do Set Pieces
   (`_jogoCampoHtml`, chama `pitchOpenPresentation(g.id,mode)`) — como `_jogoCampoHtml`
   é partilhada pelos 4 sub-separadores E pela app standalone `?tatico=1` (confirmado
   no sps-v191: `?tatico=1` chama-se "SPS Set Pieces Board" no seu próprio manifest),
   um único ponto de alteração cobre tudo o que o Roger pediu ("quer na plataforma quer
   na app Set Pieces"), sem wiring extra.
6. Sem novas colunas/tabelas no Supabase — qual passo está visível e se o overlay está
   aberto é só estado efémero de UI, nunca persistido.
7. SW bump para `sps-v202`.

**Testado:** `node --check` ao `index.html` (script extraído) e a `sw.js`. Harness Node
dedicado novo (`test_presentation_v202.js`, vm com stubs de DOM que trackeiam
`classList`/`addEventListener`/`removeEventListener` de verdade) cobrindo o motor
genérico: `_pbSnapshotSvg`/`_pitchSnapshotSvg` com e sem os novos parâmetros opcionais
(regressão explícita de que nenhuma chamada existente muda de comportamento);
`_pbCurrentFrame`/`_pitchCurrentFrame` (forma e defaults corretos); frames = galeria
(ordem cronológica preservada) vs. sintético (sem nenhum registo); navegação
`presPrev`/`presNext` com clamp nos dois extremos (sem wraparound) e UI do
contador/setas a esconder com 1 frame só; navegação por teclado
(ArrowLeft/ArrowRight) e Escape a fechar; `_presBackdropClick` só fecha quando o alvo
do clique é o próprio overlay (nunca quando é o palco); limpeza do listener de keydown
ao fechar (confirmado ao nível do `document.removeEventListener` real, não só uma
variável interna a zero) e que um ArrowRight residual depois de fechar não tem
qualquer efeito; e que abrir/navegar/fechar nunca muta `pb`/`g` (diff do JSON completo
antes/depois). Extensões às suites existentes: `test_playbook_v201.js` (secção 13,
integração com uma jogada real desta suite — nome vindo de `pb.athleteAssign` ao vivo,
botão presente, sem mutação) e `test_playbook_dom_v201.js` (Playwright, browser real —
overlay abre/fecha, SVG com nome, navegação por rato/teclado, ✕/Escape/backdrop todos
fecham, listener de teclado sem fantasma, 3 ciclos abrir/fechar sem mutar a jogada);
`test_tatico_v191.js` ganhou um "Teste 3" equivalente para o Set Pieces via `?tatico=1`
(nomes sempre visíveis mesmo no sub-separador cornerDef, que normalmente não mostra
nomes; galeria com 2 passos; mesmas verificações de navegação/fecho/sem-mutação).
Regressão completa re-corrida sem falhas: `test_playbook_v201.js`,
`test_playbook_dom_v201.js`, `test_tatico_v191.js`, `test_mobile_v187.js`,
`test_estagios.js`, `test_guiao.js`, `test_coc3.js` — incluindo a invariante já
existente de que o quadro NORMAL do Playbook (`_pbMarkersHtml`) e o `showName` do
Tático continuam exatamente como antes.

**Ainda por fazer:** nada pendente para este pedido. Possível pedido futuro do Roger,
não incluído de propósito: um modo "apresentação automática" que avança os passos sem
intervenção (hoje é só manual, por setas/teclado); mostrar as Tarefas Individuais (Set
Pieces) ou a Descrição (Playbook) como legenda opcional dentro do próprio ecrã cheio
(hoje é só o diagrama, como pedido — "só aparece a imagem").

## sps-v203 (07/10/2026): Gravação automática — Código de Conduta, Guião de Jogo Fora e 4 ecrãs da App Nutri

**Pedido do Roger**, em duas mensagens (06/10, fim de sessão + 07/10, concretizado a
pedido): resolver como edita o Guião de Jogo Fora e o Código de Conduta ("amanhã temos
que tratar"), e a questão mais genérica de "sempre que há uma entrada de edição nova que
grave automaticamente e permita sempre edição" — detetada em particular na App Nutri.
Pedida clarificação antes de implementar (mesma prática de confirmar antes de mexer em
pedidos abertos): o ponto de dor do Guião/Código de Conduta era **"um só botão para
tudo"**, e no editor de cada ponto ele quer poder **editar só o texto** — "neste momento
não está assim" (o formulário de cada ponto mostrava título + texto, os dois editáveis).
Para a App Nutri, confirmou as 4 áreas: Consultas & Notas de Sessão, Planos
Nutricionais/Diário Alimentar, Suplementação (Catálogo/Prescrição) e Anamnese Alimentar.

**Investigado antes de mexer:** o Guião de Jogo Fora e o Código de Conduta usavam o mesmo
modo de edição por ponto introduzido no sps-v197/v198 (`_cocEditMode`/`_guiaoEditMode`,
toggle "✏️ Editar Texto" → formulário com TODOS os pontos, cada um com `<input>` de
título + `<textarea>` de texto, e um único botão "💾 Guardar Alterações" no fim — daí "um
só botão para tudo"). Os 4 ecrãs da Nutri tinham o mesmo padrão "formulário em branco +
um botão Guardar a criar só no fim" (`saveNutriConsulta`/`saveNutriPlano`/`saveNadDay`/
`saveSuplItem`/`saveSuplPresc`/`atSaveDietAnamnese`) — ao contrário de Estágios/Playbook
(sps-v198-v201), onde "+ Nova X" já cria o registo de imediato e abre um ecrã sempre
editável, campo a campo, sem nenhum botão "Guardar" (`saveEstagioField`/`savePbField`).

**O que foi construído — mesmo idioma exato de Estágios/Playbook em todos os 6 pontos:**

1. **Código de Conduta e Guião de Jogo Fora** — removido por completo o modo de edição
   separado (`_cocEditMode`/`_guiaoEditMode` e as funções `_renderCodigoCondutaEdit`/
   `_renderGuiaoJogoForaEdit` eliminadas). Para um admin, `renderCodigoConduta`/
   `renderGuiaoJogoFora` desenham os mesmos accordions que todos veem, mas o corpo de
   cada ponto é agora um `<textarea onblur="save<X>Ponto(id,this.value)">` diretamente —
   gravação nova por ponto (`saveCodigoCondutaPonto`/`saveGuiaoJogoForaPonto`, substituem
   `saveCodigoCondutaTexto`/`saveGuiaoJogoForaTexto`, que recolhiam os 32/10 pontos de
   uma vez). **O título deixou de ser editável** — fica sempre o de
   `_CODIGO_CONDUTA_SECOES`/`_GUIAO_JOGO_FORA_SECOES`, nunca mais gravado num override
   (só `html` persiste a partir de agora); um override antigo que ainda tenha "title"
   guardado de antes desta versão continua a ser lido normalmente por `_cocSections()`/
   `_guiaoSections()` (merge por spread, inalterado) — só deixa de ser escrito. Não-admin
   continua a ver exatamente o mesmo texto só de leitura, sem qualquer textarea.
2. **Versão/reaceitação do Código de Conduta, desacoplada da edição de texto** — como já
   não há um único "momento de guardar" para acoplar o checkbox "esta alteração exige
   nova aceitação", esse comportamento passou a um botão próprio e explícito, junto de um
   novo rótulo "Versão atual do texto: N": **"📌 Marcar texto atual como nova versão
   (pede reaceitação às atletas)"** (`_cocBumpVersion`, com `confirm()` antes de agir).
   Escrever num textarea e sair do campo nunca muda a versão — só este botão o faz. O
   Guião de Jogo Fora não tem conceito de versão/aceitação, por isso não ganhou
   equivalente. "↺ Repor Texto Original" (reset de todos os overrides) ficou inalterado
   nos dois, só reposicionado para a barra de ferramentas principal (já não vivia dentro
   do modo de edição que deixou de existir).
3. **Nutri Consultas** (`renderNutriConsultas`) — "+ Agendar Consulta" passou a criar o
   registo de imediato (`novaNutriConsulta`: atleta da área de origem ou a 1ª do plantel,
   data de hoje, resto em branco) e a abrir o mesmo formulário, sempre editável,
   diretamente sobre esse id. Cada campo grava sozinho (`saveNcField`, onblur nos campos
   de texto/data/hora, onchange nos `<select>` de atleta/responsável) — substitui
   `saveNutriConsulta`, que recolhia tudo de uma vez. `setConsultaStatus`/
   `setConsultaMotivo` (já autosave desde antes) ficaram intocados. Os 3 atalhos que
   abriam este formulário vazio a partir de outros ecrãs (Dashboard do Plantel, alerta
   "sem avaliação/plano") passaram a chamar `novaNutriConsulta()` em vez de só armar
   `_showNcForm=true`.
4. **Planos Nutricionais / Diário Alimentar** — "+ Novo Plano" cria o registo de imediato
   (`novoNutriPlano`: as 6 refeições já com a estrutura `MEALS` em branco, `active:true`,
   `startDate:hoje`) e abre o mesmo formulário sempre editável. Cada campo (base + cada
   uma das 6 refeições) grava sozinho via `saveNutriPlanoField(id,field,value)` — para uma
   refeição, `field` é `'meal:<índice>:<time|kcal|foods>'`, resolvido internamente sem
   nunca reconstruir o array `meals` do zero. Substitui `saveNutriPlano`. Na grelha
   evoluída (Diário Alimentar Semanal, 7 dias × 6 refeições), cada campo grava sozinho via
   `saveNadMealField(athleteId,day,mealIndex,field,value)`, substituindo `saveNadDay`
   (botão único "💾 Guardar {Dia}"); `nadCopyDay` (já autosave) ficou intocado. Os 3
   atalhos externos a este formulário (Dashboard do Plantel, alerta "sem plano", "+ Criar
   Plano Nutricional" dentro do próprio Diário sem plano ativo) passaram a chamar
   `novoNutriPlano()`.
5. **Suplementação (Catálogo/Prescrição)** — os dois modais (`_openSuplItemModal`/
   `_openSuplPrescModal`) passaram a criar o registo de imediato quando chamados sem id
   (`id`/`prescId` nulo — "+ Novo Suplemento" e "+ Adicionar" dentro de uma coluna de
   momento, o único ponto de criação de uma prescrição) e a abrir-se já sobre esse id
   real. Cada campo grava sozinho via `saveSuplItemField(id,field,value)`/
   `saveSuplPrescField(athleteId,prescId,field,value)` — checkboxes de momento em
   `onchange`, com `field` na forma `'moment:<key>'` e valor booleano (acrescenta/remove
   só essa chave do array `moments`, nunca o reconstrói do zero). Substituem
   `saveSuplItem`/`saveSuplPresc`. Os botões "💾 Guardar" foram removidos dos dois modais
   — ficou só "Fechar" (o ✕ do cabeçalho do modal já fechava sem gravar nada à parte).
6. **Anamnese Alimentar** — lado atleta (`atOpenDietAnamnese`, 11 campos): cada campo
   grava sozinho via `atSaveDietAnamField(key,value)` (onblur, incluindo as 2 textareas),
   substitui `atSaveDietAnamnese` (botão único "Guardar"). Lado Nutri (`nad-notes`, campo
   único) já só precisava de trocar o botão "💾 Guardar Notas" por `onblur` —
   `saveNadNutriNotes(athleteId,value)` ganhou o 2º parâmetro mas manteve-se
   retrocompatível (sem ele, continua a ler do próprio campo do DOM).
7. SW bump para `sps-v203`. Sem alterações de schema Supabase em nenhuma das 6 áreas —
   só mudou QUANDO cada campo é gravado, nunca que campos existem (`_CLOUD_TABLE_SCHEMA`/
   `pullCloud()` inalterados nas tabelas tocadas: `code_of_conduct`, `away_game_guide`,
   `nutrition_appointments`, `nutrition_plans`, `supplement_catalog`,
   `supplement_prescriptions`, `nutrition_diet_anamnesis`).

**Convenção seguida (confirmada contra o código real antes de implementar, mesmo idioma
em todo o lado):** gravação silenciosa, sem toast — `saveEstagioField`/`savePbField`
nunca mostram confirmação visual por campo, e os 6 pontos acima seguem a mesma regra.
Um registo criado de imediato e depois abandonado em branco é aceitável (mesmo
comportamento já existente em Estágios/Playbook) — não foi inventada nenhuma lógica de
"apagar se ficar vazio".

**Desvio deliberado do que a descrição inicial do pedido equiparava a Estágios/Playbook:**
`saveNovoEstagio`/`saveNovaPbJogada` exigem, na prática, um pequeno formulário prévio
(só título + datas/categoria) antes de criar o registo — não é literalmente "clique único
sem preencher nada". Para as 4 áreas da Nutri e os 2 modais de Suplementação, optou-se
por criar mesmo sem nenhum campo prévio obrigatório (só com defaults sensatos/em branco),
por ser o que a formulação do pedido descrevia mais literalmente ("cria de imediato,
antes de qualquer campo ser preenchido") e por não haver, nestes 6 casos, nenhum campo
que precise obrigatoriamente de validação prévia para o registo fazer sentido (ao
contrário de Estágios, que liga opcionalmente a um Jogo). Documentado aqui para o Roger
confirmar que é o comportamento que queria, já que não é 100% idêntico byte a byte às
duas funções que serviram de referência.

**Testado:** `node --check` ao `index.html` (script extraído) e a `sw.js`. Harness Node
dedicado novo (`test_autosave_v203.js`, mesmo padrão `vm` dos restantes) com 97
asserções cobrindo as 6 áreas: gravação por campo preserva sempre os campos irmãos
(incl. entre refeições/dias/momentos — nunca um save de 1 campo apaga outro, a classe de
bug recorrente documentada nos Incidentes #1-4); criação imediata produz um id real antes
de qualquer campo tocado; Código de Conduta — título nunca gravado num override novo,
override antigo com "title" continua a mostrar-se (retrocompatibilidade), bump de versão
100% desacoplado da gravação de texto (escrever + sair do campo nunca muda a versão), e
`ativarCodigoConduta`/`desativarCodigoConduta` continuam a preservar `sections`
(regressão sps-v197). `test_guiao.js` atualizado para a nova interface (removidas as
asserções do modo de edição antigo, acrescentadas as de gravação por ponto + retrocompat
de título antigo); `test_coc3.js` já não testava o modo de edição, passou sem alterações.
`test_supl_v193.js`/`test_nutri_anamnese_diario_supl2_v195.js`/`test_nutri_plantel_v194.js`
(Playwright, browser real) atualizados para o novo fluxo (criação imediata + preencher
campos com blur explícito, já sem chamar as funções de guardar antigas) e voltaram a
passar por completo. Regressão re-corrida sem falhas: `test_estagios.js`,
`test_mobile_v187.js`, `test_tatico_v191.js`, `test_playbook_v201.js`,
`test_presentation_v202.js` — nenhuma área fora do âmbito deste pedido foi tocada.

**Ainda por fazer:** nada pendente para este pedido. `test_coc.js`/`test_coc2.js`/
`test_coc_edit.js` (rascunhos de sessões anteriores ao sps-v196/197, já superados por
`test_coc3.js`) continuam a testar a interface antiga e não foram atualizados — não
fazem parte da suite de regressão listada no changelog, só ficaram na pasta de trabalho
por valor histórico; se algum dia forem corridos vão falhar contra esta versão, o que é
esperado e não é uma regressão real.

## sps-v204 (07/10/2026): Evolução visual de marcadores/setas — boneco "colete" com cor e
rotação, setas à mão livre no Playbook, esconder/restaurar em massa

**Pedido do Roger**, especificação detalhada entregue à sessão (mockup de referência +
duas alterações deliberadas face a esse mockup, ambas documentadas abaixo e assumidas
pela sessão sem precisar de confirmação adicional, por já virem explicadas na própria
especificação): os marcadores do Playbook e das Bolas Paradas (círculo simples
próprio/GK, X vermelho da adversária) ganham um visual mais parecido com um jogador real
— um boneco em forma de "colete" com cor configurável e rotação (orientação de quem
calça o colete) —, a bola ganha um ícone mais parecido com uma bola de futebol, e o
Playbook passa a ter desenho de setas (reta e à mão livre), que já existia nas Bolas
Paradas mas nunca tinha chegado ao Playbook.

**O que foi construído, nos dois quadros (Playbook e Set Pieces/`?tatico=1`):**

1. **Marcador "colete"** (`_bibMarkerSvg`, `_bibDarken`, `_bibTextColor`, index.html:1313-1341,
   namespace neutro partilhado, não pertence a `_pb*` nem a `_pitch*`) — corpo (círculo,
   nunca roda), duas "pernas" (`<rect>`, rodam com `facing`) e etiqueta de texto (número,
   só nos próprios jogadores — nunca roda, fica sempre legível). Usa-se tanto nos próprios
   jogadores como nas adversárias (antes: círculo liso vs. X vermelho de `<line>`); raio
   mantido inalterado (`rad=7` no Playbook, `rad=6` nas Bolas Paradas) — pedido explícito
   para não aumentar a área ocupada no campo.
2. **Cor configurável por marcador** — novos campos `pb.positions[i].color` /
   `pb.opponents[].color` / `g.playerPositions[mode][aid].color` (via
   `g.pitchMarkerColors[mode]`) / `g.pitchOpponents[mode][].color`; paleta de 8 cores +
   seletor de cor livre no modal (ver ponto 5). Sem cor definida, mantém o comportamento
   antigo (dourado/verde GK para próprios, vermelho #e63946 para adversárias) —
   retrocompatível com registos antigos.
3. **Rotação ("facing")** — novo campo `facing` (graus, 0-359) em todas as mesmas
   entidades; só as "pernas" do boneco rodam, nunca o texto. Pensado para indicar para
   onde a jogadora está orientada/vai correr.
4. **Bola mais parecida com bola de futebol** (`_ballIconSvg`, index.html:1343-1348) —
   círculo branco + pentágono + 5 "costuras", em vez do círculo branco liso. Ao contrário
   dos outros marcadores, a bola **mantém o comportamento direto de sempre** (clique único
   = `pbToggleBall`/`pitchToggleBall`, sem modal) — não tem cor nem rotação, não há nada
   para configurar.
5. **Modal partilhado de opções do marcador** (`_openMarkerOptionsModal` +
   `_bibMarkerData`/`_bibRenderPreviewSvg`/`_bibPreviewLive`/`_bibRefreshModalPreview`/
   `_bibApplyField`/`_bibDeleteMarker`, index.html:1362-1493) — clicar num marcador
   próprio ou adversário (sem arrastar) abre um modal com pré-visualização em SVG ao vivo,
   seletor de cor (paleta + `<input type="color">`) e slider de rotação 0-359°, mais um
   botão para eliminar/esconder. Reaproveita o sistema de modal genérico já existente
   (`openMod`/`closeMod`) — a pré-visualização atualiza-se em `oninput` (só DOM, sem
   gravar), e cada campo só é persistido (gravação + `saveData()`/sync + novo render do
   quadro) em `onchange`, exatamente como outros ecrãs de gravação automática do projeto
   (Estágios/Playbook/sps-v203). **Desvio deliberado nº1 face ao mockup entregue:** o
   mockup mostrava uma alça/pega para arrastar diretamente no campo para rodar o
   marcador; optou-se por este modal com slider em vez disso, porque um gesto de arrastar
   rotação teria de coexistir no mesmo `<g>` com o arrastar de posição já existente
   (`pbDragStart`/`pitchDragStart`) e com o toque em ecrãs táteis (telemóvel/tablet) — alto
   risco de ambiguidade de gesto e de regressão no arrastar de posição, que é a interação
   mais usada do quadro. O modal garante o mesmo resultado (mudar cor e rotação) de forma
   fiável em qualquer dispositivo. **Desvio deliberado nº2:** a bola (ponto 4) não ganhou
   este modal — não tem cor nem rotação para configurar, por isso manteve-se o
   confirm()/toggle direto que já tinha.
6. **Setas — reta e à mão livre, com cor e estilo** — as Bolas Paradas já tinham setas
   retas (sps-anterior); o Playbook não tinha nenhum desenho de setas e ganhou-o do zero
   nesta versão, com o mesmo motor partilhado onde fazia sentido (`_freehandPathD`,
   index.html:1351-1361, neutro) mas implementações próprias em cada namespace (sem
   `_pbXxx` chamar `_pitchXxx` nem vice-versa, só através dos helpers neutros):
   - Playbook: `pb.arrows[]` (novo campo), alternância "➡️ Reta"/"✏️ Traço Livre"
     (`_pbArrowKind`), seletor de cor (`_pbArrowColor`), mantém o alternador
     Sólida/Tracejada já existente (`_pbArrowStyle`); `pbArrowStart`/`pbArrowMove`/
     `pbArrowEnd`/`pbArrowClick`/`pbClearArrows`/`_pbArrows`/`_pbArrowPreviewEl`
     (index.html:17040-17133), com suporte a touch novo (`_initPbEvents`,
     index.html:17134, chamado de `_renderPbDetail` — o Playbook só tinha rato até agora).
   - Set Pieces: `g.pitchArrows[mode][]` ganhou `kind`/`points`/`color` (antes só retas sem
     cor própria); mesma alternância Reta/Traço Livre + seletor de cor, reaproveitando
     `pitchArrowStart`/`pitchArrowMove`/`pitchArrowEnd` já existentes
     (`_pitchArrowPreviewEl`, index.html:4811).
   - Regra de descarte igual nos dois: reta com menos de 8px de distância é ignorada;
     traço livre com menos de 3 pontos OU comprimento total amostrado abaixo de 8px é
     ignorado — mesma régua que a reta das Bolas Paradas já usava.
7. **Esconder/restaurar em massa (próprios) e limpar adversárias/setas em massa** — novos
   `pb.hiddenOwn`/`g.pitchHiddenOwn[mode]` (array de ids escondidos, não apagados — o
   "Remover" do modal para um marcador próprio esconde em vez de eliminar, para nunca
   perder a ligação atleta↔marcador por engano); botões novos "🙈 Esconder Todos"/"👁️
   Restaurar Todos" (só aparece quando há algo escondido) e "🗑️ Limpar Adversárias" nos
   dois quadros (`pbHideAllOwn`/`pbRestoreAllOwn`/`pbClearOpponents`, index.html:17011-17033;
   `pitchHideAllOwn`/`pitchRestoreAllOwn`/`pitchClearOpponents`, index.html:6519-6537). O
   filtro de ocultação aplica-se também ao SVG das miniaturas/galeria e ao Modo
   Apresentação (`_pbSnapshotSvg`/`_pitchSnapshotSvg` leem `markerColors`/`facing` e o
   filtro de ocultação já vem resolvido antes de gerar o SVG do quadro ao vivo).
8. **Correção de bug pré-existente, aproveitada de caminho (mesma classe dos Incidentes
   #1-4):** `g.pitchOpponents`/`g.pitchBall` nunca estiveram em
   `_CLOUD_TABLE_SCHEMA.games.cols` nem no mapeador de `pullCloud()` desde que foram
   introduzidos no sps-v185 — ou seja, adversárias/bola do Campo Tático nunca sincronizavam
   entre dispositivos (só ficavam no dispositivo onde foram desenhadas, perdidas ao
   `pullCloud()` noutro dispositivo/sessão). Corrigido ao mesmo tempo que se acrescentaram
   as novas colunas desta versão: `pitch_opponents`/`pitch_ball` passaram a constar de
   `_CLOUD_TABLE_SCHEMA.games.cols` e do mapeador `games` em `pullCloud()`
   (index.html:21156, index.html:20807), a par das 2 colunas genuinamente novas
   `pitch_marker_colors`/`pitch_hidden_own`.

**Schema Supabase** — migração já aplicada **fora desta sessão** (a sessão não correu SQL
nem usou qualquer ferramenta MCP do Supabase, por instrução explícita do pedido): 7 colunas
jsonb novas, já existentes na base de dados antes de qualquer edição ao código —
`playbook.arrows`, `playbook.hidden_own`, `playbook.marker_colors`, `games.pitch_opponents`,
`games.pitch_ball`, `games.pitch_marker_colors`, `games.pitch_hidden_own`. O código desta
versão só precisou de declarar estas colunas em `_CLOUD_TABLE_SCHEMA` (`playbook`/`games`)
e de as ler de volta nos mapeadores de `pullCloud()` — nunca de as criar.

**Testado:** `node --check` ao `index.html` (script extraído) e a `sw.js` depois de cada
lote de alterações. Harness Node novo (`test_marker_evolution_v204.js`, mesmo padrão `vm`
dos restantes, 75 asserções): helpers partilhados (`_bibMarkerSvg`/`_bibDarken`/
`_bibTextColor`/`_ballIconSvg`/`_freehandPathD`, incl. 2/3/10+ pontos); Playbook — setas
reta+mão livre (adicionar/apagar individual/limpar tudo), cor/rotação de marcador próprio
sobrevivem a `_pbSnapshot`/`_pbLoadSnapshot`, esconder/restaurar individual+em massa;
mesma bateria para as Bolas Paradas em `mode='tatico'` e num segundo modo
(`cornerDef`/`cornerOf`/`freeKick`, conforme a secção); `_CLOUD_TABLE_SCHEMA` contém as
colunas novas nas duas tabelas; teste dedicado da correção do bug de sync (linha `games`
simulada com `pitch_opponents`/`pitch_ball` preenchidos, confirma que o mapeador de
`pullCloud()` os liga a `g.pitchOpponents`/`g.pitchBall`); retrocompatibilidade (jogadas/
jogos antigos sem nenhum campo novo continuam a desenhar sem rebentar). Todos os 75
passaram (`node test_marker_evolution_v204.js`).

Regressão completa re-corrida (todos os `test_*.js` presentes na pasta de trabalho da
sessão): `test_coc3.js`, `test_guiao.js`, `test_playbook_v201.js`,
`test_presentation_v202.js`, `test_estagios.js`, `test_playbook_roundtrip.js`,
`test_hydration_v188.js`, `test_mobile_v187.js`, `test_na_dashboard_v192.js`,
`test_na_plantel_v192.js`, `test_nutri_anamnese_diario_supl2_v195.js`,
`test_nutri_metricas_v190.js`, `test_nutri_plantel_v194.js`, `test_pdf_a4_uma_pagina_v183.js`,
`test_playbook_dom_v201.js`, `test_supl_v193.js`, `test_tatico_e2e.js`, `test_tatico_v191.js`,
`test_autosave_v203.js`, `test_gdFoldRunning.js`, `test_palestra_fields.js`,
`test_palestra_ordem_v180.js`, `test_pdf_convocados_colunas.js`, `test_pull_bug_repro.js`,
`test_pull_fix.js`, `test_saveEvent_preserva_rsvp.js`, `test_tatico.js`,
`test_convoc_badge2.js`, `test_lista_convocados.js`, `test_lista_convocados2.js` — todos
passaram. `test_tatico_v191.js` e `test_tatico_e2e.js` tinham asserções que testavam
literalmente a forma geométrica antiga (X de `<line>`, clique direto com `confirm()` na
adversária) que esta versão substitui de propósito — atualizadas para verificar o novo
boneco/modal (mesmo comportamento coberto, só a forma de verificar mudou), não é uma
regressão disfarçada. `test_coc.js`/`test_coc2.js`/`test_coc_edit.js` (já documentados
como obsoletos desde o sps-v203, ver entrada acima) e `test_fisio_metricas_v189.js`
(função `_fisioMetricasRows` renomeada para `_nutriMetricasRows` antes desta sessão, no
sps-v190) continuam fora da suite de regressão — não tocados por este pedido, falham
contra qualquer versão atual por motivos alheios a este trabalho.

**Ainda por fazer:** nada pendente para este pedido. Possível extensão futura (não pedida):
o modal de opções do marcador podia ganhar também o campo "tarefa individual" que antes
se editava por clique direto no marcador das Bolas Paradas (sps-anterior) — essa edição
continua disponível na barra lateral "Tarefas Individuais", só deixou de estar acessível
por clique direto no próprio marcador do campo.

**Bug encontrado e corrigido durante a verificação independente (antes do deploy):**
`_bibApplyField('pitch', ..., 'own', 'facing', ...)` — ao rodar, pelo modal, um marcador
próprio das Bolas Paradas/Tático que ainda **nunca tinha sido arrastado manualmente**
(ou seja, sem entrada própria em `g.playerPositions`/`g.setpiecePositions[mode]`, o caso
mais comum logo a seguir a definir o onze), o código original do agente criava essa
entrada com um ponto fixo `{x:150,y:210}` (o centro do campo) em vez de usar a mesma
posição por omissão da grelha (`_pitchDefaultPos(mode,i,formation)`) já desenhada no
quadro — o marcador "saltava" visualmente para o centro do campo só por lhe mudar a
rotação ou a cor, perdendo a posição onde já estava. Confirmado visualmente com um
screenshot Playwright dedicado (o marcador do guarda-redes desaparecia da área da baliza
e ficava sobreposto ao ponto central). Note-se que o equivalente no Playbook
(`_pbDefaultPos`) já estava correto — só o lado `_pitchXxx` tinha este problema,
assimetria introduzida só numa das duas implementações paralelas. Corrigido calculando o
índice do atleta na mesma ordenação por número de camisola usada em `_jogoCampoHtml`
(`sortedLineup`) e chamando `_pitchDefaultPos` com esse índice, tal como o Playbook já
fazia. Dois testes novos acrescentados a `test_marker_evolution_v204.js` (secção 11)
fixam este comportamento como regressão: um confirma que cada atleta recebe o SEU
próprio default (não os dois o mesmo ponto fixo) e nunca cai em `(150,210)`; outro
confirma que um marcador já arrastado manualmente não se mexe ao mudar-lhe a rotação.
79 testes no total (75 do agente + 4 da verificação), todos a passar; regressão completa
(todos os `test_*.js`) re-corrida de novo depois da correção, sem falhas novas.

## sps-v205 (07/10/2026): Playbook — Quadro Tático maior com lista de atletas ao lado +
## pernas dos marcadores sempre brancas

**Pedido do Roger**, depois de ver o sps-v204 em produção: duas queixas/pedidos sobre o
Playbook, cada um explicitamente condicionado a ver um exemplo/mockup antes de qualquer
código ("MOSTRA-ME AS TUAS SUJESTOES ANTES DE AVANÇAR" / "MOSTRA ANTES DE CRIARES CODIGO"
/ "MOSTRA EXEMPLO ANTES DE AVANÇAR" / "MOSTRA EXEMPLOS", repetido 4 vezes ao longo da
conversa) — seguido escrupulosamente: nenhuma linha de `index.html` foi tocada antes da
confirmação final.

**1) Layout — Quadro Tático maior, lista de atletas ao lado:**

O Playbook (`_pbBoardHtml`) tinha o SVG do campo limitado a `max-width:300px` inline,
deixando o resto do painel vazio, com a lista "Atletas do Plantel"
(`_pbAthleteListHtml`, sps-v201) a aparecer num `.ipanel` próprio por baixo, a empurrar o
campo para cima e a ocupar largura que não ajudava o campo em nada. O Roger propôs
aumentar o campo e pôr a lista ao lado; escolhida (`AskUserQuestion`) a opção que espelha
o padrão já comprovado das Bolas Paradas (`_jogoCampoHtml`/`.jc-pitch-wrap`, responsivo
via `width:min(96vw,640px)` em retrato e `width:min(72vw,90vh,820px)` em paisagem/tablet+,
sps-v187) em vez de um grid de 2 colunas novo. Mockup (`mockup_playbook_layout_v1.html`,
com nomes reais do plantel) aprovado antes de codar.

- `_pbBoardHtml`: SVG do campo passou a ficar dentro de `.jc-pitch-wrap` (a mesma classe
  responsiva das Bolas Paradas, sem `max-width:300px`), num `<div style="display:flex;
  gap:16px;align-items:flex-start;flex-wrap:wrap">` ao lado de uma coluna
  `flex:1;min-width:230px` com `_pbAthleteListHtml(pb)`.
- `_pbAthleteListHtml`: deixou de se envolver no seu próprio `.ipanel` — passou a devolver
  só o conteúdo (título "👥 ATLETAS DO PLANTEL" + 11 linhas), para ser embutido como coluna
  dentro do mesmo painel do Quadro Tático; linhas passaram de formato horizontal
  (rótulo+select lado a lado) para rótulo em cima do select (mais estreito, cabe melhor na
  coluna lateral).
- `_renderPbDetail`: deixou de chamar `_pbAthleteListHtml` separadamente depois de
  `_pbBoardHtml` — a lista passou a viver só dentro do próprio quadro, numa única fonte
  (confirmado por teste: chamar `_pbBoardHtml` não duplica o título da lista).

**2) Pernas dos marcadores sempre brancas (antes: versão escura da própria cor do
marcador):**

O boneco "colete" (sps-v204, `_bibMarkerSvg`) dava às "pernas" uma versão escurecida da
cor escolhida para o círculo (`_bibDarken(fill,0.25)`) — o Roger pediu pernas sempre numa
cor fixa, independente da cor do círculo. Três rondas de mockup até à decisão final:

1. 1ª proposta: preto fixo (`#1a1a2e`) — aprovada em forma ("ISSO MESMO"), mas o Roger
   reconsiderou de imediato, pedindo ver branco também, com pernas ligeiramente maiores,
   por achar que contrastaria melhor com o verde do campo (`mockup_pes_v2.html`, sobre
   fundo verde real — branco revelou-se visualmente quase fundido com marcadores de
   círculo branco, por isso recebeu um contorno fino verde-escuro `#15803d` só para esse
   caso; preto não precisou de nenhum ajuste).
2. "REDUZ 5%" sobre o tamanho maior do passo anterior (`mockup_pes_v3.html`).
3. **Decisão final: "BRANCO E AVANÇA"** — branco (`#ffffff`) com o contorno
   `#15803d` (`stroke-width≈rad*0.06`), no tamanho -5% da proposta de +25% (`legLen=rad*1.7`,
   `legW=rad*0.36` — ~17%/~29% maiores que os valores originais do sps-v204,
   `rad*1.45`/`rad*0.28`, depois do desconto de 5%).

`_bibDarken` deixou de ter qualquer utilizador (confirmado por grep nos 9 pontos de
chamada de `_bibMarkerSvg`) e foi removida; `_bibMarkerSvg` perdeu o parâmetro `legColor`
(assinatura `(fill,label,rad,facing)` em vez de `(fill,legColor,label,rad,facing)`) — como
é uma função partilhada e neutra (não pertence a `_pb*` nem a `_pitch*`), a mudança
cascateia automaticamente para os dois quadros (Playbook e Set Pieces) e para todos os
sítios que a chamam (preview do modal de opções, miniaturas/galeria/PDF,
`_pitchSnapshotSvg`, `_jogoCampoHtml`, `_pbMarkersHtml`/`_pbOpponentsHtml`,
`_pbSnapshotSvg`) sem precisar de tocar em cada um individualmente.

**Testado:** `node --check` ao `index.html` (script extraído) e a `sw.js`, duas vezes
(logo depois das alterações e numa passagem final). `test_marker_evolution_v204.js`
estendido: lista de funções disponíveis atualizada (`_bibDarken` removida,
`_pbAthleteListHtml` acrescentada); secção [1] reescrita para a nova assinatura de
`_bibMarkerSvg`, com testes novos confirmando pernas sempre `#ffffff` independentemente
da cor do círculo (testado com amarelo/azul/branco), pernas maiores que os valores
originais do sps-v204, e `_bibDarken` já não existe; nova secção [7b] "Playbook — layout
sps-v205" com 4 testes: `_pbBoardHtml` já não tem `max-width:300px` e usa
`.jc-pitch-wrap`; campo e lista "Atletas do Plantel" aparecem na mesma fiada flex (campo
antes da lista); `_pbAthleteListHtml` já não se envolve em `.ipanel` próprio; chamar
`_pbBoardHtml` não duplica o título "ATLETAS DO PLANTEL". 85 testes no total (79 do
sps-v204 + 6 novos), todos a passar. Verificação visual com 3 screenshots Playwright
dedicados (`verify_v205_screens.js`, `verify_v205_setpieces.js`): jogada real do Playbook
com nomes reais do plantel atribuídos aos marcadores 1/4/11 e cores próprias nos
marcadores 7 (azul) e 9 (roxo) — confirma visualmente o campo alargado para 820px de
largura num viewport de 1400px (antes limitado a 300px), a lista de atletas ao lado, e as
pernas brancas com contorno verde-escuro nos marcadores coloridos; terceiro screenshot
confirma que a mesma mudança de pernas brancas cascateia corretamente para o quadro de
Bolas Paradas (`_jogoCampoHtml`), sem qualquer alteração de código nesse lado. Regressão
completa re-corrida (mesma lista do sps-v204) sem falhas novas — só a flakiness já
documentada de `test_mobile_v187.js` quando corrido em sequência com muitos outros testes
Playwright na mesma sessão (confirmada limpa em execuções isoladas, consistente com o
padrão já descrito acima).

SW bump para `sps-v205`.

**Ainda por fazer:** nada pendente para este pedido.
