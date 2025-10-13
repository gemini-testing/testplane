import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { Connect } from "vite";
import IncomingMessage = Connect.IncomingMessage;

interface User {
    login: string;
    password: string;
}

export class AuthServer {
    private readonly users: User[] = [
        { login: "admin", password: "admin123" },
        { login: "user", password: "user123" },
        { login: "test", password: "test123" },
    ];

    private readonly port: number = 3000;
    private readonly sessions: Map<string, { login: string; timestamp: number }> = new Map();
    private server: http.Server<typeof IncomingMessage> | undefined;

    public start(): void {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.port, () => {
            console.log(`Server running at http://localhost:${this.port}`);
        });
    }

    public stop(): void {
        if (this.server) {
            this.server.close();
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        const parsedUrl = url.parse(req.url || "", true);
        const pathname = parsedUrl.pathname;

        res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Credentials", "true");

        const anotherCookieOptions = ["someCookie=someName", "HttpOnly", "sameSite=Lax", "Path=/"].join("; ");

        res.setHeader("Set-Cookie", anotherCookieOptions);

        if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
        }

        if (pathname === "/api/login" && req.method === "POST") {
            this.handleLogin(req, res);
        } else if (pathname === "/api/logout" && req.method === "POST") {
            this.handleLogout(req, res);
        } else if (pathname === "/api/check-auth" && req.method === "GET") {
            this.handleCheckAuth(req, res);
        } else {
            this.serveStaticFile(req, res);
        }
    }

    private serveStaticFile(req: http.IncomingMessage, res: http.ServerResponse): void {
        const parsedUrl = url.parse(req.url || "");
        let pathname = path.join(
            __dirname,
            "public",
            parsedUrl.pathname === "/" ? "index.html" : parsedUrl.pathname || "",
        );

        pathname = path.normalize(pathname);
        if (!pathname.startsWith(path.join(__dirname, "public"))) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }

        fs.readFile(pathname, (err, data) => {
            if (err) {
                if (err.code === "ENOENT") {
                    fs.readFile(path.join(__dirname, "public", "index.html"), (err, data) => {
                        if (err) {
                            res.writeHead(404);
                            res.end("File not found");
                        } else {
                            res.writeHead(200, { "Content-Type": "text/html" });
                            res.end(data);
                        }
                    });
                } else {
                    res.writeHead(500);
                    res.end("Server error");
                }
            } else {
                const ext = path.extname(pathname);
                const contentType = this.getContentType(ext);
                res.writeHead(200, { "Content-Type": contentType });
                res.end(data);
            }
        });
    }

    private getContentType(ext: string): string {
        const contentTypes: { [key: string]: string } = {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
        };
        return contentTypes[ext] || "text/plain";
    }

    private handleLogin(req: http.IncomingMessage, res: http.ServerResponse): void {
        let body = "";

        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            try {
                const { login, password, rememberMe } = JSON.parse(body);
                const user = this.users.find(u => u.login === login && u.password === password);

                if (user) {
                    const sessionId = this.generateSessionId();
                    this.sessions.set(sessionId, {
                        login: user.login,
                        timestamp: Date.now(),
                    });

                    const sessionCookieOptions = [
                        `sessionId=${sessionId}`,
                        "HttpOnly",
                        "sameSite=Lax",
                        "Path=/",
                        rememberMe ? `Max-Age=${60 * 60 * 24 * 7}` : "",
                    ].join("; ");

                    res.setHeader("Set-Cookie", sessionCookieOptions);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            success: true,
                            message: "Login successful",
                            login: user.login,
                        }),
                    );
                } else {
                    res.writeHead(401, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            success: false,
                            message: "Invalid login or password",
                        }),
                    );
                }
            } catch (error) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        success: false,
                        message: "Invalid request format",
                    }),
                );
            }
        });
    }

    private handleLogout(req: http.IncomingMessage, res: http.ServerResponse): void {
        const cookies = this.parseCookies(req.headers.cookie || "");
        const sessionId = cookies.sessionId;

        if (sessionId && this.sessions.has(sessionId)) {
            this.sessions.delete(sessionId);
        }

        res.setHeader("Set-Cookie", "sessionId=; HttpOnly; Path=/; Max-Age=0");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
            JSON.stringify({
                success: true,
                message: "Logout successful",
            }),
        );
    }

    private handleCheckAuth(req: http.IncomingMessage, res: http.ServerResponse): void {
        const cookies = this.parseCookies(req.headers.cookie || "");
        const sessionId = cookies.sessionId;

        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    authenticated: true,
                    login: session.login,
                }),
            );
        } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    authenticated: false,
                }),
            );
        }
    }

    private parseCookies(cookieHeader: string): { [key: string]: string } {
        const cookies: { [key: string]: string } = {};
        cookieHeader.split(";").forEach(cookie => {
            const [name, value] = cookie.trim().split("=");
            if (name && value) {
                cookies[name] = value;
            }
        });
        return cookies;
    }

    private generateSessionId(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}
