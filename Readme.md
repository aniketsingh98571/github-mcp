# GitHub MCP (Model Control Protocol)

This is a GitHub integration service that provides a Model Control Protocol (MCP) interface for interacting with GitHub's API.

## Setup and Configuration

### Prerequisites

- Node.js installed on your system
- A GitHub Personal Access Token (PAT)

### Environment Setup

The MCP server uses environment variables configured directly in your Cursor/Claude Desktop MCP settings. No separate `.env` file is needed.

## Running the MCP Server

### Local Development

To run the MCP server locally in Cursor/Claude Desktop:

1. Start the server using Node.js:

```bash
node src/index.js
```

2. Configure Cursor/Claude Desktop to use the MCP server by adding the following to your MCP configuration:

```json
{
  "mcpServers": {
    "GitHub MCP": {
      "command": "node",
      "args": ["/path/to/your/github-mcp/src/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

Replace `/path/to/your/github-mcp` with the actual path to your GitHub MCP project directory.

## Features

The GitHub MCP provides the following capabilities:

- User information retrieval
- Repository management
- Repository name updates
- And more GitHub API integrations

## Development

### Project Structure

```
github-mcp/
├── src/
│   └── index.js
├── .env
├── package.json
└── Readme.md
```
