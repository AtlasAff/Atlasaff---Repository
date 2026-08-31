#!/usr/bin/env python3
"""
Servidor local só pra desenvolvimento. Igual ao `python3 -m http.server`,
mas manda Cache-Control: no-store em tudo — sem isso, o navegador guarda
o shared.js em cache entre recarregamentos e a gente fica editando um
arquivo enquanto o site continua rodando uma versão antiga (foi exatamente
isso que fez o carrinho "parar de funcionar" numa sessão de testes longa).
"""
import http.server

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    http.server.test(HandlerClass=NoCacheHandler, port=8000)
