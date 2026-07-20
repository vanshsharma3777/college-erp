import type { WebSocket } from "ws";

import type { AttendanceView, ServerMessage } from "./protocol";
import type { SocketAuth } from "./auth";
import { send, sendToStudents, sendToTeacher } from "./connections";
import {
  createSession,
  getSessionWithContext,
  toView,
  getEnrolledStudentIds,
  getOffering,
  isStudentEnrolled,
  markPending,
  removePending,
  getPendingView,
  acceptSession,
  cancelSession,
  getTeacherId,
} from "./store";

type TeacherAuth = Extract<SocketAuth, { role: "TEACHER" }>;
type StudentAuth = Extract<SocketAuth, { role: "STUDENT" }>;

const SESSION_TYPES = ["LECTURE", "LAB"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function error(code: string, message: string, errors?: string[]): ServerMessage {
  return errors
    ? { type: "error", payload: { code, message, errors } }
    : { type: "error", payload: { code, message } };
}

async function pushPendingUpdate(sessionId: string, teacherId: string): Promise<void> {
  const students = await getPendingView(sessionId);
  sendToTeacher(teacherId, {
    type: "pending_update",
    payload: { sessionId, students, totalMarked: students.length },
  });
}

/**
 * Teacher opens a new attendance session for one of their own subject
 * offerings. Persisted immediately (status OPEN) so it survives a
 * restart — only the live "who's clicked so far" list stays in memory
 * until accept.
 */
export async function handleCreateAttendance(
  ws: WebSocket,
  payload: Record<string, unknown>,
  auth: TeacherAuth,
): Promise<void> {
  const { subjectOfferingId, sessionType, sessionDate, timetableEntryId } = payload;

  const errors: string[] = [];
  if (typeof subjectOfferingId !== "string" || subjectOfferingId.trim() === "") {
    errors.push("subjectOfferingId is required (string)");
  }
  if (typeof sessionType !== "string" || !SESSION_TYPES.includes(sessionType as never)) {
    errors.push(`sessionType must be one of: ${SESSION_TYPES.join(", ")}`);
  }
  if (
    typeof sessionDate !== "string" ||
    !DATE_RE.test(sessionDate) ||
    Number.isNaN(new Date(sessionDate).getTime())
  ) {
    errors.push("sessionDate must be a valid date string (YYYY-MM-DD)");
  }
  if (timetableEntryId !== undefined && typeof timetableEntryId !== "string") {
    errors.push("timetableEntryId must be a string when provided");
  }
  if (errors.length > 0) {
    send(ws, error("VALIDATION_FAILED", "Validation failed", errors));
    return;
  }

  const offering = await getOffering(subjectOfferingId as string);
  if (!offering) {
    send(ws, error("OFFERING_NOT_FOUND", "No subject offering found for that id"));
    return;
  }
  if (offering.teacherId !== auth.teacherProfileId) {
    send(ws, error("FORBIDDEN", "You do not teach this subject offering"));
    return;
  }

  const created = await createSession({
    subjectOfferingId: subjectOfferingId as string,
    timetableEntryId: (timetableEntryId as string | undefined) ?? null,
    sessionType: sessionType as "LECTURE" | "LAB",
    sessionDate: sessionDate as string,
    createdBy: auth.teacherProfileId,
  });

  const session = await getSessionWithContext(created.id);
  if (!session) {
    send(ws, error("INTERNAL_ERROR", "Session was created but could not be loaded"));
    return;
  }
  const view = toView(session);

  send(ws, { type: "attendance_created", payload: { attendance: view } });

  const enrolled = await getEnrolledStudentIds(subjectOfferingId as string);
  sendToStudents(enrolled, { type: "attendance_available", payload: { attendance: view } });
}

/**
 * Student clicks "Mark Attendance". No code, no confirmation step from
 * their side — this just adds them to the teacher's live pending list.
 * Nothing is written to the database until the teacher accepts.
 */
export async function handleMarkAttendance(
  ws: WebSocket,
  payload: Record<string, unknown>,
  auth: StudentAuth,
): Promise<void> {
  const { sessionId } = payload;
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    send(ws, error("SESSION_ID_REQUIRED", "sessionId is required (string)"));
    return;
  }

  const session = await getSessionWithContext(sessionId);
  if (!session) {
    send(ws, error("SESSION_NOT_FOUND", "No attendance session found for this id"));
    return;
  }
  if (session.status !== "OPEN") {
    send(ws, error("SESSION_CLOSED", "This attendance session is no longer open"));
    return;
  }

  const enrolled = await isStudentEnrolled(session.subjectOfferingId, auth.studentProfileId);
  if (!enrolled) {
    send(ws, error("NOT_ENROLLED", "You are not enrolled in this subject"));
    return;
  }

  const markedAt = markPending(sessionId, auth.studentProfileId);
  if (!markedAt) {
    send(ws, error("ALREADY_MARKED", "You have already marked your attendance for this session"));
    return;
  }

  send(ws, { type: "attendance_marked", payload: { sessionId } });
  await pushPendingUpdate(sessionId, session.createdBy);
}

