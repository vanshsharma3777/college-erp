import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { attendanceRecords, attendanceSessions, studentProfiles, subjectOfferings } from "@repo/db/schema";
import { db } from "@repo/db";
import { cookies } from "next/headers";
import { AUTH_SERVICE_URL } from "../../../../lib/config";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
)  {
  const cookieStore = await cookies();

const cookieHeader = cookieStore.toString();

const res = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
  headers: {
    Cookie: cookieHeader,
  },
});

if (!res.ok) {
  return NextResponse.json(
    { error: "Unauthorized access" },
    { status: 401 }
  );
}

const { user } = await res.json();
  if (!user || user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }
  console.log("user found" , user)
  const { subjectId } =await params
  console.log("subOOfferiingId" , subjectId )
  if (!subjectId) {
    return NextResponse.json({ error: "Subject Offering ID required" }, { status: 400 });
  }

  try {
    // 1. Locate student target profile mapped to this user account
   const student = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, user.id)
    });
    console.log("student found" , student)
    if (!student) {
      return NextResponse.json({ error: "Student profile configuration fault" }, { status: 404 });
    }
    
    // 2. Query target subject info metrics with the nested subject relation
    const offering = await db.query.subjectOfferings.findFirst({
      where: eq(subjectOfferings.id, subjectId),
      with: {
        subject: true, // Joins the master subjects table
      },
    });
    console.log("ofeering " , offering)
    // 3. Gather only this student's explicit records across all accepted sessions for this offering
   const history = await db
      .select({
        recordId: attendanceRecords.createdAt,
        status: attendanceRecords.status,
        markedAt: attendanceRecords.markedAt,
        sessionDate: attendanceSessions.sessionDate,
        sessionType: attendanceSessions.sessionType,
      })
      .from(attendanceRecords)
      .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(
        and(
          eq(attendanceRecords.studentId, student.id),
          eq(attendanceSessions.subjectOfferingId, subjectId),
          eq(attendanceSessions.status, "ACCEPTED")
        )
      )
      .orderBy(desc(attendanceSessions.sessionDate));

      console.log("history" , history)
    const totalSessions = history.length;
    const attendedSessions = history.filter(h => h.status === "PRESENT").length;
    const aggregatePercentage = totalSessions > 0 ? ((attendedSessions / totalSessions) * 100).toFixed(1) : "0.0";

    return NextResponse.json({
      subject: offering ? { name: offering.subject.name, code: offering.subject.code } : null,
      student:{
        sectionRollNo: student.sectionRollNo,
        registrationNo: student.registrationNo,
        universityRollNo: student.universityRollNo
      },
      stats: {
        totalSessions,
        attendedSessions,
        percentage: aggregatePercentage,
      },
      history,
    });
  } catch (error) {
  console.dir(error, { depth: null });

  return NextResponse.json(
    {
      error: String(error),
    },
    { status: 500 }
  );
}
}