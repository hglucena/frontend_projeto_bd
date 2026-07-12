"""
Servidor do frontend - Sistema de Gestão Hospitalar Dra. Yuska Maritan Brito

Serve os arquivos estáticos (index.html, app.js, style.css) e repassa
qualquer chamada /api/* para o backend FastAPI em http://localhost:8000.

Por que o proxy? O backend não envia cabeçalhos CORS; servindo tudo pela
mesma origem, o navegador não bloqueia as chamadas e o backend não
precisa ser alterado.

Uso:
    python server.py            # http://localhost:3000
    python server.py 8081       # porta customizada

Requisitos: apenas Python 3 (biblioteca padrão, sem pip install).
"""

import http.server
import os
import sys
import urllib.error
import urllib.request

BACKEND = os.environ.get("BACKEND_URL", "http://localhost:8000")
PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 3000


class Handler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        # Obriga o navegador a revalidar os arquivos a cada carregamento,
        # evitando que uma versão antiga do app.js fique presa no cache
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _proxy(self):
        destino = BACKEND + self.path[len("/api"):]
        corpo = None
        tamanho = self.headers.get("Content-Length")
        if tamanho:
            corpo = self.rfile.read(int(tamanho))

        requisicao = urllib.request.Request(destino, data=corpo, method=self.command)
        if corpo:
            requisicao.add_header("Content-Type",
                                  self.headers.get("Content-Type", "application/json"))
        try:
            with urllib.request.urlopen(requisicao) as resposta:
                dados = resposta.read()
                self._responder(resposta.status, dados,
                                resposta.headers.get("Content-Type"))
        except urllib.error.HTTPError as erro:
            # erros da API (400, 404, 409...) são repassados como vieram
            dados = erro.read()
            self._responder(erro.code, dados, erro.headers.get("Content-Type"))
        except urllib.error.URLError:
            self._responder(502, b'{"detail": "Backend indisponivel na porta 8000."}',
                            "application/json")

    def _responder(self, status, dados, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type or "application/json")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        if dados:
            self.wfile.write(dados)

    def _rotear(self):
        if self.path == "/api" or self.path.startswith("/api/"):
            self._proxy()
            return True
        return False

    def do_GET(self):
        if not self._rotear():
            super().do_GET()

    def do_POST(self):
        if not self._rotear():
            self.send_error(404)

    def do_PUT(self):
        if not self._rotear():
            self.send_error(404)

    def do_DELETE(self):
        if not self._rotear():
            self.send_error(404)

    def log_message(self, formato, *args):
        print(f"[frontend] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with http.server.ThreadingHTTPServer(("", PORTA), Handler) as servidor:
        print(f"Frontend disponível em http://localhost:{PORTA}")
        print(f"Chamadas /api/* serão repassadas para {BACKEND}")
        servidor.serve_forever()
