/* ============================================================
   Frontend - Sistema de Gestão Hospitalar Dra. Yuska Maritan Brito
   Consome a API FastAPI através do proxy local /api (ver server.py)
   ============================================================ */

const API = "/api";

/* ---------- utilitários ---------- */

async function chamarApi(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo !== undefined) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(corpo);
  }
  let resposta;
  try {
    resposta = await fetch(API + caminho, opcoes);
  } catch (e) {
    throw new Error("Não foi possível falar com a API. O backend está rodando na porta 8000?");
  }
  if (resposta.status === 204) return null;
  let dados = null;
  try { dados = await resposta.json(); } catch (e) { /* corpo vazio */ }
  if (!resposta.ok) {
    const detalhe = dados && dados.detail
      ? (typeof dados.detail === "string" ? dados.detail : JSON.stringify(dados.detail, null, 2))
      : `Erro HTTP ${resposta.status}`;
    throw new Error(detalhe);
  }
  return dados;
}

function toast(mensagem, tipo) {
  const el = document.getElementById("toast");
  el.textContent = mensagem;
  el.className = tipo; // "ok" | "erro"
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = "hidden"; }, tipo === "erro" ? 8000 : 3500);
}

function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const f of filhos) {
    if (f === null || f === undefined) continue;
    n.append(f.nodeType ? f : document.createTextNode(f));
  }
  return n;
}

/* ---------- definição dos recursos (espelha os schemas Pydantic) ---------- */

const GRUPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const TURNOS = ["manha", "tarde", "noite"];

