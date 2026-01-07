# Google Tasks MCP Server

![gtasks mcp logo](./logo.jpg)
[![smithery badge](https://smithery.ai/badge/@zcaceres/gtasks)](https://smithery.ai/server/@zcaceres/gtasks)

This MCP server integrates with Google Tasks and Google Calendar to allow:

- **Tasks**: listing, reading, searching, creating, updating, and deleting tasks.
- **Calendar**: listing events, creating events (with optional Google Meet links), updating, and deleting events.

## Components

### Tools

- **search**

  - Search for tasks in Google Tasks
  - Input: `query` (string): Search query
  - Returns matching tasks with details

- **list**

  - List all tasks in Google Tasks
  - Optional input: `cursor` (string): Cursor for pagination
  - Returns a list of all tasks

- **create**

  - Create a new task in Google Tasks
  - Input:
    - `taskListId` (string, optional): Task list ID
    - `title` (string, required): Task title
    - `notes` (string, optional): Task notes
    - `due` (string, optional): Due date
  - Returns confirmation of task creation

- **update**

  - Update an existing task in Google Tasks
  - Input:
    - `taskListId` (string, optional): Task list ID
    - `id` (string, required): Task ID
    - `uri` (string, required): Task URI
    - `title` (string, optional): New task title
    - `notes` (string, optional): New task notes
    - `status` (string, optional): New task status ("needsAction" or "completed")
    - `due` (string, optional): New due date
  - Returns confirmation of task update

- **delete**

  - Delete a task in Google Tasks
  - Input:
    - `taskListId` (string, required): Task list ID
    - `id` (string, required): Task ID
  - Returns confirmation of task deletion

- **clear**

  - Clear completed tasks from a Google Tasks task list
  - Input: `taskListId` (string, required): Task list ID
  - Returns confirmation of cleared tasks

- **calendar_list_events**

  - List events from a Google Calendar
  - Input:
    - `calendarId` (string, optional): Calendar ID (default: "primary")
    - `maxResults` (number, optional): Max results to return
    - `timeMin` (string, optional): Min start time (ISO 8601)
    - `timeMax` (string, optional): Max start time (ISO 8601)
    - `query` (string, optional): Free text search terms
  - Returns list of events

- **calendar_create_event**

  - Create a new event in Google Calendar
  - Input:
    - `calendarId` (string, optional): Calendar ID (default: "primary")
    - `summary` (string, required): Event title
    - `description` (string, optional): Event description
    - `location` (string, optional): Location
    - `startTime` (string, required): Start time (ISO 8601)
    - `endTime` (string, required): End time (ISO 8601)
    - `createMeet` (boolean, optional): Set to `true` to generate a Google Meet link
  - Returns confirmation of event creation

- **calendar_update_event**

  - Update an existing event in Google Calendar
  - Input:
    - `calendarId` (string, optional): Calendar ID (default: "primary")
    - `eventId` (string, required): ID of event to update
    - `summary`, `description`, `location`, `startTime`, `endTime` (optional): Fields to update
  - Returns confirmation of event update

- **calendar_delete_event**
  - Delete an event from Google Calendar
  - Input:
    - `calendarId` (string, optional): Calendar ID (default: "primary")
    - `eventId` (string, required): ID of event to delete
  - Returns confirmation of deletion

### Resources

The server provides access to Google Tasks resources:

- **Tasks** (`gtasks:///<task_id>`)

  - Represents individual tasks in Google Tasks
  - Supports reading task details including title, status, due date, notes, and other metadata
  - Can be listed, read, created, updated, and deleted using the provided tools

- **Calendar Events** (`gcalendar:///events/<calendar_id>/<event_id>`)
  - Represents individual calendar events
  - Supports reading event details including summary, time, location, and status

## Getting started

### Prerequisites

1. [Create a new Google Cloud project](https://console.cloud.google.com/projectcreate)
2. [Enable the Google Tasks API](https://console.cloud.google.com/workspace-api/products)
3. [Configure an OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) ("internal" is fine for testing)
4. Add scopes:
   - `https://www.googleapis.com/auth/tasks`
   - `https://www.googleapis.com/auth/calendar`
5. [Create an OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient) for application type "Desktop App"
6. Download the JSON file of your client's OAuth keys

### Installation

1. Clone this repository
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

### Quick Usage with `npx`

Once installed and built, you can use `npx` to run the server or trigger authentication:

**1. Run the MCP Server:**

```bash
npx g-tasks-mcp
```

(If credentials are not found, this will automatically launch the authentication flow.)

**2. Manually Trigger Authentication:**

```bash
npx g-tasks-mcp auth
```

(This will explicitly launch the authentication flow.)

_Ensure you have your OAuth credentials configured as described in the "Configuration & Authentication" section below._

### Configuration & Authentication

This server supports multiple ways to provide your Google Cloud OAuth credentials. It handles authentication automatically: if no valid user credentials (`.gtasks-server-credentials.json`) are found, it will launch a browser window to authenticate you when the server starts.

You can configure the OAuth keys using **one** of the following methods:

#### Method 1: Environment Variables (Recommended)

Set the following environment variables in your MCP client configuration (e.g., `claude_desktop_config.json`). This is the cleanest way as it doesn't require placing files in the source directory.

- `GOOGLE_OAUTH_CREDENTIALS`: Absolute path to your downloaded OAuth JSON key file.
  - OR -
- `GOOGLE_CLIENT_ID`: Your OAuth Client ID.
- `GOOGLE_CLIENT_SECRET`: Your OAuth Client Secret.

#### Method 2: Key File

Rename your downloaded OAuth JSON key file to `gcp-oauth.keys.json` and place it in the root directory of this repository.

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json` (typically located at `~/Library/Application Support/Claude/` on macOS):

#### Option 1: Using Local Installation

```json
{
  "mcpServers": {
    "gtasks": {
      "command": "/path/to/your/node",
      "args": ["/absolute/path/to/gtasks-mcp/dist/index.js"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/absolute/path/to/your/gcp-oauth.keys.json"
      }
    }
  }
}
```

_Replace `/path/to/your/node` (run `which node` to find it) and `/absolute/path/to/...` with your actual paths._

#### Option 2: Using `npx` (No Local Installation Required)

```json
{
  "mcpServers": {
    "gtasks": {
      "command": "npx",
      "args": ["-y", "g-tasks-mcp"],
      "env": {
        "GOOGLE_OAUTH_CREDENTIALS": "/absolute/path/to/your/gcp-oauth.keys.json"
      }
    }
  }
}
```

### Installing via Smithery

To install Google Tasks Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@zcaceres/gtasks):

```bash
npx -y @smithery/cli install @zcaceres/gtasks --client claude
```

## Build

To rebuild the project:

```bash
npm run build
```

To watch for changes during development:

```bash
npm run dev
```
