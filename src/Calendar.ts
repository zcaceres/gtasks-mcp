import {
  CallToolRequest,
  ListResourcesRequest,
  ReadResourceRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { GaxiosResponse } from "gaxios";
import { calendar_v3 } from "googleapis";

const MAX_RESULTS = 100;

export class CalendarResources {
  static async read(request: ReadResourceRequest, calendar: calendar_v3.Calendar) {
    // Basic implementation for reading a specific event via URI
    // URI format: gcalendar:///events/{calendarId}/{eventId}
    const uri = request.params.uri;
    const parts = uri.replace("gcalendar:///events/", "").split("/");
    
    if (parts.length !== 2) {
         throw new Error("Invalid Resource URI. Expected format: gcalendar:///events/{calendarId}/{eventId}");
    }
    
    const [calendarId, eventId] = parts;

    try {
        const response = await calendar.events.get({
            calendarId: decodeURIComponent(calendarId),
            eventId: eventId
        });
        
        return response.data;
    } catch (error) {
        throw new Error(`Failed to read event: ${error}`);
    }
  }

  static async list(
    request: ListResourcesRequest,
    calendar: calendar_v3.Calendar,
  ): Promise<[calendar_v3.Schema$CalendarListEntry[], string | null]> {
    
    const params: any = {
      maxResults: MAX_RESULTS,
    };

    if (request.params?.cursor) {
      params.pageToken = request.params.cursor;
    }

    const response = await calendar.calendarList.list(params);
    const items = response.data.items || [];
    const nextPageToken = response.data.nextPageToken || null;

    return [items, nextPageToken];
  }
}

export class CalendarActions {
  private static formatEvent(event: calendar_v3.Schema$Event) {
    const start = event.start?.dateTime || event.start?.date || "Unknown";
    const end = event.end?.dateTime || event.end?.date || "Unknown";
    return `Event: ${event.summary}\nTime: ${start} - ${end}\nDescription: ${event.description || "None"}\nLocation: ${event.location || "None"}\nID: ${event.id}\nLink: ${event.htmlLink}\nStatus: ${event.status}`;
  }

  private static formatEventList(events: calendar_v3.Schema$Event[]) {
    return events.map((event) => this.formatEvent(event)).join("\n\n");
  }

  static async list_events(request: CallToolRequest, calendar: calendar_v3.Calendar) {
    const calendarId = (request.params.arguments?.calendarId as string) || "primary";
    const maxResults = Number(request.params.arguments?.maxResults) || 10;
    
    // Optional time filtering
    const timeMin = request.params.arguments?.timeMin as string;
    const timeMax = request.params.arguments?.timeMax as string;
    const query = request.params.arguments?.query as string;

    const params: any = {
        calendarId,
        maxResults,
        singleEvents: true,
        orderBy: "startTime",
    };

    if (timeMin) params.timeMin = timeMin;
    if (timeMax) params.timeMax = timeMax;
    if (query) params.q = query;

    try {
        const response = await calendar.events.list(params);
        const events = response.data.items || [];
        
        return {
            content: [
                {
                    type: "text",
                    text: `Found ${events.length} events in '${calendarId}':\n\n${this.formatEventList(events)}`
                }
            ],
            isError: false
        }

    } catch (error) {
         return {
            content: [
                {
                    type: "text",
                    text: `Error listing events: ${error}`
                }
            ],
            isError: true
        }
    }
  }

  static async create_event(request: CallToolRequest, calendar: calendar_v3.Calendar) {
    const calendarId = (request.params.arguments?.calendarId as string) || "primary";
    const summary = request.params.arguments?.summary as string;
    const description = request.params.arguments?.description as string;
    const location = request.params.arguments?.location as string;
    const startTime = request.params.arguments?.startTime as string;
    const endTime = request.params.arguments?.endTime as string;

    if (!summary) throw new Error("Event summary (title) is required");
    if (!startTime || !endTime) throw new Error("Start and End times are required");

    const createMeet = request.params.arguments?.createMeet as boolean;

    const event: calendar_v3.Schema$Event = {
        summary,
        description,
        location,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        ...(createMeet && {
            conferenceData: {
                createRequest: {
                    requestId: Math.random().toString(36).substring(7),
                    conferenceSolutionKey: { type: "hangoutsMeet" }
                }
            }
        })
    };

    try {
        const response = await calendar.events.insert({
            calendarId,
            requestBody: event,
            conferenceDataVersion: createMeet ? 1 : 0
        });

        return {
            content: [
                {
                    type: "text",
                    text: `Event created: ${response.data.htmlLink}` + (response.data.conferenceData?.entryPoints?.[0]?.uri ? `\nGoogle Meet: ${response.data.conferenceData.entryPoints[0].uri}` : "")
                }
            ],
            isError: false
        };
    } catch(error) {
        return {
            content: [{ type: "text", text: `Error creating event: ${error}`}],
            isError: true
        };
    }
  }

  static async update_event(request: CallToolRequest, calendar: calendar_v3.Calendar) {
    const calendarId = (request.params.arguments?.calendarId as string) || "primary";
    const eventId = request.params.arguments?.eventId as string;
    
    if (!eventId) throw new Error("Event ID is required for update");

    // Creating requestBody with only provided fields
    const requestBody: any = {};
    if (request.params.arguments?.summary) requestBody.summary = request.params.arguments?.summary;
    if (request.params.arguments?.description) requestBody.description = request.params.arguments?.description;
    if (request.params.arguments?.location) requestBody.location = request.params.arguments?.location;
    if (request.params.arguments?.startTime) requestBody.start = { dateTime: request.params.arguments?.startTime };
    if (request.params.arguments?.endTime) requestBody.end = { dateTime: request.params.arguments?.endTime };

    try {
        const response = await calendar.events.patch({
            calendarId,
            eventId,
            requestBody
        });

         return {
            content: [
                {
                    type: "text",
                    text: `Event updated: ${response.data.summary} (${response.data.htmlLink})`
                }
            ],
            isError: false
        };

    } catch (error) {
         return {
            content: [{ type: "text", text: `Error updating event: ${error}`}],
            isError: true
        };
    }
  }

  static async delete_event(request: CallToolRequest, calendar: calendar_v3.Calendar) {
    const calendarId = (request.params.arguments?.calendarId as string) || "primary";
    const eventId = request.params.arguments?.eventId as string;

    if (!eventId) throw new Error("Event ID is required for deletion");

    try {
        await calendar.events.delete({
            calendarId,
            eventId
        });

        return {
            content: [
                {
                    type: "text",
                    text: `Event with ID ${eventId} deleted successfully.`
                }
            ],
            isError: false
        };

    } catch (error) {
         return {
            content: [{ type: "text", text: `Error deleting event: ${error}`}],
            isError: true
        };
    }
  }
}
