# Frontend — Sistema de Gestão Hospitalar Dra. Yuska Maritan Brito

Interface web para o CRUD do projeto de Banco de Dados. Consome a API FastAPI
do repositório [backend_projeto_bd](https://github.com/brunocostaar/backend_projeto_bd).

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
| `app.js`     | Lógica: formulários, tabelas e chamadas à API                |
| `style.css`  | Estilo                                                       |
| `server.py`  | Servidor estático + proxy `/api` → `localhost:8000`          |

## Funcionalidades

Cada aba tem três áreas, nesta ordem: **Consultar** (filtros de busca),
**Resultados** (tabela) e **Cadastrar/editar** (formulário).

- Consulta com filtros em todas as abas: nome/CPF parcial para pessoas,
  especialidade e ano de residência para residentes, nível de risco para
  procedimentos, paciente/residente/preceptor/dia para atendimentos,
  unidade/dia/turno para escalas etc. Os filtros viram query string e a
  busca é feita em SQL no backend.
- Perfil: clicar em qualquer resultado abre o perfil completo do registro,
  com os dados relacionados — atendimentos do paciente, escalas e
  atendimentos do residente/preceptor, procedimentos realizados do
  atendimento, escalas da unidade. As listas relacionadas também são
  clicáveis (dá para navegar de um paciente para um atendimento dele, por
  exemplo) e o botão "← Voltar" preserva a busca feita.
- Tabelas de atendimentos e escalas mostram os nomes das pessoas e
  unidades no lugar dos ids.
- Pacientes: cadastrar, listar, editar e excluir. As alergias separadas por
  vírgula viram linhas na tabela `alergia` do banco.
- Preceptores: cadastrar e listar (o backend ainda não expõe editar/excluir)
- Residentes: CRUD completo, com ano de residência restrito a R1, R2 e R3
- Atendimentos: CRUD completo, com seleção de paciente, residente e
  preceptor por nome
- Procedimentos: CRUD completo
- Procedimentos realizados: listagem geral com filtros, além de registrar,
  buscar, atualizar e excluir pela chave composta (atendimento e
  procedimento)
- Escalas: CRUD completo, com dia da semana e turno restritos aos valores
  aceitos pelo banco
- Unidades: CRUD completo

Os erros da API (validações, conflitos de escala, restrições do banco)
aparecem como notificação no canto da tela, com a mensagem original do
backend.

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
