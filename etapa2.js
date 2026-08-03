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
    "As views são objetos do banco, criadas em 08_etapa2_views.sql. " +
    "A API só faz SELECT sobre elas."));

  const cartoes = [
    cartaoDeConsulta({
      titulo: "Pacientes internados (vw_pacientes_internados)",
      ajuda: "Entra quem tem a internação mais recente sem data de saída. Uma alta na última " +
             "internação tira o paciente da lista, mesmo que exista uma internação antiga em aberto.",
      caminho: "/pacientes/internados",
      colunas: ["nome", "cpf", "grupo_sanguineo", "unidade", "data_hora_entrada", "motivo"],
      rotulos: { data_hora_entrada: "entrada", cpf: "CPF" },
    }),
    cartaoDeConsulta({
      titulo: "Residentes sem supervisor doutor (vw_residentes_sem_supervisor)",
      ajuda: "Plantões cujo preceptor responsável não tem titulação de doutor.",
      caminho: "/residentes/sem-supervisor-doutor",
      colunas: ["residente", "ano_residencia", "unidade", "dia_semana", "turno", "preceptor", "titulacao", "motivo"],
    }),
    cartaoDeConsulta({
      titulo: "Estatísticas mensais (vw_estatisticas_atendimentos_mensal)",
      ajuda: "Agrupado por mês e unidade. Registros antigos sem unidade ficam de fora.",
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
    "As duas rotinas abaixo gravam dentro de uma transação só. Se um passo falhar, " +
    "o banco desfaz os anteriores."));

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
  const linhasProcedimento = el("div");
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

  const areaResultado = el("div");

  formAtendimento.append(el("div", { class: "acoes-form" },
    el("button", { class: "botao salvar", type: "submit" }, "Registrar tudo numa transação"),
    el("button", { class: "botao", type: "button", onclick: acrescentarLinha },
      "+ Outro procedimento")));

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
      toast("Escolha ao menos um procedimento: a procedure recusa lista vazia.", "erro");
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
        "Transação revertida: " + e.message));
    }
  });

  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Registrar atendimento completo (sp_registrar_atendimento_completo)"),
    el("p", { class: "ajuda" },
      "O atendimento e a lista de procedimentos vão numa chamada só, com os procedimentos " +
      "em JSON. Para ver a reversão, repita um procedimento na lista: a chave primária " +
      "composta recusa e aí nem o atendimento é gravado."),
    formAtendimento,
    el("h2", {}, "Procedimentos deste atendimento"),
    linhasProcedimento,
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
    el("button", { class: "botao salvar", type: "submit" }, "Reajustar")));

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
    el("h2", {}, "Reajustar escala (sp_reajustar_escala)"),
    el("p", { class: "ajuda" },
      "Move de uma vez todos os plantões do residente de um dia e turno para outro, e " +
      "recusa se ele já tiver plantão no destino. Com os dados do seed, o residente 14 " +
      "sai de sexta/manhã para quinta/manhã; o 12 não sai de quinta/manhã para segunda/manhã. " +
      "A coluna versao sobe a cada movimentação aceita."),
    formReajuste,
    el("h2", {}, "Escalas atuais"),
    escalasApos));
  recarregarEscalas();
}

/* ---------- aba: auditoria ---------- */

function montarAbaAuditoria() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("div", { class: "aviso" },
    "Tudo aqui foi gravado pelo trigger trg_audita_atendimento, inclusive as linhas de " +
    "atendimentos que já foram apagados. A API não escreve nesta tabela."));

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

  /* Cada linha mostra o que mudou, comparando os dois JSON campo a campo.
     Guardar a linha inteira em JSON é o que permite fazer isso sem saber de
     antemão quais colunas a tabela tem. */
  function diferencas(antes, depois) {
    if (!antes) return "linha criada";
    if (!depois) return "linha removida";
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
    el("h2", {}, "Consultar auditoria de atendimentos"),
    el("p", { class: "ajuda" },
      "Crie, edite ou apague um atendimento na aba Atendimentos para ver linhas novas aqui."),
    formFiltro));
  raiz.append(el("div", { class: "card" }, el("h2", {}, "Histórico"), area));
  carregar();
}

/* ---------- aba: consultas com ORM ---------- */

