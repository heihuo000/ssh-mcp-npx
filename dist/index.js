#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SSHConnectionManager } from "./ssh-connection.js";
import { ServerConfigManager } from "./server-config.js";

// Initialize managers
const configManager = new ServerConfigManager();
const sshManager = new SSHConnectionManager(configManager);

// Create MCP server
const server = new Server(
  {
    name: "ssh-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ssh_connect",
        description: "Connect to an SSH server",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Name of the server to connect to (optional, uses default if not specified)",
            },
          },
        },
      },
      {
        name: "ssh_disconnect",
        description: "Disconnect from SSH server",
        inputSchema: {
          type: "object",
          properties: {
            connection_id: {
              type: "string",
              description: "Connection ID to disconnect (optional, disconnects all if not specified)",
            },
          },
        },
      },
      {
        name: "ssh_execute",
        description: "Execute a command on the SSH server",
        inputSchema: {
          type: "object",
          properties: {
            server_name: {
              type: "string",
              description: "Server name",
            },
            command: {
              type: "string",
              description: "Command to execute",
            },
            timeout: {
              type: "number",
              description: "Timeout in seconds (optional)",
            },
          },
          required: ["server_name", "command"],
        },
      },
      {
        name: "ssh_get_status",
        description: "Get SSH connection status",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "ssh_list_servers",
        description: "List all configured SSH servers",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Optional keyword to filter servers",
            },
            include_system_info: {
              type: "boolean",
              description: "Whether to include system info (default: true)",
            },
          },
        },
      },
      {
        name: "ssh_add_server",
        description: "Add a new SSH server configuration",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Server name (unique identifier)",
            },
            host: {
              type: "string",
              description: "Server address",
            },
            port: {
              type: "number",
              description: "SSH port",
            },
            username: {
              type: "string",
              description: "Username",
            },
            password: {
              type: "string",
              description: "Password (optional, use key or password)",
            },
            key_path: {
              type: "string",
              description: "SSH key path (optional, use key or password)",
            },
            description: {
              type: "string",
              description: "Server description",
            },
            proxy_command: {
              type: "string",
              description: "SSH ProxyCommand (e.g., cloudflared access ssh --hostname %h)",
            },
          },
          required: ["name", "host", "username"],
        },
      },
      {
        name: "ssh_delete_server",
        description: "Delete SSH server configuration",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Server name to delete",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "ssh_set_default",
        description: "Set default SSH server",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Server name to set as default",
            },
          },
          required: ["name"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "ssh_connect": {
        const result = await sshManager.connect(args?.server_name);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ssh_disconnect": {
        const result = sshManager.disconnect(args?.connection_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ssh_execute": {
        const result = await sshManager.executeCommand(
          args.server_name,
          args.command,
          args.timeout
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ssh_get_status": {
        const result = sshManager.getStatus();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ssh_list_servers": {
        const result = configManager.listServers(
          args?.keyword,
          args?.include_system_info
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ssh_add_server": {
        const result = configManager.addServer(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ssh_delete_server": {
        const result = configManager.deleteServer(args.name);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "ssh_set_default": {
        const result = configManager.setDefaultServer(args.name);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SSH MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});