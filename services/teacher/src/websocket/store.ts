import { and, eq, inArray } from "drizzle-orm";
import { db } from "@repo/db";
import {
  attendanceSessions,
  attendanceRecords,
  subjectEnrollments,
  subjectOfferings,
  studentProfiles,
} from "@repo/db/schema";

import type { AttendanceView, PendingStudent } from "./protocol";

// In-memory: sessionId -> studentId -> markedAt.
// Only holds *pending* clicks between session creation and accept — once
// accepted the roster is committed to attendance_records in one batch and
// this entry is cleared. A server restart loses only unaccepted pending
// clicks, never anything already accepted (that's in the DB).
const pending = new Map<string, Map<string, Date>>();

export interface CreateSessionInput {
  subjectOfferingId: string;
  timetableEntryId: string | null;
  sessionType: "LECTURE" | "LAB";
  sessionDate: string;
  createdBy: string; // teacherProfileId
}

export async function createSession(input: CreateSessionInput) {
  const [row] = await db
    .insert(attendanceSessions)
    .values({
      subjectOfferingId: input.subjectOfferingId,
      timetableEntryId: input.timetableEntryId,
      sessionType: input.sessionType,
      sessionDate: input.sessionDate,
      createdBy: input.createdBy,
    })
    .returning();

  if (!row) throw new Error("Failed to create attendance session");

  pending.set(row.id, new Map());
  return row;
}

// Fetch a session with everything needed to build an AttendanceView and to
// authorize actions on it.
export async function getSessionWithContext(sessionId: string) {
  return db.query.attendanceSessions.findFirst({
    where: eq(attendanceSessions.id, sessionId),
    with: {
      subjectOffering: {
        with: {
          subject: true,
          teacher: { with: { user: true } },
        },
      },
      timetableEntry: {
        with: { classroom: true },
      },
    },
  });
}

type SessionWithContext = NonNullable<Awaited<ReturnType<typeof getSessionWithContext>>>;

export function toView(session: SessionWithContext): AttendanceView {
  const offering = session.subjectOffering;
  const teacherUser = offering.teacher.user;
  return {
    id: session.id,
    subjectOfferingId: offering.id,
    subjectCode: offering.subject.code,
    subjectName: offering.subject.name,
    teacherName: `${teacherUser.firstName} ${teacherUser.lastName}`,
    sessionType: session.sessionType,
    sessionDate: session.sessionDate,
    classroom: session.timetableEntry
      ? `${session.timetableEntry.classroom.building} ${session.timetableEntry.classroom.roomNo}`
      : null,
    startTime: session.timetableEntry?.startTime ?? null,
    endTime: session.timetableEntry?.endTime ?? null,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
  };
}

export async function getEnrolledStudentIds(subjectOfferingId: string): Promise<Set<string>> {
  const rows = await db.query.subjectEnrollments.findMany({
    where: eq(subjectEnrollments.subjectOfferingId, subjectOfferingId),
  });
  return new Set(rows.map((r) => r.studentId));
}

export async function getOffering(subjectOfferingId: string) {
  return db.query.subjectOfferings.findFirst({
    where: eq(subjectOfferings.id, subjectOfferingId),
  });
}

export async function isStudentEnrolled(
  subjectOfferingId: string,
  studentId: string,
): Promise<boolean> {
  const row = await db.query.subjectEnrollments.findFirst({
    where: and(
      eq(subjectEnrollments.subjectOfferingId, subjectOfferingId),
      eq(subjectEnrollments.studentId, studentId),
    ),
  });
  return !!row;
}

/**
 * Every currently OPEN session across every subject offering a student is
 * enrolled in — used for late-join, so a student connecting after a
 * session was created still sees it.
 */
