// apps/web/app/api/student/profile/route.ts

import { NextResponse } from "next/server";
import { db } from "@repo/db";
import { studentProfiles } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { AUTH_SERVICE_URL } from "../../../../lib/config";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();

    // 1. Authenticate against the core auth service session
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

    if (!user || user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Unauthorized access profile mapping" },
        { status: 401 }
      );
    }

    // 2. Fetch the student profile entry using safe select syntax
    const studentProfileArray = await db
      .select({
        id: studentProfiles.id,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, user.id))
      .limit(1);

    const studentProfile = studentProfileArray[0];

    if (!studentProfile) {
      return NextResponse.json(
        { error: "Student mapping entry not found" },
        { status: 451 }
      );
    }

    // 3. Return only the required metadata context
    return NextResponse.json(
      { studentId: studentProfile.id },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}