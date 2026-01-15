# SSH MCP Server

A Model Context Protocol (MCP) server implementation for SSH connections, built with Node.js and TypeScript.

## Features

- Secure SSH connection management
- Remote command execution
- File transfer capabilities
- Session persistence
- Multi-server support

## Installation

```bash
npx ssh-mcp-npx
```

## Usage

### Basic Usage

```bash
npx ssh-mcp-server
```

### Configuration

Create a configuration file or use environment variables to configure SSH servers:

```json
{
  "servers": {
    "my-server": {
      "host": "example.com",
      "port": 22,
      "username": "user",
      "password": "password"
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```

## License

MIT