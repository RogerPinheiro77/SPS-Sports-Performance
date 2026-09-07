# SPS Sports Performance — Análise Técnica Completa & Plano de Projeto
> Gerado em: 2026-06-01 | Baseado em leitura profunda de ambos os ficheiros

---

## 1. PLATAFORMA PRINCIPAL — O que já existe e funciona

### 1.1 Sistema de Autenticação (sólido)

**Staff (técnico / fisio / nutri):**
- Login com email + password SHA-256
- Stored em `APP.users[]` com roles: `tecnico`, `fisio`, `nutri`
- Primeiro acesso cria admin automaticamente
- Sessão em `sessionStorage` (expira ao fechar o browser)

**Atletas:**
- Login separado: nº de atleta / nome / email + password SHA-256
- Stored em `APP.athletes[].passwordHash`
- Password gerada automaticamente (8 chars aleatórios)
- Técnico partilha via modal → botões diretos para WhatsApp, Gmail, Email
- Password mostrada **uma única vez** — modal com cópia/partilha
- Repor password disponível no perfil da atleta

### 1.2 Fluxo de Dados — Quem cria o quê para quem

```
TÉCNICO cria                    →   ATLETA consome (app atleta)
─────────────────────────────────────────────────────────────────
Eventos no Calendário           →   Agenda (atp-agenda)
Planos de treino individuais    →   Treino (atp-treino) — pode marcar "feito"
Períodos de avaliação (abertos) →   Avaliações (atp-aval) — preenche autoavaliação
Convocatórias por jogo          →   Convocatórias (atp-convoc)

FISIO cria                      →   ATLETA consome
─────────────────────────────────────────────────────────────────
Episódios de lesão + fases      →   Fisio (atp-fisio) — vê estado + tratamentos
Tratamentos registados          →   Fisio (atp-fisio) — historial de tratamentos

NUTRICIONISTA cria              →   ATLETA consome
─────────────────────────────────────────────────────────────────
Planos nutricionais (active=true) →  Nutrição (atp-nutri) — vê plano + macros + refeições
Avaliações antropométricas      →   Nutrição (atp-nutri) — vê peso + IMC + hidratação

ATLETA cria                     →   TÉCNICO/STAFF consome
─────────────────────────────────────────────────────────────────
Wellness diário (8-11h janela)  →   Dashboard + módulo PSE/Wellness + alertas
PSE pós-sessão (após fim treino) →  Dashboard + módulo PSE/Wellness + ACWR + alertas
Auto-avaliação (eval form)      →   Módulo Avaliações → comparação com avaliação técnica
Treino marcado como "feito"     →   Módulo Treinos Individuais → confirmação
```

### 1.3 Lógica de Negócio Importante

**Wellness:**
- Janela configurável (default 07:00–11:00)
- Fora da janela: formulário bloqueado com mensagem "Reabre às X"
- 5 dimensões: Sono, Fadiga, Stress, Dor, Humor + fase do ciclo menstrual
- Score calculado 0–100
- Histórico 14 dias visível para a atleta

**PSE:**
- Só desbloqueado após fim da sessão agendada + delay configurável
- Calcula carga interna: PSE × Duração = UA (unidades arbitrárias)
- Histórico completo + ACWR calculado pelo técnico

**Avaliações:**
- Períodos abertos/fechados por equipa
- Atleta preenche autoavaliação (4 dimensões: ofensivo, físico, mental, defensivo)
- Técnico preenche avaliação técnica
- Comparação em radar chart com análise narrativa automática
- Export PDF por atleta

**Vista Home da atleta:**
- KPIs do dia (Wellness + PSE com semáforo verde/vermelho)
- Eventos de hoje + próximos 5 eventos
- Alerta de lesão ativa com fase atual
- Alerta de convocatória próxima
- Notificação de avaliação em aberto

### 1.4 Supabase Sync (Plataforma Principal)

**Pull (cloud → app):**
- Tabelas individuais: athletes, wellness_records, pse_records, injuries, treatments, nutrition_records, nutrition_plans, schedule_events, training_plans
- Blob JSON em `clubs.meta`: users, config, teams, games, evaluations, evalPeriods, evalResponses, trainings, convocatorias, scouting, microcycles, sessions

