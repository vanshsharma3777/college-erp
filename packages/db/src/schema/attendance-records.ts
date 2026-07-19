  import { pgEnum, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
  import { relations } from "drizzle-orm";

  import { attendanceSessions } from "./attendance-sessions";
  import { studentProfiles } from "./student-profiles";

  export const attendanceRecordStatusEnum = pgEnum("attendance_record_status", [
    "PRESENT",
    "ABSENT",
  ]);

  // One row per enrolled student per accepted session — written in a single
  // batch when the teacher hits "Accept" (the full offering roster, not just
  // the students who clicked). Absence is an explicit row, not a missing one,
  // so attendance-percentage queries never need to reconstruct who was
  // enrolled at the time from elsewhere.
  export const attendanceRecords = pgTable(
    "attendance_records",
    {
      sessionId: uuid("session_id")
        .references(() => attendanceSessions.id, { onDelete: "cascade" })
        .notNull(),

      studentId: uuid("student_id")
        .references(() => studentProfiles.id, { onDelete: "cascade" })
        .notNull(),

      status: attendanceRecordStatusEnum("status").notNull(),

      // When the student's mark-attendance click reached the server.
      // Null for students who never clicked (they end up ABSENT at accept
      // time with no click to timestamp).
      markedAt: timestamp("marked_at"),

      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      pk: primaryKey({ columns: [table.sessionId, table.studentId] }),
    }),
  );

  export const attendanceRecordsRelations = relations(
    attendanceRecords,
    ({ one }) => ({
      session: one(attendanceSessions, {
        fields: [attendanceRecords.sessionId],
        references: [attendanceSessions.id],
      }),
      student: one(studentProfiles, {
        fields: [attendanceRecords.studentId],
        references: [studentProfiles.id],
      }),
    }),
  );
