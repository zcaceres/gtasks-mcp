import {
  CallToolRequest,
  CallToolResult,
  ListResourcesRequest,
  ReadResourceRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { GaxiosResponse } from "gaxios";
import { tasks_v1 } from "googleapis";

const MAX_TASK_RESULTS = 100;

export class TaskResources {
  static async read(request: ReadResourceRequest, tasks: tasks_v1.Tasks) {
    const taskId = request.params.uri.replace("gtasks:///", "");

    const taskListsResponse: GaxiosResponse<tasks_v1.Schema$TaskLists> =
      await tasks.tasklists.list({
        maxResults: MAX_TASK_RESULTS,
      });

    const taskLists = taskListsResponse.data.items || [];
    let task: tasks_v1.Schema$Task | null = null;

    for (const taskList of taskLists) {
      if (taskList.id) {
        try {
          const taskResponse: GaxiosResponse<tasks_v1.Schema$Task> =
            await tasks.tasks.get({
              tasklist: taskList.id,
              task: taskId,
            });
          task = taskResponse.data;
          break;
        } catch (error) {
          // Task not found in this list, continue to the next one
        }
      }
    }

    if (!task) {
      throw new Error("Task not found");
    }

    return task;
  }

  static async list(
    request: ListResourcesRequest,
    tasks: tasks_v1.Tasks,
  ): Promise<[tasks_v1.Schema$Task[], string | null]> {
    const pageSize = 10;
    const params: any = {
      maxResults: pageSize,
    };

    if (request.params?.cursor) {
      params.pageToken = request.params.cursor;
    }

    const taskListsResponse = await tasks.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });

    const taskLists = taskListsResponse.data.items || [];

    let allTasks: tasks_v1.Schema$Task[] = [];
    let nextPageToken = null;

    for (const taskList of taskLists) {
      const tasksResponse = await tasks.tasks.list({
        tasklist: taskList.id,
        ...params,
      });

      const taskItems = tasksResponse.data.items || [];
      allTasks = allTasks.concat(taskItems);

      if (tasksResponse.data.nextPageToken) {
        nextPageToken = tasksResponse.data.nextPageToken;
      }
    }

    return [allTasks, nextPageToken];
  }
}

export class TaskActions {
  private static formatTask(task: tasks_v1.Schema$Task) {
    return `${task.title}\n (Due: ${task.due || "Not set"}) - Notes: ${task.notes} - ID: ${task.id} - Status: ${task.status} - URI: ${task.selfLink} - Hidden: ${task.hidden} - Parent: ${task.parent} - Deleted?: ${task.deleted} - Completed Date: ${task.completed} - Position: ${task.position} - Updated Date: ${task.updated} - ETag: ${task.etag} - Links: ${task.links} - Kind: ${task.kind}}`;
  }

  private static formatTaskList(taskList: tasks_v1.Schema$Task[]) {
    return taskList.map((task) => this.formatTask(task)).join("\n");
  }

