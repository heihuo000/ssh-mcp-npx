import { Client } from "ssh2";
import { ServerConfigManager, SSHServerConfig } from "./server-config.js";

export interface SSHConnection {
  id: string;
  server_name: string;
  client: Client;
  connected: boolean;
  connected_at: Date;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exit_code: number | null;
  duration: number;
}

export class SSHConnectionManager {
  private connections: Map<string, SSHConnection> = [];
  private configManager: ServerConfigManager;
  private connectionCounter = 0;

  constructor(configManager: ServerConfigManager) {
    this.configManager = configManager;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${this.connectionCounter++}`;
  }

  async connect(server_name?: string): Promise<SSHConnection> {
    const name = server_name || this.configManager.getDefaultServer();
    if (!name) {
      throw new Error(
        "No server specified and no default server configured"
      );
    }

    const config = this.configManager.getServer(name);
    if (!config) {
      throw new Error(`Server '${name}' not found in configuration`);
    }

    // Check if already connected to this server
    for (const conn of this.connections.values()) {
      if (conn.server_name === name && conn.connected) {
        return conn;
      }
    }

    return new Promise((resolve, reject) => {
      const client = new Client();
      const connectionId = this.generateConnectionId();

      const connection: SSHConnection = {
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

      const connectConfig: any = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 30000,
      };

      // Add authentication method
      if (config.key_path) {
        connectConfig.privateKey = require("fs").readFileSync(config.key_path);
      } else if (config.password) {
        connectConfig.password = config.password;
      }

      // Add proxy command if configured
      if (config.proxy_command) {
        // For proxy commands, we need to use a different approach
        // This is a simplified version - you may need to adjust based on your needs
        console.warn(
          "Proxy command support is limited. Consider using SSH config file."
        );
      }

      client.connect(connectConfig);
    });
  }

  disconnect(connection_id?: string): { disconnected: number } {
    if (connection_id) {
      const conn = this.connections.get(connection_id);
      if (conn) {
        conn.client.end();
        this.connections.delete(connection_id);
        return { disconnected: 1 };
      }
      return { disconnected: 0 };
    } else {
      // Disconnect all
      let count = 0;
      for (const [id, conn] of this.connections.entries()) {
        conn.client.end();
        this.connections.delete(id);
        count++;
      }
      return { disconnected: count };
    }
  }

  async executeCommand(
    server_name: string,
    command: string,
    timeout: number = 30
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const connection = await this.connect(server_name);

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let exit_code: number | null = null;
      let timer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
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
          .on("data", (data: Buffer) => {
            stdout += data.toString();
          })
          .stderr
          .on("data", (data: Buffer) => {
            stderr += data.toString();
          });

        stream.on("close", (code: number) => {
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

  getStatus(): {
    connections: Array<{
      id: string;
      server_name: string;
      connected: boolean;
      connected_at: string;
    }>;
    total: number;
  } {
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

  getConnection(server_name: string): SSHConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.server_name === server_name && conn.connected) {
        return conn;
      }
    }
    return undefined;
  }
}
