"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TEACHER_SERVICE_WS_URL } from "../lib/config";
import { getCurrentUser, type CurrentUser } from "../lib/auth";
import axios from "axios";

interface AttendanceView {
  id: string;
  subjectOfferingId: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  sessionType: "LECTURE" | "LAB";
  sessionDate: string;
  classroom: string | null;
  startTime: string | null;
  endTime: string | null;
  status: "OPEN" | "ACCEPTED" | "CANCELLED";
  createdAt: string;
}

type SessionState = "open" | "marked" | "accepted";
type ConnectionState = "connecting" | "connected" | "closed";

function DashboardContent() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [studentId, setStudentId] = useState();
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  const [sessions, setSessions] = useState<Map<string, AttendanceView>>(new Map());
  const [states, setStates] = useState<Map<string, SessionState>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [closedNotice, setClosedNotice] = useState<AttendanceView | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

useEffect(() => {
  getCurrentUser().then(async (u) => {
    setUser(u);
    setAuthChecked(true);

    if (u && u.role === "STUDENT") {
      try {
        // Replacing URL parsing with an explicit Axios network request
        const response = await axios.get("/api/attendance/student/student-id");
        console.log("response.data" ,response.data)
        if (response.data?.studentId) {
          setStudentId(response.data.studentId);
        }
      } catch (err) {
        console.error("Axios failed to fetch student identity profile:", err);
        setError("Failed to load student profile context.");
      }
    }
  });
}, []);

  useEffect(() => {
    if (!authChecked || !user || user.role !== "STUDENT") return;

    const ws = new WebSocket(TEACHER_SERVICE_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnection("connected");
    ws.onclose = () => setConnection("closed");
    ws.onerror = () => setConnection("closed");

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("message ws ", msg);
      if (msg.type === "connected") {
        setConnection("connected");
      } else if (msg.type === "attendance_available") {
        const attendance: AttendanceView = msg.payload.attendance;
        setSessions((prev) => new Map(prev).set(attendance.id, attendance));
        setStates((prev) => (prev.has(attendance.id) ? prev : new Map(prev).set(attendance.id, "open")));
      } else if (msg.type === "attendance_marked") {
        const id: string = msg.payload.sessionId;
        setStates((prev) => new Map(prev).set(id, "marked"));
      } else if (msg.type === "attendance_accepted") {
        const id: string = msg.payload.sessionId;
        const subjectOfferingId: AttendanceView = msg.payload.subjectOfferingId;
        setStates((prev) => new Map(prev).set(id, "accepted"));
        router.push(`student/get-details?subjectId=${subjectOfferingId}`);
      } else if (msg.type === "attendance_closed") {
        const attendance: AttendanceView = msg.payload.attendance;
        
        setSessions((prev) => {
          const next = new Map(prev);
          next.delete(attendance.id);
          return next;
        });
        setStates((prev) => {
          const next = new Map(prev);
          next.delete(attendance.id);
          return next;
        });
        setClosedNotice(attendance);
      } else if (msg.type === "error") {
        setError(msg.payload.message);
      }
    };

    return () => ws.close();
  }, [authChecked, user, router]);

  function handleMark(sessionId: string) {
    setError(null);
    wsRef.current?.send(JSON.stringify({ type: "mark_attendance", payload: { sessionId } }));
  }

  if (authChecked && !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
        <div className="max-w-md w-full mx-auto bg-slate-900/60 backdrop-blur-md p-8 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-4">
          <div className="text-xs font-bold tracking-widest uppercase text-amber-500/80">College ERP · Access Fault</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Not signed in</h1>
          <p className="text-sm text-slate-400">
            <Link className="text-amber-500 hover:text-amber-400 font-semibold transition underline" href="/login">
              Sign in
            </Link>{" "}
            with a valid student account node first.
          </p>
        </div>
      </div>
    );
  }

  if (authChecked && user && user.role !== "STUDENT") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
        <div className="max-w-md w-full mx-auto bg-slate-900/60 backdrop-blur-md p-8 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-4">
          <div className="text-xs font-bold tracking-widest uppercase text-slate-500">College ERP · Security Context</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Invalid Privilege Profile</h1>
          <p className="text-sm text-slate-400">
            Authenticated as {user.email} ({user.role}) — this area is reserved for student routing. Access{" "}
            <Link className="text-amber-500 hover:text-amber-400 font-semibold transition underline" href="/teacher">
              teacher terminal panel
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const list = [...sessions.values()];

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Dynamic Navigation Context Header */}
        <div className="relative bg-slate-900/80 p-6 rounded-2xl shadow-2xl border border-slate-800/80 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-bold tracking-widest uppercase text-amber-500/90">College ERP · Student Terminal</div>
              <h1 className="text-2xl font-black tracking-tight text-white antialiased">Your Live Classes</h1>
              <p className="text-xs text-slate-400 font-medium tracking-wide flex items-center gap-1.5">
                <span>{user ? `${user.firstName} ${user.lastName}` : "Student Node"}</span>
                <span className="text-slate-700">·</span>
                {connection === "connecting" && <span className="text-slate-500 animate-pulse">connecting…</span>}
                {connection === "connected" && (
                  <span className="text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> link active
                  </span>
                )}
                {connection === "closed" && <span className="text-rose-400 font-bold">socket disconnected</span>}
              </p>
            </div>

            {/* History Navigation Link Button Trigger */}
            {studentId && (
              <button
                onClick={() => router.push(`/student/get-details?studentId=${studentId}`)}
                className="px-3.5 py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-850 hover:border-slate-700 transition duration-150 tracking-wide inline-flex items-center gap-1.5 shadow-sm shrink-0 self-start sm:self-center"
              >
                📊 Get Previous Attendance Record
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 text-sm text-rose-400 rounded-xl bg-rose-950/30 border border-rose-900/50 font-medium shadow-inner">
            {error}
          </div>
        )}

        {closedNotice && (
          <div className="p-4 text-sm text-amber-400 rounded-xl bg-amber-950/20 border border-amber-900/40 font-medium shadow-md">
            ⚠️ Attendance sequence for <span className="text-white font-bold">{closedNotice.subjectCode}</span> was closed 
            {closedNotice.teacherName ? ` by ${closedNotice.teacherName}` : " by the host instructor"}.
          </div>
        )}

        {/* Live Session Streams Container */}
        <div className="space-y-4">
          {list.length === 0 ? (
            <div className="bg-slate-900/40 rounded-2xl p-8 border border-slate-900 text-center">
              <p className="text-xs text-slate-500 font-medium italic tracking-wide">
                No active signature streams broadcasted at this timestamp. Available streams populate live upon faculty initialization.
              </p>
            </div>
          ) : (
            list.map((a) => {
              const state = states.get(a.id) ?? "open";
              const where = a.classroom
                ? `${a.classroom}${a.startTime ? ` · ${a.startTime}–${a.endTime}` : ""}`
                : null;
              
              return (
                <div 
                  className="bg-slate-900/80 p-6 rounded-2xl shadow-xl border border-slate-800/80 transition hover:border-slate-700 relative overflow-hidden group" 
                  key={a.id}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-black text-white tracking-tight group-hover:text-amber-400 transition">
                        {a.subjectCode} <span className="text-slate-600 font-light font-sans">|</span> <span className="text-slate-300 font-medium">{a.subjectName}</span>
                      </h2>
                      <p className="text-xs text-slate-400 font-medium tracking-wide">
                        {a.teacherName} <span className="text-slate-700">·</span> <span className="text-amber-500/80">{a.sessionType}</span>
                        {where && <><span className="text-slate-700"> · </span><span className="text-slate-300">{where}</span></>}
                      </p>
                    </div>

                    <button
                      className={`py-2.5 px-5 rounded-xl text-xs font-bold tracking-wide uppercase transition duration-150 transform active:scale-[0.98] sm:self-center self-start shadow-md ${
                        state === "open"
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-950/20"
                          : state === "marked"
                          ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 cursor-default shadow-none"
                          : "bg-slate-850 text-slate-500 border border-slate-800 cursor-default shadow-none"
                      }`}
                      onClick={() => handleMark(a.id)}
                      disabled={state !== "open"}
                    >
                      {state === "open" && "Mark Attendance"}
                      {state === "marked" && "✓ Pending Approval"}
                      {state === "accepted" && "Attendance Confirmed"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

// Next.js client components using hooks like useSearchParams must be wrapped 
// in a Suspense boundary when rendered inside Static HTML boundaries.
export default function StudentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-400">
        <div className="animate-pulse text-xs font-bold tracking-widest uppercase">Loading Terminal Workspace…</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}