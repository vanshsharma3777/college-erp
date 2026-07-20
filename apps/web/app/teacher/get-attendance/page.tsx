"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface TeacherReport {
  id: string;
  subjectCode: string;
  subjectName: string;
  sessionType: "LECTURE" | "LAB";
  sessionDate: string;
  status: string;
  stats: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
  };
  roster: Array<{
    studentId: string;
    name: string;
    lastName: string;
    sectionRollNo: string;
    status: "PRESENT" | "ABSENT";
    markedAt: string | null;
  }>;
}

export default function GetAttendancePage({ searchParams }: { searchParams: Promise<{ sessionId?: string }> }) {
  const { sessionId } = use(searchParams);
  const [data, setData] = useState<TeacherReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No active session identified. Run an attendance sequence first.");
      setLoading(false);
      return;
    }

    fetch(`/api/attendance/teacher/${sessionId}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.error) setError(resData.error);
        else setData(resData);
        console.log(resData)
      })
      .catch(() => setError("Failed to process system payload telemetry."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const shareWhatsAppReport = () => {
    if (!data) return;

    let rosterStatusList = "";
    data.roster.forEach((s) => {
      const statusIcon = s.status === "PRESENT" ? "✅" : "❌";
      rosterStatusList += `${s.sectionRollNo} - ${s.name}: ${statusIcon} ${s.status}\n`;
    });

    const message = `*📋 ATTENDANCE REPORT*\n\n` +
      `*Subject:* ${data.subjectName} (${data.subjectCode})\n` +
      `*Date:* ${data.sessionDate} [${data.sessionType}]\n\n` +
      `*📊 SUMMARY METRICS*\n` +
      `• Total Strength: ${data.stats.totalStudents}\n` +
      `• Present Count: ${data.stats.presentCount}\n` +
      `• Absent Count: ${data.stats.absentCount}\n\n` +
      `*👥 STUDENT ROSTER LOG*\n` +
      rosterStatusList;

    const encodedText = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
        <div className="max-w-md w-full mx-auto bg-slate-900/60 backdrop-blur-md p-8 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-4">
          <div className="text-xs font-bold tracking-widest uppercase text-amber-500/80">College ERP · Analytics</div>
          <p className="text-sm text-slate-400 animate-pulse font-medium tracking-wide">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
        <div className="max-w-md w-full mx-auto bg-slate-900/60 backdrop-blur-md p-8 border border-slate-800 rounded-2xl shadow-2xl space-y-4">
          <div className="text-xs font-bold tracking-widest uppercase text-slate-500 text-center">College ERP · System Fault</div>
          <div className="p-4 text-sm text-rose-400 rounded-xl bg-rose-950/30 border border-rose-900/50 font-medium text-center shadow-inner">
            {error || "Telemetry data structure fault."}
          </div>
          <div className="text-center">
            <Link className="text-amber-500 hover:text-amber-400 transition underline text-sm font-semibold tracking-wide" href="/teacher">
              Return to Control Panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const attendanceRate = data.stats.totalStudents > 0 
    ? Math.round((data.stats.presentCount / data.stats.totalStudents) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Main Dashboard Header */}
        <div className="relative bg-slate-900/80 p-6 rounded-2xl shadow-2xl border border-slate-800/80 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between relative z-10">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-amber-500/90">
                Attendance Report
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-white mt-1 antialiased">
                {data.subjectCode} <span className="text-slate-500 font-light font-sans">|</span> <span className="text-slate-200 font-medium">{data.subjectName}</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-1 tracking-wide">
                {data.sessionDate} <span className="text-slate-700">·</span> <span className="text-amber-500/80 font-semibold">{data.sessionType}</span>
              </p>
            </div>
            <span
              className={`inline-flex items-center self-start sm:self-center px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm border ${
                data.status === "ACCEPTED"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50 shadow-emerald-900/20"
                  : "bg-amber-950/40 text-amber-400 border-amber-800/50 shadow-amber-900/20"
              }`}
            >
              ● {data.status}
            </span>
          </div>
        </div>

        {/* Dynamic Metric Cards */}
        <div className="grid gap-4 grid-cols-3">
          <div className="bg-slate-900/80 p-4 rounded-2xl shadow-xl border border-slate-800/80 transition hover:border-slate-700">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Strength</p>
            <h2 className="mt-1 text-3xl font-black text-white tracking-tight">
              {data.stats.totalStudents}
            </h2>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl shadow-xl border border-slate-800/80 transition hover:border-emerald-900/60 relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition"></div>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
              Present <span className="text-[9px] text-slate-500 font-normal">({attendanceRate}%)</span>
            </p>
            <h2 className="mt-1 text-3xl font-black text-emerald-400 tracking-tight drop-shadow-[0_0_12px_rgba(52,211,153,0.15)]">
              {data.stats.presentCount}
            </h2>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl shadow-xl border border-slate-800/80 transition hover:border-rose-900/60 relative overflow-hidden group">
            <div className="absolute inset-0 bg-rose-500/[0.02] opacity-0 group-hover:opacity-100 transition"></div>
            <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Absent</p>
            <h2 className="mt-1 text-3xl font-black text-rose-400 tracking-tight drop-shadow-[0_0_12px_rgba(251,113,133,0.15)]">
              {data.stats.absentCount}
            </h2>
          </div>
        </div>

        {/* Native CTA Action Link */}
        <div>
          <button
            onClick={shareWhatsAppReport}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl shadow-lg shadow-emerald-950/50 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-emerald-500 transition duration-200 transforms hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.114-2.904-6.989-1.873-1.876-4.36-2.907-7.008-2.908-5.44 0-9.866 4.42-9.869 9.865-.001 1.649.431 3.257 1.256 4.675l-.973 3.553 3.64-.955zm10.707-7.07c-.282-.141-1.673-.826-1.932-.92-.259-.095-.448-.141-.637.141-.188.283-.728.92-.892 1.107-.164.188-.328.212-.61.07-2.8-.14-3.874-1.74-4.63-3.047-.215-.373.215-.346.615-1.147.094-.19.048-.356-.024-.497-.072-.142-.637-1.535-.873-2.103-.23-.554-.462-.48-.637-.489-.165-.008-.353-.01-.542-.01-.19 0-.498.07-.757.355-.26.283-.99 1.016-.99 2.48 0 1.465 1.066 2.88 1.214 3.07.149.191 2.098 3.203 5.084 4.495.71.307 1.265.49 1.696.628.713.226 1.362.194 1.875.118.571-.085 1.674-.684 1.909-1.344.236-.66.236-1.226.166-1.343-.07-.117-.26-.188-.542-.33z"/>
            </svg>
            Share on WhatsApp
          </button>
        </div>

        <div className="bg-slate-900/80 rounded-2xl shadow-2xl border border-slate-800/80 overflow-hidden">
          <div className="border-b  border-slate-850 px-6 py-4 bg-slate-950/20 flex items-center justify-center">
            <h2 className="text-xl font-bold uppercase  tracking-widest text-slate-400">
              Analytics
            </h2>
            
          </div>

          <div className="divide-y divide-slate-850 max-h-[26rem] overflow-y-auto custom-scrollbar">
            {data.roster.map((student) => (
              <div
                key={student.studentId}
                className="flex items-center justify-between px-6 py-3.5 text-sm hover:bg-slate-850/30 transition duration-75 group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-mono text-[11px] font-bold text-slate-400 border border-slate-800 group-hover:border-amber-500/30 transition">
                    {student.sectionRollNo}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-200 tracking-wide truncate group-hover:text-white transition">
                      {student.name} {student.lastName}
                    </h3>
                    <p className="text-[10px] text-slate-500 text-sm  tracking-wider uppercase mt-0.5">
                      Roll NO {student.sectionRollNo}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase shadow-sm border ${
                    student.status === "PRESENT"
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40 shadow-emerald-950/30"
                      : "bg-rose-950/40 text-rose-400 border-rose-900/40 shadow-rose-950/30"
                  }`}
                >
                  {student.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}