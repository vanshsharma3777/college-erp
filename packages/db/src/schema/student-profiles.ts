import {
  date,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { users } from "./users";
import { programs } from "./programs";
import { semesters } from "./semesters";
import { subjectEnrollments } from "./subject-enrollments";
import { attendanceRecords } from "./attendance-records";
import { teacherProfiles } from "./teacher-profiles";

export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    userId: uuid("user_id")
      .references(() => users.id, {
        onDelete: "cascade",
      })
      .notNull()
      .unique(),

    coordinatorId: uuid("coordinator_id")
      .references(() => teacherProfiles.id, {
        onDelete: "cascade",
      }),

    programId: uuid("program_id")
      .references(() => programs.id)
      .notNull(),

    semesterId: uuid("semester_id")
      .references(() => semesters.id)
      .notNull(),

    sectionRollNo: varchar("section_roll_no", {
      length: 50,
    })
      .notNull()
      .unique(),

    universityRollNo: varchar("university_roll_no", {
      length: 50,
    })
      .notNull()
      .unique(),

    registrationNo: varchar(
      "registration_no",
      {
        length: 50,
      }
    )
      .notNull()
      .unique(),

    phone: varchar("phone", {
      length: 20,
    }),

    joinedAt: date("joined_at"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  }
);

export const studentProfilesRelations = relations(studentProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [studentProfiles.userId],
    references: [users.id],
  }),
  program: one(programs, {
    fields: [studentProfiles.programId],
    references: [programs.id],
  }),
  semester: one(semesters, {
    fields: [studentProfiles.semesterId],
    references: [semesters.id],
  }),
  enrollments: many(subjectEnrollments),
  attendanceRecords: many(attendanceRecords),
}));