import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/db";
import { attendanceRecords, attendanceSessions, studentProfiles, users } from "@repo/db/schema";

import { eq, and, or , desc, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { AUTH_SERVICE_URL } from "../../../../lib/config";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
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

    if (!user || user.role !== "TEACHER") {
        return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
  const { sessionId } = await params;
    console.log("sessionId " , sessionId)
    if (!sessionId) {
        return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    try {
       const sessionDetails = await db.query.attendanceSessions.findFirst({
  where: eq(attendanceSessions.id, sessionId),
   with: {
     subjectOffering: {
     with: {
         subject: true, // Joins the subjects table
      },
    },
  },
});

       if (!sessionDetails) {
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}

        // 2. Fetch all student records for this snapshot session
        const records = await db
            .select({
                studentId: studentProfiles.id,
                name: users.firstName, // Assuming users has firstName/lastName
                lastName: users.lastName,
                sectionRollNo: studentProfiles.sectionRollNo,
                status: attendanceRecords.status,
                markedAt: attendanceRecords.markedAt,
            })
            .from(attendanceRecords)
            .innerJoin(studentProfiles, eq(attendanceRecords.studentId, studentProfiles.id))
            .innerJoin(users, eq(studentProfiles.userId, users.id))
            .where(eq(attendanceRecords.sessionId, sessionId))
            .orderBy(desc(studentProfiles.sectionRollNo));

        const totalStudents = records.length;
        const presentCount = records.filter(r => r.status === "PRESENT").length;
        const absentCount = totalStudents - presentCount;

return NextResponse.json({
   
    id: sessionDetails.id,
    subjectCode: sessionDetails.subjectOffering.subject.code, // Fixed: accessing .code from subjects
    subjectName: sessionDetails.subjectOffering.subject.name, // Fixed: accessing .name from subjects
    sessionType: sessionDetails.sessionType,
    sessionDate: sessionDetails.sessionDate,
    status: sessionDetails.status,
    stats:{
      totalStudents,
      presentCount,
      absentCount
    },
    roster:records 
  

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