**Push (app → cloud):**
- `saveData()` chama `pushAppMeta()` automaticamente se sync ativo
- cloudUpsert por tabela individual quando atleta submete (PSE, wellness, treino feito)
- **Sem realtime** — sync é manual ou on-save

---

## 2. PWA (`sps-app/index.html.html`) — Estado Real

### 2.1 O que tem de bom
- PWA manifest dinâmico (blob URL) — funcional ✓
- Service Worker inline — cache + offline básico ✓
- Realtime Supabase (wellness, PSE, lesões, nutrição, treinos) ✓
- Vista técnico com KPIs, notificações, gestão de plantel/agenda/treinos ✓
- Submissão de PSE + Wellness com push para Supabase ✓

### 2.2 Problemas Críticos

| Problema | Detalhe |
|---|---|
| Auth fraca | Atleta seleciona da lista — sem password. Sem segurança |
| 4 módulos em falta | Convocatórias, Avaliações, Nutrição (plano), Fisio — não existem na vista atleta |
| Não lê `clubs.meta` | Convocatórias, avaliações, nutrition_plans ficam no blob Supabase — PWA nunca os lê |
| Data model diferente | `APP.treinos` (PWA) ≠ `APP.trainingPlans` (plataforma); `APP.nutrition` ≠ `APP.nutritionAssessments` |
| localStorage diferente | Chave `sps_v1` vs `sps_plat_v2` — sem Supabase, apps isoladas |
| Vista técnico duplicada | A PWA tem um técnico view que duplica a plataforma principal |
| Sem token/link | Sem welcome screen, sem auto-login por URL |

---

## 3. COMUNICAÇÃO ENTRE AS DUAS APPS

```
                   SEM SUPABASE
    ┌───────────────────────────────────────┐
    │ PLATAFORMA (sps_plat_v2)              │   ISOLADA
    │ ATLETA: 9 módulos completos           │   
    └───────────────────────────────────────┘

    ┌───────────────────────────────────────┐
    │ PWA (sps_v1)                          │   ISOLADA
    │ ATLETA: 4 módulos (incompleto)        │
    └───────────────────────────────────────┘

                   COM SUPABASE
    ┌───────────────────────────────────────┐
    │ PLATAFORMA                            │
    │  push: tabelas + clubs.meta           │──┐
    │  pull: tabelas + clubs.meta           │  │
    └───────────────────────────────────────┘  │   SUPABASE DB
                                               ├──[tabelas SQL + clubs.meta blob]
    ┌───────────────────────────────────────┐  │
    │ PWA                                   │  │
    │  push: tabelas individuais ✓          │──┘
    │  pull: tabelas individuais ✓          │
    │  pull: clubs.meta ← NÃO FAZ ⚠️        │
    │  realtime: wellness/PSE/lesões ✓      │
    └───────────────────────────────────────┘

RESULTADO: Convocatórias, avaliações, nutrition_plans nunca chegam à PWA
mesmo com Supabase ativo — porque estão em clubs.meta e a PWA não o lê.
```

---

## 4. DIAGNÓSTICO FINAL

A **plataforma principal** é o sistema completo. Tem:
- Auth real e segura para atletas
- 9 módulos completos na vista atleta
- Toda a lógica de negócio (wellness window, PSE delay, avaliações, etc.)
- Staff de 3 tipos a criar dados que a atleta consome

A **PWA** foi criada como companion mobile, mas está **incompleta e inconsistente**. A atleta na PWA não vê convocatórias, avaliações, plano nutricional, nem o seu estado de fisio — que são exatamente as coisas mais importantes que o staff cria para ela.

**Conclusão:** A plataforma principal já é a "app completa". A PWA precisa de ser repensada.

---

## 5. OPÇÕES ESTRATÉGICAS

### OPÇÃO A — Tornar a Plataforma Principal numa PWA (RECOMENDADA)

A plataforma já tem tudo. Só falta ser instalável como app.

**O que implementar:**
1. PWA manifest dinâmico + Service Worker → app instalável em iOS/Android
2. Sistema de link direto: `?a=ID&t=TOKEN` (token derivado do hash da atleta)
3. Welcome screen com foto + nome + botão entrar quando URL tem token
4. Auto-login por token → direto para vista atleta
5. Botão "Gerar Link App" no perfil da atleta → QR code + copiar + partilhar WhatsApp

**Resultado:** Técnico gera link → atleta clica → vê welcome screen → instala como PWA → tem app completa com todos os 9 módulos.

