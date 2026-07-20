"use strict";
"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface HistoryRecord {
  sessionId: string;
  sessionDate: string;
  sessionType: string;
  attendanceStatus: string;
  markedAt: string | null;
  subjectCode: string;
  subjectName: string;
}

interface StudentMeta {
  id: string;
  rollNo: string;
  name: string;
  email?: string;
}

interface AttendancePayload {
  student: StudentMeta;
  filteredRecordsCount: number;
  history: HistoryRecord[];
}

type FilterType = "ALL" | "LECTURE" | "LAB";

export default function StudentAttendanceDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = searchParams.get("studentId");

  const [data, setData] = useState<AttendancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");

  // Fetch student records from the updated global route endpoint
  useEffect(() => {
 
    fetch(`/api/attendance/student/details?studentId=${studentId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not acquire your statement records.");
        return res.json();
      })
      .then((payload) => setData(payload))
      .catch((err) => setError(err.message || "Something went wrong."))
      .finally(() => setLoading(false));
  }, [studentId]);

  // Global Performance Matrix Metrics
  const globalMetrics = useMemo(() => {
    if (!data || data.history.length === 0) return { present: 0, absent: 0, percentage: 0 };
    
    let presentCount = 0;
    data.history.forEach((rec) => {
      if (rec.attendanceStatus.toUpperCase() === "PRESENT") presentCount++;
    });

    const total = data.history.length;
    return {
      present: presentCount,
      absent: total - presentCount,
      percentage: parseFloat(((presentCount / total) * 100).toFixed(1)),
    };
  }, [data]);

  // Aggregate Metrics grouped dynamically by individual course identities
  const subjectsMap = useMemo(() => {
    if (!data) return new Map();
    const map = new Map<string, { code: string; name: string; total: number; present: number }>();

    data.history.forEach((rec) => {
      if (!map.has(rec.subjectCode)) {
        map.set(rec.subjectCode, {
          code: rec.subjectCode,
          name: rec.subjectName,
          total: 0,
          present: 0,
        });
      }
      const item = map.get(rec.subjectCode)!;
      item.total++;
      if (rec.attendanceStatus.toUpperCase() === "PRESENT") {
        item.present++;
      }
    });
    return map;
  }, [data]);

  const availableSubjects = useMemo(() => Array.from(subjectsMap.values()), [subjectsMap]);

  // Detailed Course Specific Metric Layout Panel Values
  const activeSubjectMetrics = useMemo(() => {
    if (!selectedSubjectCode || !subjectsMap.has(selectedSubjectCode)) return null;
    const item = subjectsMap.get(selectedSubjectCode)!;
    return {
      present: item.present,
      absent: item.total - item.present,
      percentage: parseFloat(((item.present / item.total) * 100).toFixed(1)),
    };
  }, [selectedSubjectCode, subjectsMap]);

  // Filter dynamic logs history timeline for selected courses
  const filteredTimelineLogs = useMemo(() => {
    if (!data || !selectedSubjectCode) return [];
    
    return data.history
      .filter((rec) => {
        const matchesSubject = rec.subjectCode === selectedSubjectCode;
        if (!matchesSubject) return false;
        
        if (typeFilter === "ALL") return true;
        return rec.sessionType.toUpperCase() === typeFilter;
      })
      .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
  }, [data, selectedSubjectCode, typeFilter]);

  const handleSubjectSelect = (code: string) => {
    setSelectedSubjectCode(code);
    setTypeFilter("ALL");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-400">
        <div className="animate-pulse text-xs font-bold tracking-widest uppercase text-amber-500/80">
          Querying Comprehensive Ledgers…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 text-slate-100">
        <div className="max-w-md w-full mx-auto bg-slate-900/60 backdrop-blur-md p-8 border border-slate-800 rounded-2xl text-center space-y-4 shadow-2xl">
          <div className="text-xs font-bold tracking-widest uppercase text-rose-500">ledger status anomaly</div>
          <h1 className="text-xl font-bold tracking-tight text-white">{error || "Data Unavailable"}</h1>
          <button onClick={() => router.back()} className="text-xs text-amber-500 hover:text-amber-400 font-bold transition underline">
            ← Return to Live Streams Terminal
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 selection:bg-amber-500/20 selection:text-amber-200">
      <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-start">
                    <button onClick={() => router.back()} className="text-xs text-amber-500 hover:text-amber-400 font-bold transition flex items-center gap-1">
                        ← Return to Live Attendance
                    </button>
                </div>
        {/* Profile and High-Level Matrix Performance Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-500 font-mono text-base">
              {data.student.name?.[0] || "S"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black tracking-tight text-slate-100">{data.student.name}</h1>
                <span className="text-[10px] font-mono tracking-widest font-bold uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-slate-400">
                  {data.student.rollNo}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm font-mono text-slate-500">
                {data.student.email && (
                  <>
                    <p>Enrolled Matrix: <span className="text-slate-400 text-lg">{data.student.email}</span></p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Aggregated Dynamic Scoreboards cards */}
          <div className="flex flex-col gap-2">
  <span className="text-[12px]   tracking-widest font-bold uppercase text-slate-500 px-1">
    Overall Metric Matrix
  </span>
  <div className="flex flex-wrap items-center gap-4 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
    <div className="px-4 py-2 border-r border-slate-850 text-center">
      <span className="text-[12px] font-mono tracking-wider text-slate-500 uppercase block">Present</span>
      <span className="text-xl font-black font-mono text-emerald-400">{globalMetrics.present}</span>
    </div>
    <div className="px-4 py-2 border-r border-slate-850 text-center">
      <span className="text-[12px] font-mono tracking-wider text-slate-500 uppercase block">Absent</span>
      <span className="text-xl font-black font-mono text-rose-400">{globalMetrics.absent}</span>
    </div>
    <div className="px-4 py-2 text-center min-w-[100px]">
      <span className="text-[12px] font-mono tracking-wider text-slate-500 uppercase block">Net Standing</span>
      <span className={`text-xl font-black font-mono ${globalMetrics.percentage >= 75 ? 'text-emerald-400' : 'text-amber-500'}`}>
        {globalMetrics.percentage}%
      </span>
    </div>
  </div>
</div>
        </div>

        {/* Core Workspace Splitting Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* COLUMN 1: Subject Roster Select Panel */}
          <div className="lg:col-span-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-[650px]">
            <div className="border-b border-slate-800 px-5 py-4 bg-slate-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Enrolled Courses</h2>
              </div>
              <span className="text-[12px] text-slate-500 font-semibold">{availableSubjects.length} Subjects</span>
            </div>
            
            <div className="divide-y divide-slate-850 overflow-y-auto custom-scrollbar flex-1">
              {availableSubjects.map((subject) => {
                const isSelected = subject.code === selectedSubjectCode;
                const pct = parseFloat(((subject.present / subject.total) * 100).toFixed(1));
                
                return (
                  <button
                    key={subject.code}
                    onClick={() => handleSubjectSelect(subject.code)}
                    className={`w-full text-left px-5 py-3.5 transition flex flex-col gap-2 group relative ${
                      isSelected ? "bg-slate-850/70" : "hover:bg-slate-850/20"
                    }`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}
                    <div className="flex justify-between items-start gap-3 w-full">
                      <span className="font-mono text-sm text-amber-500 font-bold bg-amber-950/30 border border-amber-900/30 px-1.5 py-0.5 rounded shrink-0">
                        {subject.code}
                      </span>
                      <span className={`text-xs font-mono font-bold ${pct >= 75 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {pct}% Attendance
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className={`font-medium text-md transition truncate ${isSelected ? "text-amber-400" : "text-slate-200 group-hover:text-white"}`}>
                        {subject.name}
                      </p>
                      <div className="flex gap-3 text-sm font-mono text-slate-500 mt-1">
                        <span>P: <span className="text-slate-400">{subject.present}</span></span>
                        <span>A: <span className="text-slate-400">{subject.total - subject.present}</span></span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* COLUMN 2 & 3: Filter controls and output Course Timeline Details */}
          <div className="lg:col-span-8 space-y-6 flex flex-col h-[650px]">
            
            {/* Subject Specific Metric Analysis Block Card */}
            {selectedSubjectCode && activeSubjectMetrics && (
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 p-5 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-900 to-slate-950">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Course Focus Target</h3>
                  <p className="text-lg font-black text-amber-400 mt-1">{selectedSubjectCode}</p>
                </div>
                <div className="flex gap-6 font-mono text-xs">
                  <div className="text-center">
                    <span className="text-[12px] text-slate-500 block uppercase font-bold">Present</span>
                    <span className="text-emerald-400 text-lg font-bold">{activeSubjectMetrics.present}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[12px] text-slate-500 block uppercase font-bold">Absent</span>
                    <span className="text-rose-400 text-lg font-bold">{activeSubjectMetrics.absent}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[12px] text-slate-500 block uppercase font-bold">Standing</span>
                    <span className={`text-lg font-bold ${activeSubjectMetrics.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {activeSubjectMetrics.percentage}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP A: Session Classification Segmenter Controls */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 p-5 flex flex-col gap-3 shrink-0">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Session Classification</h3>
              {!selectedSubjectCode ? (
                <p className="text-md text-slate-500 italic py-1">Select a subject to get your performance.</p>
              ) : (
                <div className="flex gap-2">
                  {(["ALL", "LECTURE", "LAB"] as FilterType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs uppercase border tracking-wider transition duration-150 ${
                        typeFilter === type
                          ? "bg-slate-800 text-amber-400 border-slate-700 shadow-inner"
                          : "bg-slate-950 text-slate-500 border-slate-850 hover:border-slate-850 hover:text-slate-300"
                      }`}
                    >
                      {type === "ALL" ? "All Sessions" : type.toLowerCase() + "s"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* STEP B: Class History Timeline Stream View */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="border-b border-slate-800 px-6 py-4 bg-slate-950/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedSubjectCode ? 'bg-emerald-500' : 'bg-slate-700'}`}></span>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Verified Session Timeline</h2>
                </div>
                {selectedSubjectCode && (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 uppercase tracking-wider">
                    {filteredTimelineLogs.length} Classes Listed
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-850/60 overflow-y-auto custom-scrollbar flex-1 bg-slate-950/10">
                {!selectedSubjectCode ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <p className="text-xl text-slate-500 font-medium italic">
                      Select a subject to check record.
                    </p>
                  </div>
                ) : filteredTimelineLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <p className="text-xl text-slate-500 font-medium italic">
                      No classes found mapped for status {typeFilter}
                    </p>
                  </div>
                ) : (
                  filteredTimelineLogs.map((record, index) => {
                    const isPresent = record.attendanceStatus.toUpperCase() === "PRESENT";
                    return (
                      <div
                        key={`${record.sessionId}-${index}`}
                        className="flex items-center justify-between gap-4 px-6 py-4 text-sm hover:bg-slate-850/30 transition duration-150 group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex h-9 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-950 font-mono text-[12px] font-bold text-slate-300 border border-slate-850 group-hover:border-slate-700 transition duration-150">
                            {new Date(record.sessionDate).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="min-w-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-950 text-slate-400 border border-slate-850">
                              {record.sessionType.toLowerCase()}
                            </span>
                            <p className="text-[12px] text-slate-500 mt-1 hidden sm:block">
                              Marked At: {record.markedAt ? new Date(record.markedAt).toLocaleString(undefined, {hour:'2-digit', minute:'2-digit', second:'2-digit'}) : "Not Marked"}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center justify-center w-24 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase border shadow-sm transition duration-150 shrink-0 ${
                            isPresent
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40 shadow-emerald-950/20 group-hover:bg-emerald-900/30"
                              : "bg-rose-950/40 text-rose-400 border-rose-900/40 shadow-rose-950/20 group-hover:bg-rose-900/30"
                          }`}
                        >
                          {record.attendanceStatus.toLowerCase()}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}