const camposPessoa = [
  { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
  { nome: "CPF", rotulo: "CPF (11 dígitos)", tipo: "text", obrigatorio: true, maxlength: 11, minlength: 11 },
  { nome: "data_nascimento", rotulo: "Data de nascimento", tipo: "date", obrigatorio: true },
  { nome: "telefone", rotulo: "Telefone", tipo: "text" },
  { nome: "endereco", rotulo: "Endereço", tipo: "text" },
  { nome: "is_flamengo", rotulo: "É flamenguista?", tipo: "checkbox" },
];

const RECURSOS = {
  pacientes: {
    titulo: "Pacientes",
    caminho: "/pacientes/",
    chave: ["id_pessoa"],
    podeEditar: true,
    podeExcluir: true,
    listavel: true,
    campos: [
      ...camposPessoa,
      { nome: "num_convenio", rotulo: "Nº do convênio", tipo: "text", obrigatorio: true },
      { nome: "alergias", rotulo: "Alergias", tipo: "text" },
      { nome: "grupo_sanguineo", rotulo: "Grupo sanguíneo", tipo: "select", opcoes: GRUPOS_SANGUINEOS },
    ],
    colunas: ["id_pessoa", "nome", "CPF", "num_convenio", "grupo_sanguineo", "telefone"],
  },

  preceptores: {
    titulo: "Preceptores",
    caminho: "/preceptores/",
    chave: ["id_pessoa"],
    podeEditar: false,   // o backend só oferece criar e listar
    podeExcluir: false,
    listavel: true,
    campos: [
      ...camposPessoa,
      { nome: "CRM", rotulo: "CRM", tipo: "text", obrigatorio: true },
      { nome: "data_admissao", rotulo: "Data de admissão", tipo: "date", obrigatorio: true },
      { nome: "especialidade", rotulo: "Especialidade", tipo: "text", obrigatorio: true },
      { nome: "titulacao", rotulo: "Titulação", tipo: "text", obrigatorio: true },
    ],
    colunas: ["id_pessoa", "nome", "CRM", "especialidade", "titulacao"],
  },

  residentes: {
    titulo: "Residentes",
    caminho: "/residentes/",
    chave: ["id_pessoa"],
    podeEditar: true,
    podeExcluir: true,
    listavel: true,
    campos: [
      ...camposPessoa,
      { nome: "CRM", rotulo: "CRM", tipo: "text", obrigatorio: true },
      { nome: "data_admissao", rotulo: "Data de admissão", tipo: "date", obrigatorio: true },
      { nome: "especialidade", rotulo: "Especialidade", tipo: "text", obrigatorio: true },
      { nome: "ano_residencia", rotulo: "Ano de residência", tipo: "select", opcoes: ["R1", "R2", "R3"], obrigatorio: true },
    ],
    colunas: ["id_pessoa", "nome", "CRM", "especialidade", "ano_residencia"],
  },

  atendimentos: {
    titulo: "Atendimentos",
    caminho: "/atendimentos/",
    chave: ["id_atendimento"],
    podeEditar: true,
    podeExcluir: true,
    listavel: true,
    campos: [
      { nome: "data_hora", rotulo: "Data e hora", tipo: "datetime-local", obrigatorio: true },
      { nome: "duracao_minutos", rotulo: "Duração (min)", tipo: "number", obrigatorio: true, min: 1 },
      { nome: "id_paciente", rotulo: "Paciente", tipo: "lookup", recurso: "pacientes",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa,
        dica: "id do paciente (seed: 1 a 5)" },
      { nome: "id_residente", rotulo: "Residente", tipo: "lookup", recurso: "residentes",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa,
        dica: "id do residente (seed: 11 a 15)" },
      { nome: "id_preceptor", rotulo: "Preceptor", tipo: "lookup", recurso: "preceptores",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa,
        dica: "id do preceptor (seed: 6 a 10)" },
    ],
    colunas: ["id_atendimento", "data_hora", "duracao_minutos", "id_paciente", "id_residente", "id_preceptor"],
  },

  procedimentos: {
    titulo: "Procedimentos",
    caminho: "/procedimentos/",
    chave: ["id_procedimento"],
    podeEditar: true,
    podeExcluir: true,
    listavel: true,
    campos: [
      { nome: "codigo", rotulo: "Código (número)", tipo: "number", obrigatorio: true },
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
      { nome: "tempo_medio_minutos", rotulo: "Tempo médio (min)", tipo: "number", obrigatorio: true, min: 1 },
      { nome: "nivel_risco", rotulo: "Nível de risco", tipo: "select", opcoes: ["BAIXO", "MEDIO", "ALTO"], obrigatorio: true },
    ],
    colunas: ["id_procedimento", "codigo", "nome", "tempo_medio_minutos", "nivel_risco"],
  },

  "procedimentos-realizados": {
    titulo: "Proc. Realizados",
    especial: "procRealizado",
  },

  escalas: {
    titulo: "Escalas",
    caminho: "/escalas/",
    chave: ["id_escala"],
    podeEditar: true,
    podeExcluir: true,
    listavel: true,
    campos: [
      { nome: "id_unidade", rotulo: "Unidade", tipo: "lookup", recurso: "unidades",
        rotuloOpcao: u => `${u.id_unidade} — ${u.nome}`, valorOpcao: u => u.id_unidade },
      { nome: "dia_semana", rotulo: "Dia da semana", tipo: "select", opcoes: DIAS, obrigatorio: true },
      { nome: "turno", rotulo: "Turno", tipo: "select", opcoes: TURNOS, obrigatorio: true },
      { nome: "id_residente", rotulo: "Residente", tipo: "lookup", recurso: "residentes",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa,
        dica: "id do residente (seed: 11 a 15)" },
      { nome: "id_preceptor", rotulo: "Preceptor", tipo: "lookup", recurso: "preceptores",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
    ],
    colunas: ["id_escala", "id_unidade", "dia_semana", "turno", "id_residente", "id_preceptor"],
  },

  unidades: {
    titulo: "Unidades",
    caminho: "/unidades/",
    chave: ["id_unidade"],
    podeEditar: true,
    podeExcluir: true,
    listavel: true,
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
      { nome: "tipo", rotulo: "Tipo", tipo: "text", obrigatorio: true, dica: "Enfermaria, UTI, Pronto-Socorro..." },
      { nome: "capacidade_leitos", rotulo: "Capacidade de leitos", tipo: "number", obrigatorio: true, min: 0 },
    ],
    colunas: ["id_unidade", "nome", "tipo", "capacidade_leitos"],
  },
};

/* ---------- construção de formulários ---------- */

function criarCampo(campo) {
  if (campo.tipo === "checkbox") {
    const input = el("input", { type: "checkbox", name: campo.nome });
    return el("label", { class: "chk" }, input, campo.rotulo);
  }

  let controle;
  if (campo.tipo === "select") {
    controle = el("select", { name: campo.nome });
    if (!campo.obrigatorio) controle.append(el("option", { value: "" }, "—"));
    for (const o of campo.opcoes) controle.append(el("option", { value: o }, o));
  } else if (campo.tipo === "lookup") {
    // tenta carregar as opções da API; se falhar, vira campo numérico simples
    controle = el("select", { name: campo.nome });
    controle.append(el("option", { value: "" }, "carregando..."));
    carregarLookup(controle, campo);
  } else {
    const attrs = { type: campo.tipo, name: campo.nome };
    if (campo.obrigatorio) attrs.required = "";
    if (campo.maxlength) attrs.maxlength = campo.maxlength;
    if (campo.minlength) attrs.minlength = campo.minlength;
    if (campo.min !== undefined) attrs.min = campo.min;
    controle = el("input", attrs);
  }

  const rotulo = el("label", {}, campo.rotulo);
  if (campo.dica) rotulo.append(el("span", { class: "dica" }, campo.dica));
  rotulo.append(controle);
  return rotulo;
}

async function carregarLookup(select, campo) {
  try {
    const itens = await chamarApi("GET", RECURSOS[campo.recurso].caminho);
    select.innerHTML = "";
    select.append(el("option", { value: "" }, "selecione..."));
    for (const item of itens) {
      select.append(el("option", { value: campo.valorOpcao(item) }, campo.rotuloOpcao(item)));
    }
  } catch (e) {
    // fallback: troca o select por input numérico para não travar o formulário
    const input = el("input", { type: "number", name: campo.nome, placeholder: campo.dica || "id" });
    select.replaceWith(input);
  }
}

function lerFormulario(form, campos) {
  const dados = {};
  for (const campo of campos) {
    const controle = form.querySelector(`[name="${campo.nome}"]`);
    if (!controle) continue;
    if (campo.tipo === "checkbox") {
      dados[campo.nome] = controle.checked;
    } else if (controle.value === "") {
      dados[campo.nome] = null;
    } else if (campo.tipo === "number" && !campo.comoTexto) {
      dados[campo.nome] = Number(controle.value);
    } else if (campo.tipo === "lookup") {
      dados[campo.nome] = Number(controle.value);
    } else {
      dados[campo.nome] = controle.value; // comoTexto: número enviado como string (schema espera str)
    }
  }
  return dados;
}

function preencherFormulario(form, campos, item) {
  for (const campo of campos) {
    const controle = form.querySelector(`[name="${campo.nome}"]`);
    if (!controle) continue;
    const valor = item[campo.nome];
    if (campo.tipo === "checkbox") controle.checked = Boolean(valor);
    else if (campo.tipo === "datetime-local" && valor) controle.value = String(valor).slice(0, 16);
    else controle.value = valor === null || valor === undefined ? "" : valor;
  }
}

/* ---------- aba CRUD genérica ---------- */

function montarAbaCrud(chaveRecurso) {
  const cfg = RECURSOS[chaveRecurso];
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  if (cfg.aviso) raiz.append(el("div", { class: "aviso" }, "⚠️ " + cfg.aviso));

  // --- formulário ---
  const form = el("form", { class: "crud-form" });
  for (const campo of cfg.campos) form.append(criarCampo(campo));

  const idEmEdicao = { valor: null };
  const botaoSalvar = el("button", { class: "botao salvar", type: "submit" }, "Cadastrar");
  const botaoCancelar = el("button", { class: "botao neutro", type: "button", onclick: cancelarEdicao }, "Cancelar edição");
  botaoCancelar.style.display = "none";
  form.append(el("div", { class: "acoes-form" }, botaoSalvar, botaoCancelar));

  function cancelarEdicao() {
    idEmEdicao.valor = null;
    form.reset();
    botaoSalvar.textContent = "Cadastrar";
    botaoCancelar.style.display = "none";
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const dados = lerFormulario(form, cfg.campos);
    try {
      if (idEmEdicao.valor === null) {
        await chamarApi("POST", cfg.caminho, dados);
        toast(`${cfg.titulo}: cadastrado com sucesso!`, "ok");
      } else {
        await chamarApi("PUT", cfg.caminho + idEmEdicao.valor, dados);
        toast(`${cfg.titulo}: atualizado com sucesso!`, "ok");
      }
      cancelarEdicao();
      await atualizarTabela();
    } catch (e) {
      toast(e.message, "erro");
    }
  });

  raiz.append(el("div", { class: "card" },
    el("h2", {}, (cfg.podeEditar ? "Cadastrar / editar " : "Cadastrar ") + cfg.titulo.toLowerCase()),
    form));

  // --- tabela ---
  const areaTabela = el("div", { class: "tabela-wrap" });
  raiz.append(el("div", { class: "card" }, el("h2", {}, "Lista de " + cfg.titulo.toLowerCase()), areaTabela));

  async function atualizarTabela() {
    areaTabela.innerHTML = "";
    let itens;
    try {
      itens = await chamarApi("GET", cfg.caminho);
    } catch (e) {
      areaTabela.append(el("p", { class: "vazio" }, "Erro ao listar: " + e.message));
      return;
    }
    if (!itens || itens.length === 0) {
      areaTabela.append(el("p", { class: "vazio" }, "Nenhum registro."));
      return;
    }
    const tabela = el("table");
    const cab = el("tr");
    for (const c of cfg.colunas) cab.append(el("th", {}, c));
    if (cfg.podeEditar || cfg.podeExcluir) cab.append(el("th", {}, "ações"));
    tabela.append(cab);

    for (const item of itens) {
      const linha = el("tr");
      for (const c of cfg.colunas) {
        let valor = item[c];
        if (valor === null || valor === undefined) valor = "—";
        if (typeof valor === "boolean") valor = valor ? "sim" : "não";
        linha.append(el("td", {}, String(valor)));
      }
      if (cfg.podeEditar || cfg.podeExcluir) {
        const celula = el("td");
        const id = item[cfg.chave[0]];
        if (cfg.podeEditar) {
          celula.append(el("button", { class: "editar", onclick: () => {
            idEmEdicao.valor = id;
            preencherFormulario(form, cfg.campos, item);
            botaoSalvar.textContent = "Salvar alterações";
            botaoCancelar.style.display = "";
            window.scrollTo({ top: 0, behavior: "smooth" });
          } }, "Editar"));
        }
        if (cfg.podeExcluir) {
          celula.append(el("button", { class: "excluir", onclick: async () => {
            if (!confirm(`Excluir registro ${id}?`)) return;
            try {
              await chamarApi("DELETE", cfg.caminho + id);
              toast("Registro excluído.", "ok");
              await atualizarTabela();
            } catch (e) { toast(e.message, "erro"); }
          } }, "Excluir"));
        }
        linha.append(celula);
      }
      tabela.append(linha);
    }
    areaTabela.append(tabela);
  }

  atualizarTabela();
}

