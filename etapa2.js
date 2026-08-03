/* ============================================================
   Abas da Etapa 2 - Sistema de Gestão Hospitalar Dra. Yuska Maritan Brito

   Carregado antes do app.js. Define registrarRecursosEtapa2, que o app.js
   chama para acrescentar estas abas ao objeto RECURSOS antes de montar a barra
   de navegação.

   Abas acrescentadas:

     Internações      CRUD da entidade nova, com registro de alta
     Views            as três views do banco, cada uma num cartão
     Procedures       as duas stored procedures que gravam
     Auditoria        o histórico que o trigger de atendimento alimenta
     Consultas ORM    as consultas avançadas e as analíticas em DSL
     Concorrência     a simulação de duas transações disputando uma escala

   Todas as telas usam os endpoints canônicos da API, sem prefixos alternativos.
   ============================================================ */

const DIAS_ETAPA2 = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const TURNOS_ETAPA2 = ["manha", "tarde", "noite"];

/* ---------- utilitários locais ---------- */

/* Tabela simples a partir de uma lista de objetos. As abas de leitura da
   Etapa 2 não têm perfil nem ações, então não usam renderizarTabela. */
function tabelaSimples(itens, colunas, rotulos) {
  if (!itens || itens.length === 0) {
    return el("p", { class: "vazio" }, "Nenhum registro encontrado.");
  }
  const tabela = el("table");
  const cabecalho = el("tr");
  for (const coluna of colunas) {
    cabecalho.append(el("th", {}, (rotulos && rotulos[coluna]) || coluna.replaceAll("_", " ")));
  }
  tabela.append(cabecalho);
  for (const item of itens) {
    const linha = el("tr");
    for (const coluna of colunas) linha.append(el("td", {}, formatarValor(coluna, item[coluna])));
    tabela.append(linha);
  }
  return el("div", { class: "tabela-wrap" }, tabela);
}

/* Cartão que carrega dados de um endpoint e desenha a tabela. Devolve também
   uma função para recarregar, usada depois de executar uma procedure. */
function cartaoDeConsulta({ titulo, ajuda, caminho, colunas, rotulos, transformar }) {
  const area = el("div");
  const cartao = el("div", { class: "card" },
    el("h2", {}, titulo),
    ajuda ? el("p", { class: "ajuda" }, ajuda) : null,
    area);

  async function recarregar() {
    area.innerHTML = "";
    area.append(el("p", { class: "vazio" }, "Carregando..."));
    try {
      let itens = await chamarApi("GET", caminho);
      if (transformar) itens = transformar(itens);
      area.innerHTML = "";
      area.append(tabelaSimples(itens, colunas, rotulos));
    } catch (e) {
      area.innerHTML = "";
      area.append(el("p", { class: "vazio" }, "Erro: " + e.message));
    }
  }

  return { cartao, recarregar };
}

/* ---------- aba: views ---------- */

function montarAbaViews() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("div", { class: "aviso" },
    "Painel de acompanhamento em tempo real das unidades hospitalares e corpo médico."));

  const cartoes = [
    cartaoDeConsulta({
      titulo: "Pacientes Atualmente Internados",
      ajuda: "Lista pacientes com internação ativa. Pacientes que receberam alta são removidos automaticamente.",
      caminho: "/pacientes/internados",
      colunas: ["nome", "cpf", "grupo_sanguineo", "unidade", "data_hora_entrada", "motivo"],
      rotulos: { data_hora_entrada: "entrada", cpf: "CPF" },
    }),
    cartaoDeConsulta({
      titulo: "Plantões com Supervisão Pendente ou Não-Doutor",
      ajuda: "Identifica plantões onde o preceptor responsável não possui titulação de doutorado.",
      caminho: "/residentes/sem-supervisor-doutor",
      colunas: ["residente", "ano_residencia", "unidade", "dia_semana", "turno", "preceptor", "titulacao", "motivo"],
    }),
    cartaoDeConsulta({
      titulo: "Relatório Mensal de Produtividade por Unidade",
      ajuda: "Estatísticas agregadas por mês e unidade hospitalar.",
      caminho: "/atendimentos/estatisticas-mensais",
      colunas: ["mes", "unidade", "total_atendimentos", "media_duracao_minutos",
                "menor_duracao", "maior_duracao", "procedimentos_mais_comuns"],
      rotulos: { media_duracao_minutos: "duração média (min)" },
    }),
  ];

  for (const { cartao, recarregar } of cartoes) {
    raiz.append(cartao);
    recarregar();
  }
}

