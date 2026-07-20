"use strict";
"use client";

import { useState, useMemo } from "react";
import { AttendanceHistory } from "../teacher/students-detail/page";

type FilterType = "ALL" | "LECTURE" | "LAB";

export default function AttendanceExplorer({ history }: { history: AttendanceHistory[] }) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");

  // Group unique students from the log dataset safely
  const studentsMap = useMemo(() => {
    const map = new Map<string, { id: string; roll: string; name: string; email: string; records: AttendanceHistory[] }>();
    
    history.forEach((record) => {
      if (!map.has(record.studentId)) {
        map.set(record.studentId, {
          id: record.studentId,
          roll: record.sectionRollNo,
          name: `${record.firstName} ${record.lastName}`,
          email: record.email,
          records: [],
        });
      }
      map.get(record.studentId)!.records.push(record);
    });

    return Array.from(map.values()).sort((a, b) => a.roll.localeCompare(b.roll, undefined, { numeric: true }));
  }, [history]);

  // Find currently chosen student metadata context
  const currentStudent = useMemo(() => {
    return studentsMap.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, studentsMap]);

  // Extract unique subjects for the selected student context
  const availableSubjects = useMemo(() => {
    if (!currentStudent) return [];
    const map = new Map<string, { name: string; code: string }>();
    
    currentStudent.records.forEach((rec) => {
      if (!map.has(rec.subjectCode)) {
        map.set(rec.subjectCode, { name: rec.subjectName, code: rec.subjectCode });
      }
    });
    
    return Array.from(map.values());
  }, [currentStudent]);

  // Filter and chronologically sort logs for the active Student + Subject + Session Type selection
  const filteredTimelineLogs = useMemo(() => {
    if (!currentStudent || !selectedSubjectCode) return [];
    
    return currentStudent.records
      .filter((rec) => {
        const matchesSubject = rec.subjectCode === selectedSubjectCode;
        if (!matchesSubject) return false;
        
        if (typeFilter === "ALL") return true;
        return rec.sessionType.toUpperCase() === typeFilter;
      })
      .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
  }, [currentStudent, selectedSubjectCode, typeFilter]);

  // Reset dependent selection criteria when changing target students
  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSelectedSubjectCode(null);
    setTypeFilter("ALL");
  };

  // Reset type segmentation safely when switching subjects
  const handleSubjectSelect = (code: string) => {
    setSelectedSubjectCode(code);
    setTypeFilter("ALL");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* COLUMN 1: Student Roster Select Panel */}
      <div className="lg:col-span-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col h-[650px]">
        <div className="border-b border-slate-800 px-5 py-4 bg-slate-950/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Student Profiles</h2>
          </div>
          <span className="text-[12px] text-slate-500 font-semibold">{studentsMap.length} Total</span>
        </div>
        
        <div className="divide-y divide-slate-850 overflow-y-auto custom-scrollbar flex-1">
          {studentsMap.map((student) => {
            const isSelected = student.id === selectedStudentId;
            return (
              <button
                key={student.id}
                onClick={() => handleStudentSelect(student.id)}
                className={`w-full text-left px-5 py-3.5 transition flex items-center gap-3 group relative ${
                  isSelected ? "bg-slate-850/70" : "hover:bg-slate-850/20"
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                )}
                <span className="font-mono text-sm text-amber-500 font-bold bg-amber-950/30 border border-amber-900/30 px-1.5 py-0.5 rounded shrink-0">
                  #{student.roll}
                </span>
                <div className="min-w-0">
                  <p className={`font-medium text-md transition truncate ${isSelected ? "text-amber-400" : "text-slate-200 group-hover:text-white"}`}>
                    {student.name}
                  </p>
                  <p className="text-sm text-slate-500 truncate">{student.email}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* COLUMN 2 & 3: Filter controls and output Timeline */}
      <div className="lg:col-span-8 space-y-6 flex flex-col h-[650px]">
        
        {/* STEP A: Select Subject & Session Type Filter Layout */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 p-5 flex flex-col gap-4 shrink-0">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${selectedStudentId ? 'bg-amber-500' : 'bg-slate-700'}`}></span>
              Subject Selection
            </h2>
            
            {!selectedStudentId ? (
              <p className="text-md text-slate-500 italic py-1">Select a student from the left panel to display courses.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar p-0.5">
                {availableSubjects.map((subject) => {
                  const isSubSelected = subject.code === selectedSubjectCode;
                  return (
                    <button
                      key={subject.code}
                      onClick={() => handleSubjectSelect(subject.code)}
                      className={`text-xs px-3 py-2 rounded-xl font-medium border transition duration-150 text-left ${
                        isSubSelected
                          ? "bg-amber-950/40 text-amber-400 border-amber-500/50 shadow-sm shadow-amber-950"
                          : "bg-slate-950 text-slate-400 border-slate-850 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <span className="font-mono block text-[11px] opacity-80 tracking-wide uppercase">{subject.code}</span>
                      {subject.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* New Session Type Filter Array */}
          {selectedSubjectCode && (
            <div className="border-t border-slate-850/60 pt-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Session Classification</h3>
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
            </div>
          )}
        </div>

        {/* STEP B: Class History Timeline Stream View */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="border-b border-slate-800 px-6 py-4 bg-slate-950/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${selectedSubjectCode ? 'bg-emerald-500' : 'bg-slate-700'}`}></span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Verified Historical Sessions
              </h2>
            </div>
            {selectedSubjectCode && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 uppercase tracking-wider">
                {filteredTimelineLogs.length} Classes Listed
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-850/60 overflow-y-auto custom-scrollbar flex-1 bg-slate-950/10">
            {!selectedStudentId ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <p className="text-xl text-slate-600 font-medium italic">
                  Waiting for student selection.
                </p>
              </div>
            ) : !selectedSubjectCode ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <p className="text-xl text-slate-500 font-medium italic">
                  Select a subject to get the record
                </p>
              </div>
            ) : filteredTimelineLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <p className="text-xl text-slate-500 font-medium italic">
                  No classes found for {typeFilter}
                </p>
              </div>
            ) : (
              filteredTimelineLogs.map((record, index) => {
                const isPresent = record.attendanceStatus.toUpperCase() === "PRESENT";
                return (
                  <div
                    key={`${record.studentId}-${index}`}
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
  );
}