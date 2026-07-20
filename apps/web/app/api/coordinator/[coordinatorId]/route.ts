// apps/web/api/teacher/[coordinatorId]/route.ts

import { NextResponse } from "next/server";
import { db } from "@repo/db";
import {
  attendanceRecords,
  attendanceSessions,
  studentProfiles,
  users,
  subjectOfferings,
  subjects,
  teacherProfiles,
} from "@repo/db/schema";
import { eq, desc } from "drizzle-orm";
import { cookies } from "next/headers";
import { AUTH_SERVICE_URL } from "../../../lib/config";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ coordinatorId: string }> }
) {
  try {
    const cookieStore = await cookies();

    const authRes = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
      headers: {
        Cookie: cookieStore.toString(),
      },
    });

    if (!authRes.ok) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    const { user } = await authRes.json();

    if (!user || user.role !== "TEACHER") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { coordinatorId } = await params;

    if (!coordinatorId) {
      return NextResponse.json(
        { error: "Coordinator id required" },
        { status: 400 }
      );
    }

const coordinator = await db.query.teacherProfiles.findFirst({
  where: eq(teacherProfiles.id, coordinatorId),
  with: {
    user: {
      columns: {
        firstName: true,
        lastName: true,
        email: true,
        
      },
    },
  },
});

console.log(coordinator);

    const history = await db
      .select({
        studentId: studentProfiles.id,
        sectionRollNo: studentProfiles.sectionRollNo,

        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,

        sessionId: attendanceSessions.id,
        sessionDate: attendanceSessions.sessionDate,
        sessionType: attendanceSessions.sessionType,
        status: attendanceSessions.status,

        attendanceStatus: attendanceRecords.status,
        markedAt: attendanceRecords.markedAt,

        subjectCode: subjects.code,
        subjectName: subjects.name,
      })
      .from(studentProfiles)
      .innerJoin(
        users,
        eq(studentProfiles.userId, users.id)
      )
      .leftJoin(
        attendanceRecords,
        eq(studentProfiles.id, attendanceRecords.studentId)
      )
      .leftJoin(
        attendanceSessions,
        eq(attendanceRecords.sessionId, attendanceSessions.id)
      )
      .leftJoin(
        subjectOfferings,
        eq(
          attendanceSessions.subjectOfferingId,
          subjectOfferings.id
        )
      )
      .leftJoin(
        subjects,
        eq(subjectOfferings.subjectId, subjects.id)
      )
      .where(eq(studentProfiles.coordinatorId, coordinatorId))
      .orderBy(
        studentProfiles.sectionRollNo,
        desc(attendanceSessions.sessionDate)
      );
      console.log("coordinatre" , coordinator)
    return NextResponse.json(
      {
        coordinatorId,
        coordinator,
        totalRecords: history.length,
        history,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}