/* ---------- aba: procedures ---------- */

function montarAbaProcedures() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("div", { class: "aviso" },
    "Registro unificado de prontuário e gestão de escalas de plantão com garantia de consistência de dados."));

  /* --- sp_registrar_atendimento_completo --- */

  const camposAtendimento = [
    { nome: "data_hora", rotulo: "Data e hora", tipo: "datetime-local", obrigatorio: true },
    { nome: "duracao_minutos", rotulo: "Duração (min)", tipo: "number", obrigatorio: true, min: 1 },
    { nome: "id_paciente", rotulo: "Paciente", tipo: "lookup", recurso: "pacientes",
      rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
    { nome: "id_residente", rotulo: "Residente", tipo: "lookup", recurso: "residentes",
      rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
    { nome: "id_preceptor", rotulo: "Preceptor", tipo: "lookup", recurso: "preceptores",
      rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
    { nome: "id_unidade", rotulo: "Unidade", tipo: "lookup", recurso: "unidades",
      rotuloOpcao: u => `${u.id_unidade} — ${u.nome}`, valorOpcao: u => u.id_unidade },
  ];

  const formAtendimento = el("form", { class: "crud-form" });
  for (const campo of camposAtendimento) formAtendimento.append(criarCampo(campo));

  /* Lista dinâmica de procedimentos. A procedure exige pelo menos um. */
  const linhasProcedimento = el("div", { style: "grid-column: 1 / -1;" });
  const camposProcedimento = [
    { nome: "id_procedimento", rotulo: "Procedimento", tipo: "lookup", recurso: "procedimentos",
      rotuloOpcao: p => `${p.id_procedimento} — ${p.nome}`, valorOpcao: p => p.id_procedimento },
    { nome: "quantidade", rotulo: "Quantidade", tipo: "number", min: 1 },
    { nome: "tempo_real_minutos", rotulo: "Tempo real (min)", tipo: "number", min: 1 },
    { nome: "data_hora_inicio", rotulo: "Início", tipo: "datetime-local" },
    { nome: "observacao", rotulo: "Observação", tipo: "text" },
  ];

  function acrescentarLinha() {
    const linha = el("form", { class: "crud-form linha-procedimento" });
    for (const campo of camposProcedimento) linha.append(criarCampo(campo));
    linha.append(el("div", { class: "acoes-form" },
      el("button", { class: "botao neutro", type: "button", onclick: () => linha.remove() },
        "Remover este procedimento")));
    linhasProcedimento.append(linha);
  }
  acrescentarLinha();

  const areaResultado = el("div", { style: "grid-column: 1 / -1; margin-top: 12px;" });

  /* Adiciona a seção de procedimentos e botões na ordem natural do formulário */
  formAtendimento.append(
    el("div", { style: "grid-column: 1 / -1; margin-top: 16px; margin-bottom: 6px;" },
      el("h3", { style: "font-size: 1rem; color: var(--azul-escuro); font-weight: 600;" }, "Procedimentos deste atendimento")),
    linhasProcedimento,
    el("div", { style: "grid-column: 1 / -1; margin-bottom: 12px;" },
      el("button", { class: "botao", type: "button", onclick: acrescentarLinha },
        "+ Adicionar Procedimento")),
    el("div", { class: "acoes-form", style: "grid-column: 1 / -1; border-top: 1px solid var(--borda); padding-top: 16px;" },
      el("button", { class: "botao salvar", type: "submit" }, "Finalizar e Registrar Atendimento"))
  );

  formAtendimento.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const dados = lerFormulario(formAtendimento, camposAtendimento);

    const procedimentos = [];
    for (const linha of linhasProcedimento.querySelectorAll("form.linha-procedimento")) {
      const item = lerFormulario(linha, camposProcedimento);
      if (!item.id_procedimento) continue;
      if (item.quantidade === null) item.quantidade = 1;
      procedimentos.push(item);
    }
    if (procedimentos.length === 0) {
      toast("Selecione ao menos um procedimento para o atendimento.", "erro");
      return;
    }

    try {
      const resposta = await chamarApi("POST",
        "/atendimentos/completo",
        { ...dados, procedimentos });
      toast(resposta.mensagem, "ok");
      areaResultado.innerHTML = "";
      areaResultado.append(tabelaSimples([resposta],
        ["id_atendimento", "procedimentos_inseridos", "mensagem"]));
    } catch (e) {
      toast(e.message, "erro");
      areaResultado.innerHTML = "";
      areaResultado.append(el("p", { class: "vazio" },
        "Operação não concluída: " + e.message));
    }
  });

  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Admissão e Prontuário de Atendimento Integrado"),
    el("p", { class: "ajuda" },
      "Cadastre o atendimento e os procedimentos realizados em um único envio atômico."),
    formAtendimento,
    areaResultado));

  /* --- sp_reajustar_escala --- */

  const camposReajuste = [
    { nome: "id_residente", rotulo: "Residente", tipo: "lookup", recurso: "residentes",
      rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
    { nome: "dia_origem", rotulo: "Dia de origem", tipo: "select", opcoes: DIAS_ETAPA2, obrigatorio: true },
    { nome: "turno_origem", rotulo: "Turno de origem", tipo: "select", opcoes: TURNOS_ETAPA2, obrigatorio: true },
    { nome: "dia_destino", rotulo: "Dia de destino", tipo: "select", opcoes: DIAS_ETAPA2, obrigatorio: true },
    { nome: "turno_destino", rotulo: "Turno de destino", tipo: "select", opcoes: TURNOS_ETAPA2, obrigatorio: true },
  ];

  const formReajuste = el("form", { class: "crud-form" });
  for (const campo of camposReajuste) formReajuste.append(criarCampo(campo));
  formReajuste.append(el("div", { class: "acoes-form" },
    el("button", { class: "botao salvar", type: "submit" }, "Reajustar Escala")));

  const escalasApos = el("div");

  async function recarregarEscalas() {
    escalasApos.innerHTML = "";
    try {
      const [escalas, residentes, unidades] = await Promise.all([
        chamarApi("GET", "/escalas/"),
        listaCacheada("residentes"),
        listaCacheada("unidades"),
      ]);
      const nomeResidente = {};
      for (const r of residentes) nomeResidente[r.id_pessoa] = r.nome;
      const nomeUnidade = {};
      for (const u of unidades) nomeUnidade[u.id_unidade] = u.nome;
      const enfeitadas = escalas.map(e => ({
        ...e,
        residente: nomeResidente[e.id_residente] || `id ${e.id_residente}`,
        unidade: nomeUnidade[e.id_unidade] || `id ${e.id_unidade}`,
      }));
      escalasApos.append(tabelaSimples(enfeitadas,
        ["id_escala", "residente", "unidade", "dia_semana", "turno", "versao"]));
    } catch (e) {
      escalasApos.append(el("p", { class: "vazio" }, "Erro: " + e.message));
    }
  }

  formReajuste.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const resposta = await chamarApi("POST", "/escalas/reajustar",
        lerFormulario(formReajuste, camposReajuste));
      toast(resposta.mensagem, resposta.escalas_movidas > 0 ? "ok" : "erro");
      await recarregarEscalas();
    } catch (e) {
      toast(e.message, "erro");
    }
  });

  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Reajuste em Lote da Escala Médica"),
    el("p", { class: "ajuda" },
      "Mova os plantões de um residente entre dias e turnos com validação de choques de horário."),
    formReajuste,
    el("h2", {}, "Escalas Atuais"),
    escalasApos));
  recarregarEscalas();
}

