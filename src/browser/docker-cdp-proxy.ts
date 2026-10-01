// Executed with python3 -c inside the browser container; no third-party modules.
export const CDP_PROXY_SCRIPT = String.raw`
import http.client
import http.server
import json
import select
import socket
import socketserver
import sys
from urllib.parse import urlsplit

debugger_host = sys.argv[1]
debugger_port = int(sys.argv[2])
listen_port = int(sys.argv[3])
if len(sys.argv) > 4:
    sys.stdout = sys.stderr = open(sys.argv[4], "a", buffering=1)

class Proxy(http.server.BaseHTTPRequestHandler):
    # Do not buffer bytes that belong to the WebSocket tunnel.
    rbufsize = 0

    def log_message(self, *args):
        pass

    def do_GET(self):
        connection = http.client.HTTPConnection(debugger_host, debugger_port, timeout=10)
        try:
            if self.headers.get("Upgrade", "").lower() == "websocket":
                connection.request("GET", "/json/version")
                response = connection.getresponse()
                if response.status != 200:
                    raise ValueError("CDP discovery returned %s" % response.status)
                endpoint = urlsplit(json.loads(response.read())["webSocketDebuggerUrl"])
                self.tunnel(endpoint.path + ("?" + endpoint.query if endpoint.query else ""))
            else:
                connection.request("GET", self.path)
                response = connection.getresponse()
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(key, value)
                self.send_header("Connection", "close")
                self.end_headers()
                while True:
                    data = response.read(65536)
                    if not data:
                        break
                    self.wfile.write(data)
        except (OSError, ValueError, KeyError, http.client.HTTPException) as error:
            print("CDP proxy: %s" % error, file=sys.stderr)
            try:
                self.send_error(502, "CDP upstream unavailable")
            except OSError:
                pass
        finally:
            connection.close()
            self.close_connection = True

    def tunnel(self, path):
        with socket.create_connection((debugger_host, debugger_port), timeout=10) as upstream:
            headers = ["GET %s HTTP/1.1" % path, "Host: localhost:%s" % debugger_port]
            headers.extend("%s: %s" % (key, value) for key, value in self.headers.items()
                           if key.lower() not in ("host", "origin"))
            upstream.sendall(("\r\n".join(headers) + "\r\n\r\n").encode("latin-1"))
            upstream.settimeout(None)
            sockets = [self.connection, upstream]
            while True:
                readable, _, _ = select.select(sockets, [], [])
                for source in readable:
                    data = source.recv(65536)
                    if not data:
                        return
                    target = upstream if source is self.connection else self.connection
                    target.sendall(data)

class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

with Server(("0.0.0.0", listen_port), Proxy) as server:
    print(server.server_port, flush=True)
    server.serve_forever()
`;
