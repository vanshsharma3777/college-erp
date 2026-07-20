"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TEACHER_SERVICE_WS_URL } from "../lib/config";
import { getCurrentUser, type CurrentUser } from "../lib/auth";

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

interface PendingStudent {
  studentId: string;
  name: string;
  sectionRollNo: string;
  markedAt: string;
}

type ConnectionState = "connecting" | "connected" | "closed";

export default function TeacherPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  const [session, setSession] = useState<AttendanceView | null>(null);
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subjectOfferingId, setSubjectOfferingId] = useState("");
  const [sessionType, setSessionType] = useState<"LECTURE" | "LAB">("LECTURE");
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timetableEntryId, setTimetableEntryId] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<AttendanceView | null>(null);
  const teacherIdRef = useRef<string >(null);

  function applySession(next: AttendanceView | null) {
    sessionRef.current = next;
    setSession(next);
  }

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      console.log(u)
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked || !user || user.role !== "TEACHER") return;

    const ws = new WebSocket(TEACHER_SERVICE_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnection("connected");
    ws.onclose = () => setConnection("closed");
    ws.onerror = () => setConnection("closed");

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("every msg" , msg)
      console.log("every msg : "  , msg)
      if (msg.type === "connected") {
        setConnection("connected");
      } else if (msg.type === "attendance_created") {
        applySession(msg.payload.attendance);
        setStudents([]);
        setAccepted(false);
        setError(null);
      } else if (msg.type === "pending_update") {
        if (msg.payload.sessionId === sessionRef.current?.id) {
          setStudents(msg.payload.students);
        }
      } else if (msg.type === "attendance_accepted") {
        if (msg.payload.sessionId === sessionRef.current?.id) {
          setAccepted(true);
        }
      } else if (msg.type === "attendance_closed") {
        applySession(null);
        setStudents([]);
        setAccepted(false);
        router.push(`teacher/get-attendance?sessionId=${sessionRef?.current?.id}`);
      } 
      
      else if (msg.type === "get_students_detail") {
        console.log("msg" , msg)
        const teacherId = msg.payload.teacherId;
  router.push(`/teacher/students-detail?coordinatorId=${teacherId}`);

      }
      else if (msg.type === "error") {
        setError(msg.payload.message);
      }
    };

    return () => ws.close();
  }, [authChecked, user, router]);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    console.log("subjectofferid" , subjectOfferingId)
    const payload: Record<string, unknown> = {
      subjectOfferingId: subjectOfferingId.trim(),
      sessionType,
      sessionDate,
    };
    if (timetableEntryId.trim()) payload.timetableEntryId = timetableEntryId.trim();
    wsRef.current?.send(JSON.stringify({ type: "create_attendance", payload }));
  }

  function handleRemove(studentId: string) {
    if (!sessionRef.current) return;
    wsRef.current?.send(
      JSON.stringify({
        type: "remove_student",
        payload: { sessionId: sessionRef.current.id, studentId },
      }),
    );
  }

  function handleAccept() {
    if (!sessionRef.current) return;
    wsRef.current?.send(
      JSON.stringify({
        type: "accept_attendance",
        payload: { sessionId: sessionRef.current.id },
      }),
    );
    router.push(`teacher/get-attendance?sessionId=${sessionRef.current.id}`);
  }
  function handleGetStudentsDetail() {
    console.log("clicked")
    if ( !user) return;

    wsRef.current?.send(
      JSON.stringify({
        type: "get_students_detail",
        payload: {
          teacherId: user.id  // Pass the actual teacher ID from auth context
        },
      }),
    );
      }

  function handleCloseAttendance() {
    if (!sessionRef.current) return;

    wsRef.current?.send(
      JSON.stringify({
        type: "close_attendance",
        payload: {
          sessionId: sessionRef.current.id,
        },
      }),
    );
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
            with a valid teacher credentials portal first.
          </p>
        </div>
      </div>
    );
  }

  if (authChecked && user && user.role !== "TEACHER") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
        <div className="max-w-md w-full mx-auto bg-slate-900/60 backdrop-blur-md p-8 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-4">
          <div className="text-xs font-bold tracking-widest uppercase text-slate-500">College ERP · Security Context</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Invalid Privilege Profile</h1>
          <p className="text-sm text-slate-400">
            Authenticated as {user.email} ({user.role}) — this control suite requires teacher clearance. Access{" "}
            <Link className="text-amber-500 hover:text-amber-400 font-semibold transition underline" href="/student">
              student sub-terminal view
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Dynamic Context Header */}
        <div className="relative bg-slate-900/80 p-6 rounded-2xl shadow-2xl border border-slate-800/80 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 space-y-1">
            <div className="text-[10px] font-bold tracking-widest uppercase text-amber-500/90">College ERP · Attendance Manager</div>
            <h1 className="text-2xl font-black tracking-tight text-white antialiased">Create New Attendence</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide flex items-center gap-1.5">
              <span>{user ? `${user.firstName} ${user.lastName}` : "Terminal Node"}</span>
              <span className="text-slate-700">·</span>
              {connection === "connecting" && <span className="text-slate-500 animate-pulse">connecting…</span>}
              {connection === "connected" && (
                <span className="text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> live link stable
                </span>
              )}
              {connection === "closed" && <span className="text-rose-400 font-bold">link disconnected</span>}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 text-sm text-rose-400 rounded-xl bg-rose-950/30 border border-rose-900/50 font-medium shadow-inner">
            {error}
          </div>
        )}

        {!session || session.status !== "OPEN" ? (
          /* Session Instantiation Suite */
          <form className="bg-slate-900/80 p-6 rounded-2xl shadow-2xl border border-slate-800/80 space-y-4" onSubmit={handleCreate}>
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="subjectOfferingId" className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Subject Id</label>
              <input
                id="subjectOfferingId"
                className="block w-full rounded-xl border-slate-800 bg-slate-950/60 p-3 text-sm text-white focus:border-amber-500/50 focus:ring-amber-500/20 placeholder-slate-600 transition"
                placeholder="Enter targeted subject uuid..."
                value={subjectOfferingId}
                onChange={(e) => setSubjectOfferingId(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label htmlFor="sessionType" className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Subject Type </label>
              <select
                id="sessionType"
                className="block w-full rounded-xl border-slate-800 bg-slate-950/60 p-3 text-sm text-white focus:border-amber-500/50 focus:ring-amber-500/20 transition"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as "LECTURE" | "LAB")}
              >
                <option value="LECTURE" className="bg-slate-900 text-slate-200">Lecture Session</option>
                <option value="LAB" className="bg-slate-900 text-slate-200">Laboratory Session</option>
              </select>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label htmlFor="sessionDate" className="text-[10px] uppercase tracking-widest font-bold text-slate-400"> Date</label>
              <input
                id="sessionDate"
                type="date"
                className="block w-full rounded-xl border-slate-800 bg-slate-950/60 p-3 text-sm text-white focus:border-amber-500/50 focus:ring-amber-500/20 transition color-scheme-dark"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label htmlFor="timetableEntryId" className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Timetable ID (Optional)</label>
              <input
                id="timetableEntryId"
                className="block w-full rounded-xl border-slate-800 bg-slate-950/60 p-3 text-sm text-white focus:border-amber-500/50 focus:ring-amber-500/20 placeholder-slate-600 transition"
                placeholder="Enter mapping uuid if required..."
                value={timetableEntryId}
                onChange={(e) => setTimetableEntryId(e.target.value)}
              />
            </div>

            <button 
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition duration-150 transform active:scale-[0.99]" 
              type="submit" 
              disabled={connection !== "connected"}
            >
              Create New Attendance
            </button>
          </form>
        ) : (
          /* Live Registry Console Frame */
          <div className="bg-slate-900/80 p-6 rounded-2xl shadow-2xl border border-slate-800/80 space-y-4">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                {session.subjectCode} <span className="text-slate-600 font-light font-sans">|</span> <span className="text-slate-300 font-medium">{session.sessionType}</span>
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-1.5 flex-wrap font-medium">
                <span>{session.sessionDate}</span>
                {session.classroom && <span className="text-slate-600">·</span>}
                {session.classroom && <span>{session.classroom}</span>}
                {(session.startTime || session.endTime) && <span className="text-slate-600">·</span>}
                {session.startTime && <span>{session.startTime}–{session.endTime}</span>}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase shadow-sm border ${
                  accepted 
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40 shadow-emerald-950/30" 
                    : "bg-amber-950/40 text-amber-400 border-amber-800/40 shadow-amber-900/20 animate-pulse"
                }`}>
                  ● {accepted ? "accepted" : "live stream"}
                </span>
              </p>
            </div>

            {/* Active Student Stream Ledger */}
            <div className="divide-y divide-slate-850 border-t border-b border-slate-850 my-4 max-h-80 overflow-y-auto custom-scrollbar">
              {students.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8 font-medium italic tracking-wide">
                  Awaiting remote signature broadcasts from student nodes...
                </p>
              ) : (
                students.map((s) => (
                  <div className="flex items-center justify-between py-3.5 text-sm hover:bg-slate-850/30 transition duration-75 group" key={s.studentId}>
                    <span className="font-mono font-bold text-slate-400 w-14 shrink-0 text-xs bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 group-hover:border-amber-500/20 transition">{s.sectionRollNo}</span>
                    <span className="text-slate-200 font-semibold flex-1 px-3 truncate group-hover:text-white">{s.name}</span>
                    <span className="text-[10px] font-mono font-medium text-slate-500 mr-3 shrink-0">
                      {new Date(s.markedAt).toLocaleTimeString()}
                    </span>
                    {!accepted && (
                      <button 
                        className="py-1 px-2.5 rounded-md text-[10px] font-bold tracking-wide uppercase text-rose-400 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/30 focus:outline-none focus:ring-1 focus:ring-rose-500 transition shrink-0" 
                        onClick={() => handleRemove(s.studentId)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Control Directives Actions */}
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-amber-500 disabled:opacity-20 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition duration-150 transform active:scale-[0.99]"
                onClick={handleAccept}
                disabled={accepted}
              >
                {accepted ? "Registry Saved ✓" : `COMPLETED (${students.length} )`}
              </button>

              <button
                className="flex-1 flex justify-center py-2.5 px-4 rounded-xl shadow-lg text-sm font-bold text-rose-400 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-rose-500 disabled:opacity-20 disabled:cursor-not-allowed transition duration-150 transform active:scale-[0.99]"
                onClick={handleCloseAttendance}
                disabled={accepted}
              >
                Cancel Session
              </button>
            </div>
            
          </div>
        )}
        
        <div  className="mt-5 flex justify-center"> 
          <button onClick={()=>{
      handleGetStudentsDetail()
        }}
                className="flex-1 flex justify-center py-2.5 px-4 rounded-xl shadow-lg text-sm font-bold text-yellow-400 bg-yellow- hover:bg-yellow-950/60 border border-yellow-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-yellow-500 disabled:opacity-20 disabled:cursor-not-allowed transition duration-150 transform active:scale-[0.99]"
                disabled={accepted}
              >
                Get Student record as Coordinator
              </button> </div>
      </div>
      
    </div>
  );
}