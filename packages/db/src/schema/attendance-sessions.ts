import {
  date,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { subjectOfferings } from "./subject-offerings";
import { timetableEntries } from "./timetable-entries";
import { teacherProfiles } from "./teacher-profiles";
import { attendanceRecords } from "./attendance-records";

// A subject offering can run both lecture and lab slots, so a session
// needs to say which one it's taking attendance for.
export const sessionTypeEnum = pgEnum("session_type", ["LECTURE", "LAB"]);

// OPEN: created, live, students can mark themselves.
// ACCEPTED: teacher reviewed the pending list and committed it — final.
// CANCELLED: teacher discarded it without ever accepting; no records exist.
export const attendanceSessionStatusEnum = pgEnum("attendance_session_status", [
  "OPEN",
  "ACCEPTED",
  "CANCELLED",
]);

export const attendanceSessions = pgTable("attendance_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),

  subjectOfferingId: uuid("subject_offering_id")
    .references(() => subjectOfferings.id, { onDelete: "cascade" })
    .notNull(),

  // Optional: which recurring weekly slot this session was taken for.
  // Nullable so a teacher can still open an ad-hoc session with no
  // matching timetable entry.
  timetableEntryId: uuid("timetable_entry_id").references(
    () => timetableEntries.id,
  ),

  // The teacher who actually opened the session (usually the offering's
  // own teacher, but recorded explicitly for ownership checks / audit).
  createdBy: uuid("created_by")
    .references(() => teacherProfiles.id)
    .notNull(),

  sessionType: sessionTypeEnum("session_type").notNull(),

  sessionDate: date("session_date").notNull(),

  status: attendanceSessionStatusEnum("status").default("OPEN").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  // Set only when the teacher hits "Accept" and the session's records
  // are committed.
  acceptedAt: timestamp("accepted_at"),
});

export const attendanceSessionsRelations = relations(
  attendanceSessions,
  ({ one, many }) => ({
    subjectOffering: one(subjectOfferings, {
      fields: [attendanceSessions.subjectOfferingId],
      references: [subjectOfferings.id],
    }),
    timetableEntry: one(timetableEntries, {
      fields: [attendanceSessions.timetableEntryId],
      references: [timetableEntries.id],
    }),
    createdByTeacher: one(teacherProfiles, {
      fields: [attendanceSessions.createdBy],
      references: [teacherProfiles.id],
    }),
    records: many(attendanceRecords),
  }),
);