/* ---------- aba especial: procedimentos realizados (chave composta) ---------- */

function montarAbaProcRealizado() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("div", { class: "aviso" },
    "ℹ️ O backend não possui listagem geral de procedimentos realizados — " +
    "a consulta é feita pela chave composta (atendimento + procedimento)."));

  const campos = [
    { nome: "id_atendimento", rotulo: "Atendimento", tipo: "lookup", recurso: "atendimentos",
      rotuloOpcao: a => `${a.id_atendimento} — ${String(a.data_hora).slice(0, 16).replace("T", " ")}`,
      valorOpcao: a => a.id_atendimento },
    { nome: "id_procedimento", rotulo: "Procedimento", tipo: "lookup", recurso: "procedimentos",
      rotuloOpcao: p => `${p.id_procedimento} — ${p.nome}`, valorOpcao: p => p.id_procedimento },
    { nome: "quantidade", rotulo: "Quantidade", tipo: "number", obrigatorio: true, min: 1 },
    { nome: "tempo_real_minutos", rotulo: "Tempo real (min)", tipo: "number", obrigatorio: true, min: 1 },
    { nome: "observacao", rotulo: "Observação", tipo: "text" },
    { nome: "faturado", rotulo: "Já faturado?", tipo: "checkbox" },
  ];

  const form = el("form", { class: "crud-form" });
  for (const campo of campos) form.append(criarCampo(campo));

  const botaoCriar = el("button", { class: "botao salvar", type: "submit" }, "Registrar");
  const botaoBuscar = el("button", { class: "botao", type: "button", onclick: buscar }, "Buscar pela chave");
  const botaoAtualizar = el("button", { class: "botao", type: "button", onclick: atualizar }, "Atualizar");
  const botaoExcluir = el("button", { class: "botao neutro", type: "button", onclick: excluir }, "Excluir");
  form.append(el("div", { class: "acoes-form" }, botaoCriar, botaoBuscar, botaoAtualizar, botaoExcluir));

  const resultado = el("div", { class: "tabela-wrap" });

  function chaves() {
    const d = lerFormulario(form, campos);
    if (!d.id_atendimento || !d.id_procedimento) {
      throw new Error("Selecione o atendimento e o procedimento.");
    }
    return d;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const d = chaves();
      await chamarApi("POST", "/procedimentos-realizados/", d);
      toast("Procedimento registrado no atendimento!", "ok");
      mostrar(d);
    } catch (e) { toast(e.message, "erro"); }
  });

  async function buscar() {
    try {
      const d = chaves();
      const item = await chamarApi("GET", `/procedimentos-realizados/${d.id_atendimento}/${d.id_procedimento}`);
      preencherFormulario(form, campos, item);
      mostrar(item);
      toast("Registro encontrado.", "ok");
    } catch (e) { toast(e.message, "erro"); }
  }

  async function atualizar() {
    try {
      const d = chaves();
      const corpo = { quantidade: d.quantidade, tempo_real_minutos: d.tempo_real_minutos,
                      observacao: d.observacao, faturado: d.faturado };
      const item = await chamarApi("PUT", `/procedimentos-realizados/${d.id_atendimento}/${d.id_procedimento}`, corpo);
      mostrar(item);
      toast("Registro atualizado.", "ok");
    } catch (e) { toast(e.message, "erro"); }
  }

  async function excluir() {
    try {
      const d = chaves();
      if (!confirm("Excluir este procedimento realizado?")) return;
      await chamarApi("DELETE", `/procedimentos-realizados/${d.id_atendimento}/${d.id_procedimento}`);
      resultado.innerHTML = "";
      toast("Registro excluído.", "ok");
    } catch (e) { toast(e.message, "erro"); }
  }

  function mostrar(item) {
    resultado.innerHTML = "";
    const tabela = el("table");
    const cab = el("tr");
    const cols = ["id_atendimento", "id_procedimento", "quantidade", "tempo_real_minutos", "observacao", "faturado"];
    for (const c of cols) cab.append(el("th", {}, c));
    tabela.append(cab);
    const linha = el("tr");
    for (const c of cols) {
      let v = item[c];
      if (v === null || v === undefined) v = "—";
      if (typeof v === "boolean") v = v ? "sim" : "não";
      linha.append(el("td", {}, String(v)));
    }
    tabela.append(linha);
    resultado.append(tabela);
  }

  raiz.append(el("div", { class: "card" }, el("h2", {}, "Procedimentos realizados em atendimentos"), form));
  raiz.append(el("div", { class: "card" }, el("h2", {}, "Registro consultado"), resultado));
}

/* ---------- navegação por abas ---------- */

function montarTabs() {
  const nav = document.getElementById("tabs");
  for (const [chaveRecurso, cfg] of Object.entries(RECURSOS)) {
    const botao = el("button", { onclick: () => selecionar(chaveRecurso, botao) }, cfg.titulo);
    botao.dataset.recurso = chaveRecurso;
    nav.append(botao);
  }
  function selecionar(chaveRecurso, botao) {
    document.querySelectorAll("#tabs button").forEach(b => b.classList.remove("ativa"));
    botao.classList.add("ativa");
    if (RECURSOS[chaveRecurso].especial === "procRealizado") montarAbaProcRealizado();
    else montarAbaCrud(chaveRecurso);
  }
  nav.querySelector("button").click();
}

/* ---------- status da API ---------- */

async function verificarApi() {
  const status = document.getElementById("api-status");
  try {
    await chamarApi("GET", "/");
    status.textContent = "✅ conectado à API (porta 8000)";
    status.className = "ok";
  } catch (e) {
    status.textContent = "❌ API fora do ar — suba o backend com: uvicorn main:app --reload";
    status.className = "erro";
  }
}

verificarApi();
montarTabs();
