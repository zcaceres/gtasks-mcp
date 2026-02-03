#!/usr/bin/env node

import { authenticate } from "@google-cloud/local-auth";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import { google, tasks_v1 } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import { TaskActions, TaskListActions, TaskResources } from "./Tasks.js";

const tasks = google.tasks("v1");

const server = new Server(
  {
    name: "example-servers/gtasks",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const [allTasks, nextPageToken] = await TaskResources.list(request, tasks);
  return {
    resources: allTasks.map((task) => ({
      uri: `gtasks:///${task.id}`,
      mimeType: "text/plain",
      name: task.title,
    })),
    nextCursor: nextPageToken,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const task = await TaskResources.read(request, tasks);

  const taskDetails = [
    `Title: ${task.title || "No title"}`,
    `Status: ${task.status || "Unknown"}`,
    `Due: ${task.due || "Not set"}`,
    `Notes: ${task.notes || "No notes"}`,
    `Hidden: ${task.hidden || "Unknown"}`,
    `Parent: ${task.parent || "Unknown"}`,
    `Deleted?: ${task.deleted || "Unknown"}`,
    `Completed Date: ${task.completed || "Unknown"}`,
    `Position: ${task.position || "Unknown"}`,
    `ETag: ${task.etag || "Unknown"}`,
    `Links: ${task.links || "Unknown"}`,
    `Kind: ${task.kind || "Unknown"}`,
    `Status: ${task.status || "Unknown"}`,
    `Created: ${task.updated || "Unknown"}`,
    `Updated: ${task.updated || "Unknown"}`,
  ].join("\n");

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "text/plain",
        text: taskDetails,
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search for a task in Google Tasks",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
            includeCompleted: {
              type: "boolean",
              description:
                "Include completed tasks in search results (default: false)",
            },
            status: {
              type: "string",
              enum: ["needsAction", "completed"],
              description:
                "Filter by status: 'needsAction' for active tasks, 'completed' for completed tasks",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list",
        description: "List all tasks in Google Tasks",
        inputSchema: {
          type: "object",
          properties: {
            cursor: {
              type: "string",
              description: "Cursor for pagination",
            },
            includeCompleted: {
              type: "boolean",
              description:
                "Include completed tasks in results (default: false)",
            },
            status: {
              type: "string",
              enum: ["needsAction", "completed"],
              description:
                "Filter by status: 'needsAction' for active tasks, 'completed' for completed tasks",
            },
          },
        },
      },
      {
        name: "create",
        description: "Create a new task in Google Tasks",
        inputSchema: {
          type: "object",
          properties: {
            taskListId: {
              type: "string",
              description: "Task list ID",
            },
            title: {
              type: "string",
              description: "Task title",
            },
            notes: {
              type: "string",
              description: "Task notes",
            },
            due: {
              type: "string",
              description: "Due date",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "clear",
        description: "Clear completed tasks from a Google Tasks task list",
        inputSchema: {
          type: "object",
          properties: {
            taskListId: {
              type: "string",
              description: "Task list ID",
            },
          },
          required: ["taskListId"],
        },
      },
      {
        name: "delete",
        description: "Delete a task in Google Tasks",
        inputSchema: {
          type: "object",
          properties: {
            taskListId: {
              type: "string",
              description: "Task list ID",
            },
            id: {
              type: "string",
              description: "Task id",
            },
          },
          required: ["id", "taskListId"],
        },
      },
      {
        name: "update",
        description:
          "Update a task in Google Tasks. Only provided fields will be updated; omitted fields remain unchanged.",
        inputSchema: {
          type: "object",
          properties: {
            taskListId: {
              type: "string",
              description: "Task list ID",
            },
            id: {
              type: "string",
              description: "Task ID",
            },
            title: {
              type: "string",
              description: "Task title",
            },
            notes: {
              type: "string",
              description: "Task notes",
            },
            status: {
              type: "string",
              enum: ["needsAction", "completed"],
              description: "Task status (needsAction or completed)",
            },
            due: {
              type: "string",
              description: "Due date",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "list-tasklists",
        description: "List all task lists in Google Tasks",
        inputSchema: {
          type: "object",
          properties: {
            cursor: {
              type: "string",
              description:
                "Cursor for pagination (nextPageToken from previous response)",
            },
          },
        },
      },
      {
        name: "get-tasklist",
        description: "Get details of a specific task list by ID",
        inputSchema: {
          type: "object",
          properties: {
            taskListId: {
              type: "string",
              description: "Task list ID (use 'list-tasklists' to find IDs)",
            },
          },
          required: ["taskListId"],
        },
      },
      {
        name: "create-tasklist",
        description: "Create a new task list in Google Tasks",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title for the new task list (max 1024 characters)",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "update-tasklist",
        description: "Update an existing task list's title in Google Tasks",
        inputSchema: {
          type: "object",
          properties: {
            taskListId: {
              type: "string",
              description: "Task list ID to update",
            },
            title: {
              type: "string",
              description: "New title for the task list (max 1024 characters)",
            },
          },
          required: ["taskListId", "title"],
        },
      },
      {
        name: "delete-tasklist",
        description:
          "Delete a task list from Google Tasks (cannot delete default list)",
        inputSchema: {
          type: "object",
          properties: {
            taskListId: {
              type: "string",
              description: "Task list ID to delete",
            },
          },
          required: ["taskListId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search") {
    const taskResult = await TaskActions.search(request, tasks);
    return taskResult;
  }
  if (request.params.name === "list") {
    const taskResult = await TaskActions.list(request, tasks);
    return taskResult;
  }
  if (request.params.name === "create") {
    const taskResult = await TaskActions.create(request, tasks);
    return taskResult;
  }
  if (request.params.name === "update") {
    const taskResult = await TaskActions.update(request, tasks);
    return taskResult;
  }
  if (request.params.name === "delete") {
    const taskResult = await TaskActions.delete(request, tasks);
    return taskResult;
  }
  if (request.params.name === "clear") {
    const taskResult = await TaskActions.clear(request, tasks);
    return taskResult;
  }
  if (request.params.name === "list-tasklists") {
    const result = await TaskListActions.list(request, tasks);
    return result;
  }
  if (request.params.name === "get-tasklist") {
    const result = await TaskListActions.get(request, tasks);
    return result;
  }
  if (request.params.name === "create-tasklist") {
    const result = await TaskListActions.create(request, tasks);
    return result;
  }
  if (request.params.name === "update-tasklist") {
    const result = await TaskListActions.update(request, tasks);
    return result;
  }
  if (request.params.name === "delete-tasklist") {
    const result = await TaskListActions.delete(request, tasks);
    return result;
  }
  throw new Error("Tool not found");
});

const credentialsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.gtasks-server-credentials.json",
);

async function authenticateAndSaveCredentials() {
  console.log("Launching auth flow…");
  const p = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../gcp-oauth.keys.json",
  );

  console.log(p);
  const auth = await authenticate({
    keyfilePath: p,
    scopes: ["https://www.googleapis.com/auth/tasks"],
  });
  fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
  console.log("Credentials saved. You can now run the server.");
}

async function loadCredentialsAndRunServer() {
  if (!fs.existsSync(credentialsPath)) {
    console.error(
      "Credentials not found. Please run with 'auth' argument first.",
    );
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));

  // Load OAuth app credentials to enable token refresh
  const oauthKeysPath =
    process.env.GOOGLE_OAUTH_CREDENTIALS ||
    path.join(path.dirname(credentialsPath), "gcp-oauth.keys.json");
  const oauthKeys = JSON.parse(fs.readFileSync(oauthKeysPath, "utf-8"));
  const { client_id, client_secret } = oauthKeys.installed;

  const auth = new google.auth.OAuth2(client_id, client_secret);
  auth.setCredentials(credentials);

  // Auto-save refreshed tokens
  auth.on("tokens", (tokens) => {
    const updated = { ...credentials, ...tokens };
    fs.writeFileSync(credentialsPath, JSON.stringify(updated, null, 2));
  });

  google.options({ auth });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}
