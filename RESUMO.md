# SPS Sports Performance — Resumo Técnico
> Última atualização: 2026-08-06 | Supabase religado e bugs de sync corrigidos · Plantel Moreirense Feminino 2025/26 importado (26 atletas) · Ver secção "Sessão 2026-08-06" para o trabalho mais recente

---

## Repositório & Deploy

- **GitHub:** https://github.com/RogerPinheiro77/SPS-Sports-Performance
- **GitHub Pages:** https://rogerpinheiro77.github.io/SPS-Sports-Performance/
- **Ficheiro principal:** `index.html` (= `sport_performance_platform.html`)
- **Pasta local:** `G:\O meu disco\APP COACH RP\` (Google Drive — acessível em qualquer PC)

---

## Stack

- HTML/CSS/JS puro — single-file app (~5400 linhas, ~389KB)
- **Supabase** — sync cloud opcional (auth + RLS)
- **Chart.js** — gráficos e radar charts
- **Dados locais** — `localStorage` com push/pull para Supabase

---

## Arquitetura

### Autenticação & Roles
- Login com roles: `tecnico`, `fisio`, `nutri`, `atleta`
- Sessão guardada em `sessionStorage`
- Passwords com hash SHA-256
- Primeiro acesso cria admin automaticamente

### Estrutura de Dados (`APP`)
```
APP = {
  config: { clubName, season, teams[], users[], activations, pins... },
  athletes: [],
  schedule: [],        // eventos/calendário
  sessions: [],        // microciclos
  trainings: [],       // unidades de treino
  games: [],           // jogos
  wellness: [],        // registos wellness
  pse: [],             // registos PSE
  injuries: [],        // episódios fisio
  treatments: [],      // tratamentos
  nutritionAssessments: [],
  nutritionPlans: [],
  scouting: [],
  evalPeriods: [],     // períodos de avaliação
  evalResponses: [],   // respostas (auto + técnico)
  convocatorias: [],
  exercises: [],       // biblioteca
  trainingPlans: [],   // treinos individuais
  formations: []       // formações táticas
}
```

---

## Módulos Implementados

### Vista Staff (Técnico/Fisio/Nutri)
| Módulo | Função principal |
|--------|-----------------|
| Dashboard | KPIs, alertas, resumo plantel, wellness overview |
| Plantel | CRUD atletas, import FPF/ZeroZero/Transfermarkt, fotos |
| Planeamento | Calendário mensal + microciclos semanais |
| Jogos | Info, adversário, pré-jogo, campo tático drag&drop, formações, stats pós-jogo, export PDF |
| Treinos | Unidades de treino com fases (aquecimento/principal/retorno), exercícios com imagens/vídeos, export PDF |
| PSE/Wellness | Registos de bem-estar e perceção esforço, alertas |
| Scouting | Fichas de observação com rating por estrelas |
| Avaliações | Períodos, avaliação técnica, radar chart, análise narrativa automática, export PDF |
| Convocatórias | Gestão de listas por jogo |
| Biblioteca | Exercícios reutilizáveis |
| Treinos Ind. | Planos individuais por atleta |
| Formação | Gestão de equipas/grupos |
| Fisioterapia | Episódios de lesão, fases de reabilitação, tratamentos |
| Nutrição | Avaliações antropométricas, planos nutricionais |
| Relatórios | Exports CSV/PDF/impressão (plantel, wellness, PSE, fichas) |
| Config | Equipas, users, ativações, backup/restore JSON, Supabase sync |

### Vista Atleta (mobile-first, bottom nav)
| Página | Conteúdo |
|--------|---------|
| Home | Resumo do dia, próximo treino/jogo |
| Wellness | Registo diário de bem-estar (8 dimensões) |
| PSE | Perceção de esforço pós-sessão |
| Agenda | Próximos eventos |
| Nutrição | Plano ativo |
| Fisio | Estado de lesões |
| Treino | Planos individuais atribuídos |
| Convocatórias | Listas em que está incluída |
| Avaliações | Auto-avaliação (preencher/editar) + ver comparação com avaliação técnica (radar chart) |

### Sistema de Avaliações (completo)
- Períodos de avaliação (abertos/fechados)
- **Autoavaliação da atleta** (`_evalType='auto'`)
- **Avaliação técnica** (`_evalType='tecnica'`)
- **Comparação** com radar chart sobrepostos
- Análise narrativa automática: alinhamento, subestimação, sobrevalorização
- Export PDF individual por atleta

---

## Base de Dados Supabase

Ficheiros SQL na pasta:
- `moreirense_fc_database.sql` — estrutura base
- `supabase_migration_v2.sql` — migração v2
- `supabase_fix_final.sql` + `supabase_fix_policies.sql` — correções RLS
- `supabase_app_meta.sql` — metadata da app

Sync via `pushAppMeta()` / `pullCloud()` — guarda `APP` serializado numa tabela de metadata.

---

## Backups Disponíveis
- `sport_performance_platform.html.bak` — 27 Mai
- `sport_performance_platform.bak2.html` — 28 Mai (259KB)
- `sport_performance_platform.bak3.html` — 28 Mai (303KB)
- `sport_performance_platform.bak4.html` — 02 Jun (389KB)
- `sport_performance_platform.bak5.html` — **06 Ago 2026** (versão local antes de ser substituída pela do GitHub, 412KB)
- `index.html` — **atual, sincronizado com GitHub, 06 Ago 2026 (415KB, 5923 linhas)**

---

## Fase 2 — PWA da Atleta (Opção A — Recomendada)

### Estratégia decidida
Tornar a **plataforma principal** numa PWA instalável — em vez de manter a PWA separada (`sps-app`) que está incompleta e inconsistente.

**Porquê:** A plataforma já tem 9 módulos completos, auth real, toda a lógica de negócio e sync Supabase. A PWA separada só tem 4 módulos e problemas de sync.

### Estado por item (verificado 2026-08-06 diretamente no repositório GitHub via clone)
1. **PWA Manifest** — ✅ feito (manifest dinâmico via Blob, ícone do clube ou gerado, tema/cor)
2. **Service Worker** — ✅ feito. Ficheiro dedicado `sw.js` (não inline) registado via `navigator.serviceWorker.register('./sw.js')`. Pré-cacheia o app shell + assets do Supabase/Chart.js no install, limpa caches antigos no activate.
3. **Link único por atleta** — ✅ feito, formato `?a=ID&t=TOKEN`
4. **Token de acesso** — ✅ feito, `btoa(athleteId + ':' + passwordHash.slice(0,16))`
5. **Welcome screen** — ✅ feito (foto/nome/posição, criar password / reset / entrar, instruções instalação iOS/Android)
6. **Auto-login por token** — ✅ feito (sessão persistente em localStorage, reentra sem pedir password)
7. **Botão "Gerar Link App"** — ✅ feito no Plantel (perfil da atleta) — modal com QR code + copiar + WhatsApp
8. **UX Mobile melhorada** — ✅ feito. Home da atleta com cards grandes por área (Wellness, PSE, Agenda, Avaliações, Nutrição, Fisio) com ícone, cor e badge de notificação
9. **Extras encontrados que não estavam no plano original:** item de navegação "Convocatórias", pull automático de dados ao abrir a app da atleta, sincronização automática treino ↔ evento no calendário

### Nota importante sobre o histórico deste projeto (2026-08-06)
A pasta local (`G:\O meu disco\APP COACH RP\`) estava **desatualizada** em relação ao GitHub — o repositório tinha uma versão mais avançada (com Fase 4 e sw.js dedicado) que nunca tinha sido copiada para local. Resolvido: `index.html` e `sw.js` locais foram substituídos pela versão do GitHub (a versão local anterior foi guardada em `sport_performance_platform.bak5.html`). **A partir de agora, o GitHub é a fonte de verdade — antes de editar localmente, confirmar que a pasta local está sincronizada com o repositório.**

### Decisões tomadas
- Link abre welcome screen (não auto-loga direto) — mais seguro em telemóvel partilhado
- Instruções de instalação incluídas no welcome screen
- Funciona em iOS (Safari) e Android (Chrome)
- PWA separada (`sps-app`) — abandonar

### Próximos passos sugeridos
- Testar a app instalada (offline, atualização de versão) para confirmar que o `sw.js` não prende utilizadores em versões antigas
- Validar publicação em produção: https://rogerpinheiro77.github.io/SPS-Sports-Performance/

---

## Sessão 2026-08-06 (tarde/noite) — Supabase ligado, bugs de sync corrigidos, plantel importado

### Supabase
- Conector oficial do Supabase ligado (MCP) — projeto **SPS** (`dgpltxembsnnypushsxh`, org `kzuqbqgplgtasanprwms`)
- Projeto estava **pausado (INACTIVE)** há ~2 meses (desde 4 Jun) — foi **reativado** com sucesso
- Havia **dois clubes** na base de dados: "Sport Performance" (placeholder, `a56297e9-8322-411c-9828-c0439cef36db`) e **"Moreirense Futebol Clube"** (`406d8b81-a759-4832-b871-37add6a91b18`) — Roger confirmou que o real é o Moreirense
- Equipas do Moreirense: `T1` = "Equipa Principal" (Sénior Feminino), `mpmr4ffiraib` = "MFC W SUB/19"

### Bugs corrigidos (críticos)
1. **Escolha de clube ao acaso** — dispositivos novos ligavam a um clube arbitrário (`.limit(1)` sem filtro). Corrigido: `_DEFAULT_CLUB_ID` fixo ao Moreirense no `initSupabase`.
2. **Sync individual nunca funcionava de facto** — `cloudUpsert()` enviava objetos locais (camelCase) misturados com campos snake_case adicionados manualmente; o Supabase rejeitava o pedido inteiro por colunas desconhecidas. Corrigido com `_CLOUD_TABLE_SCHEMA` (mapa de colunas reais + renomeações) — agora `cloudUpsert(table, row)` filtra e traduz automaticamente para qualquer tabela.
3. **Fisioterapia e Nutrição nunca tinham sync nenhum** — adicionadas chamadas `cloudUpsert` em `saveEpisodio`, `saveTratamento`, `saveNutriAval`, `saveNutriPlano`/`toggleNpActive`, `saveTreinoInd`.
4. **Login com race condition** — ecrã de login aparecia antes da sincronização inicial terminar, causando "password incorreta" com password certa. Corrigido: mostra "A sincronizar..." e só renderiza o login depois do primeiro pull (ou timeout de 4s).
5. Migração aplicada: colunas `password_hash` e `email` adicionadas a `athletes` (faltavam — o token de login da atleta não sincronizava entre dispositivos); coluna `team_id` adicionada a `schedule_events`.
6. Botão **"🔄 Sincronizar Tudo Agora"** adicionado em Config → envia todos os dados locais (atletas, wellness, PSE, lesões, tratamentos, nutrição, calendário, treinos individuais) para o Supabase — útil quando um dispositivo esteve offline.

### Importação FPF melhorada
- Antes só trazia nome + foto. Agora extrai também **Data de Nascimento**, **Naturalidade** e **Posição** da secção "Bio" da ficha da FPF (a FPF não tem API — estes dados só existem como texto na página).
- **ZeroZero import está partido**: o regex de deteção de URL só reconhece o formato antigo (`jogador.php?id=`), mas o site usa hoje `zerozero.pt/jogador/nome/ID`. **Pendente de corrigir.**

### Plantel do Moreirense Feminino (época 2025/26) importado
- 26 atletas inseridas diretamente no Supabase (`athletes`, `team_id='T1'`), com nome + posição genérica (GR/DC/MC/AV) + clube, verificados no plantel real do ZeroZero (época 2025/26 filtrada).
- **Só a Ana Cerqueira tem dados completos da FPF** (nome completo, foto, data nascimento 2004-04-11, naturalidade Portugal) — confirmado que a ficha da FPF é mesmo dela (liga a Moreirense Fc).
- As outras 25 **não foram enriquecidas com dados da FPF** — ao tentar confirmar por nome, encontrei jogadoras com o mesmo nome registadas noutros clubes (ex: "Mariana Couto" e "Joana Cunha" na FPF aparecem ligadas a outros clubes, não ao Moreirense). Risco real de atribuir data de nascimento/foto da pessoa errada — por isso parei. **Falta:** data de nascimento, nacionalidade, número de camisola, foto — recomendado preencher via Plantel → perfil da atleta → importador FPF (o técnico confirma visualmente cada jogadora antes de aplicar).

### Pendente para a próxima sessão
1. Corrigir regex de deteção de URL do ZeroZero (formato novo `/jogador/nome/id`)
2. Completar dados (DOB, nacionalidade, nº, foto) das 25 atletas importadas sem enriquecimento FPF
3. Construir funcionalidade **"Mudar de Clube"** em Config — para quando o Roger mudar de clube a meio da época (clube = fronteira rígida, época = etiqueta dentro do clube; ver conversa de 2026-08-06)
4. Confirmar que a app está mesmo a puxar os dados corretos em produção depois de todas estas correções (testar login, wellness, PSE, plantel no telemóvel)

---

## Como Retomar numa Nova Conversa

1. Abre nova conversa no projeto **SPS_APP** no Cowork
2. A pasta `APP COACH RP` em `G:\O meu disco\` já está ligada
3. Cola esta frase: *"Continua o desenvolvimento da SPS Sports Performance. Lê o RESUMO.md da pasta para contexto."*
4. Se o conector Supabase não aparecer já ligado, pede para ligar de novo (MCP) — o projeto é o "SPS" (`dgpltxembsnnypushsxh`)
5. Pronto — retomamos sem perder nada

---

## Notas Técnicas

- A plataforma é **single-file** — todo o CSS, JS e HTML num único ficheiro
- Ao editar, fazer sempre backup antes (`bak4`, `bak5`, etc.)
- O `index.html` no repositório é o mesmo ficheiro que `sport_performance_platform.html`
- Para publicar: copiar conteúdo para `index.html` e fazer push para GitHub
- Pasta do projeto na Google Drive: `G:\O meu disco\APP COACH RP\`