function montarAbaConsultasOrm() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("div", { class: "aviso" },
    "As consultas desta aba são montadas com a DSL do SQLAlchemy. O SQL equivalente " +
    "está em 10_etapa2_verificacao.sql e em 04_analiticas.sql, para comparar os resultados."));

  const cartoes = [
    cartaoDeConsulta({
      titulo: "Tempo médio de espera por unidade (sp_calcular_tempo_medio_espera)",
      ajuda: "Intervalo entre a chegada do paciente e o início do primeiro procedimento.",
      caminho: "/atendimentos/tempo-medio-espera",
      colunas: ["nome_unidade", "atendimentos_considerados", "espera_media_minutos"],
      rotulos: { nome_unidade: "unidade", espera_media_minutos: "espera média (min)" },
    }),
    cartaoDeConsulta({
      titulo: "Preceptores de pacientes flamenguistas",
      ajuda: "Preceptores que supervisionaram residentes no atendimento a pacientes com is_flamengo verdadeiro.",
      caminho: "/preceptores/supervisionados-flamenguistas",
      colunas: ["preceptor", "titulacao", "especialidade",
                "atendimentos_com_flamenguista", "residentes_supervisionados"],
    }),
    cartaoDeConsulta({
      titulo: "Percentual de procedimentos de alto risco por residente",
      ajuda: "A contagem é por registro de procedimento realizado e ignora a coluna quantidade. " +
             "Residente sem procedimento aparece com 0%.",
      caminho: "/residentes/percentual-alto-risco",
      colunas: ["residente", "ano_residencia", "total_procedimentos",
                "procedimentos_alto_risco", "percentual_alto_risco"],
      rotulos: { percentual_alto_risco: "percentual (%)" },
    }),
    cartaoDeConsulta({
      titulo: "Último atendimento de cada paciente",
      ajuda: "Função de janela para achar o mais recente, com os relacionamentos carregados de uma vez.",
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
    el("h2", {}, "Carregamento sob demanda contra adiantado"),
    el("p", { class: "ajuda" },
      "Percorre os atendimentos lendo o nome do paciente das duas formas e conta " +
      "quantas instruções SQL cada uma dispara. A diferença é o N+1."),
    el("div", { class: "acoes-form" },
      el("button", { class: "botao", type: "button", onclick: () => medirCarregamento() },
        "Medir agora")),
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
    el("h2", {}, "As consultas analíticas da Etapa 1, reescritas em DSL"),
    el("p", { class: "ajuda" },
      "O item 4 da Etapa 2 pede as operações da Etapa 1 reimplementadas com ORM. " +
      "Estas quatro antes só rodavam pelo psql.")));

  const analiticas = [
    cartaoDeConsulta({
      titulo: "1. Ranking de residentes por atendimentos",
      ajuda: "Junção externa: residente sem atendimento aparece com total zero.",
      caminho: "/analiticas/ranking-residentes",
      colunas: ["nome", "ano_residencia", "total_atendimentos"],
    }),
    cartaoDeConsulta({
      titulo: "2. Preceptores com mais de 5 atendimentos em julho de 2026",
      ajuda: "WHERE filtra o mês antes de agrupar; HAVING filtra a contagem depois.",
      caminho: "/analiticas/preceptores-por-mes?mes=2026-07-01&minimo=5",
      colunas: ["nome", "titulacao", "total_supervisionados"],
    }),
    cartaoDeConsulta({
      titulo: "3. Plantões por residente em cada unidade (grade semanal)",
      ajuda: "A escala guarda dia da semana e turno, sem data. Aqui a contagem é das posições da grade.",
      caminho: "/analiticas/plantoes-por-unidade",
      colunas: ["unidade", "residente", "plantoes"],
    }),
    cartaoDeConsulta({
      titulo: "3b. Plantões projetados no mês corrente",
      ajuda: "Mesma grade, multiplicada pelas ocorrências de cada dia da semana no mês.",
      caminho: "/analiticas/plantoes-por-unidade?projetar_no_mes=true",
      colunas: ["unidade", "residente", "plantoes"],
    }),
    cartaoDeConsulta({
      titulo: "4. Pacientes que nunca fizeram procedimento de risco ALTO",
      ajuda: "Feita com NOT EXISTS. Com NOT IN, um NULL na subconsulta zeraria o resultado sem dar erro.",
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
    "A simulação abre duas sessões em threads separadas e faz as duas disputarem a " +
    "mesma escala. No fim ela apaga o que criou, e o banco volta como estava."));

  const area = el("div");

  const botao = el("button", { class: "botao salvar", type: "button" },
    "Rodar os cenários");

  botao.addEventListener("click", async () => {
    botao.disabled = true;
    area.innerHTML = "";
    area.append(el("p", { class: "vazio" },
      "Executando. Os cenários esperam por bloqueio, então isso leva alguns segundos."));
    try {
      const r = await chamarApi("POST", "/concorrencia/simular");
      area.innerHTML = "";
      for (const cenario of r.cenarios) {
        const log = tabelaSimples(cenario.log, ["instante", "ator", "mensagem"]);
        area.append(el("div", { class: "card" },
          el("h2", {}, cenario.cenario + (cenario.conflito_evitado ? "" : " (conflito não evitado)")),
          el("p", { class: "ajuda" }, cenario.descricao),
          log,
          el("p", { class: "ajuda" }, "Desfecho: " + cenario.desfecho)));
      }
      const todosOk = r.cenarios.every(c => c.conflito_evitado);
      toast(todosOk ? "Todos os cenários terminaram como esperado."
                    : "Algum cenário não terminou como esperado. Confira os logs.",
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
    el("h2", {}, "Duas transações disputando a mesma escala"),
    el("p", { class: "ajuda" },
      "No cenário 1 só as restrições do banco seguram: as duas sessões consultam, nenhuma " +
      "vê conflito e a segunda quebra na gravação. O cenário 2 usa bloqueio pessimista " +
      "(SELECT ... FOR UPDATE) e a segunda sessão desiste com mensagem de negócio. O cenário 3 " +
      "usa bloqueio otimista pela coluna versao e a segunda recebe StaleDataError. " +
      "A mesma simulação roda no terminal com python demo_concorrencia.py."),
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

  RECURSOS["views"] = { titulo: "Views", montar: montarAbaViews };
  RECURSOS["procedures"] = { titulo: "Procedures", montar: montarAbaProcedures };
  RECURSOS["auditoria"] = { titulo: "Auditoria", montar: montarAbaAuditoria };
  RECURSOS["consultas-orm"] = { titulo: "Consultas ORM", montar: montarAbaConsultasOrm };
  RECURSOS["concorrencia"] = { titulo: "Concorrência", montar: montarAbaConcorrencia };
}
