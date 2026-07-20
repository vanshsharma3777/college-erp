// apps/web/app/api/student/details/route.ts

import { NextResponse } from "next/server";
import { db } from "@repo/db";
import {
  attendanceRecords,
  attendanceSessions,
  studentProfiles,
  subjectOfferings,
  subjects,
} from "@repo/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { AUTH_SERVICE_URL } from "../../../../lib/config";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();

    // 1. Authenticate and resolve user session
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

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    let targetStudentId = searchParams.get("studentId");

    // 2. Resolve internal student profile tracking mapping
    let studentProfile;

    if (targetStudentId) {
      // If a specific studentId is passed in the URL parameters, fetch that profile
      studentProfile = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.id, targetStudentId),
      });
    } else if (user.role === "STUDENT") {
      // Fallback: If no studentId param exists but the logged-in user is a student, use their own session
      studentProfile = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.userId, user.id),
      });
    }

    if (!studentProfile) {
      return NextResponse.json(
        { error: "Student profile record not found" },
        { status: 404 }
      );
    }

    // 3. Query execution pulling ALL rows for this student across ALL subjects
    const history = await db
      .select({
        sessionId: attendanceSessions.id,
        sessionDate: attendanceSessions.sessionDate,
        sessionType: attendanceSessions.sessionType,
        attendanceStatus: attendanceRecords.status,
        markedAt: attendanceRecords.markedAt,
        subjectCode: subjects.code,
        subjectName: subjects.name,
      })
      .from(attendanceRecords)
      .innerJoin(
        attendanceSessions,
        eq(attendanceRecords.sessionId, attendanceSessions.id)
      )
      .innerJoin(
        subjectOfferings,
        eq(attendanceSessions.subjectOfferingId, subjectOfferings.id)
      )
      .innerJoin(
        subjects,
        eq(subjectOfferings.subjectId, subjects.id)
      )
      .where(eq(attendanceRecords.studentId, studentProfile.id))
      .orderBy(desc(attendanceSessions.sessionDate));

    // 4. Try to construct name metadata context if checking another student's ledger profile
    const profileName = studentProfile.userId === user.id 
      ? `${user.firstName} ${user.lastName}`
      : "Student Ledger Node";

    return NextResponse.json(
      {
        student: {
          id: studentProfile.id,
          rollNo: studentProfile.sectionRollNo,
          name: profileName,
          email: studentProfile.userId === user.id ? user.email : undefined,
        },
        filteredRecordsCount: history.length,
        history,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: err.message,
      },
      { status: 500 }
    );
  }
}