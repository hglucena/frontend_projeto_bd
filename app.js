/* ============================================================
   Frontend - Sistema de Gestão Hospitalar Dra. Yuska Maritan Brito
   Consome a API FastAPI através do proxy local /api (ver server.py)
   ============================================================ */

const API = "/api";

/* Cada recurso aponta diretamente para seu endpoint canônico. */
function caminhoDe(cfg) {
  return cfg.caminho;
}

function permite(cfg, acao) {
  const valor = cfg[acao];
  return typeof valor === "function" ? valor() : Boolean(valor);
}

/* ---------- utilitários ---------- */

let cacheListas = {}; // cache das listagens (lookups e decoração de tabelas)

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
    throw new Error("Sem resposta da API. Confira se o backend está no ar na porta 8000.");
  }
  if (metodo !== "GET") cacheListas = {}; // dados mudaram: invalida o cache
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

function listaCacheada(chaveRecurso) {
  const chave = chaveRecurso;
  if (!cacheListas[chave]) {
    cacheListas[chave] = chamarApi("GET", caminhoDe(RECURSOS[chaveRecurso]))
      .catch(e => { delete cacheListas[chave]; throw e; });
  }
  return cacheListas[chave];
}

async function mapaPorId(chaveRecurso, campoId) {
  const mapa = {};
  for (const item of await listaCacheada(chaveRecurso)) mapa[item[campoId]] = item;
  return mapa;
}

function rotularPessoa(mapa, id) {
  return mapa[id] ? `${mapa[id].nome} (id ${id})` : `id ${id}`;
}

function montarQuery(filtros) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros || {})) {
    if (v !== null && v !== undefined && v !== "") params.set(k, v);
  }
  const s = params.toString();
  return s ? "?" + s : "";
}