/* ---------- aba: auditoria ---------- */

function montarAbaAuditoria() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("div", { class: "aviso" },
    "Trilha de segurança e auditoria automatizada de alterações de prontuários."));

  const camposFiltro = [
    { nome: "id_atendimento", rotulo: "Atendimento (id)", tipo: "number" },
    { nome: "operacao", rotulo: "Operação", tipo: "select",
      opcoes: ["INSERT", "UPDATE", "DELETE"] },
    { nome: "limite", rotulo: "Máximo de linhas", tipo: "number", min: 1 },
  ];

  const formFiltro = el("form", { class: "crud-form" });
  for (const campo of camposFiltro) formFiltro.append(criarCampo(campo));
  formFiltro.append(el("div", { class: "acoes-form" },
    el("button", { class: "botao", type: "submit" }, "Buscar"),
    el("button", { class: "botao neutro", type: "button", onclick: () => {
      formFiltro.reset();
      formFiltro.querySelectorAll("select").forEach(s => { s.value = ""; });
      carregar();
    } }, "Limpar filtros")));

  const area = el("div");

  function diferencas(antes, depois) {
    if (!antes) return "registro criado";
    if (!depois) return "registro removido";
    const mudancas = [];
    for (const campo of Object.keys(depois)) {
      if (String(antes[campo]) !== String(depois[campo])) {
        mudancas.push(`${campo}: ${antes[campo]} → ${depois[campo]}`);
      }
    }
    return mudancas.length ? mudancas.join("; ") : "sem alteração de valores";
  }

  async function carregar() {
    const filtros = lerFormulario(formFiltro, camposFiltro);
    area.innerHTML = "";
    area.append(el("p", { class: "vazio" }, "Carregando..."));
    try {
      const linhas = await chamarApi("GET", "/auditoria/atendimentos" + montarQuery(filtros));
      const enfeitadas = linhas.map(l => ({
        ...l,
        alteracao: diferencas(l.dados_antigos, l.dados_novos),
      }));
      area.innerHTML = "";
      area.append(tabelaSimples(enfeitadas,
        ["id_auditoria", "id_atendimento", "operacao", "usuario", "data_hora", "alteracao"]));
    } catch (e) {
      area.innerHTML = "";
      area.append(el("p", { class: "vazio" }, "Erro: " + e.message));
    }
  }

  formFiltro.addEventListener("submit", (ev) => { ev.preventDefault(); carregar(); });

  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Consultar Trilha de Auditoria"),
    el("p", { class: "ajuda" },
      "Exibe alterações registradas automaticamente em tempo real durante modificações de atendimento."),
    formFiltro));
  raiz.append(el("div", { class: "card" }, el("h2", {}, "Histórico de Registros"), area));
  carregar();
}

