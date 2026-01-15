"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerConfigManager = void 0;
const fs = require("fs");
const path = require("path");
const os = require("os");
class ServerConfigManager {
    constructor(configPath) {
        this.configPath = configPath || path.join(os.homedir(), ".ssh_servers.json");
        this.config = this.loadConfig();
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, "utf-8");
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error("Error loading config:", error);
        }
        return { servers: {} };
    }
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf-8");
        }
        catch (error) {
            console.error("Error saving config:", error);
            throw error;
        }
    }
    addServer(config) {
        const name = config.name;
        if (this.config.servers[name]) {
            throw new Error(`Server '${name}' already exists`);
        }
        const serverConfig = {
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
    deleteServer(name) {
        if (!this.config.servers[name]) {
            throw new Error(`Server '${name}' not found`);
        }
        delete this.config.servers[name];
        if (this.config.default_server === name) {
            delete this.config.default_server;
        }
        this.saveConfig();
        return true;
    }
    getServer(name) {
        return this.config.servers[name];
    }
    listServers(keyword, includeSystemInfo = true) {
        let servers = Object.values(this.config.servers);
        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            servers = servers.filter((s) => s.name.toLowerCase().includes(lowerKeyword) ||
                s.host.toLowerCase().includes(lowerKeyword) ||
                (s.description && s.description.toLowerCase().includes(lowerKeyword)));
        }
        return servers.map((s) => ({
            ...s,
            is_default: s.name === this.config.default_server,
        }));
    }
    getDefaultServer() {
        return this.config.default_server;
    }
    setDefaultServer(name) {
        if (!this.config.servers[name]) {
            throw new Error(`Server '${name}' not found`);
        }
        this.config.default_server = name;
        this.saveConfig();
        return true;
    }
    getAllServers() {
        return { ...this.config.servers };
    }
    getConfigPath() {
        return this.configPath;
    }
}
exports.ServerConfigManager = ServerConfigManager;
