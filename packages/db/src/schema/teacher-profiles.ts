import {
  boolean,
  date,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { users } from "./users";
import { subjectOfferings } from "./subject-offerings";
import { attendanceSessions } from "./attendance-sessions";

export const teacherProfiles = pgTable(
  "teacher_profiles",
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

    employeeId: varchar(
      "employee_id",
      {
        length: 50,
      }
    )
      .notNull()
      .unique(),

    designation: varchar(
      "designation",
      {
        length: 255,
      }
    ),

    phone: varchar("phone", {
      length: 20,
    }),

    joinedAt: date("joined_at"),
    isCoordinator: boolean("is_coordinator").default(false),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  }
);

export const teacherProfilesRelations = relations(teacherProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [teacherProfiles.userId],
    references: [users.id],
  }),
  subjectOfferings: many(subjectOfferings),
  createdAttendanceSessions: many(attendanceSessions),
}));