function formatarValor(coluna, valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (["data_hora", "data_hora_inicio", "data_hora_entrada", "data_hora_saida"].includes(coluna)) {
    return String(valor).slice(0, 16).replace("T", " ");
  }
  return String(valor);
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

const buscaPessoa = [
  { nome: "nome", rotulo: "Nome contém", tipo: "text" },
  { nome: "cpf", rotulo: "CPF contém", tipo: "text" },
];

const RECURSOS = {
  pacientes: {
    titulo: "Pacientes",
    caminho: "/pacientes/",
    chave: ["id_pessoa"],
    podeEditar: true,
    podeExcluir: true,
    campos: [
      ...camposPessoa,
      { nome: "num_convenio", rotulo: "Nº do convênio", tipo: "text", obrigatorio: true },
      { nome: "alergias", rotulo: "Alergias", tipo: "text" },
      { nome: "grupo_sanguineo", rotulo: "Grupo sanguíneo", tipo: "select", opcoes: GRUPOS_SANGUINEOS },
    ],
    colunas: ["id_pessoa", "nome", "CPF", "num_convenio", "grupo_sanguineo", "telefone"],
    busca: [
      ...buscaPessoa,
      { nome: "grupo_sanguineo", rotulo: "Grupo sanguíneo", tipo: "select", opcoes: GRUPOS_SANGUINEOS },
    ],
    perfil: {
      rotuloItem: p => `Paciente: ${p.nome}`,
      relacionados: [
        { titulo: "Atendimentos deste paciente", recurso: "atendimentos", parametro: "id_paciente" },
      ],
    },
  },

  preceptores: {
    titulo: "Preceptores",
    caminho: "/preceptores/",
    chave: ["id_pessoa"],
    podeEditar: true,
    podeExcluir: true,
    campos: [
      ...camposPessoa,
      { nome: "CRM", rotulo: "CRM", tipo: "text", obrigatorio: true },
      { nome: "data_admissao", rotulo: "Data de admissão", tipo: "date", obrigatorio: true },
      { nome: "especialidade", rotulo: "Especialidade", tipo: "text", obrigatorio: true },
      { nome: "titulacao", rotulo: "Titulação", tipo: "text", obrigatorio: true },
    ],
    colunas: ["id_pessoa", "nome", "CRM", "especialidade", "titulacao"],
    busca: [
      ...buscaPessoa,
      { nome: "especialidade", rotulo: "Especialidade contém", tipo: "text" },
    ],
    perfil: {
      rotuloItem: p => `Preceptor: ${p.nome}`,
      relacionados: [
        { titulo: "Atendimentos supervisionados por este preceptor", recurso: "atendimentos", parametro: "id_preceptor" },
        { titulo: "Escalas deste preceptor", recurso: "escalas", parametro: "id_preceptor" },
      ],
    },
  },

  residentes: {
    titulo: "Residentes",
    caminho: "/residentes/",
    chave: ["id_pessoa"],
    podeEditar: true,
    podeExcluir: true,
    campos: [
      ...camposPessoa,
      { nome: "CRM", rotulo: "CRM", tipo: "text", obrigatorio: true },
      { nome: "data_admissao", rotulo: "Data de admissão", tipo: "date", obrigatorio: true },
      { nome: "especialidade", rotulo: "Especialidade", tipo: "text", obrigatorio: true },
      { nome: "ano_residencia", rotulo: "Ano de residência", tipo: "select", opcoes: ["R1", "R2", "R3"], obrigatorio: true },
    ],
    colunas: ["id_pessoa", "nome", "CRM", "especialidade", "ano_residencia"],
    busca: [
      ...buscaPessoa,
      { nome: "especialidade", rotulo: "Especialidade contém", tipo: "text" },
      { nome: "ano_residencia", rotulo: "Ano de residência", tipo: "select", opcoes: ["R1", "R2", "R3"] },
    ],
    perfil: {
      rotuloItem: p => `Residente: ${p.nome}`,
      relacionados: [
        { titulo: "Atendimentos deste residente", recurso: "atendimentos", parametro: "id_residente" },
        { titulo: "Escalas deste residente", recurso: "escalas", parametro: "id_residente" },
      ],
    },
  },

  atendimentos: {
    titulo: "Atendimentos",
    caminho: "/atendimentos/",
    chave: ["id_atendimento"],
    podeEditar: true,
    podeExcluir: true,
    podeCadastrar: false,
    aviso: "Novos atendimentos precisam ser criados com ao menos um procedimento. " +
           "Use a aba Procedures, em Registrar atendimento completo. Esta aba continua " +
           "permitindo consultar, editar e excluir atendimentos existentes.",
    campos: [
      { nome: "data_hora", rotulo: "Data e hora", tipo: "datetime-local", obrigatorio: true },
      { nome: "duracao_minutos", rotulo: "Duração (min)", tipo: "number", obrigatorio: true, min: 1 },
      { nome: "id_paciente", rotulo: "Paciente", tipo: "lookup", recurso: "pacientes", decorado: "paciente",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa,
        dica: "id do paciente (seed: 1 a 5)" },
      { nome: "id_residente", rotulo: "Residente", tipo: "lookup", recurso: "residentes", decorado: "residente",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa,
        dica: "id do residente (seed: 11 a 15)" },
      { nome: "id_preceptor", rotulo: "Preceptor", tipo: "lookup", recurso: "preceptores", decorado: "preceptor",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa,
        dica: "id do preceptor (seed: 6 a 10)" },
      { nome: "id_unidade", rotulo: "Unidade", tipo: "lookup", recurso: "unidades", decorado: "unidade",
        rotuloOpcao: u => `${u.id_unidade} — ${u.nome}`, valorOpcao: u => u.id_unidade,
        dica: "unidade onde ocorreu o atendimento" },
    ],
    colunas: ["id_atendimento", "data_hora", "duracao_minutos", "paciente", "residente", "preceptor", "unidade"],
    decorar: async (itens) => {
      const [pac, res, pre, uni] = await Promise.all([
        mapaPorId("pacientes", "id_pessoa"),
        mapaPorId("residentes", "id_pessoa"),
        mapaPorId("preceptores", "id_pessoa"),
        mapaPorId("unidades", "id_unidade"),
      ]);
      return itens.map(a => ({
        ...a,
        paciente: rotularPessoa(pac, a.id_paciente),
        residente: rotularPessoa(res, a.id_residente),
        preceptor: rotularPessoa(pre, a.id_preceptor),
        unidade: uni[a.id_unidade] ? `${uni[a.id_unidade].nome} (id ${a.id_unidade})` : null,
      }));
    },
    busca: [
      { nome: "id_paciente", rotulo: "Paciente", tipo: "lookup", recurso: "pacientes",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
      { nome: "id_residente", rotulo: "Residente", tipo: "lookup", recurso: "residentes",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
      { nome: "id_preceptor", rotulo: "Preceptor", tipo: "lookup", recurso: "preceptores",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
      { nome: "data", rotulo: "Data (dia exato)", tipo: "date" },
    ],
    perfil: {
      rotuloItem: a => `Atendimento nº ${a.id_atendimento}`,
      relacionados: [
        { titulo: "Procedimentos realizados neste atendimento", recurso: "procedimentos-realizados", parametro: "id_atendimento" },
      ],
    },
  },

  procedimentos: {
    titulo: "Procedimentos",
    caminho: "/procedimentos/",
    chave: ["id_procedimento"],
    podeEditar: true,
    podeExcluir: true,
    campos: [
      { nome: "codigo", rotulo: "Código (número)", tipo: "number", obrigatorio: true },
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
      { nome: "tempo_medio_minutos", rotulo: "Tempo médio (min)", tipo: "number", obrigatorio: true, min: 1 },
      { nome: "nivel_risco", rotulo: "Nível de risco", tipo: "select", opcoes: ["BAIXO", "MEDIO", "ALTO"], obrigatorio: true },
    ],
    // media_tempo_procedimento é mantida pelo trigger. Não há campo dela no
    // formulário: a aplicação não escreve nessa
    // coluna, quem escreve é o banco.
    colunas: ["id_procedimento", "codigo", "nome", "tempo_medio_minutos", "nivel_risco", "media_tempo_procedimento"],
    busca: [
      { nome: "nome", rotulo: "Nome contém", tipo: "text" },
      { nome: "nivel_risco", rotulo: "Nível de risco", tipo: "select", opcoes: ["BAIXO", "MEDIO", "ALTO"] },
      { nome: "codigo", rotulo: "Código", tipo: "number" },
    ],
    perfil: {
      rotuloItem: p => `Procedimento: ${p.nome}`,
      relacionados: [
        { titulo: "Atendimentos com este procedimento", recurso: "procedimentos-realizados", parametro: "id_procedimento" },
      ],
    },
  },

  "procedimentos-realizados": {
    titulo: "Proc. Realizados",
    especial: "procRealizado",
    caminho: "/procedimentos-realizados/",
    chave: ["id_atendimento", "id_procedimento"],
    colunas: ["atendimento", "procedimento", "quantidade", "tempo_real_minutos", "data_hora_inicio", "observacao", "faturado"],
    decorar: async (itens) => {
      const ate = await mapaPorId("atendimentos", "id_atendimento");
      return itens.map(pr => ({
        ...pr,
        atendimento: ate[pr.id_atendimento]
          ? `nº ${pr.id_atendimento} — ${formatarValor("data_hora", ate[pr.id_atendimento].data_hora)}`
          : `nº ${pr.id_atendimento}`,
        // o nome do procedimento vem do JOIN feito em SQL no backend
        procedimento: pr.nome_procedimento
          ? `${pr.nome_procedimento} (id ${pr.id_procedimento})`
          : `id ${pr.id_procedimento}`,
      }));
    },
    busca: [
      { nome: "id_atendimento", rotulo: "Atendimento", tipo: "lookup", recurso: "atendimentos",
        rotuloOpcao: a => `${a.id_atendimento} — ${String(a.data_hora).slice(0, 16).replace("T", " ")}`,
        valorOpcao: a => a.id_atendimento },
      { nome: "id_procedimento", rotulo: "Procedimento", tipo: "lookup", recurso: "procedimentos",
        rotuloOpcao: p => `${p.id_procedimento} — ${p.nome}`, valorOpcao: p => p.id_procedimento },
      { nome: "faturado", rotulo: "Faturado", tipo: "select",
        opcoes: [{ valor: "true", rotulo: "sim" }, { valor: "false", rotulo: "não" }] },
      { nome: "nivel_risco", rotulo: "Nível de risco", tipo: "select",
        opcoes: ["BAIXO", "MEDIO", "ALTO"] },
    ],
  },

  escalas: {
    titulo: "Escalas",
    caminho: "/escalas/",
    chave: ["id_escala"],
    podeEditar: true,
    podeExcluir: true,
    campos: [
      { nome: "id_unidade", rotulo: "Unidade", tipo: "lookup", recurso: "unidades", decorado: "unidade",
        rotuloOpcao: u => `${u.id_unidade} — ${u.nome}`, valorOpcao: u => u.id_unidade },
      { nome: "dia_semana", rotulo: "Dia da semana", tipo: "select", opcoes: DIAS, obrigatorio: true },
      { nome: "turno", rotulo: "Turno", tipo: "select", opcoes: TURNOS, obrigatorio: true },
      { nome: "id_residente", rotulo: "Residente", tipo: "lookup", recurso: "residentes", decorado: "residente",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa,
        dica: "id do residente (seed: 11 a 15)" },
      { nome: "id_preceptor", rotulo: "Preceptor", tipo: "lookup", recurso: "preceptores", decorado: "preceptor",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
    ],
    // versao entra no controle de concorrência otimista.
    colunas: ["id_escala", "unidade", "dia_semana", "turno", "residente", "preceptor", "versao"],
    prepararAtualizacao: (dados, item) => ({ ...dados, versao: item.versao }),
    decorar: async (itens) => {
      const [uni, res, pre] = await Promise.all([
        mapaPorId("unidades", "id_unidade"),
        mapaPorId("residentes", "id_pessoa"),
        mapaPorId("preceptores", "id_pessoa"),
      ]);
      return itens.map(e => ({
        ...e,
        unidade: uni[e.id_unidade] ? `${uni[e.id_unidade].nome} (id ${e.id_unidade})` : `id ${e.id_unidade}`,
        residente: rotularPessoa(res, e.id_residente),
        preceptor: rotularPessoa(pre, e.id_preceptor),
      }));
    },
    busca: [
      { nome: "id_unidade", rotulo: "Unidade", tipo: "lookup", recurso: "unidades",
        rotuloOpcao: u => `${u.id_unidade} — ${u.nome}`, valorOpcao: u => u.id_unidade },
      { nome: "id_residente", rotulo: "Residente", tipo: "lookup", recurso: "residentes",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
      { nome: "id_preceptor", rotulo: "Preceptor", tipo: "lookup", recurso: "preceptores",
        rotuloOpcao: p => `${p.id_pessoa} — ${p.nome}`, valorOpcao: p => p.id_pessoa },
      { nome: "dia_semana", rotulo: "Dia da semana", tipo: "select", opcoes: DIAS },
      { nome: "turno", rotulo: "Turno", tipo: "select", opcoes: TURNOS },
    ],
    perfil: {
      rotuloItem: e => `Escala nº ${e.id_escala}`,
      relacionados: [],
    },
  },

  relatorios: {
    titulo: "Relatórios",
    especial: "relatorios",
  },

  unidades: {
    titulo: "Unidades",
    caminho: "/unidades/",
    chave: ["id_unidade"],
    podeEditar: true,
    podeExcluir: true,
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "text", obrigatorio: true },
      { nome: "tipo", rotulo: "Tipo", tipo: "text", obrigatorio: true, dica: "Enfermaria, UTI, Pronto-Socorro..." },
      { nome: "capacidade_leitos", rotulo: "Capacidade de leitos", tipo: "number", obrigatorio: true, min: 0 },
    ],
    colunas: ["id_unidade", "nome", "tipo", "capacidade_leitos"],
    busca: [
      { nome: "nome", rotulo: "Nome contém", tipo: "text" },
      { nome: "tipo", rotulo: "Tipo contém", tipo: "text" },
    ],
    perfil: {
      rotuloItem: u => `Unidade: ${u.nome}`,
      relacionados: [
        { titulo: "Escalas desta unidade", recurso: "escalas", parametro: "id_unidade" },
      ],
    },
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
    for (const o of campo.opcoes) {
      const valor = typeof o === "object" ? o.valor : o;
      const rotulo = typeof o === "object" ? o.rotulo : o;
      controle.append(el("option", { value: valor }, rotulo));
    }
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
    const itens = await listaCacheada(campo.recurso);
    select.innerHTML = "";
    select.append(el("option", { value: "" }, "selecione..."));
    for (const item of itens) {
      select.append(el("option", { value: campo.valorOpcao(item) }, campo.rotuloOpcao(item)));
    }
    select.dataset.carregado = "1";
    if (select.dataset.pendente !== undefined) {
      select.value = select.dataset.pendente;
      delete select.dataset.pendente;
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
    else {
      const texto = valor === null || valor === undefined ? "" : String(valor);
      controle.value = texto;
      // lookup ainda carregando: guarda o valor para aplicar quando as opções chegarem
      if (campo.tipo === "lookup" && controle.tagName === "SELECT" && controle.dataset.carregado !== "1") {
        controle.dataset.pendente = texto;
      }
    }
  }
}

/* ---------- tabela de resultados genérica ---------- */

async function renderizarTabela(chaveRecurso, itens, opcoes = {}) {
  const cfg = RECURSOS[chaveRecurso];
  if (cfg.decorar && itens && itens.length > 0) {
    try { itens = await cfg.decorar(itens); } catch (e) { /* exibe sem decoração */ }
  }
  const wrap = el("div", { class: "tabela-wrap" });
  if (!itens || itens.length === 0) {
    wrap.append(el("p", { class: "vazio" }, "Nenhum registro encontrado."));
    return wrap;
  }

  const tabela = el("table");
  const cab = el("tr");
  for (const c of cfg.colunas) cab.append(el("th", {}, c.replaceAll("_", " ")));
  if (opcoes.acoes) cab.append(el("th", {}, "ações"));
  tabela.append(cab);

  const aoClicar = opcoes.aoClicar || (cfg.perfil ? (item) => abrirPerfil(chaveRecurso, item) : null);

  for (const item of itens) {
    const linha = el("tr");
    for (const c of cfg.colunas) linha.append(el("td", {}, formatarValor(c, item[c])));
    if (opcoes.acoes) {
      const celula = el("td");
      for (const botao of opcoes.acoes(item)) celula.append(botao);
      linha.append(celula);
    }
    if (aoClicar) {
      linha.classList.add("clicavel");
      linha.title = "Abrir perfil";
      linha.addEventListener("click", () => aoClicar(item));
    }
    tabela.append(linha);
  }
  wrap.append(tabela);
  return wrap;
}

/* ---------- navegação (abas + perfis, com botão voltar) ---------- */

let abaAtiva = null;
let visaoAtual = null;   // { tipo: "aba", chave } | { tipo: "perfil", chave, item }
let pilhaVoltar = [];
const estadoBusca = {};  // últimos filtros usados em cada aba

function abrirPerfil(chaveRecurso, item) {
  pilhaVoltar.push(visaoAtual);
  visaoAtual = { tipo: "perfil", chave: chaveRecurso, item };
  montarPerfil(chaveRecurso, item);
}

function voltar() {
  const anterior = pilhaVoltar.pop() || { tipo: "aba", chave: abaAtiva };
  visaoAtual = anterior;
  if (anterior.tipo === "perfil") montarPerfil(anterior.chave, anterior.item);
  else montarVisaoAba(anterior.chave);
}

function montarVisaoAba(chaveRecurso, opcoes) {
  const cfg = RECURSOS[chaveRecurso];
  // Abas com construtor próprio (as da Etapa 2, em etapa2.js) trazem montar().
  if (typeof cfg.montar === "function") cfg.montar();
  else if (cfg.especial === "procRealizado") montarAbaProcRealizado();
  else if (cfg.especial === "relatorios") montarAbaRelatorios();
  else montarAbaCrud(chaveRecurso, opcoes);
}

function ativarAba(chaveRecurso, opcoes) {
  document.querySelectorAll("#tabs button").forEach(b =>
    b.classList.toggle("ativa", b.dataset.recurso === chaveRecurso));
  abaAtiva = chaveRecurso;
  pilhaVoltar = [];
  visaoAtual = { tipo: "aba", chave: chaveRecurso };
  montarVisaoAba(chaveRecurso, opcoes);
}

/* ---------- aba CRUD genérica (consulta + resultados + cadastro) ---------- */

function montarAbaCrud(chaveRecurso, opcoes = {}) {
  const cfg = RECURSOS[chaveRecurso];
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  if (cfg.aviso) raiz.append(el("div", { class: "aviso" }, cfg.aviso));

  /* --- consulta --- */
  const camposBusca = cfg.busca || [];
  const formBusca = el("form", { class: "crud-form" });
  for (const campo of camposBusca) formBusca.append(criarCampo(campo));
  const botaoBuscar = el("button", { class: "botao", type: "submit" }, "Buscar");
  const botaoLimpar = el("button", { class: "botao neutro", type: "button", onclick: () => {
    formBusca.reset();
    formBusca.querySelectorAll("select").forEach(s => { s.value = ""; });
    delete estadoBusca[chaveRecurso];
    atualizarTabela();
  } }, "Limpar filtros");
  formBusca.append(el("div", { class: "acoes-form" }, botaoBuscar, botaoLimpar));
  formBusca.addEventListener("submit", (ev) => { ev.preventDefault(); atualizarTabela(); });

  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Consultar " + cfg.titulo.toLowerCase()),
    el("p", { class: "ajuda" },
      "Filtro vazio traz a lista inteira. Clicar numa linha abre o perfil do registro."),
    formBusca));

  // restaura a última busca desta aba (ex.: ao voltar de um perfil)
  if (estadoBusca[chaveRecurso]) preencherFormulario(formBusca, camposBusca, estadoBusca[chaveRecurso]);

  /* --- resultados --- */
  const tituloResultados = el("h2", {}, "Resultados");
  const areaTabela = el("div");
  raiz.append(el("div", { class: "card" }, tituloResultados, areaTabela));

  /* --- formulário de cadastro/edição --- */
  const form = el("form", { class: "crud-form" });
  for (const campo of cfg.campos) form.append(criarCampo(campo));

  const podeCadastrar = cfg.podeCadastrar !== false;
  const idEmEdicao = { valor: null };
  const itemEmEdicao = { valor: null };
  const botaoSalvar = el(
    "button",
    { class: "botao salvar", type: "submit" },
    podeCadastrar ? "Cadastrar" : "Salvar alterações",
  );
  const botaoCancelar = el("button", { class: "botao neutro", type: "button", onclick: cancelarEdicao }, "Cancelar edição");
  botaoCancelar.style.display = "none";
  form.append(el("div", { class: "acoes-form" }, botaoSalvar, botaoCancelar));
  if (!podeCadastrar) form.style.display = "none";

  const cardCadastro = el("div", { class: "card" },
    el("h2", {}, podeCadastrar
      ? (permite(cfg, "podeEditar") ? "Cadastrar / editar " : "Cadastrar ") + cfg.titulo.toLowerCase()
      : "Editar " + cfg.titulo.toLowerCase()),
    !podeCadastrar ? el("p", { class: "ajuda" },
      "Selecione Editar em um atendimento existente. Para criar um novo, use " +
      "Registrar atendimento completo na aba Procedures.") : null,
    !podeCadastrar ? el("div", { class: "acoes-form" },
      el("button", {
        class: "botao salvar",
        type: "button",
        onclick: () => ativarAba("procedures"),
      }, "Ir para Registrar atendimento completo")) : null,
    form);
  raiz.append(cardCadastro);

  function cancelarEdicao() {
    idEmEdicao.valor = null;
    itemEmEdicao.valor = null;
    form.reset();
    botaoSalvar.textContent = podeCadastrar ? "Cadastrar" : "Salvar alterações";
    botaoCancelar.style.display = "none";
    if (!podeCadastrar) form.style.display = "none";
  }

  function iniciarEdicao(item) {
    idEmEdicao.valor = item[cfg.chave[0]];
    itemEmEdicao.valor = item;
    preencherFormulario(form, cfg.campos, item);
    botaoSalvar.textContent = "Salvar alterações";
    botaoCancelar.style.display = "";
    form.style.display = "";
    cardCadastro.scrollIntoView({ behavior: "smooth" });
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const dados = lerFormulario(form, cfg.campos);
    try {
      if (idEmEdicao.valor === null) {
        if (!podeCadastrar) {
          throw new Error(
            "Crie o atendimento pela aba Procedures, em Registrar atendimento completo."
          );
        }
        await chamarApi("POST", caminhoDe(cfg), dados);
        toast(`${cfg.titulo}: registro cadastrado.`, "ok");
      } else {
        const corpo = cfg.prepararAtualizacao
          ? cfg.prepararAtualizacao(dados, itemEmEdicao.valor)
          : dados;
        await chamarApi("PUT", caminhoDe(cfg) + idEmEdicao.valor, corpo);
        toast(`${cfg.titulo}: registro atualizado.`, "ok");
      }
      cancelarEdicao();
      await atualizarTabela();
    } catch (e) {
      toast(e.message, "erro");
    }
  });

  function montarAcoes(item) {
    const botoes = [];
    const id = item[cfg.chave[0]];
    if (permite(cfg, "podeEditar")) {
      botoes.push(el("button", { class: "editar", onclick: (ev) => {
        ev.stopPropagation();
        iniciarEdicao(item);
      } }, "Editar"));
    }
    if (permite(cfg, "podeExcluir")) {
      botoes.push(el("button", { class: "excluir", onclick: async (ev) => {
        ev.stopPropagation();
        if (!confirm(`Excluir registro ${id}?`)) return;
        try {
          await chamarApi("DELETE", caminhoDe(cfg) + id);
          toast("Registro excluído.", "ok");
          await atualizarTabela();
        } catch (e) { toast(e.message, "erro"); }
      } }, "Excluir"));
    }
    return botoes;
  }

  async function atualizarTabela() {
    const filtros = lerFormulario(formBusca, camposBusca);
    estadoBusca[chaveRecurso] = filtros;
    areaTabela.innerHTML = "";
    areaTabela.append(el("p", { class: "vazio" }, "Carregando..."));
    let itens;
    try {
      itens = await chamarApi("GET", caminhoDe(cfg) + montarQuery(filtros));
    } catch (e) {
      areaTabela.innerHTML = "";
      areaTabela.append(el("p", { class: "vazio" }, "Erro ao consultar: " + e.message));
      return;
    }
    const temFiltro = Object.values(filtros).some(v => v !== null && v !== undefined && v !== "");
    tituloResultados.textContent = temFiltro
      ? `Resultados da consulta (${itens.length})`
      : `Todos os registros (${itens.length})`;
    const tabela = await renderizarTabela(chaveRecurso, itens, {
      acoes: (permite(cfg, "podeEditar") || permite(cfg, "podeExcluir")) ? montarAcoes : undefined,
    });
    areaTabela.innerHTML = "";
    areaTabela.append(tabela);
  }

  atualizarTabela().then(() => {
    if (opcoes.editar) iniciarEdicao(opcoes.editar);
  });
}

/* ---------- perfil de um registro (com dados relacionados) ---------- */

async function montarPerfil(chaveRecurso, item) {
  const cfg = RECURSOS[chaveRecurso];
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  raiz.append(el("button", { class: "botao neutro voltar", onclick: voltar }, "← Voltar"));

  // decoração: mostra nomes no lugar de ids nos campos de referência
  let decorado = item;
  if (cfg.decorar) {
    try { decorado = (await cfg.decorar([item]))[0]; } catch (e) { /* segue sem decoração */ }
  }

  const dl = el("dl", { class: "perfil" });
  for (const campo of cfg.campos || []) {
    let valor;
    if (campo.tipo === "lookup" && campo.decorado && decorado[campo.decorado] !== undefined) {
      valor = decorado[campo.decorado];
    } else {
      valor = formatarValor(campo.nome, item[campo.nome]);
    }
    dl.append(el("div", {}, el("dt", {}, campo.rotulo), el("dd", {}, String(valor))));
  }

  const acoes = el("div", { class: "acoes-form" });
  if (permite(cfg, "podeEditar")) {
    acoes.append(el("button", { class: "botao", onclick: () => ativarAba(chaveRecurso, { editar: item }) },
      "Editar no formulário"));
  }
  if (permite(cfg, "podeExcluir")) {
    acoes.append(el("button", { class: "botao excluir-perfil", onclick: async () => {
      const id = item[cfg.chave[0]];
      if (!confirm(`Excluir registro ${id}?`)) return;
      try {
        await chamarApi("DELETE", caminhoDe(cfg) + id);
        toast("Registro excluído.", "ok");
        ativarAba(chaveRecurso);
      } catch (e) { toast(e.message, "erro"); }
    } }, "Excluir"));
  }

  // Ações específicas de um recurso, como dar alta numa internação.
  if (cfg.perfil && typeof cfg.perfil.acoesExtra === "function") {
    for (const botao of cfg.perfil.acoesExtra(item)) acoes.append(botao);
  }

  const identificacao = cfg.chave.map(c => `${c.replaceAll("_", " ")}: ${item[c]}`).join(" · ");
  raiz.append(el("div", { class: "card" },
    el("h2", {}, cfg.perfil && cfg.perfil.rotuloItem ? cfg.perfil.rotuloItem(item) : "Registro"),
    el("p", { class: "ajuda" }, identificacao),
    dl,
    acoes));

  // seções com os registros relacionados a este perfil
  for (const rel of (cfg.perfil && cfg.perfil.relacionados) || []) {
    const area = el("div");
    area.append(el("p", { class: "vazio" }, "Carregando..."));
    raiz.append(el("div", { class: "card" }, el("h2", {}, rel.titulo), area));
    (async () => {
      try {
        const alvo = RECURSOS[rel.recurso];
        const itens = await chamarApi("GET", `${caminhoDe(alvo)}?${rel.parametro}=${item[cfg.chave[0]]}`);
        const tabela = await renderizarTabela(rel.recurso, itens);
        area.innerHTML = "";
        area.append(tabela);
      } catch (e) {
        area.innerHTML = "";
        area.append(el("p", { class: "vazio" }, "Erro: " + e.message));
      }
    })();
  }
}

/* ---------- aba especial: relatórios (consultas agregadas em SQL) ---------- */

async function montarAbaRelatorios() {
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  const area = el("div", { class: "tabela-wrap" });
  area.append(el("p", { class: "vazio" }, "Carregando..."));
  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Tempo médio de duração dos atendimentos por residente"),
    el("p", { class: "ajuda" },
      "AVG com GROUP BY feito no banco. O LEFT JOIN mantém na lista o residente que ainda não atendeu ninguém."),
    area));

  try {
    const [dados, residentes] = await Promise.all([
      chamarApi("GET", "/atendimentos/tempo-medio-por-residente"),
      listaCacheada("residentes"),
    ]);
    const porId = {};
    for (const r of residentes) porId[r.id_pessoa] = r;

    const tabela = el("table");
    const cab = el("tr");
    for (const c of ["id", "residente", "total de atendimentos", "tempo médio (min)"]) {
      cab.append(el("th", {}, c));
    }
    tabela.append(cab);

    for (const d of dados) {
      const linha = el("tr");
      linha.append(el("td", {}, String(d.id_residente)));
      linha.append(el("td", {}, d.nome));
      linha.append(el("td", {}, String(d.total_atendimentos)));
      linha.append(el("td", {}, d.tempo_medio_minutos === null ? "—" : String(d.tempo_medio_minutos)));
      const residente = porId[d.id_residente];
      if (residente) {
        linha.classList.add("clicavel");
        linha.title = "Abrir perfil";
        linha.addEventListener("click", () => abrirPerfil("residentes", residente));
      }
      tabela.append(linha);
    }
    area.innerHTML = "";
    area.append(tabela);
  } catch (e) {
    area.innerHTML = "";
    area.append(el("p", { class: "vazio" }, "Erro: " + e.message));
  }
}

