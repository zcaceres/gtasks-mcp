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
import { google, tasks_v1, calendar_v3 } from "googleapis";
import path from "path";
import { TaskActions, TaskResources } from "./Tasks.js";
import { CalendarActions, CalendarResources } from "./Calendar.js";

const tasks = google.tasks("v1");
const calendar = google.calendar("v3");

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
    nextCursor: nextPageToken ? nextPageToken : undefined,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri.startsWith("gtasks:///")) {
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
  }

  if (request.params.uri.startsWith("gcalendar:///")) {
      const event = await CalendarResources.read(request, calendar);
      const eventDetails = JSON.stringify(event, null, 2);
       return {
            contents: [
                {
                    uri: request.params.uri,
                    mimeType: "application/json",
                    text: eventDetails,
                },
            ],
        };
  }

  throw new Error("Resource not found");
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
        description: "Update a task in Google Tasks",
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
            uri: {
              type: "string",
              description: "Task URI",
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
          required: ["id", "uri"],
        },
      },

      {
        name: "calendar_list_events",
        description: "List events from a Google Calendar",
        inputSchema: {
          type: "object",
          properties: {
            calendarId: {
                type: "string",
                description: "Calendar ID (default: primary)",
            },
            maxResults: {
                type: "number",
                description: "Maximum results to return",
            },
            timeMin: {
                type: "string",
                description: "Minimum time (ISO 8601)",
            },
            timeMax: {
                type: "string",
                description: "Maximum time (ISO 8601)",
            },
            query: {
                type: "string",
                description: "Free text search terms",
            },
          },
        },
      },
      {
        name: "calendar_create_event",
        description: "Create a new event in Google Calendar",
        inputSchema: {
          type: "object",
          properties: {
             calendarId: { type: "string", description: "Calendar ID (default: primary)" },
             summary: { type: "string", description: "Event title/summary" },
             description: { type: "string", description: "Event description" },
             location: { type: "string", description: "Event location" },
             startTime: { type: "string", description: "Start time (ISO 8601)" },
             endTime: { type: "string", description: "End time (ISO 8601)" },
             createMeet: { type: "boolean", description: "Create a Google Meet link" },
          },
          required: ["summary", "startTime", "endTime"],
        },
      },
      {
         name: "calendar_update_event",
         description: "Update an existing event in Google Calendar",
         inputSchema: {
            type: "object",
             properties: {
                 calendarId: { type: "string", description: "Calendar ID (default: primary)" },
                 eventId: { type: "string", description: "Event ID to update" },
                 summary: { type: "string", description: "New title/summary" },
                 description: { type: "string", description: "New description" },
                 location: { type: "string", description: "New location" },
                 startTime: { type: "string", description: "New start time (ISO 8601)" },
                 endTime: { type: "string", description: "New end time (ISO 8601)" },
             },
             required: ["eventId"],
         },
      },
      {
        name: "calendar_delete_event",
        description: "Delete an event from Google Calendar",
        inputSchema: {
             type: "object",
             properties: {
                 calendarId: { type: "string", description: "Calendar ID (default: primary)" },
                 eventId: { type: "string", description: "Event ID to delete" },
             },
             required: ["eventId"],
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
  
  // Calendar Tools
  if (request.params.name === "calendar_list_events") {
      return await CalendarActions.list_events(request, calendar);
  }
  if (request.params.name === "calendar_create_event") {
      return await CalendarActions.create_event(request, calendar);
  }
  if (request.params.name === "calendar_update_event") {
      return await CalendarActions.update_event(request, calendar);
  }
  if (request.params.name === "calendar_delete_event") {
      return await CalendarActions.delete_event(request, calendar);
  }

  throw new Error("Tool not found");
});

const credentialsPath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../.gtasks-server-credentials.json",
);

async function authenticateAndSaveCredentials() {
  console.error("Launching auth flow…");
  const keyFilePath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "../gcp-oauth.keys.json",
  );

  let auth;
  let tempKeyPath: string | null = null;

  try {
    if (process.env.GOOGLE_OAUTH_CREDENTIALS) {
      console.error(`Using keys file from GOOGLE_OAUTH_CREDENTIALS environment variable: ${process.env.GOOGLE_OAUTH_CREDENTIALS}`);
      auth = await authenticate({
        keyfilePath: process.env.GOOGLE_OAUTH_CREDENTIALS,
        scopes: [
          "https://www.googleapis.com/auth/tasks",
          "https://www.googleapis.com/auth/calendar",
        ],
      });
    } else if (fs.existsSync(keyFilePath)) {
      console.error(`Using keys file: ${keyFilePath}`);
      auth = await authenticate({
        keyfilePath: keyFilePath,
        scopes: [
          "https://www.googleapis.com/auth/tasks",
          "https://www.googleapis.com/auth/calendar",
        ],
      });
    } else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      console.error("Using credentials from environment variables.");
      const keys = {
        installed: {
          client_id: process.env.GOOGLE_CLIENT_ID,
          project_id: "gtasks-mcp", // Placeholder
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uris: ["http://localhost:3000/oauth2callback"],
        },
      };
      
      tempKeyPath = path.join(
        path.dirname(new URL(import.meta.url).pathname),
        "../temp-oauth.keys.json"
      );
      fs.writeFileSync(tempKeyPath, JSON.stringify(keys));
      
      auth = await authenticate({
        keyfilePath: tempKeyPath,
        scopes: [
          "https://www.googleapis.com/auth/tasks",
          "https://www.googleapis.com/auth/calendar",
        ],
      });
    } else {
      throw new Error(
        "No credentials found. Please provide 'gcp-oauth.keys.json' or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
      );
    }

    fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
    console.error("Credentials saved. You can now run the server.");

  } finally {
    if (tempKeyPath && fs.existsSync(tempKeyPath)) {
      fs.unlinkSync(tempKeyPath);
    }
  }
}

function writeCredentials(credentials: object) {
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials));
}

async function loadOrRefreshAuth() {
  if (!fs.existsSync(credentialsPath)) {
    console.error("Credentials not found. Launching authentication...");
    try {
      await authenticateAndSaveCredentials();
    } catch (error) {
      console.error("Authentication failed:", error);
      process.exit(1);
    }
  }

  let credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  const auth = new google.auth.OAuth2();
  auth.setCredentials(credentials);

  auth.on("tokens", (tokens) => {
    if (!tokens.access_token && !tokens.refresh_token) {
      return;
    }
    const merged = {
      ...auth.credentials,
      ...tokens,
      refresh_token: tokens.refresh_token || auth.credentials.refresh_token,
    };
    writeCredentials(merged);
  });

  try {
    const accessToken = await auth.getAccessToken();
    if (!accessToken?.token) {
      throw new Error("No access token available.");
    }
  } catch (error) {
    console.error("Stored credentials invalid. Re-authenticating...");
    try {
      await authenticateAndSaveCredentials();
    } catch (authError) {
      console.error("Authentication failed:", authError);
      process.exit(1);
    }
    credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
    auth.setCredentials(credentials);
  }

  return auth;
}

async function loadCredentialsAndRunServer() {
  const auth = await loadOrRefreshAuth();
  google.options({ auth });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}
