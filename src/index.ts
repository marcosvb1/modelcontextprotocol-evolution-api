#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const FETCH_INSTANCES_TOOL: Tool = {
  name: "fetchInstances",
  description: "Lists all WhatsApp instances",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const SEND_TEXT_TOOL: Tool = {
  name: "sendText",
  description: "Send a text message to a WhatsApp number",
  inputSchema: {
    type: "object",
    properties: {
      instance: {
        type: "string",
        description: "Instance name to use"
      },
      number: {
        type: "string",
        description: "Phone number to send message to (with country code, no special chars)"
      },
      text: {
        type: "string",
        description: "Text message to send"
      },
      delay: {
        type: "number",
        description: "Delay in seconds before sending",
        default: 1
      }
    },
    required: ["instance", "number", "text"],
  },
};

const server = new Server(
  {
    name: "evolution-api",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Check for API key
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN!;
if (!EVOLUTION_API_TOKEN) {
  console.error("Error: EVOLUTION_API_TOKEN environment variable is required");
  process.exit(1);
}

const BASE_URL = "https://evolution.digitalprofits.com.br";

async function fetchInstances() {
  const response = await fetch(`${BASE_URL}/instance/fetchInstances`, {
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_TOKEN
    }
  });

  if (!response.ok) {
    throw new Error(`Evolution API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  return await response.json();
}

async function sendText(instance: string, number: string, text: string, delay: number = 1) {
  const response = await fetch(`${BASE_URL}/message/sendText/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_TOKEN
    },
    body: JSON.stringify({
      number,
      text,
      delay
    })
  });

  if (!response.ok) {
    throw new Error(`Evolution API error: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  return await response.json();
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [FETCH_INSTANCES_TOOL, SEND_TEXT_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args && name !== "fetchInstances") {
      throw new Error("No arguments provided");
    }

    switch (name) {
      case "fetchInstances": {
        const results = await fetchInstances();
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
          isError: false,
        };
      }

      case "sendText": {
        if (!args?.instance || !args?.number || !args?.text) {
          throw new Error("Missing required arguments for sendText");
        }
        const { instance, number, text, delay = 1 } = args;
        const results = await sendText(instance, number, text, delay);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
          isError: false,
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Evolution API MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});