/* ---------- aba: consultas com ORM ---------- */

function montarAbaConsultasOrm() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("div", { class: "aviso" },
    "Métricas operacionais e indicadores de desempenho hospitalar."));

  const cartoes = [
    cartaoDeConsulta({
      titulo: "Tempo Médio de Espera por Unidade",
      ajuda: "Intervalo entre a chegada do paciente e o início do primeiro procedimento.",
      caminho: "/atendimentos/tempo-medio-espera",
      colunas: ["nome_unidade", "atendimentos_considerados", "espera_media_minutos"],
      rotulos: { nome_unidade: "unidade", espera_media_minutos: "espera média (min)" },
    }),
    cartaoDeConsulta({
      titulo: "Supervisão Médica a Pacientes Flamenguistas",
      ajuda: "Preceptores que supervisionaram residentes em atendimentos a pacientes torcedores do Flamengo.",
      caminho: "/preceptores/supervisionados-flamenguistas",
      colunas: ["preceptor", "titulacao", "especialidade",
                "atendimentos_com_flamenguista", "residentes_supervisionados"],
    }),
    cartaoDeConsulta({
      titulo: "Índice de Procedimentos de Alto Risco por Residente",
      ajuda: "Proporção de procedimentos de risco ALTO executados por médico residente.",
      caminho: "/residentes/percentual-alto-risco",
      colunas: ["residente", "ano_residencia", "total_procedimentos",
                "procedimentos_alto_risco", "percentual_alto_risco"],
      rotulos: { percentual_alto_risco: "percentual (%)" },
    }),
    cartaoDeConsulta({
      titulo: "Último Atendimento Registrado por Paciente",
      ajuda: "Histórico consolidado do atendimento mais recente de cada paciente.",
      caminho: "/pacientes/ultimo-atendimento",
      colunas: ["paciente", "data_hora", "unidade", "residente", "preceptor", "procedimentos"],
      transformar: (itens) => itens.map(i => ({
        ...i,
        procedimentos: i.procedimentos
          .map(p => `${p.nome} (${p.nivel_risco || "sem risco"}, ${p.quantidade}x)`)
          .join("; "),
      })),
    }),
  ];

  for (const { cartao, recarregar } of cartoes) {
    raiz.append(cartao);
    recarregar();
  }

  /* --- lazy contra eager --- */

  const areaCarregamento = el("div");
  const cartaoCarregamento = el("div", { class: "card" },
    el("h2", {}, "Diagnóstico de Performance de Consultas (Lazy vs Eager Loading)"),
    el("p", { class: "ajuda" },
      "Mede o número de consultas ao banco ao buscar atendimentos com e sem carregamento adiantado."),
    el("div", { class: "acoes-form" },
      el("button", { class: "botao", type: "button", onclick: () => medirCarregamento() },
        "Executar Diagnóstico")),
    areaCarregamento);

  async function medirCarregamento() {
    areaCarregamento.innerHTML = "";
    areaCarregamento.append(el("p", { class: "vazio" }, "Medindo..."));
    try {
      const r = await chamarApi("GET", "/consultas/lazy-vs-eager");
      areaCarregamento.innerHTML = "";
      areaCarregamento.append(tabelaSimples([r],
        ["atendimentos", "consultas_lazy", "consultas_eager", "resultados_iguais"],
        { consultas_lazy: "consultas (sob demanda)", consultas_eager: "consultas (adiantado)",
          resultados_iguais: "mesmo resultado" }));
      areaCarregamento.append(el("p", { class: "ajuda" }, r.observacao));
    } catch (e) {
      areaCarregamento.innerHTML = "";
      areaCarregamento.append(el("p", { class: "vazio" }, "Erro: " + e.message));
    }
  }
  raiz.append(cartaoCarregamento);

  /* --- as quatro analíticas da Etapa 1, agora em DSL --- */

  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Indicadores Gerenciais Avançados"),
    el("p", { class: "ajuda" },
      "Relatórios gerenciais consolidados do sistema hospitalar.")));

  const analiticas = [
    cartaoDeConsulta({
      titulo: "1. Ranking de Residentes por Volume de Atendimentos",
      ajuda: "Total de atendimentos por residente.",
      caminho: "/analiticas/ranking-residentes",
      colunas: ["nome", "ano_residencia", "total_atendimentos"],
    }),
    cartaoDeConsulta({
      titulo: "2. Preceptores com Alta Produtividade em Julho/2026",
      ajuda: "Preceptores que supervisionaram mais de 5 atendimentos no mês.",
      caminho: "/analiticas/preceptores-por-mes?mes=2026-07-01&minimo=5",
      colunas: ["nome", "titulacao", "total_supervisionados"],
    }),
    cartaoDeConsulta({
      titulo: "3. Ocupação de Plantões por Unidade (Grade Semanal)",
      ajuda: "Distribuição semanal de residentes por unidade hospitalar.",
      caminho: "/analiticas/plantoes-por-unidade",
      colunas: ["unidade", "residente", "plantoes"],
    }),
    cartaoDeConsulta({
      titulo: "3b. Projeção Mensal de Plantões",
      ajuda: "Projeção total de plantões no mês corrente.",
      caminho: "/analiticas/plantoes-por-unidade?projetar_no_mes=true",
      colunas: ["unidade", "residente", "plantoes"],
    }),
    cartaoDeConsulta({
      titulo: "4. Pacientes Sem Histórico de Procedimentos de Alto Risco",
      ajuda: "Lista pacientes que nunca realizaram procedimentos classificados como risco alto.",
      caminho: "/analiticas/pacientes-sem-alto-risco",
      colunas: ["nome", "grupo_sanguineo", "numero_convenio"],
    }),
  ];

  for (const { cartao, recarregar } of analiticas) {
    raiz.append(cartao);
    recarregar();
  }
}