export async function getOpenSessionsForStudent(
  studentProfileId: string,
): Promise<SessionWithContext[]> {
  const enrollments = await db.query.subjectEnrollments.findMany({
    where: eq(subjectEnrollments.studentId, studentProfileId),
  });
  const offeringIds = enrollments.map((e) => e.subjectOfferingId);
  if (offeringIds.length === 0) return [];

  return db.query.attendanceSessions.findMany({
    where: and(
      inArray(attendanceSessions.subjectOfferingId, offeringIds),
      eq(attendanceSessions.status, "OPEN"),
    ),
    with: {
      subjectOffering: {
        with: {
          subject: true,
          teacher: { with: { user: true } },
        },
      },
      timetableEntry: {
        with: { classroom: true },
      },
    },
  });
}

export function markPending(sessionId: string, studentId: string): Date | null {
  let sessionPending = pending.get(sessionId);
  if (!sessionPending) {
    sessionPending = new Map();
    pending.set(sessionId, sessionPending);
  }
  if (sessionPending.has(studentId)) return null; // already marked, caller treats as a no-op error
  const markedAt = new Date();
  sessionPending.set(studentId, markedAt);
  return markedAt;
}

export function removePending(sessionId: string, studentId: string): boolean {
  return pending.get(sessionId)?.delete(studentId) ?? false;
}

export function getPendingIds(sessionId: string): Set<string> {
  return new Set(pending.get(sessionId)?.keys() ?? []);
}

export async function getPendingView(sessionId: string): Promise<PendingStudent[]> {
  const sessionPending = pending.get(sessionId);
  if (!sessionPending || sessionPending.size === 0) return [];

  const studentIds = [...sessionPending.keys()];
  const rows = await db.query.studentProfiles.findMany({
    where: inArray(studentProfiles.id, studentIds),
    with: { user: true },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  const result: PendingStudent[] = [];
  for (const id of studentIds) {
    const profile = byId.get(id);
    const markedAt = sessionPending.get(id);
    if (!profile || !markedAt) continue;
    result.push({
      studentId: id,
      name: `${profile.user.firstName} ${profile.user.lastName}`,
      sectionRollNo: profile.sectionRollNo,
      markedAt: markedAt.toISOString(),
    });
  }
  return result;
}

/**
 * Commits the session: every enrolled student becomes PRESENT if they're
 * in the current pending set, ABSENT otherwise. Written in one batch so
 * every accepted session always has a complete roster — removing a student
 * from the pending list before accept just means they land as ABSENT,
 * nothing is ever deleted. Flips the session to ACCEPTED and clears the
 * in-memory pending entry.
 */
export async function acceptSession(sessionId: string, subjectOfferingId: string) {
  const enrolled = await getEnrolledStudentIds(subjectOfferingId);
  const sessionPending = pending.get(sessionId) ?? new Map<string, Date>();

  const records = [...enrolled].map((studentId) => {
    const markedAt = sessionPending.get(studentId);
    return {
      sessionId,
      studentId,
      status: markedAt ? ("PRESENT" as const) : ("ABSENT" as const),
      markedAt: markedAt ?? null,
    };
  });

  await db.transaction(async (tx) => {
    if (records.length > 0) {
      await tx.insert(attendanceRecords).values(records);
    }
    await tx
      .update(attendanceSessions)
      .set({ status: "ACCEPTED", acceptedAt: new Date() })
      .where(eq(attendanceSessions.id, sessionId));
  });

  pending.delete(sessionId);
  return records;
}

export function discardPending(sessionId: string): void {
  pending.delete(sessionId);
}

/**
 * Cancels a session: sets status to CANCELLED and clears pending marks.
 * Late students cannot mark attendance after this.
 */
export async function cancelSession(sessionId: string, subjectOfferingId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Update session status to CANCELLED
    await tx
      .update(attendanceSessions)
      .set({ status: "CANCELLED", cancelledAt: new Date() })
      .where(eq(attendanceSessions.id, sessionId));
  });

  // Clear all pending marks for this session
  removeAllPending(sessionId);
}

/**
 * Removes all pending marks for a given session.
 */
export function removeAllPending(sessionId: string): void {
  pending.delete(sessionId);
}