/* ---------- aba especial: procedimentos realizados (chave composta) ---------- */

function montarAbaProcRealizado() {
  const cfg = RECURSOS["procedimentos-realizados"];
  const raiz = document.getElementById("content");
  raiz.innerHTML = "";

  const campos = [
    { nome: "id_atendimento", rotulo: "Atendimento", tipo: "lookup", recurso: "atendimentos",
      rotuloOpcao: a => `${a.id_atendimento} — ${String(a.data_hora).slice(0, 16).replace("T", " ")}`,
      valorOpcao: a => a.id_atendimento },
    { nome: "id_procedimento", rotulo: "Procedimento", tipo: "lookup", recurso: "procedimentos",
      rotuloOpcao: p => `${p.id_procedimento} — ${p.nome}`, valorOpcao: p => p.id_procedimento },
    { nome: "quantidade", rotulo: "Quantidade", tipo: "number", obrigatorio: true, min: 1 },
    { nome: "tempo_real_minutos", rotulo: "Tempo real (min)", tipo: "number", obrigatorio: true, min: 1 },
    { nome: "data_hora_inicio", rotulo: "Início", tipo: "datetime-local" },
    { nome: "observacao", rotulo: "Observação", tipo: "text" },
    { nome: "faturado", rotulo: "Já faturado?", tipo: "checkbox" },
  ];

  /* --- formulário de registro/edição (chave composta) --- */
  const form = el("form", { class: "crud-form" });
  for (const campo of campos) form.append(criarCampo(campo));

  const botaoCriar = el("button", { class: "botao salvar", type: "submit" }, "Registrar");
  const botaoBuscarChave = el("button", { class: "botao", type: "button", onclick: buscar }, "Buscar pela chave");
  const botaoAtualizar = el("button", { class: "botao", type: "button", onclick: atualizar }, "Atualizar");
  const botaoExcluir = el("button", { class: "botao neutro", type: "button", onclick: excluir }, "Excluir");
  form.append(el("div", { class: "acoes-form" }, botaoCriar, botaoBuscarChave, botaoAtualizar, botaoExcluir));

  const resultado = el("div", { class: "tabela-wrap" });

  /* --- consulta com filtros --- */
  const formBusca = el("form", { class: "crud-form" });
  for (const campo of cfg.busca) formBusca.append(criarCampo(campo));
  const botaoBuscar = el("button", { class: "botao", type: "submit" }, "Buscar");
  const botaoLimpar = el("button", { class: "botao neutro", type: "button", onclick: () => {
    formBusca.reset();
    formBusca.querySelectorAll("select").forEach(s => { s.value = ""; });
    atualizarLista();
  } }, "Limpar filtros");
  formBusca.append(el("div", { class: "acoes-form" }, botaoBuscar, botaoLimpar));
  formBusca.addEventListener("submit", (ev) => { ev.preventDefault(); atualizarLista(); });

  const tituloResultados = el("h2", {}, "Resultados");
  const areaLista = el("div");

  async function atualizarLista() {
    const filtros = lerFormulario(formBusca, cfg.busca);
    areaLista.innerHTML = "";
    areaLista.append(el("p", { class: "vazio" }, "Carregando..."));
    try {
      const itens = await chamarApi("GET", caminhoDe(cfg) + montarQuery(filtros));
      const temFiltro = Object.values(filtros).some(v => v !== null && v !== undefined && v !== "");
      tituloResultados.textContent = temFiltro
        ? `Resultados da consulta (${itens.length})`
        : `Todos os registros (${itens.length})`;
      const tabela = await renderizarTabela("procedimentos-realizados", itens, {
        aoClicar: (item) => {
          preencherFormulario(form, campos, item);
          mostrar(item);
          cardForm.scrollIntoView({ behavior: "smooth" });
          toast("Registro carregado no formulário.", "ok");
        },
      });
      areaLista.innerHTML = "";
      areaLista.append(tabela);
    } catch (e) {
      areaLista.innerHTML = "";
      areaLista.append(el("p", { class: "vazio" }, "Erro ao consultar: " + e.message));
    }
  }

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
      toast("Procedimento registrado no atendimento.", "ok");
      mostrar(d);
      await atualizarLista();
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
                      data_hora_inicio: d.data_hora_inicio,
                      observacao: d.observacao, faturado: d.faturado };
      const item = await chamarApi("PUT", `/procedimentos-realizados/${d.id_atendimento}/${d.id_procedimento}`, corpo);
      mostrar(item);
      toast("Registro atualizado.", "ok");
      await atualizarLista();
    } catch (e) { toast(e.message, "erro"); }
  }

  async function excluir() {
    try {
      const d = chaves();
      if (!confirm("Excluir este procedimento realizado?")) return;
      await chamarApi("DELETE", `/procedimentos-realizados/${d.id_atendimento}/${d.id_procedimento}`);
      resultado.innerHTML = "";
      toast("Registro excluído.", "ok");
      await atualizarLista();
    } catch (e) { toast(e.message, "erro"); }
  }

  function mostrar(item) {
    resultado.innerHTML = "";
    const tabela = el("table");
    const cab = el("tr");
    const cols = ["id_atendimento", "id_procedimento", "quantidade", "tempo_real_minutos",
                  "data_hora_inicio", "observacao", "faturado"];
    for (const c of cols) cab.append(el("th", {}, c));
    tabela.append(cab);
    const linha = el("tr");
    for (const c of cols) linha.append(el("td", {}, formatarValor(c, item[c])));
    tabela.append(linha);
    resultado.append(tabela);
  }

  raiz.append(el("div", { class: "card" },
    el("h2", {}, "Consultar procedimentos realizados"),
    el("p", { class: "ajuda" },
      "Clicar numa linha carrega o registro no formulário abaixo."),
    formBusca));
  raiz.append(el("div", { class: "card" }, tituloResultados, areaLista));

  const cardForm = el("div", { class: "card" },
    el("h2", {}, "Registrar / editar procedimento realizado"), form);
  raiz.append(cardForm);
  raiz.append(el("div", { class: "card" }, el("h2", {}, "Registro consultado"), resultado));

  atualizarLista();
}

/* ---------- navegação por abas ---------- */

function montarTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  for (const [chaveRecurso, cfg] of Object.entries(RECURSOS)) {
    const botao = el("button", { onclick: () => ativarAba(chaveRecurso) }, cfg.titulo);
    botao.dataset.recurso = chaveRecurso;
    nav.append(botao);
  }
  const inicial = abaAtiva && RECURSOS[abaAtiva] ? abaAtiva : Object.keys(RECURSOS)[0];
  ativarAba(inicial);
}

/* ---------- status da API ---------- */

async function verificarApi() {
  const status = document.getElementById("api-status");
  try {
    await chamarApi("GET", "/");
    status.textContent = "conectado à API na porta 8000";
    status.className = "ok";
  } catch (e) {
    status.textContent = "API fora do ar. Suba o backend com uvicorn main:app --reload";
    status.className = "erro";
  }
}

/* etapa2.js é carregado antes deste arquivo e define registrarRecursosEtapa2,
   que acrescenta as abas da Etapa 2 ao RECURSOS. O teste mantém o app.js
   funcionando sozinho, caso o outro arquivo não seja carregado. */
if (typeof registrarRecursosEtapa2 === "function") registrarRecursosEtapa2(RECURSOS);

verificarApi();
montarTabs();
