// Shared message protocol between WebSocket clients and the server.
// Role now comes from the verified `accessToken` cookie (see auth.ts),
// never from anything the client claims in a message.

export type Role = "TEACHER" | "STUDENT";

// Client -> Server
export type ClientMessage =
  | { type: "create_attendance"; payload: Record<string, unknown> }
  | { type: "close_attendance"; payload: Record<string, unknown> }
  | { type: "mark_attendance"; payload: Record<string, unknown> }
  | { type: "remove_student"; payload: Record<string, unknown> }
  | { type: "accept_attendance"; payload: Record<string, unknown> }
  | { type: "get_students_detail"; payload: {teacherId: string}};

const CLIENT_MESSAGE_TYPES = [
  "mark_attendance",
  "remove_student",
  "create_attendance",
  "close_attendance",
  "get_students_detail",
  "accept_attendance",
] as const;

// What both roles see once a session exists.
export interface AttendanceView {
  id: string;
  subjectOfferingId: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  sessionType: "LECTURE" | "LAB";
  sessionDate: string;
  classroom: string | null;
  startTime: string | null;
  endTime: string | null;
  status: "OPEN" | "ACCEPTED" | "CANCELLED";
  createdAt: string;
}

// One row in the teacher's live pending list.
export interface PendingStudent {
  studentId: string;
  name: string;
  sectionRollNo: string;
  markedAt: string;
}

// Server -> Client
export type ServerMessage =
  | { type: "connected"; payload: { role: Role } }
  | { type: "attendance_available"; payload: { attendance: AttendanceView ,} } // pushed to enrolled students
  | { type: "attendance_closed"; payload: { attendance: AttendanceView } } // ack to the close teacher
  | { type: "attendance_created"; payload: { attendance: AttendanceView } } // ack to the creating teacher
  | { type: "attendance_marked"; payload: { sessionId: string } } // ack to the student who clicked
  | {
      type: "pending_update";
      payload: { sessionId: string; students: PendingStudent[]; totalMarked: number };
    } // pushed to the owning teacher after every mark/remove
  | { type: "attendance_accepted"; payload: { sessionId: string , subjectOfferingId:string  } } // pushed to teacher + enrolled students
  | { type: "error"; payload: { code?: string; message: string; errors?: string[] } }
  | { type: "get_students_detail"; payload: { teacherId : string} };
  

/**
 * Validate that a raw parsed JSON object is a recognizable client message.
 * Returns a discriminated error object when it is not.
 */
export function parseClientMessage(
  data: unknown,
): ClientMessage | { error: string } {
  if (typeof data !== "object" || data === null) {
    return { error: "Message must be a JSON object" };
  }

  const msg = data as Record<string, unknown>;

  if (typeof msg.type !== "string") {
    return { error: "Missing or invalid 'type' field" };
  }

  if (!CLIENT_MESSAGE_TYPES.includes(msg.type as (typeof CLIENT_MESSAGE_TYPES)[number])) {
    return { error: `Unknown message type: '${msg.type}'` };
  }

  if (typeof msg.payload !== "object" || msg.payload === null) {
    return { error: "Missing or invalid 'payload' object" };
  }

  return msg as ClientMessage;
}
