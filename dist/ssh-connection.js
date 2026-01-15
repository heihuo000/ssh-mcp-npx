"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.SSHConnectionManager = void 0;
const ssh2_1 = require("ssh2");
class SSHConnectionManager {
    constructor(configManager) {
        this.connections = new Map();
        this.connectionCounter = 0;
        this.configManager = configManager;
    }
    generateConnectionId() {
        return `conn_${Date.now()}_${this.connectionCounter++}`;
    }
    async connect(server_name) {
        const name = server_name || this.configManager.getDefaultServer();
        if (!name) {
            throw new Error("No server specified and no default server configured");
        }
        const config = this.configManager.getServer(name);
        if (!config) {
            throw new Error(`Server '${name}' not found in configuration`);
        }
        for (const conn of this.connections.values()) {
            if (conn.server_name === name && conn.connected) {
                return conn;
            }
        }
        return new Promise((resolve, reject) => {
            const client = new ssh2_1.Client();
            const connectionId = this.generateConnectionId();
            const connection = {
                id: connectionId,
                server_name: name,
                client,
                connected: false,
                connected_at: new Date(),
            };
            client
                .on("ready", () => {
                    connection.connected = true;
                    this.connections.set(connectionId, connection);
                    console.error(`Connected to ${name}`);
                    resolve(connection);
                })
                .on("error", (err) => {
                    console.error(`Connection error to ${name}:`, err);
                    reject(err);
                });
            const connectConfig = {
                host: config.host,
                port: config.port,
                username: config.username,
                readyTimeout: 30000,
            };
            if (config.key_path) {
                connectConfig.privateKey = require("fs").readFileSync(config.key_path);
            }
            else if (config.password) {
                connectConfig.password = config.password;
            }
            if (config.proxy_command) {
                console.warn("Proxy command support is limited. Consider using SSH config file.");
            }
            client.connect(connectConfig);
        });
    }
    disconnect(connection_id) {
        if (connection_id) {
            const conn = this.connections.get(connection_id);
            if (conn) {
                conn.client.end();
                this.connections.delete(connection_id);
                return { disconnected: 1 };
            }
            return { disconnected: 0 };
        }
        else {
            let count = 0;
            for (const [id, conn] of this.connections.entries()) {
                conn.client.end();
                this.connections.delete(id);
                count++;
            }
            return { disconnected: count };
        }
    }
    async executeCommand(server_name, command, timeout = 30) {
        const startTime = Date.now();
        const connection = await this.connect(server_name);
        return new Promise((resolve, reject) => {
            let stdout = "";
            let stderr = "";
            let exit_code = null;
            let timer = null;
            const cleanup = () => {
                if (timer)
                    clearTimeout(timer);
            };
            if (timeout > 0) {
                timer = setTimeout(() => {
                    cleanup();
                    reject(new Error(`Command timeout after ${timeout}s`));
                }, timeout * 1000);
            }
            connection.client.exec(command, (err, stream) => {
                if (err) {
                    cleanup();
                    reject(err);
                    return;
                }
                stream
                    .on("data", (data) => {
                    stdout += data.toString();
                })
                    .stderr
                    .on("data", (data) => {
                    stderr += data.toString();
                });
                stream.on("close", (code) => {
                    cleanup();
                    exit_code = code;
                    resolve({
                        stdout,
                        stderr,
                        exit_code,
                        duration: Date.now() - startTime,
                    });
                });
            });
        });
    }
    getStatus() {
        return {
            connections: Array.from(this.connections.values()).map((conn) => ({
                id: conn.id,
                server_name: conn.server_name,
                connected: conn.connected,
                connected_at: conn.connected_at.toISOString(),
            })),
            total: this.connections.size,
        };
    }
    getConnection(server_name) {
        for (const conn of this.connections.values()) {
            if (conn.server_name === server_name && conn.connected) {
                return conn;
            }
        }
        return undefined;
    }
}
exports.SSHConnectionManager = SSHConnectionManager;
