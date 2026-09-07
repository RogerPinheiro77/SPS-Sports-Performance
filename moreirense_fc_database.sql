-- =============================================================================
-- MOREIRENSE FC — FUTEBOL FEMININO
-- Base de Dados PostgreSQL — Sistema Integrado de Alto Rendimento
-- Versão 1.0 | Maio 2026
-- =============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- pesquisa de texto

-- =============================================================================
-- TIPOS ENUMERADOS (ENUMS)
-- =============================================================================

CREATE TYPE role_utilizador      AS ENUM ('treinador','atleta','nutricionista','fisioterapeuta','medico','admin');
CREATE TYPE posicao_futebol      AS ENUM ('GR','DC','DD','DE','MCD','MC','MD','EX','AC');
CREATE TYPE fase_ciclo           AS ENUM ('menstrual','folicular','ovulacao','lutea');
CREATE TYPE tipo_sessao          AS ENUM ('tatico','fisico','tecnico','ativacao','recuperacao','misto');
CREATE TYPE tipo_evento          AS ENUM ('jogo_casa','jogo_fora','treino','viagem','concentracao','folga');
CREATE TYPE tipo_lesao           AS ENUM ('traumatica','sobrecarga','doenca','outra');
CREATE TYPE grau_severidade      AS ENUM ('ligeira','moderada','grave','critica');
CREATE TYPE estado_lesao         AS ENUM ('ativa','reabilitacao','alta');
CREATE TYPE objetivo_nutricional AS ENUM ('manutencao','reducao_gordura','ganho_massa','performance');
CREATE TYPE hidratacao_estado    AS ENUM ('boa','razoavel','ma');
CREATE TYPE tipo_alerta          AS ENUM ('wellness_baixo','carga_alta','acwr_risco','lesao_nova','retorno_previsto','ausencia_registo');
CREATE TYPE nivel_alerta         AS ENUM ('info','aviso','critico');
CREATE TYPE flag_risco           AS ENUM ('verde','amarelo','vermelho');
CREATE TYPE estado_treino_ind    AS ENUM ('pendente','em_curso','concluido','cancelado');
CREATE TYPE resultado_teste_func AS ENUM ('aprovado','reprovado','n_a');


-- =============================================================================
-- DOMÍNIO 1 — CORE: UTILIZADORES, ATLETAS, STAFF
-- =============================================================================

