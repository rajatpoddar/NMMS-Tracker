"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, MapPin, Camera, CheckCircle2,
  XCircle, Loader2, AlertCircle, Users, FileText,
} from "lucide-react";
import { formatDate, todayISO } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Worker {
  id: number;
  sno: number;
  jobCardNo: string;
  workerName: string;
  gender: string | null;
  isPresent: boolean;
}

interface MusterRoll {
  id: number;
  msrNo: string;
  workCode: string;
  workName: string | null;
  totalWorkers: number;
  presentCount: number;
  absentCount: number;
  photo1Url: string | null;
  photo1TakenAt: string | null;
  photo1UploadedAt: string | null;
  photo1TakenBy: string | null;
  photo1Designation: string | null;
  photo2Url: string | null;
  photo2TakenAt: string | null;
  photo2UploadedAt: string | null;
  workers: Worker[];
}

// ─── Photo Thumbnail ──────────────────────────────────────────────────────────
function PhotoThumb({
  url,
  label,
  takenAt,
  uploadedAt,
  takenBy,
}: {
  url: string;
  label: string;
  takenAt?: string | null;
  uploadedAt?: string | null;
  takenBy?: string | null;
}) {
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => !err && setOpen(true)}
          className="relative group"
          title={label}
        >
          {err ? (
            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
              <Camera className="h-5 w-5 text-slate-300" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="w-16 h-16 object-cover rounded-lg border border-slate-200 group-hover:ring-2 group-hover:ring-blue-400 transition-all cursor-zoom-in"
              onError={() => setErr(true)}
            />
          )}
          {!err && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {label.includes("1") ? "1" : "2"}
            </span>
          )}
        </button>
        {takenAt && (
          <span className="text-[9px] text-slate-400 text-center leading-tight max-w-[4rem]">
            {takenAt.split(" ").slice(0, 2).join(" ")}
          </span>
        )}
        {uploadedAt && (
          <span className="text-[9px] text-slate-400 text-center leading-tight max-w-[4rem]">
            ↑ {uploadedAt.split(" ").slice(0, 2).join(" ")}
          </span>
        )}
        {takenBy && (
          <span className="text-[9px] text-slate-500 text-center leading-tight max-w-[4rem] font-medium">
            {takenBy}
          </span>
        )}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="w-full rounded-xl shadow-2xl" />
            <div className="mt-3 text-center text-white text-sm space-y-1">
              <p className="font-semibold">{label}</p>
              {takenAt && <p className="text-white/70 text-xs">Taken: {takenAt}</p>}
              {uploadedAt && <p className="text-white/70 text-xs">Uploaded: {uploadedAt}</p>}
              {takenBy && <p className="text-white/70 text-xs">By: {takenBy}</p>}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PanchayatSheetPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const panchayatCode = params.panchayatCode as string;
  const dateParam = searchParams.get("date") || todayISO();

  const [date, setDate] = useState(dateParam);
  const [data, setData] = useState<{
    musterRolls: MusterRoll[];
    panchayatName: string;
    blockName: string;
    districtName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (d: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/muster-rolls/panchayat/${panchayatCode}?date=${d}`
        );
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    [panchayatCode]
  );

  useEffect(() => {
    fetchData(date);
  }, [date, fetchData]);

  // Totals
  const totals = data?.musterRolls.reduce(
    (acc, mr) => ({
      workers: acc.workers + mr.totalWorkers,
      present: acc.present + mr.presentCount,
      absent: acc.absent + mr.absentCount,
    }),
    { workers: 0, present: 0, absent: 0 }
  );

  // Flatten all workers across all MRs for the big sheet
  const allRows = data?.musterRolls.flatMap((mr) =>
    mr.workers.map((w) => ({ ...w, mr }))
  ) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>

          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
            ) : (
              <>
                <h1 className="text-sm font-bold text-slate-800 truncate">
                  {data?.panchayatName || panchayatCode}
                </h1>
                <p className="text-xs text-slate-400">
                  {data?.blockName} · {data?.districtName}
                </p>
              </>
            )}
          </div>

          {/* Date picker */}
          <div className="relative flex-shrink-0">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 pl-8 pr-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        {/* ── Date + KPI strip ── */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <MapPin className="h-4 w-4 text-blue-500" />
            <span className="font-semibold">{formatDate(date)}</span>
          </div>

          {!loading && totals && (
            <div className="flex flex-wrap gap-2 ml-auto">
              <span className="flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <FileText className="h-3.5 w-3.5" />
                {data?.musterRolls.length} MRs
              </span>
              <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Users className="h-3.5 w-3.5" />
                {totals.workers} Workers
              </span>
              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {totals.present} Present
              </span>
              <span className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full">
                <XCircle className="h-3.5 w-3.5" />
                {totals.absent} Absent
              </span>
            </div>
          )}
        </div>

        {/* ── States ── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && data?.musterRolls.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No muster rolls for {formatDate(date)}</p>
          </div>
        )}

        {/* ── Main Sheet Table ── */}
        {!loading && !error && allRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Title bar */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-3">
              <h2 className="text-white font-semibold text-sm">
                Attendance Sheet — {data?.panchayatName}
              </h2>
              <p className="text-blue-200 text-xs mt-0.5">
                {formatDate(date)} · {allRows.length} worker records
              </p>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10">
                      S.No
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      MR No.
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Work Name / Code
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Worker Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Job Card No.
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Gender
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Morning Photo
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      Afternoon Photo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allRows.map((row, idx) => {
                    const isFirstInMR =
                      idx === 0 || allRows[idx - 1].mr.id !== row.mr.id;
                    const mrRowSpan = row.mr.workers.length;

                    return (
                      <tr
                        key={`${row.mr.id}-${row.id}`}
                        className={`${
                          row.isPresent ? "hover:bg-slate-50" : "bg-red-50/30 hover:bg-red-50/50"
                        } transition-colors`}
                      >
                        {/* S.No */}
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                          {idx + 1}
                        </td>

                        {/* MR No — rowspan for first row of each MR */}
                        {isFirstInMR && (
                          <td
                            rowSpan={mrRowSpan}
                            className="px-4 py-3 align-top border-r border-slate-100"
                          >
                            <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap">
                              #{row.mr.msrNo}
                            </span>
                          </td>
                        )}

                        {/* Work Name — rowspan */}
                        {isFirstInMR && (
                          <td
                            rowSpan={mrRowSpan}
                            className="px-4 py-3 align-top border-r border-slate-100 max-w-[220px]"
                          >
                            <p className="text-xs font-medium text-slate-700 leading-snug line-clamp-3">
                              {row.mr.workName || "—"}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1 font-mono break-all">
                              {row.mr.workCode}
                            </p>
                            <div className="mt-2 flex gap-2 text-[10px]">
                              <span className="text-emerald-600 font-semibold">
                                ✓ {row.mr.presentCount}
                              </span>
                              <span className="text-red-500 font-semibold">
                                ✗ {row.mr.absentCount}
                              </span>
                              <span className="text-slate-400">
                                / {row.mr.totalWorkers}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Worker Name */}
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800 whitespace-nowrap">
                            {row.workerName}
                          </p>
                        </td>

                        {/* Job Card */}
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-500 font-mono whitespace-nowrap">
                            {row.jobCardNo}
                          </p>
                        </td>

                        {/* Gender */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              row.gender === "F"
                                ? "bg-pink-50 text-pink-600"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {row.gender || "—"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          {row.isPresent ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="h-3 w-3" /> Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                              <XCircle className="h-3 w-3" /> Absent
                            </span>
                          )}
                        </td>

                        {/* Morning Photo — rowspan */}
                        {isFirstInMR && (
                          <td
                            rowSpan={mrRowSpan}
                            className="px-4 py-3 align-middle text-center border-l border-slate-100"
                          >
                            {row.mr.photo1Url ? (
                              <PhotoThumb
                                url={row.mr.photo1Url}
                                label="Morning Photo"
                                takenAt={row.mr.photo1TakenAt}
                                uploadedAt={row.mr.photo1UploadedAt}
                                takenBy={row.mr.photo1TakenBy}
                              />
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        )}

                        {/* Afternoon Photo — rowspan */}
                        {isFirstInMR && (
                          <td
                            rowSpan={mrRowSpan}
                            className="px-4 py-3 align-middle text-center border-l border-slate-100"
                          >
                            {row.mr.photo2Url ? (
                              <PhotoThumb
                                url={row.mr.photo2Url}
                                label="Afternoon Photo"
                                takenAt={row.mr.photo2TakenAt}
                                uploadedAt={row.mr.photo2UploadedAt}
                              />
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer totals */}
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">
                      Total
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-bold text-emerald-600">
                          ✓ {totals?.present}
                        </span>
                        <span className="text-xs font-bold text-red-500">
                          ✗ {totals?.absent}
                        </span>
                      </div>
                    </td>
                    <td colSpan={2} className="px-4 py-3 text-center text-xs text-slate-400">
                      {totals?.workers} workers
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Per-MR Photo Gallery (below table) ── */}
        {!loading && !error && data && data.musterRolls.some(mr => mr.photo1Url || mr.photo2Url) && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-500" />
              Site Photos — All Muster Rolls
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.musterRolls
                .filter((mr) => mr.photo1Url || mr.photo2Url)
                .map((mr) => (
                  <div
                    key={mr.id}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-white text-xs font-semibold">MR #{mr.msrNo}</span>
                      <span className="text-slate-300 text-[10px]">
                        {mr.presentCount}/{mr.totalWorkers} present
                      </span>
                    </div>
                    <p className="px-4 pt-3 pb-1 text-xs text-slate-500 line-clamp-2 leading-snug">
                      {mr.workName || mr.workCode}
                    </p>
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {mr.photo1Url ? (
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Morning
                          </p>
                          <PhotoThumb
                            url={mr.photo1Url}
                            label="Morning Photo"
                            takenAt={mr.photo1TakenAt}
                            uploadedAt={mr.photo1UploadedAt}
                            takenBy={mr.photo1TakenBy}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 bg-slate-50 rounded-lg text-slate-300 text-xs">
                          <Camera className="h-5 w-5 mb-1" />
                          No morning photo
                        </div>
                      )}
                      {mr.photo2Url ? (
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Afternoon
                          </p>
                          <PhotoThumb
                            url={mr.photo2Url}
                            label="Afternoon Photo"
                            takenAt={mr.photo2TakenAt}
                            uploadedAt={mr.photo2UploadedAt}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 bg-slate-50 rounded-lg text-slate-300 text-xs">
                          <Camera className="h-5 w-5 mb-1" />
                          No afternoon photo
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