/**
 * Teacher removes a student from the live pending list before accepting.
 * This never touches the database — it only matters for what gets
 * committed when accept runs. A removed student simply isn't PRESENT.
 */
export async function handleRemoveStudent(
  ws: WebSocket,
  payload: Record<string, unknown>,
  auth: TeacherAuth,
): Promise<void> {
  const { sessionId, studentId } = payload;
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    send(ws, error("SESSION_ID_REQUIRED", "sessionId is required (string)"));
    return;
  }
  if (typeof studentId !== "string" || studentId.trim() === "") {
    send(ws, error("STUDENT_ID_REQUIRED", "studentId is required (string)"));
    return;
  }

  const session = await getSessionWithContext(sessionId);
  if (!session) {
    send(ws, error("SESSION_NOT_FOUND", "No attendance session found for this id"));
    return;
  }
  if (session.createdBy !== auth.teacherProfileId) {
    send(ws, error("FORBIDDEN", "You did not create this session"));
    return;
  }
  if (session.status !== "OPEN") {
    send(ws, error("SESSION_CLOSED", "This attendance session is no longer open"));
    return;
  }

  removePending(sessionId, studentId);
  await pushPendingUpdate(sessionId, auth.teacherProfileId);
}

/**
 * Teacher commits the session: every enrolled student is written to the
 * database as PRESENT (if still in the pending list) or ABSENT, and the
 * session flips to ACCEPTED. This is the only point at which anything
 * attendance-related is actually persisted as a final record.
 */
export async function handleAcceptAttendance(
  ws: WebSocket,
  payload: Record<string, unknown>,
  auth: TeacherAuth,
): Promise<void> {
  const { sessionId } = payload;
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    send(ws, error("SESSION_ID_REQUIRED", "sessionId is required (string)"));
    return;
  }

  const session = await getSessionWithContext(sessionId);
  if (!session) {
    send(ws, error("SESSION_NOT_FOUND", "No attendance session found for this id"));
    return;
  }
  if (session.createdBy !== auth.teacherProfileId) {
    send(ws, error("FORBIDDEN", "You did not create this session"));
    return;
  }
  if (session.status !== "OPEN") {
    send(ws, error("SESSION_CLOSED", "This attendance session is no longer open"));
    return;
  }

  await acceptSession(sessionId, session.subjectOfferingId);

  const enrolled = await getEnrolledStudentIds(session.subjectOfferingId);
  const message: ServerMessage = { type: "attendance_accepted",payload: {
    sessionId,
    subjectOfferingId:session.subjectOfferingId
  } };
  send(ws, message);
  sendToStudents(enrolled, message);
}

export async function handleStudentsDetailForCoordinator(
  ws:WebSocket,
  payload :{teacherId: string;},
  auth:TeacherAuth,
): Promise<void>{
   const {   teacherId } = payload;
  
  if(!teacherId){
     send(ws, error("TEACHERID_MISSING", "Teacher Id not found"));
     return
  }
  const coordinatorId = await getTeacherId(teacherId);
  console.log("coordinatorId " , coordinatorId)
  if(!coordinatorId){
     send(ws, error("TEACHERID_MISSING", "Teacher Id not found"));
     return
  }
  const message : ServerMessage = { type: "get_students_detail", payload: { teacherId: (coordinatorId.id) } };
  send(ws, message);
}

export async function handleCloseAttendance(
  ws: WebSocket,
  payload: Record<string, unknown>,
  auth: TeacherAuth,
): Promise<void> {
  const { sessionId } = payload;
  if (typeof sessionId !== "string" || sessionId.trim() === "") {
    send(ws, error("SESSION_ID_REQUIRED", "sessionId is required (string)"));
    return;
  }

  const session = await getSessionWithContext(sessionId);
  if (!session) {
    send(ws, error("SESSION_NOT_FOUND", "No attendance session found for this id"));
    return;
  }
  if (session.createdBy !== auth.teacherProfileId) {
    send(ws, error("FORBIDDEN", "You did not create this session"));
    return;
  }
  if (session.status !== "OPEN") {
    send(ws, error("SESSION_CLOSED", "This attendance session is no longer open"));
    return;
  }

  // Prevent access for late students by setting session status to CANCELLED
  // This stops new attendance checks for this session
  await cancelSession(sessionId, session.subjectOfferingId);

  const enrolled = await getEnrolledStudentIds(session.subjectOfferingId);
  // The view still reads "OPEN" (fetched before we cancelled) — reflect the
  // real outcome so the client can show it faithfully.
  const closedView: AttendanceView = { ...toView(session), status: "CANCELLED" };
  const message: ServerMessage = { type: "attendance_closed", payload: { attendance: closedView } };
  send(ws, message);
  sendToStudents(enrolled, message);
}

