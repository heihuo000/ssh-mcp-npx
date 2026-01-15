import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface SSHServerConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  key_path?: string;
  description?: string;
  proxy_command?: string;
}

export interface ServerConfigData {
  default_server?: string;
  servers: Record<string, SSHServerConfig>;
}

export class ServerConfigManager {
  private configPath: string;
  private config: ServerConfigData;

  constructor(configPath?: string) {
    this.configPath =
      configPath ||
      path.join(os.homedir(), ".ssh_servers.json");
    this.config = this.loadConfig();
  }

  private loadConfig(): ServerConfigData {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }
    return { servers: {} };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Error saving config:", error);
      throw error;
    }
  }

  addServer(config: Omit<SSHServerConfig, "port"> & { port?: number }): SSHServerConfig {
    const name = config.name;
    if (this.config.servers[name]) {
      throw new Error(`Server '${name}' already exists`);
    }

    const serverConfig: SSHServerConfig = {
      name,
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
      key_path: config.key_path,
      description: config.description,
      proxy_command: config.proxy_command,
    };

    this.config.servers[name] = serverConfig;
    this.saveConfig();
    return serverConfig;
  }

  deleteServer(name: string): boolean {
    if (!this.config.servers[name]) {
      throw new Error(`Server '${name}' not found`);
    }

    delete this.config.servers[name];

    // Reset default if it was the deleted server
    if (this.config.default_server === name) {
      delete this.config.default_server;
    }

    this.saveConfig();
    return true;
  }

  getServer(name: string): SSHServerConfig | undefined {
    return this.config.servers[name];
  }

  listServers(
    keyword?: string,
    includeSystemInfo: boolean = true
  ): Array<SSHServerConfig & { is_default?: boolean }> {
    let servers = Object.values(this.config.servers);

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      servers = servers.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerKeyword) ||
          s.host.toLowerCase().includes(lowerKeyword) ||
          (s.description && s.description.toLowerCase().includes(lowerKeyword))
      );
    }

    return servers.map((s) => ({
      ...s,
      is_default: s.name === this.config.default_server,
    }));
  }

  getDefaultServer(): string | undefined {
    return this.config.default_server;
  }

  setDefaultServer(name: string): boolean {
    if (!this.config.servers[name]) {
      throw new Error(`Server '${name}' not found`);
    }

    this.config.default_server = name;
    this.saveConfig();
    return true;
  }

  getAllServers(): Record<string, SSHServerConfig> {
    return { ...this.config.servers };
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
