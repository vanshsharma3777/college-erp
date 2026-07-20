import { cookies, headers } from "next/headers";
import axios from "axios";
import AttendanceExplorer from "../../components/AttendenceExplorer";

export type AttendanceHistory = {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  sectionRollNo: string;
  subjectCode: string;
  subjectName: string;
  sessionDate: string;
  sessionType: string;
  attendanceStatus: string;
  markedAt: string | null;
};

// Defined the new Coordinator profile shapes from your updated API response
export type CoordinatorProfile = {
  id: string;
  employeeId: string;
  designation: string;
  joinedAt: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

export type ResponseData = {
  coordinatorId: string;
  totalRecords: number;
  coordinator: CoordinatorProfile; // Map the new coordinator details block
  history: AttendanceHistory[];
};

export default async function StudentsDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ coordinatorId?: string }>;
}) {
  const { coordinatorId } = await searchParams;

  if (!coordinatorId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <p className="text-sm font-mono text-rose-400 bg-rose-950/20 border border-rose-900/40 px-4 py-2 rounded-xl">
          Error: Missing coordinatorId parameter.
        </p>
      </div>
    );
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const reqHeaders = await headers();
  const host = reqHeaders.get("host")!;
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  let data: ResponseData;

  try {
    const response = await axios.get<ResponseData>(
      `${baseUrl}/api/coordinator/${coordinatorId}`,
      { headers: { Cookie: cookieHeader } }
    );
    data = response.data;
  } catch (err) {
    console.error(err);
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <p className="text-sm font-mono text-rose-400 bg-rose-950/20 border border-rose-900/40 px-4 py-2 rounded-xl">
          System Error: Unable to fetch attendance history logs.
        </p>
      </div>
    );
  }

  const teacher = data.coordinator;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 selection:bg-amber-500/20 selection:text-amber-200">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Metric Overview Header with Teacher Information Block */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Minimalistic Avatar Placeholder mapping name initials */}
            <div className="h-12 w-12 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-500 font-mono text-base">
              {teacher?.user?.firstName?.[0] || ""}{teacher?.user?.lastName?.[0] || "T"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black tracking-tight text-slate-100">
                  Prof. {teacher?.user?.firstName} {teacher?.user?.lastName}
                </h1>
                <span className="text-[10px] font-mono tracking-widest font-bold uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-slate-400">
                  {teacher?.designation || "Faculty Node"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm font-mono text-slate-500">
                <p>ID: <span className="text-slate-400 text-lg">{teacher?.employeeId}</span></p>
                <span className="hidden sm:inline text-slate-700">•</span>
                <p>Email: <span className="text-slate-400 text-lg">{teacher?.user?.email}</span></p>
                <span className="hidden sm:inline text-slate-700">•</span>
                <p>Joined: <span className="text-slate-400 text-lg">{teacher?.joinedAt}</span></p>
              </div>
            </div>
          </div>

         
    
        </div>

        {/* Client-side Interactive Explorer Pane Component */}
        <AttendanceExplorer history={data.history} />

      </div>
    </main>
  );
}