**Esforço:** ~4–5 horas | **Risco:** Baixo | **Manutenção:** 1 ficheiro

### OPÇÃO B — Completar a PWA Separada

Manter duas apps — plataforma para staff, PWA para atletas.

**O que implementar:**
1. Corrigir auth (adicionar password)
2. Ler `clubs.meta` no pullFromCloud
3. Corrigir data model (treinos→trainingPlans, nutrition→nutritionAssessments)
4. Adicionar 4 módulos em falta (convoc, aval, nutri plano, fisio)
5. Adicionar token/link system
6. Welcome screen
7. Lógica de negócio (wellness window, PSE delay) — reimplementar

**Esforço:** ~15–20 horas | **Risco:** Alto (data model, sync) | **Manutenção:** 2 ficheiros

### OPÇÃO C — Híbrida

PWA serve só para submissão rápida (PSE + Wellness). Para o resto, atleta usa a plataforma principal instalada como PWA. Reduz o escopo da PWA sem a abandonar.

---

## 6. RECOMENDAÇÃO CLARA: OPÇÃO A

**Porquê:**
- A plataforma já fez o trabalho difícil — 9 módulos completos, lógica de negócio, auth, Supabase
- Adicionar PWA é ~30 linhas de código
- O sistema de link/token é a peça que falta para a UX mobile perfeita
- Uma única codebase = zero inconsistências = zero sync issues
- A PWA separada pode ser mantida apenas para o técnico visualizar dados no tablet/mobile

---

## 7. PLANO DE IMPLEMENTAÇÃO (Opção A)

### Fase 1 — PWA Manifest + Service Worker (1h)
- Adicionar `<link rel="manifest">` dinâmico à plataforma
- SW com cache-first para assets, network-first para dados
- Ícones e splash screen
- Prompt de instalação para iOS (banner "Adicionar ao ecrã inicial") e Android

### Fase 2 — Sistema de Link/Token (2h)
- Gerar token: `btoa(athleteId + ':' + passwordHash.slice(0,16))`
- Botão "📱 Gerar Link App" no perfil de cada atleta no Plantel
- Modal: QR code + botão copiar link + botão WhatsApp
- Link format: `https://rogerpinheiro77.github.io/SPS-Sports-Performance/?a=ID&t=TOKEN`

### Fase 3 — Welcome Screen + Auto-Login (1h)
- Detetar `?a=ID&t=TOKEN` na URL no `initSession()`
- Welcome screen: foto da atleta + nome + botão "Entrar" + instruções instalação
- Auto-login por token → direto para vista atleta
- Se token inválido → mostrar login normal

### Fase 4 — UX Mobile Melhorada (1h)
- Bottom navigation mais visual para atleta em mobile
- Notificações de tarefas pendentes no home
- Orientação portrait forçada em mobile
- Testar em iOS Safari e Android Chrome

### Fase 5 — Push para GitHub Pages
- Copiar `sport_performance_platform.html` → `index.html`
- Commit + push
- Testar link gerado no GitHub Pages

---

## 8. O QUE NÃO MUDAR

- A lógica de negócio (wellness window, PSE delay, avaliações) — já perfeita
- O sistema de auth (SHA-256, modal de credenciais) — já robusto
- A estrutura de dados `APP` — funciona, não mexer
- O Supabase sync — manter como está
- Toda a vista staff — não tocar

---

## 9. ESTADO APÓS IMPLEMENTAÇÃO

```
TÉCNICO no computador:
  → Abre sport_performance_platform.html (ou GitHub Pages)
  → Cria evento, treino, convocatória, avaliação, lesão, plano nutri
  → No perfil da atleta: clica "Gerar Link App" → copia ou envia por WhatsApp

ATLETA no telemóvel:
  → Recebe link via WhatsApp
  → Abre no Safari/Chrome → Welcome screen com a sua foto
  → Clica "Entrar" → auto-login
  → "Adicionar ao ecrã inicial" → app instalada
  → Acede a: Home, Wellness, PSE, Agenda, Nutri, Fisio, Treino, Convoc, Avaliações

DADOS:
  → Com Supabase: sync bidirecional em tempo real (athlete submits → técnico vê)
  → Sem Supabase: funciona offline, dados em localStorage
```

---

*Análise gerada em 2026-06-01 — Ficheiro de referência para o projeto*