  private static async _list(
    request: CallToolRequest,
    tasks: tasks_v1.Tasks,
    options?: { includeCompleted?: boolean },
  ) {
    const taskListsResponse = await tasks.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });

    const taskLists = taskListsResponse.data.items || [];
    let allTasks: tasks_v1.Schema$Task[] = [];

    const includeCompleted = options?.includeCompleted ?? false;

    for (const taskList of taskLists) {
      if (taskList.id) {
        try {
          const tasksResponse = await tasks.tasks.list({
            tasklist: taskList.id,
            maxResults: MAX_TASK_RESULTS,
            showCompleted: true,
            showHidden: includeCompleted,
          });

          const items = tasksResponse.data.items || [];
          allTasks = allTasks.concat(items);
        } catch (error) {
          console.error(`Error fetching tasks for list ${taskList.id}:`, error);
        }
      }
    }
    return allTasks;
  }

  static async create(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const taskListId =
      (request.params.arguments?.taskListId as string) || "@default";
    const taskTitle = request.params.arguments?.title as string;
    const taskNotes = request.params.arguments?.notes as string;
    const taskStatus = request.params.arguments?.status as string;
    const taskDue = request.params.arguments?.due as string;

    if (!taskTitle) {
      throw new Error("Task title is required");
    }

    const task = {
      title: taskTitle,
      notes: taskNotes,
      due: taskDue,
    };

    const taskResponse = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: task,
    });

    return {
      content: [
        {
          type: "text",
          text: `Task created: ${taskResponse.data.title}`,
        },
      ],
      isError: false,
    };
  }

  static async update(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const taskListId =
      (request.params.arguments?.taskListId as string) || "@default";
    const taskId = request.params.arguments?.id as string;
    const taskTitle = request.params.arguments?.title as string | undefined;
    const taskNotes = request.params.arguments?.notes as string | undefined;
    const taskStatus = request.params.arguments?.status as string | undefined;
    const taskDue = request.params.arguments?.due as string | undefined;

    if (!taskId) {
      throw new Error("Task ID is required");
    }

    // Build task object with only explicitly provided fields
    const task: Partial<tasks_v1.Schema$Task> = { id: taskId };

    if (taskTitle !== undefined) task.title = taskTitle;
    if (taskNotes !== undefined) task.notes = taskNotes;
    if (taskStatus !== undefined) task.status = taskStatus;
    if (taskDue !== undefined) task.due = taskDue;

    // Use patch instead of update for partial updates
    const taskResponse = await tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: task,
    });

    return {
      content: [
        {
          type: "text",
          text: `Task updated: ${taskResponse.data.title}`,
        },
      ],
      isError: false,
    };
  }

  static async list(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const includeCompleted =
      (request.params.arguments?.includeCompleted as boolean) ?? false;
    const statusFilter = request.params.arguments?.status as string | undefined;

    const allTasks = await this._list(request, tasks, { includeCompleted });

    const filteredTasks = statusFilter
      ? allTasks.filter((task) => task.status === statusFilter)
      : allTasks;

    const taskList = this.formatTaskList(filteredTasks);

    return {
      content: [
        {
          type: "text",
          text: `Found ${filteredTasks.length} tasks:\n${taskList}`,
        },
      ],
      isError: false,
    };
  }

  static async delete(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const taskListId =
      (request.params.arguments?.taskListId as string) || "@default";
    const taskId = request.params.arguments?.id as string;

    if (!taskId) {
      throw new Error("Task URI is required");
    }

    await tasks.tasks.delete({
      tasklist: taskListId,
      task: taskId,
    });

    return {
      content: [
        {
          type: "text",
          text: `Task ${taskId} deleted`,
        },
      ],
      isError: false,
    };
  }

  static async search(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const userQuery = request.params.arguments?.query as string;
    const includeCompleted =
      (request.params.arguments?.includeCompleted as boolean) ?? false;
    const statusFilter = request.params.arguments?.status as string | undefined;

    const allTasks = await this._list(request, tasks, { includeCompleted });
    const filteredItems = allTasks.filter((task) => {
      const matchesQuery =
        task.title?.toLowerCase().includes(userQuery.toLowerCase()) ||
        task.notes?.toLowerCase().includes(userQuery.toLowerCase());
      const matchesStatus = statusFilter ? task.status === statusFilter : true;
      return matchesQuery && matchesStatus;
    });

    const taskList = this.formatTaskList(filteredItems);

    return {
      content: [
        {
          type: "text",
          text: `Found ${filteredItems.length} tasks:\n${taskList}`,
        },
      ],
      isError: false,
    };
  }

  static async clear(request: CallToolRequest, tasks: tasks_v1.Tasks) {
    const taskListId =
      (request.params.arguments?.taskListId as string) || "@default";

    await tasks.tasks.clear({
      tasklist: taskListId,
    });

    return {
      content: [
        {
          type: "text",
          text: `Tasks from tasklist ${taskListId} cleared`,
        },
      ],
      isError: false,
    };
  }
}

export class TaskListActions {
  private static formatTaskList(taskList: tasks_v1.Schema$TaskList): string {
    return [
      `Title: ${taskList.title || "Untitled"}`,
      `ID: ${taskList.id || "Unknown"}`,
      `Updated: ${taskList.updated || "Unknown"}`,
    ].join(" | ");
  }

