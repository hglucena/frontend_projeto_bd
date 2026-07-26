# Frontend — Sistema de Gestão Hospitalar Dra. Yuska Maritan Brito

Interface web para o projeto de Banco de Dados. Consome a API FastAPI do
repositório [backend_projeto_bd](https://github.com/brunocostaar/backend_projeto_bd).

Sem frameworks e sem `npm install`: HTML, CSS e JavaScript puros, servidos por
um pequeno servidor Python (biblioteca padrão) que também faz proxy das
chamadas `/api/*` para o backend. Assim o navegador enxerga uma única origem
e não há problema de CORS, sem precisar alterar nada no backend.

## Como rodar (3 passos)

1. **Banco de dados** — no repositório do backend:
   ```
   docker compose up -d
   ```

2. **Backend** — no repositório do backend:
   ```
   pip install fastapi uvicorn sqlalchemy psycopg2-binary
   uvicorn main:app --reload
   ```

3. **Frontend** — neste repositório:
   ```
   python server.py
   ```
   Abra http://localhost:3000

## Estrutura

| Arquivo      | Papel                                                        |
|--------------|--------------------------------------------------------------|
| `index.html` | Página única com navegação por abas                          |
| `app.js`     | Motor da interface: formulários, tabelas, perfis e abas da Etapa 1 |
| `etapa2.js`  | Abas da Etapa 2: views, procedures, auditoria, consultas e concorrência |
| `style.css`  | Estilo                                                       |
| `server.py`  | Servidor estático + proxy `/api` → `localhost:8000`          |

`etapa2.js` é carregado antes do `app.js` e apenas define funções. O `app.js`
chama `registrarRecursosEtapa2` antes de montar a barra de abas, o que mantém o
arquivo da Etapa 1 quase intocado.

## Chave entre as duas implementações

O cabeçalho tem um seletor com duas opções:

- **Etapa 1 — SQL puro**: as abas de CRUD falam com as rotas na raiz da API
- **Etapa 2 — ORM (SQLAlchemy)**: as mesmas abas falam com as rotas sob `/orm`

A troca acontece na hora, sem recarregar a página, e serve para comparar as
duas implementações nas mesmas telas. Duas diferenças ficam visíveis:

- Preceptores só têm os botões de editar e excluir no modo ORM, porque a
  Etapa 1 não expõe essas operações
- A unidade do atendimento e a versão da escala só são gravadas no modo ORM;
  no modo Etapa 1 essas colunas aparecem vazias

As abas próprias da Etapa 2 têm caminho fixo e não acompanham a chave, já que
essas funcionalidades só existem na Etapa 2.

## Abas

### Etapa 1

Pacientes, Preceptores, Residentes, Atendimentos, Procedimentos, Proc.
Realizados, Escalas, Relatórios e Unidades. Cada uma tem três áreas, nesta
ordem: **Consultar** (filtros), **Resultados** (tabela) e **Cadastrar/editar**
(formulário).

- Consulta com filtros em todas as abas. Os filtros viram query string e a
  busca é feita em SQL no backend.
- Perfil: clicar em qualquer resultado abre o registro completo, com os dados
  relacionados. As listas relacionadas também são clicáveis, e o botão
  "← Voltar" preserva a busca feita.
- Tabelas de atendimentos e escalas mostram nomes no lugar dos ids.
- Os erros da API aparecem como notificação no canto da tela, com a mensagem
  original do backend.

### Etapa 2

| Aba | Conteúdo |
|---|---|
| **Internações** | CRUD da entidade nova. O perfil de uma internação aberta tem o botão de dar alta. |
| **Views** | As três views do banco, cada uma num cartão com o critério explicado. |
| **Procedures** | Registrar atendimento completo (com lista dinâmica de procedimentos) e reajustar escala. |
| **Auditoria** | Histórico gravado pelo trigger, com filtros e uma coluna que compara os JSON e mostra o que mudou. |
| **Consultas ORM** | As três consultas avançadas, a medição de carregamento e as quatro analíticas da Etapa 1 em DSL. |
| **Concorrência** | Botão que roda os três cenários de disputa por uma escala e mostra os logs das duas sessões. |

## Detalhes que valem saber ao usar

**Registrar atendimento completo** é a forma mais direta de ver a transação em
ação. Se você escolher o mesmo procedimento duas vezes na lista, a chave
primária composta recusa e o atendimento inteiro é desfeito, com a mensagem do
banco na notificação.

**Reajustar escala** funciona movendo o residente 14 de sexta/manhã para
quinta/manhã. Tentar mover o residente 12 de quinta/manhã para segunda/manhã é
recusado, porque ele já tem plantão nesse horário. A tabela abaixo do
formulário mostra a coluna versão subindo a cada alteração aceita.

**Auditoria** não recebe escrita de nenhuma rota da API. Para gerar linhas
novas, crie, edite ou apague um atendimento na aba Atendimentos e volte.

**Concorrência** leva alguns segundos, porque o cenário pessimista envolve
espera real por bloqueio. O que a simulação cria é apagado no fim.

## Demonstração das 6 funcionalidades da Etapa 3

Capturas de tela do sistema executando cada atividade exigida (pasta
`screenshots/`):

1. [Inserir um novo atendimento](screenshots/atividade1_inserir_atendimento.png)
   (o backend valida paciente, residente e preceptor antes do INSERT)
2. [Atendimentos de um paciente específico](screenshots/atividade2_atendimentos_paciente.png)
   (ordenados por data)
3. [Procedimentos realizados em um atendimento](screenshots/atividade3_procedimentos_do_atendimento.png)
   (nome do procedimento via JOIN, quantidade e tempo real)
4. [Atualizar os dados de um paciente](screenshots/atividade4_atualizar_paciente.png)
5. [Remoção bloqueada de procedimento já faturado](screenshots/atividade5_remover_bloqueado_faturado.png)
   (flag `faturado` devolve erro 409)
6. [Tempo médio de atendimento por residente](screenshots/atividade6_tempo_medio_residente.png)
   (AVG + GROUP BY na aba Relatórios)