/* ---------- aba: concorrência ---------- */

function montarAbaConcorrencia() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("div", { class: "aviso" },
    "Simulação de acessos simultâneos e disputa por escalas médicas em tempo real."));

  const area = el("div");

  const botao = el("button", { class: "botao salvar", type: "button" },
    "Iniciar Teste de Estresse");

  botao.addEventListener("click", async () => {
    botao.disabled = true;
    area.innerHTML = "";
    area.append(el("p", { class: "vazio" },
      "Simulando acessos concorrentes em paralelo. Por favor, aguarde alguns segundos..."));
    try {
      const r = await chamarApi("POST", "/concorrencia/simular");
      area.innerHTML = "";
      for (const cenario of r.cenarios) {
        const log = tabelaSimples(cenario.log, ["instante", "ator", "mensagem"]);
        area.append(el("div", { class: "card" },
          el("h2", {}, cenario.cenario + (cenario.conflito_evitado ? "" : " (conflito detectado)")),
          el("p", { class: "ajuda" }, cenario.descricao),
          log,
          el("p", { class: "ajuda" }, "Resultado: " + cenario.desfecho)));
      }
      const todosOk = r.cenarios.every(c => c.conflito_evitado);
      toast(todosOk ? "Todos os cenários de concorrência foram gerenciados com sucesso."
                    : "Conflito de concorrência detectado.",
            todosOk ? "ok" : "erro");
    } catch (e) {
      area.innerHTML = "";
      area.append(el("p", { class: "vazio" }, "Erro: " + e.message));
      toast(e.message, "erro");
    } finally {
      botao.disabled = false;
    }
  });

  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Simulação de Concorrência e Bloqueios em Tempo Real"),
    el("p", { class: "ajuda" },
      "Simula duas sessões médicas tentando alterar a mesma escala simultaneamente para demonstrar bloqueios otimistas e pessimistas."),
    el("div", { class: "acoes-form" }, botao)));
  raiz.append(area);
}


