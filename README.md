# Frontend — Sistema de Gestão Hospitalar Dra. Yuska Maritan Brito

Interface web para o CRUD do projeto de Banco de Dados. Consome a API FastAPI
do repositório [backend_projeto_bd](https://github.com/brunocostaar/backend_projeto_bd).

Sem frameworks e sem `npm install`: HTML, CSS e JavaScript puros, servidos por
um pequeno servidor Python (biblioteca padrão) que também faz proxy das
chamadas `/api/*` para o backend — assim o navegador enxerga uma única origem
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

- **Pacientes** — cadastrar, listar, editar, excluir (alergias separadas por
  vírgula viram linhas na tabela `Alergia` do banco)
- **Preceptores** — cadastrar e listar (o backend ainda não expõe editar/excluir)
- **Residentes** — CRUD completo, com ano de residência restrito a R1/R2/R3
- **Atendimentos** — CRUD completo, com seleção de paciente/residente/preceptor por nome
- **Procedimentos** — CRUD completo
- **Procedimentos realizados** — registrar, buscar, atualizar e excluir pela
  chave composta (atendimento + procedimento)
- **Escalas** — CRUD completo, com dia da semana e turno restritos aos valores
  aceitos pelo banco (`segunda..domingo`, `manha/tarde/noite`)
- **Unidades** — CRUD completo

Erros da API (validações, conflitos de escala, restrições do banco) aparecem
como notificação no canto da tela, com a mensagem original do backend.
