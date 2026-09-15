import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCrmMcpServer } from './server';

async function main() {
  const server = createCrmMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('[CRM MCP Server] Running on stdio transport.');
}

main().catch((error: unknown) => {
  console.error('[CRM MCP Server Fatal Error]', error);
  process.exit(1);
});
