import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { departments } from "./departments";
import { studentProfiles } from "./student-profiles";

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    studentCount: integer("student_count").notNull().default(0),
    coordinatorId: uuid("coordinator_id")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    branchId: uuid("branch_id")
      .references(() => departments.id, { onDelete: "set null" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export const sectionRepresentatives = pgTable(
  "section_representatives",
  {
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sectionId, table.studentId] }),
  })
);

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  coordinator: one(users, {
    fields: [sections.coordinatorId],
    references: [users.id],
  }),
  branch: one(departments, {
    fields: [sections.branchId],
    references: [departments.id],
  }),
  representatives: many(sectionRepresentatives),
}));

export const sectionRepresentativesRelations = relations(sectionRepresentatives, ({ one }) => ({
  section: one(sections, {
    fields: [sectionRepresentatives.sectionId],
    references: [sections.id],
  }),
  student: one(studentProfiles, {
    fields: [sectionRepresentatives.studentId],
    references: [studentProfiles.id],
  }),
}));