  private static formatTaskLists(
    taskLists: tasks_v1.Schema$TaskList[],
  ): string {
    return taskLists
      .map((tl, index) => `${index + 1}. ${this.formatTaskList(tl)}`)
      .join("\n");
  }

  static async list(
    request: CallToolRequest,
    tasks: tasks_v1.Tasks,
  ): Promise<CallToolResult> {
    const cursor = request.params.arguments?.cursor as string | undefined;

    const params: { maxResults: number; pageToken?: string } = {
      maxResults: MAX_TASK_RESULTS,
    };

    if (cursor) {
      params.pageToken = cursor;
    }

    const response = await tasks.tasklists.list(params);
    const taskLists = response.data.items || [];
    const nextPageToken = response.data.nextPageToken;

    let resultText = `Found ${taskLists.length} task list(s):\n${this.formatTaskLists(taskLists)}`;

    if (nextPageToken) {
      resultText += `\n\nMore results available. Use cursor: "${nextPageToken}"`;
    }

    return {
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
      isError: false,
    };
  }

  static async get(
    request: CallToolRequest,
    tasks: tasks_v1.Tasks,
  ): Promise<CallToolResult> {
    const taskListId = request.params.arguments?.taskListId as string;

    if (!taskListId) {
      throw new Error("Task list ID is required");
    }

    const response = await tasks.tasklists.get({
      tasklist: taskListId,
    });

    const taskList = response.data;

    const details = [
      `Title: ${taskList.title || "Untitled"}`,
      `ID: ${taskList.id || "Unknown"}`,
      `Kind: ${taskList.kind || "Unknown"}`,
      `ETag: ${taskList.etag || "Unknown"}`,
      `Updated: ${taskList.updated || "Unknown"}`,
      `Self Link: ${taskList.selfLink || "N/A"}`,
    ].join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Task List Details:\n${details}`,
        },
      ],
      isError: false,
    };
  }

  static async create(
    request: CallToolRequest,
    tasks: tasks_v1.Tasks,
  ): Promise<CallToolResult> {
    const title = request.params.arguments?.title as string;

    if (!title) {
      throw new Error("Task list title is required");
    }

    if (title.length > 1024) {
      throw new Error("Task list title must not exceed 1024 characters");
    }

    const response = await tasks.tasklists.insert({
      requestBody: {
        title: title,
      },
    });

    const taskList = response.data;

    return {
      content: [
        {
          type: "text",
          text: `Task list created successfully:\nTitle: ${taskList.title}\nID: ${taskList.id}`,
        },
      ],
      isError: false,
    };
  }

  static async update(
    request: CallToolRequest,
    tasks: tasks_v1.Tasks,
  ): Promise<CallToolResult> {
    const taskListId = request.params.arguments?.taskListId as string;
    const title = request.params.arguments?.title as string;

    if (!taskListId) {
      throw new Error("Task list ID is required");
    }

    if (!title) {
      throw new Error("Task list title is required");
    }

    if (title.length > 1024) {
      throw new Error("Task list title must not exceed 1024 characters");
    }

    const response = await tasks.tasklists.update({
      tasklist: taskListId,
      requestBody: {
        title: title,
      },
    });

    const taskList = response.data;

    return {
      content: [
        {
          type: "text",
          text: `Task list updated successfully:\nTitle: ${taskList.title}\nID: ${taskList.id}`,
        },
      ],
      isError: false,
    };
  }

  static async delete(
    request: CallToolRequest,
    tasks: tasks_v1.Tasks,
  ): Promise<CallToolResult> {
    const taskListId = request.params.arguments?.taskListId as string;

    if (!taskListId) {
      throw new Error("Task list ID is required");
    }

    if (taskListId === "@default") {
      throw new Error("Cannot delete the default task list");
    }

    await tasks.tasklists.delete({
      tasklist: taskListId,
    });

    return {
      content: [
        {
          type: "text",
          text: `Task list "${taskListId}" deleted successfully`,
        },
      ],
      isError: false,
    };
  }
}
