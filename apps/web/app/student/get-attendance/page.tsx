"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface StudentReport {
  subject: { name: string; code: string } | null;
  student: {
    sectionRollNo: string;
    registrationNo: string;
    universityRollNo: string;
  };
  stats: {
    totalSessions: number;
    attendedSessions: number;
    percentage: string;
  };
  history: Array<{
    recordId: string;
    status: "PRESENT" | "ABSENT";
    markedAt: string | null;
    sessionDate: string;
    sessionType: "TEXT" | "LAB";
  }>;
}

export default function StudentAttendancePage({ searchParams }: { searchParams: Promise<{ subjectId?: string }> }) {
  const { subjectId } = use(searchParams);
  const [data, setData] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId) {
      setError("Please select a valid subject course offering parameter.");
      setLoading(false);
      return;
    }

    fetch(`/api/attendance/student/${subjectId}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.error) setError(resData.error);
        else setData(resData);
      })
      .catch(() => setError("Failed to collect attendance logs."))
      .finally(() => setLoading(false));
  }, [subjectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
        <div className="max-w-md w-full mx-auto bg-slate-900/60 backdrop-blur-md p-8 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-4">
          <div className="text-xs font-bold tracking-widest uppercase text-amber-500/80">College ERP · Metrics</div>
          <p className="text-sm text-slate-400 animate-pulse font-medium tracking-wide">Decrypting personal logs ledger...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
        <div className="max-w-md w-full mx-auto bg-slate-900/60 backdrop-blur-md p-8 border border-slate-800 rounded-2xl shadow-2xl space-y-4">
          <div className="text-xs font-bold tracking-widest uppercase text-slate-500 text-center">College ERP · Vault Fault</div>
          <div className="p-4 text-sm text-rose-400 rounded-xl bg-rose-950/30 border border-rose-900/50 font-medium text-center shadow-inner">
            {error || "Data link breakdown."}
          </div>
          <div className="text-center">
            <Link className="text-amber-500 hover:text-amber-400 transition underline text-sm font-semibold tracking-wide" href="/student">
              Return to Student Terminal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header Module */}
        <div className="relative bg-slate-900/80 p-6 rounded-2xl shadow-2xl border border-slate-800/80 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 space-y-1">
            <p className="text-[10px] font-bold tracking-widest uppercase text-amber-500/90">
              College ERP · Personal Vault
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white antialiased">
              {data.subject?.code || "Course"} Attendance
            </h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              {data.subject?.name || "Subject Logs Overview"}
            </p>
          </div>
        </div>

        {/* Identity Credentials Block */}
        <div className="bg-slate-900/80 p-5 rounded-2xl shadow-xl border border-slate-800/80 grid grid-cols-3 gap-2 text-center">
          <div className="space-y-0.5">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Section Roll</p>
            <p className="text-xl font-mono  font-bold text-slate-200">{data.student?.sectionRollNo || "—"}</p>
          </div>
          <div className="space-y-0.5 border-x border-slate-800">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Registration No</p>
            <p className="text-xl font-mono font-bold text-slate-200 truncate px-1">{data.student?.registrationNo || "—"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Uni Roll No</p>
            <p className="text-xl font-mono font-bold text-slate-200 truncate px-1">{data.student?.universityRollNo || "—"}</p>
          </div>
        </div>

        {/* Aggregated Percentage Metric */}
        <div className="bg-slate-900/80 p-6 rounded-2xl shadow-xl border border-slate-800/80 text-center relative overflow-hidden group">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/[0.02] rounded-full blur-2xl pointer-events-none"></div>
          <h2 className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            {data.stats.percentage}%
          </h2>
          <p className="mt-2 text-xs text-slate-400 font-medium tracking-wide">
            Attended <span className="text-amber-400 font-bold">{data.stats.attendedSessions}</span> out of <span className="text-slate-200 font-semibold">{data.stats.totalSessions}</span> completed metrics
          </p>
        </div>

      <div className="bg-slate-900/80 rounded-2xl shadow-2xl border border-slate-800/80 overflow-hidden">
          <div className="border-b border-slate-850 px-6 py-4 bg-slate-950/20 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
           Past Attendance Record
            </h2>
            
          </div>

          <div className="divide-y divide-slate-850 max-h-[26rem] overflow-y-auto custom-scrollbar">
            {data.history.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-10 font-medium italic tracking-wide">
                No verified system logs documented for this subject configuration.
              </p>
            ) : (
              data.history.map((row, idx) => (
                <div
                  key={row.recordId || idx}
                  className="flex items-center justify-between px-6 py-4 text-sm hover:bg-slate-850/30 transition duration-75 group"
                >
                  <div className="flex flex-col space-y-0.5 min-w-0">
                    <span className="font-mono font-semibold text-slate-200 tracking-wide">
                      {row.sessionDate}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">
                      {row.sessionType.toLowerCase()} 
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border shadow-sm ${
                      row.status === "PRESENT"
                        ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40 shadow-emerald-950/30"
                        : "bg-rose-950/40 text-rose-400 border-rose-900/40 shadow-rose-950/30"
                    }`}
                  >
                    {row.status.toLowerCase()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}