CREATE TABLE utilizadores (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    role            role_utilizador NOT NULL,
    nome_completo   VARCHAR(200) NOT NULL,
    telefone        VARCHAR(20),
    foto_url        TEXT,
    ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_acesso   TIMESTAMPTZ,
    CONSTRAINT chk_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_utilizadores_email ON utilizadores(email);
CREATE INDEX idx_utilizadores_role  ON utilizadores(role);


CREATE TABLE atletas (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    utilizador_id       UUID        NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
    numero_camisola     SMALLINT    UNIQUE,
    posicao_principal   posicao_futebol NOT NULL,
    posicao_secundaria  posicao_futebol,
    data_nascimento     DATE        NOT NULL,
    pe_dominante        CHAR(1)     CHECK (pe_dominante IN ('D','E','A')),
    altura_cm           NUMERIC(5,1),
    nacionalidade       CHAR(3),
    data_entrada_clube  DATE,
    data_contrato_fim   DATE,
    agente              VARCHAR(150),
    notas_perfil        TEXT,
    ativo               BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_atletas_utilizador ON atletas(utilizador_id);
CREATE INDEX idx_atletas_posicao    ON atletas(posicao_principal);
CREATE INDEX idx_atletas_ativo      ON atletas(ativo);


CREATE TABLE staff (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    utilizador_id   UUID        NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
    departamento    VARCHAR(50) NOT NULL,
    cargo           VARCHAR(100) NOT NULL,
    data_inicio     DATE,
    data_fim        DATE,
    ativo           BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_staff_utilizador ON staff(utilizador_id);


-- =============================================================================
-- DOMÍNIO 2 — MONITORIZAÇÃO: WELLNESS & CARGA INTERNA
-- =============================================================================

CREATE TABLE wellness_registos (
    id                  BIGSERIAL   PRIMARY KEY,
    atleta_id           UUID        NOT NULL REFERENCES atletas(id) ON DELETE CASCADE,
    data_registo        DATE        NOT NULL,
    -- Dimensões Hooper adaptado (1=muito mau, 5=muito bom)
    qualidade_sono      SMALLINT    NOT NULL CHECK (qualidade_sono BETWEEN 1 AND 5),
    horas_sono          NUMERIC(3,1) CHECK (horas_sono BETWEEN 0 AND 24),
    nivel_fadiga        SMALLINT    NOT NULL CHECK (nivel_fadiga BETWEEN 1 AND 5),
    nivel_stress        SMALLINT    NOT NULL CHECK (nivel_stress BETWEEN 1 AND 5),
    dor_muscular        SMALLINT    NOT NULL CHECK (dor_muscular BETWEEN 1 AND 5),
    estado_humor        SMALLINT    NOT NULL CHECK (estado_humor BETWEEN 1 AND 5),
    -- Dimensão adicional: ciclo menstrual
    fase_ciclo_menstrual fase_ciclo,
    notas               TEXT,
    submetido_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Índice composto gerado automaticamente (média ponderada das 5 dimensões, escala 0-100)
    indice_wellness     NUMERIC(5,2) GENERATED ALWAYS AS (
        ROUND(((qualidade_sono + nivel_fadiga + nivel_stress + dor_muscular + estado_humor)::NUMERIC / 25.0 * 100), 2)
    ) STORED,
    CONSTRAINT uq_wellness_atleta_data UNIQUE (atleta_id, data_registo)
);

CREATE INDEX idx_wellness_atleta   ON wellness_registos(atleta_id);
CREATE INDEX idx_wellness_data     ON wellness_registos(data_registo DESC);
CREATE INDEX idx_wellness_composto ON wellness_registos(atleta_id, data_registo DESC);


CREATE TABLE sessoes_treino (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    data                DATE        NOT NULL,
    hora_inicio         TIME,
    duracao_prevista_min SMALLINT,
    tipo                tipo_sessao NOT NULL,
    microciclo          SMALLINT,
    objetivos           TEXT[],
    local               VARCHAR(100),
    campo               VARCHAR(50),
    criado_por          UUID        REFERENCES staff(id),
    notas_pre_sessao    TEXT,
    notas_pos_sessao    TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessoes_data       ON sessoes_treino(data DESC);
CREATE INDEX idx_sessoes_microciclo ON sessoes_treino(microciclo);


CREATE TABLE pse_registos (
    id                  BIGSERIAL   PRIMARY KEY,
    atleta_id           UUID        NOT NULL REFERENCES atletas(id) ON DELETE CASCADE,
    sessao_id           UUID        REFERENCES sessoes_treino(id),
    data_sessao         DATE        NOT NULL,
    pse_borg            NUMERIC(3,1) NOT NULL CHECK (pse_borg BETWEEN 0 AND 10),
    duracao_minutos     SMALLINT    NOT NULL CHECK (duracao_minutos > 0),
    tipo_sessao         tipo_sessao,
    notas               TEXT,
    submetido_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Carga interna (UA) = PSE × duração
    carga_ua            SMALLINT    GENERATED ALWAYS AS (
        ROUND(pse_borg * duracao_minutos)::SMALLINT
    ) STORED,
    CONSTRAINT uq_pse_atleta_sessao UNIQUE (atleta_id, data_sessao, sessao_id)
);

CREATE INDEX idx_pse_atleta   ON pse_registos(atleta_id);
CREATE INDEX idx_pse_data     ON pse_registos(data_sessao DESC);
CREATE INDEX idx_pse_composto ON pse_registos(atleta_id, data_sessao DESC);


-- =============================================================================
-- DOMÍNIO 3 — TREINO & AGENDA
-- =============================================================================

CREATE TABLE eventos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            tipo_evento NOT NULL,
    data_hora       TIMESTAMPTZ NOT NULL,
    duracao_min     SMALLINT,
    adversario      VARCHAR(100),
    competicao      VARCHAR(100),
    local           VARCHAR(200),
    resultado_nos   SMALLINT,
    resultado_adv   SMALLINT,
    convocadas      UUID[],     -- array de atleta_ids
    notas           TEXT,
    criado_por      UUID        REFERENCES staff(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eventos_data ON eventos(data_hora DESC);
CREATE INDEX idx_eventos_tipo ON eventos(tipo);


CREATE TABLE minutos_jogo (
    id              BIGSERIAL   PRIMARY KEY,
    atleta_id       UUID        NOT NULL REFERENCES atletas(id),
    evento_id       UUID        NOT NULL REFERENCES eventos(id),
    minutos_jogados SMALLINT    NOT NULL DEFAULT 0 CHECK (minutos_jogados BETWEEN 0 AND 120),
    titular         BOOLEAN     NOT NULL DEFAULT FALSE,
    substituido_aos SMALLINT,
    entrou_aos      SMALLINT,
    CONSTRAINT uq_minutos_atleta_evento UNIQUE (atleta_id, evento_id)
);

CREATE INDEX idx_minutos_atleta ON minutos_jogo(atleta_id);
CREATE INDEX idx_minutos_evento ON minutos_jogo(evento_id);


CREATE TABLE treinos_individualizados (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    atleta_id       UUID        NOT NULL REFERENCES atletas(id) ON DELETE CASCADE,
    prescrito_por   UUID        NOT NULL REFERENCES staff(id),
    semana_inicio   DATE        NOT NULL,
    semana_fim      DATE,
    contexto        VARCHAR(100),   -- ex: "pré-jogo", "reforço físico", "retorno lesão"
    exercicios      JSONB       NOT NULL DEFAULT '[]',  -- [{nome, series, reps, carga, notas, video_url}]
    estado          estado_treino_ind NOT NULL DEFAULT 'pendente',
    feedback_atleta TEXT,
    avaliacao_staff TEXT,
    concluido_em    TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_treino_ind_atleta ON treinos_individualizados(atleta_id);
CREATE INDEX idx_treino_ind_semana ON treinos_individualizados(semana_inicio);


-- =============================================================================
-- DOMÍNIO 4 — MÉDICO & FISIOTERAPIA
-- =============================================================================

CREATE TABLE lesoes (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    atleta_id               UUID            NOT NULL REFERENCES atletas(id) ON DELETE CASCADE,
    data_ocorrencia         DATE            NOT NULL,
    tipo_lesao              tipo_lesao      NOT NULL,
    diagnostico             VARCHAR(200)    NOT NULL,
    localizacao_anatomica   VARCHAR(100),
    lado                    CHAR(1)         CHECK (lado IN ('D','E','B','N')), -- Direito/Esquerdo/Bilateral/Não aplicável
    mecanismo               TEXT,
    grau_severidade         grau_severidade NOT NULL DEFAULT 'ligeira',
    contacto                BOOLEAN         NOT NULL DEFAULT FALSE,
    ocorreu_em              VARCHAR(50),    -- ex: "treino", "jogo", "fora actividade"
    data_retorno_prevista    DATE,
    data_retorno_real        DATE,
    estado                  estado_lesao    NOT NULL DEFAULT 'ativa',
    registado_por           UUID            REFERENCES staff(id),
    notas_clinicas          TEXT,
    imagens_url             TEXT[],
    criado_em               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    -- Dias perdidos calculados automaticamente
    dias_perdidos           SMALLINT        GENERATED ALWAYS AS (
        CASE WHEN data_retorno_real IS NOT NULL
             THEN (data_retorno_real - data_ocorrencia)::SMALLINT
             WHEN data_retorno_prevista IS NOT NULL
             THEN (data_retorno_prevista - data_ocorrencia)::SMALLINT
             ELSE NULL END
    ) STORED
);

CREATE INDEX idx_lesoes_atleta ON lesoes(atleta_id);
CREATE INDEX idx_lesoes_data   ON lesoes(data_ocorrencia DESC);
CREATE INDEX idx_lesoes_estado ON lesoes(estado);


CREATE TABLE fases_reabilitacao (
    id                  BIGSERIAL   PRIMARY KEY,
    lesao_id            UUID        NOT NULL REFERENCES lesoes(id) ON DELETE CASCADE,
    numero_fase         SMALLINT    NOT NULL CHECK (numero_fase > 0),
    descricao           VARCHAR(100) NOT NULL,
    objetivos           TEXT[],
    criterios_avanco    TEXT[],
    data_inicio         DATE,
    data_conclusao      DATE,
    criterios_cumpridos BOOLEAN     NOT NULL DEFAULT FALSE,
    exercicios          JSONB       DEFAULT '[]',
    notas_clinicas      TEXT,
    registado_por       UUID        REFERENCES staff(id),
    CONSTRAINT uq_fase_lesao UNIQUE (lesao_id, numero_fase)
);

CREATE INDEX idx_fases_lesao ON fases_reabilitacao(lesao_id);


CREATE TABLE avaliacoes_funcionais (
    id                  BIGSERIAL   PRIMARY KEY,
    atleta_id           UUID        NOT NULL REFERENCES atletas(id),
    lesao_id            UUID        REFERENCES lesoes(id),
    data_avaliacao      DATE        NOT NULL,
    single_leg_squat    resultado_teste_func DEFAULT 'n_a',
    hop_test_pct        NUMERIC(5,2),           -- % simetria membro lesionado vs saudável
    star_excursion_pct  NUMERIC(5,2),
    limiar_dor_vas      SMALLINT    CHECK (limiar_dor_vas BETWEEN 0 AND 10),
    força_isq_quad_dto  NUMERIC(4,2),
    força_isq_quad_esq  NUMERIC(4,2),
    aprovado_retorno    BOOLEAN     NOT NULL DEFAULT FALSE,
    avaliado_por        UUID        REFERENCES staff(id),
    notas               TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_avfunc_atleta ON avaliacoes_funcionais(atleta_id);
CREATE INDEX idx_avfunc_data   ON avaliacoes_funcionais(data_avaliacao DESC);


-- =============================================================================
-- DOMÍNIO 5 — NUTRIÇÃO
-- =============================================================================

CREATE TABLE composicao_corporal (
    id                      BIGSERIAL   PRIMARY KEY,
    atleta_id               UUID        NOT NULL REFERENCES atletas(id) ON DELETE CASCADE,
    data_avaliacao          DATE        NOT NULL,
    peso_kg                 NUMERIC(5,2) NOT NULL CHECK (peso_kg > 0),
    altura_cm               NUMERIC(5,1) CHECK (altura_cm > 0),
    pct_gordura             NUMERIC(5,2) CHECK (pct_gordura BETWEEN 0 AND 100),
    prega_tricipital_mm     NUMERIC(4,1),
    prega_subescapular_mm   NUMERIC(4,1),
    prega_suprailiaca_mm    NUMERIC(4,1),
    prega_abdominal_mm      NUMERIC(4,1),
    prega_coxa_mm           NUMERIC(4,1),
    perimetro_cintura_cm    NUMERIC(5,1),
    perimetro_anca_cm       NUMERIC(5,1),
    hidratacao              hidratacao_estado,
    avaliado_por            UUID        REFERENCES staff(id),
    notas                   TEXT,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Campos calculados
    imc                     NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN altura_cm IS NOT NULL AND altura_cm > 0
             THEN ROUND(peso_kg / POWER(altura_cm / 100.0, 2), 2)
             ELSE NULL END
    ) STORED,
    massa_magra_kg          NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN pct_gordura IS NOT NULL
             THEN ROUND(peso_kg * (1 - pct_gordura / 100.0), 2)
             ELSE NULL END
    ) STORED
);

CREATE INDEX idx_compocorp_atleta ON composicao_corporal(atleta_id);
CREATE INDEX idx_compocorp_data   ON composicao_corporal(data_avaliacao DESC);


CREATE TABLE planos_nutricionais (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    atleta_id           UUID        NOT NULL REFERENCES atletas(id) ON DELETE CASCADE,
    nutricionista_id    UUID        NOT NULL REFERENCES staff(id),
    data_inicio         DATE        NOT NULL,
    data_fim            DATE,
    objetivo            objetivo_nutricional NOT NULL DEFAULT 'manutencao',
    calorias_alvo       INTEGER     CHECK (calorias_alvo > 0),
    proteina_g_kg       NUMERIC(4,2),
    hidratos_g_kg       NUMERIC(4,2),
    gordura_g_kg        NUMERIC(4,2),
    refeicoes           JSONB       DEFAULT '[]',       -- [{tipo, hora, descricao, calorias}]
    suplementacao       JSONB       DEFAULT '[]',       -- [{nome, dose, timing, objetivo}]
    adaptacao_ciclo     JSONB       DEFAULT '{}',       -- {menstrual:{...}, folicular:{...}, ovulacao:{...}, lutea:{...}}
    restricoes          TEXT[],
    ativo               BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_planosnut_atleta ON planos_nutricionais(atleta_id);
CREATE INDEX idx_planosnut_ativo  ON planos_nutricionais(ativo) WHERE ativo = TRUE;


-- =============================================================================
-- DOMÍNIO 6 — PERFORMANCE: TESTES, MÉTRICAS GPS, ALERTAS
-- =============================================================================

CREATE TABLE testes_fisicos (
    id                  BIGSERIAL   PRIMARY KEY,
    atleta_id           UUID        NOT NULL REFERENCES atletas(id) ON DELETE CASCADE,
    data_teste          DATE        NOT NULL,
    -- Saltos
    cmj_cm              NUMERIC(5,1),   -- Counter Movement Jump
    sj_cm               NUMERIC(5,1),   -- Squat Jump
    dj_cm               NUMERIC(5,1),   -- Drop Jump
    -- Velocidade
    sprint_10m_s        NUMERIC(5,3),
    sprint_20m_s        NUMERIC(5,3),
    sprint_30m_s        NUMERIC(5,3),
    -- Resistência
    vo2max_estimado     NUMERIC(5,2),
    yoyo_irt1_metros    INTEGER,
    yoyo_irt2_metros    INTEGER,
    -- Força
    racio_isq_quad_dto  NUMERIC(4,2),
    racio_isq_quad_esq  NUMERIC(4,2),
    -- Flexibilidade
    sit_and_reach_cm    NUMERIC(5,1),
    -- Agilidade
    t_test_s            NUMERIC(5,2),
    -- Contexto
    avaliado_por        UUID        REFERENCES staff(id),
    microciclo          SMALLINT,
    notas               TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_testes_atleta ON testes_fisicos(atleta_id);
CREATE INDEX idx_testes_data   ON testes_fisicos(data_teste DESC);


CREATE TABLE metricas_jogo (
    id                  BIGSERIAL   PRIMARY KEY,
    atleta_id           UUID        NOT NULL REFERENCES atletas(id),
    evento_id           UUID        NOT NULL REFERENCES eventos(id),
    minutos_jogados     SMALLINT    NOT NULL DEFAULT 0,
    -- GPS / carga externa
    distancia_total_m   INTEGER,
    distancia_hsi_m     INTEGER,    -- High Speed Intensity (>19.8 km/h)
    distancia_sprint_m  INTEGER,    -- Sprint (>25.2 km/h)
    sprints_n           SMALLINT,
    velocidade_max_kmh  NUMERIC(5,2),
    aceleracoes_n       SMALLINT,
    desaceleracoes_n    SMALLINT,
    -- Eventos de jogo
    golos               SMALLINT    NOT NULL DEFAULT 0,
    assistencias        SMALLINT    NOT NULL DEFAULT 0,
    remates             SMALLINT,
    remates_enquadrados SMALLINT,
    -- Avaliação
    nota_desempenho     NUMERIC(4,2) CHECK (nota_desempenho BETWEEN 1 AND 10),
    notas               TEXT,
    CONSTRAINT uq_metricas_atleta_evento UNIQUE (atleta_id, evento_id)
);

CREATE INDEX idx_metricas_atleta ON metricas_jogo(atleta_id);
CREATE INDEX idx_metricas_evento ON metricas_jogo(evento_id);


CREATE TABLE alertas (
    id              BIGSERIAL   PRIMARY KEY,
    atleta_id       UUID        NOT NULL REFERENCES atletas(id) ON DELETE CASCADE,
    tipo            tipo_alerta NOT NULL,
    nivel           nivel_alerta NOT NULL DEFAULT 'aviso',
    mensagem        TEXT        NOT NULL,
    valor_gatilho   NUMERIC,
    threshold       NUMERIC,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lido_em         TIMESTAMPTZ,
    lido_por        UUID        REFERENCES staff(id),
    descartado      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_alertas_atleta    ON alertas(atleta_id);
CREATE INDEX idx_alertas_nivel     ON alertas(nivel);
CREATE INDEX idx_alertas_criado    ON alertas(criado_em DESC);
CREATE INDEX idx_alertas_nao_lidos ON alertas(lido_em) WHERE lido_em IS NULL;


-- =============================================================================
-- VISTAS MATERIALIZADAS (VIEWS)
-- =============================================================================

-- Vista: Resumo de carga semanal por atleta
CREATE MATERIALIZED VIEW resumo_carga_semanal AS
SELECT
    p.atleta_id,
    EXTRACT(ISOYEAR FROM p.data_sessao)::INT AS ano,
    EXTRACT(WEEK FROM p.data_sessao)::INT    AS semana_iso,
    SUM(p.carga_ua)                          AS carga_aguda_ua,
    ROUND(AVG(p.pse_borg), 2)                AS pse_media,
    SUM(p.duracao_minutos)                   AS minutos_totais,
    COUNT(*)                                 AS num_sessoes,
    -- ACWR calculado como média 7d / média 28d (simplificado por semana aqui)
    CASE
        WHEN LAG(SUM(p.carga_ua), 1) OVER w > 0
        THEN ROUND(SUM(p.carga_ua)::NUMERIC / NULLIF(LAG(SUM(p.carga_ua), 1) OVER w, 0), 2)
        ELSE NULL
    END AS acwr_approx,
    -- Semáforo de risco
    CASE
        WHEN SUM(p.carga_ua) > 2000 THEN 'vermelho'::flag_risco
        WHEN SUM(p.carga_ua) > 1600 THEN 'amarelo'::flag_risco
        ELSE 'verde'::flag_risco
    END AS flag_risco
FROM pse_registos p
GROUP BY p.atleta_id, ano, semana_iso
WINDOW w AS (PARTITION BY p.atleta_id ORDER BY ano, semana_iso);

CREATE UNIQUE INDEX idx_resumo_carga_uk ON resumo_carga_semanal(atleta_id, ano, semana_iso);


-- Vista: Estado atual de cada atleta (para o dashboard)
CREATE VIEW v_estado_plantel AS
SELECT
    a.id            AS atleta_id,
    u.nome_completo,
    a.numero_camisola,
    a.posicao_principal,
    -- Wellness mais recente
    w.indice_wellness,
    w.data_registo  AS wellness_data,
    w.fase_ciclo_menstrual,
    -- Última PSE
    p.pse_borg      AS ultima_pse,
    p.carga_ua      AS ultima_carga_ua,
    p.data_sessao   AS ultima_pse_data,
    -- Lesão ativa
    l.diagnostico   AS lesao_ativa,
    l.estado        AS lesao_estado,
    l.data_retorno_prevista,
    -- Semáforo calculado
    CASE
        WHEN l.estado IN ('ativa','reabilitacao') THEN 'vermelho'::flag_risco
        WHEN w.indice_wellness < 55 OR r.acwr_approx > 1.5 THEN 'amarelo'::flag_risco
        ELSE 'verde'::flag_risco
    END AS semaforo
FROM atletas a
JOIN utilizadores u ON u.id = a.utilizador_id
LEFT JOIN LATERAL (
    SELECT * FROM wellness_registos
    WHERE atleta_id = a.id ORDER BY data_registo DESC LIMIT 1
) w ON TRUE
LEFT JOIN LATERAL (
    SELECT * FROM pse_registos
    WHERE atleta_id = a.id ORDER BY data_sessao DESC LIMIT 1
) p ON TRUE
LEFT JOIN LATERAL (
    SELECT * FROM lesoes
    WHERE atleta_id = a.id AND estado != 'alta' ORDER BY data_ocorrencia DESC LIMIT 1
) l ON TRUE
LEFT JOIN LATERAL (
    SELECT * FROM resumo_carga_semanal
    WHERE atleta_id = a.id ORDER BY ano DESC, semana_iso DESC LIMIT 1
) r ON TRUE
WHERE a.ativo = TRUE;


-- =============================================================================
-- FUNÇÕES E TRIGGERS
-- =============================================================================

-- Função: Gerar alerta automático quando wellness < 55
CREATE OR REPLACE FUNCTION fn_alerta_wellness()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.indice_wellness < 55 THEN
        INSERT INTO alertas (atleta_id, tipo, nivel, mensagem, valor_gatilho, threshold)
        VALUES (
            NEW.atleta_id,
            'wellness_baixo',
            CASE WHEN NEW.indice_wellness < 40 THEN 'critico' ELSE 'aviso' END,
            'Índice wellness abaixo do limiar: ' || NEW.indice_wellness || '% em ' || NEW.data_registo,
            NEW.indice_wellness,
            55
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alerta_wellness
    AFTER INSERT ON wellness_registos
    FOR EACH ROW EXECUTE FUNCTION fn_alerta_wellness();


-- Função: Gerar alerta quando carga UA semanal > 2000
CREATE OR REPLACE FUNCTION fn_alerta_carga()
RETURNS TRIGGER AS $$
DECLARE
    carga_semana INTEGER;
BEGIN
    SELECT COALESCE(SUM(carga_ua), 0) INTO carga_semana
    FROM pse_registos
    WHERE atleta_id = NEW.atleta_id
      AND data_sessao >= date_trunc('week', NEW.data_sessao)
      AND data_sessao <= NEW.data_sessao;

    IF carga_semana > 2000 THEN
        INSERT INTO alertas (atleta_id, tipo, nivel, mensagem, valor_gatilho, threshold)
        VALUES (
            NEW.atleta_id,
            'carga_alta',
            'critico',
            'Carga semanal elevada: ' || carga_semana || ' UA (limite: 2000 UA)',
            carga_semana,
            2000
        )
        ON CONFLICT DO NOTHING;
    ELSIF carga_semana > 1700 THEN
        INSERT INTO alertas (atleta_id, tipo, nivel, mensagem, valor_gatilho, threshold)
        VALUES (
            NEW.atleta_id,
            'carga_alta',
            'aviso',
            'Carga semanal em monitorização: ' || carga_semana || ' UA',
            carga_semana,
            1700
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alerta_carga
    AFTER INSERT ON pse_registos
    FOR EACH ROW EXECUTE FUNCTION fn_alerta_carga();


-- Função: Actualizar última lesão como 'alta' quando data_retorno_real é preenchida
CREATE OR REPLACE FUNCTION fn_fechar_lesao()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.data_retorno_real IS NOT NULL AND OLD.data_retorno_real IS NULL THEN
        NEW.estado = 'alta';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fechar_lesao
    BEFORE UPDATE ON lesoes
    FOR EACH ROW EXECUTE FUNCTION fn_fechar_lesao();


-- Função: Refrescar vista materializada após novos registos PSE
CREATE OR REPLACE FUNCTION fn_refresh_resumo_carga()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY resumo_carga_semanal;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_resumo
    AFTER INSERT OR UPDATE ON pse_registos
    FOR EACH STATEMENT EXECUTE FUNCTION fn_refresh_resumo_carga();


-- =============================================================================
-- DADOS INICIAIS (SEED)
-- =============================================================================

-- Admin do sistema
INSERT INTO utilizadores (email, password_hash, role, nome_completo) VALUES
('admin@moreirense.pt', crypt('changeme', gen_salt('bf')), 'admin', 'Administrador Sistema');

-- Exemplo de treinador
INSERT INTO utilizadores (email, password_hash, role, nome_completo) VALUES
('treinadora@moreirense.pt', crypt('changeme', gen_salt('bf')), 'treinador', 'Treinadora Principal');


-- =============================================================================
-- QUERIES ÚTEIS (EXEMPLOS)
-- =============================================================================

-- Estado do plantel hoje:
-- SELECT * FROM v_estado_plantel ORDER BY semaforo DESC, posicao_principal;

-- Top 5 atletas com wellness mais baixo esta semana:
-- SELECT u.nome_completo, AVG(w.indice_wellness) AS media_wellness
-- FROM wellness_registos w
-- JOIN atletas a ON a.id = w.atleta_id
-- JOIN utilizadores u ON u.id = a.utilizador_id
-- WHERE w.data_registo >= date_trunc('week', CURRENT_DATE)
-- GROUP BY u.nome_completo
-- ORDER BY media_wellness ASC LIMIT 5;

-- ACWR por atleta (últimas 2 semanas):
-- SELECT atleta_id, semana_iso, carga_aguda_ua, acwr_approx, flag_risco
-- FROM resumo_carga_semanal
-- WHERE ano = EXTRACT(YEAR FROM CURRENT_DATE)
--   AND semana_iso >= EXTRACT(WEEK FROM CURRENT_DATE) - 2
-- ORDER BY atleta_id, semana_iso;

-- Alertas não lidos:
-- SELECT a.mensagem, a.nivel, u.nome_completo, a.criado_em
-- FROM alertas a
-- JOIN atletas at ON at.id = a.atleta_id
-- JOIN utilizadores u ON u.id = at.utilizador_id
-- WHERE a.lido_em IS NULL AND a.descartado = FALSE
-- ORDER BY a.nivel DESC, a.criado_em DESC;

-- =============================================================================
-- FIM DO SCRIPT
-- =============================================================================