/* ---------- registro das abas ---------- */

function registrarRecursosEtapa2(RECURSOS) {
  /* Internações usam a máquina de CRUD genérica do app.js. */
  RECURSOS["internacoes"] = {
    titulo: "Internações",
    caminho: "/internacoes/",
    chave: ["id_internacao"],
    podeEditar: true,
    podeExcluir: true,
    aviso: "Um índice parcial no banco impede que o mesmo paciente tenha duas internações " +
           "abertas ao mesmo tempo. A alta é registrada pelo perfil da internação.",
    campos: [
      { nome: "id_paciente", rotulo: "Paciente", tipo: "lookup", recurso: "pacientes", decorado: "paciente",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
      { nome: "id_unidade", rotulo: "Unidade", tipo: "lookup", recurso: "unidades", decorado: "unidade",
        rotuloOpcao: u => `${u.id_unidade} — ${u.nome}`, valorOpcao: u => u.id_unidade },
      { nome: "data_hora_entrada", rotulo: "Entrada", tipo: "datetime-local", obrigatorio: true },
      { nome: "motivo", rotulo: "Motivo", tipo: "text" },
    ],
    colunas: ["id_internacao", "paciente", "unidade", "data_hora_entrada", "data_hora_saida", "motivo"],
    decorar: async (itens) => {
      const [pac, uni] = await Promise.all([
        mapaPorId("pacientes", "id_pessoa"),
        mapaPorId("unidades", "id_unidade"),
      ]);
      return itens.map(i => ({
        ...i,
        paciente: rotularPessoa(pac, i.id_paciente),
        unidade: uni[i.id_unidade] ? `${uni[i.id_unidade].nome} (id ${i.id_unidade})` : `id ${i.id_unidade}`,
      }));
    },
    busca: [
      { nome: "id_paciente", rotulo: "Paciente", tipo: "lookup", recurso: "pacientes",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
      { nome: "id_unidade", rotulo: "Unidade", tipo: "lookup", recurso: "unidades",
        rotuloOpcao: u => `${u.id_unidade} — ${u.nome}`, valorOpcao: u => u.id_unidade },
      { nome: "apenas_abertas", rotulo: "Só internações abertas", tipo: "select",
        opcoes: [{ valor: "true", rotulo: "sim" }] },
    ],
    perfil: {
      rotuloItem: i => `Internação nº ${i.id_internacao}`,
      relacionados: [],
      acoesExtra: (item) => {
        if (item.data_hora_saida) return [];
        return [el("button", { class: "botao salvar", onclick: async () => {
          if (!confirm(`Registrar alta da internação ${item.id_internacao} agora?`)) return;
          try {
            await chamarApi("POST", `/internacoes/${item.id_internacao}/alta`, {});
            toast("Alta registrada. O paciente sai da view de internados.", "ok");
            ativarAba("internacoes");
          } catch (e) { toast(e.message, "erro"); }
        } }, "Dar alta")];
      },
    },
  };

  RECURSOS["views"] = { titulo: "Painel Clínico", montar: montarAbaViews };
  RECURSOS["procedures"] = { titulo: "Novo Atendimento", montar: montarAbaProcedures };
  RECURSOS["auditoria"] = { titulo: "Auditoria", montar: montarAbaAuditoria };
  RECURSOS["consultas-orm"] = { titulo: "Indicadores", montar: montarAbaConsultasOrm };
  RECURSOS["concorrencia"] = { titulo: "Simulação de Concorrência", montar: montarAbaConcorrencia };
}
