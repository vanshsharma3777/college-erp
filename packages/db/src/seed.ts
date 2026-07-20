import "dotenv/config";
import bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";

import { db } from "./index";
import {
  organizations,
  departments,
  academicYears,
  semesters,
  programs,
  classrooms,
  subjects,
  users,
  teacherProfiles,
  studentProfiles,
  subjectOfferings,
  subjectEnrollments,
  timetableEntries,
} from "./schema";

const SEED_PASSWORD = "Passw0rd!";

async function findOrInsert<Row>(
  find: () => Promise<Row | undefined>,
  insert: () => Promise<Row>,
  label: string,
): Promise<Row> {
  const existing = await find();
  if (existing) {
    console.log(`= ${label} already exists, reusing`);
    return existing;
  }
  const created = await insert();
  console.log(`+ created ${label}`);
  return created;
}

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const org = await findOrInsert(
    () => db.query.organizations.findFirst({ where: eq(organizations.shortName, "EXU") }),
    async () => {
      const [row] = await db
        .insert(organizations)
        .values({ name: "Example University", shortName: "EXU" })
        .returning();
      if (!row) throw new Error("failed to insert organization");
      return row;
    },
    "organization EXU",
  );

  const dept = await findOrInsert(
    () => db.query.departments.findFirst({ where: eq(departments.code, "CS") }),
    async () => {
      const [row] = await db
        .insert(departments)
        .values({ organizationId: org.id, name: "Computer Science", code: "CS" })
        .returning();
      if (!row) throw new Error("failed to insert department");
      return row;
    },
    "department CS",
  );

  const academicYear = await findOrInsert(
    () => db.query.academicYears.findFirst({ where: eq(academicYears.name, "2026-2027") }),
    async () => {
      const [row] = await db
        .insert(academicYears)
        .values({
          name: "2026-2027",
          startDate: "2026-07-01",
          endDate: "2027-06-30",
          isCurrent: true,
        })
        .returning();
      if (!row) throw new Error("failed to insert academic year");
      return row;
    },
    "academic year 2026-2027",
  );

  const semester = await findOrInsert(
    () =>
      db.query.semesters.findFirst({
        where: and(eq(semesters.academicYearId, academicYear.id), eq(semesters.semesterNo, 1)),
      }),
    async () => {
      const [row] = await db
        .insert(semesters)
        .values({
          academicYearId: academicYear.id,
          semesterNo: 1,
          startDate: "2026-07-01",
          endDate: "2026-12-15",
          isCurrent: true,
        })
        .returning();
      if (!row) throw new Error("failed to insert semester");
      return row;
    },
    "semester 1",
  );

  const program = await findOrInsert(
    () => db.query.programs.findFirst({ where: eq(programs.code, "BTECH-CS") }),
    async () => {
      const [row] = await db
        .insert(programs)
        .values({
          departmentId: dept.id,
          name: "B.Tech Computer Science",
          code: "BTECH-CS",
          durationYears: 4,
        })
        .returning();
      if (!row) throw new Error("failed to insert program");
      return row;
    },
    "program BTECH-CS",
  );

  const classroom = await findOrInsert(
    () => db.query.classrooms.findFirst({ where: eq(classrooms.roomNo, "101") }),
    async () => {
      const [row] = await db
        .insert(classrooms)
        .values({ roomNo: "101", building: "Main Block", floor: 1, capacity: 60 })
        .returning();
      if (!row) throw new Error("failed to insert classroom");
      return row;
    },
    "classroom 101",
  );

  const subjectDefs = [
    { code: "CS201", name: "Data Structures", credits: 4 },
    { code: "CS301", name: "Operating Systems", credits: 4 },
  ];
  const subjectRows = [];
  for (const def of subjectDefs) {
    const row = await findOrInsert(
      () => db.query.subjects.findFirst({ where: eq(subjects.code, def.code) }),
      async () => {
        const [row] = await db
          .insert(subjects)
          .values({ departmentId: dept.id, code: def.code, name: def.name, credits: def.credits })
          .returning();
        if (!row) throw new Error(`failed to insert subject ${def.code}`);
        return row;
      },
      `subject ${def.code}`,
    );
    subjectRows.push(row);
  }

  const teacherUser = await findOrInsert(
    () => db.query.users.findFirst({ where: eq(users.email, "teacher1@example.edu") }),
    async () => {
      const [row] = await db
        .insert(users)
        .values({
          email: "teacher1@example.edu",
          passwordHash,
          role: "TEACHER",
          firstName: "Asha",
          lastName: "Verma",
          departmentId: dept.id,
          isActive: true,
        })
        .returning();
      if (!row) throw new Error("failed to insert teacher user");
      return row;
    },
    "user teacher1@example.edu",
  );

  const teacherProfile = await findOrInsert(
    () => db.query.teacherProfiles.findFirst({ where: eq(teacherProfiles.employeeId, "EMP001") }),
    async () => {
      const [row] = await db
        .insert(teacherProfiles)
        .values({
          userId: teacherUser.id,
          employeeId: "EMP001",
          designation: "Assistant Professor",
          joinedAt: "2024-07-01",
        })
        .returning();
      if (!row) throw new Error("failed to insert teacher profile");
      return row;
    },
    "teacher profile EMP001",
  );

  const studentDefs = [
    { email: "student1@example.edu", first: "Rohan", last: "Mehta", roll: "CS-A-01" },
    { email: "student2@example.edu", first: "Priya", last: "Nair", roll: "CS-A-02" },
    { email: "student3@example.edu", first: "Kabir", last: "Singh", roll: "CS-A-03" },
    { email: "student4@example.edu", first: "Ananya", last: "Rao", roll: "CS-A-04" },
  ];
  const studentProfileRows = [];
  for (const def of studentDefs) {
    const studentUser = await findOrInsert(
      () => db.query.users.findFirst({ where: eq(users.email, def.email) }),
      async () => {
        const [row] = await db
          .insert(users)
          .values({
            email: def.email,
            passwordHash,
            role: "STUDENT",
            firstName: def.first,
            lastName: def.last,
            departmentId: dept.id,
            isActive: true,
          })
          .returning();
        if (!row) throw new Error(`failed to insert student user ${def.email}`);
        return row;
      },
      `user ${def.email}`,
    );

    const studentProfile = await findOrInsert(
      () => db.query.studentProfiles.findFirst({ where: eq(studentProfiles.sectionRollNo, def.roll) }),
      async () => {
        const [row] = await db
          .insert(studentProfiles)
          .values({
            userId: studentUser.id,
            programId: program.id,
            semesterId: semester.id,
              coordinatorId: teacherProfile.id, // <-- add this
            sectionRollNo: def.roll,
            universityRollNo: `UNI-${def.roll}`,
            registrationNo: `REG-${def.roll}`,
            joinedAt: "2026-07-01",
          })
          .returning();
        if (!row) throw new Error(`failed to insert student profile ${def.roll}`);
        return row;
      },
      `student profile ${def.roll}`,
    );
    studentProfileRows.push(studentProfile);
  }

  const dayForOffering: ("MONDAY" | "WEDNESDAY")[] = ["MONDAY", "WEDNESDAY"];
  const offeringRows = [];
  for (let i = 0; i < subjectRows.length; i++) {
    const subject = subjectRows[i]!;
    const offering = await findOrInsert(
      () =>
        db.query.subjectOfferings.findFirst({
          where: and(
            eq(subjectOfferings.subjectId, subject.id),
            eq(subjectOfferings.teacherId, teacherProfile.id),
            eq(subjectOfferings.semesterId, semester.id),
          ),
        }),
      async () => {
        const [row] = await db
          .insert(subjectOfferings)
          .values({ subjectId: subject.id, teacherId: teacherProfile.id, semesterId: semester.id })
          .returning();
        if (!row) throw new Error(`failed to insert offering for ${subject.code}`);
        return row;
      },
      `offering ${subject.code}`,
    );
    offeringRows.push(offering);

    await findOrInsert(
      () =>
        db.query.timetableEntries.findFirst({
          where: eq(timetableEntries.subjectOfferingId, offering.id),
        }),
      async () => {
        const [row] = await db
          .insert(timetableEntries)
          .values({
            subjectOfferingId: offering.id,
            classroomId: classroom.id,
            dayOfWeek: dayForOffering[i]!,
            startTime: "09:00:00",
            endTime: "10:00:00",
          })
          .returning();
        if (!row) throw new Error(`failed to insert timetable entry for ${subject.code}`);
        return row;
      },
      `timetable entry for ${subject.code}`,
    );

    for (const student of studentProfileRows) {
      const already = await db.query.subjectEnrollments.findFirst({
        where: and(
          eq(subjectEnrollments.studentId, student.id),
          eq(subjectEnrollments.subjectOfferingId, offering.id),
        ),
      });
      if (already) continue;
      await db.insert(subjectEnrollments).values({ studentId: student.id, subjectOfferingId: offering.id });
      console.log(`+ enrolled ${student.sectionRollNo} in ${subject.code}`);
    }
  }

  console.log("\nSeed complete.");
  console.log(`Login password for every seeded account: ${SEED_PASSWORD}`);
  console.log("Teacher: teacher1@example.edu");
  console.log("Students: student1@example.edu .. student4@example.edu");
  console.log("\nSubject offering IDs (paste into the teacher.html test form):");
  for (let i = 0; i < offeringRows.length; i++) {
    console.log(`  ${subjectRows[i]!.code} -> ${offeringRows[i]!.id}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:");
  console.error(err);
  process.exit(1);
});
