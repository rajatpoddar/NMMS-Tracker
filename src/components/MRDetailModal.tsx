"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, MapPin, Calendar, Hash,
  Camera, Clock, Navigation, User, Loader2, AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Worker {
  id: number;
  sno: number;
  jobCardNo: string;
  workerName: string;
  gender: string | null;
  attendanceDate: string;
  isPresent: boolean;
}

interface MusterRollDetail {
  id: number;
  attendanceDate: string;
  districtName: string;
  blockName: string;
  panchayatName: string;
  workCode: string;
  msrNo: string;
  workName: string | null;
  totalWorkers: number;
  presentCount: number;
  absentCount: number;
  photo1Url: string | null;
  photo1TakenAt: string | null;
  photo1UploadedAt: string | null;
  photo1Coords: string | null;
  photo1TakenBy: string | null;
  photo1Designation: string | null;
  photo2Url: string | null;
  photo2TakenAt: string | null;
  photo2UploadedAt: string | null;
  photo2Coords: string | null;
  workers: Worker[];
}

interface Props {
  mrId: number;
  open: boolean;
  onClose: () => void;
}

function PhotoCard({
  label,
  url,
  takenAt,
  uploadedAt,
  coords,
  takenBy,
  designation,
}: {
  label: string;
  url: string;
  takenAt?: string | null;
  uploadedAt?: string | null;
  coords?: string | null;
  takenBy?: string | null;
  designation?: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-white" />
          <span className="text-xs font-semibold text-white">{label}</span>
        </div>
      </div>

      {/* Photo */}
      <div className="relative bg-slate-100">
        {imgError ? (
          <div className="h-48 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Image unavailable</p>
            </div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="w-full h-48 object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-1.5">
        {takenAt && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Clock className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span><span className="text-slate-400">Taken:</span> {takenAt}</span>
          </div>
        )}
        {uploadedAt && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Clock className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span><span className="text-slate-400">Uploaded:</span> {uploadedAt}</span>
          </div>
        )}
        {coords && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Navigation className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <a
              href={`https://maps.google.com/?q=${coords}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline truncate"
            >
              {coords}
            </a>
          </div>
        )}
        {takenBy && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span>{takenBy}{designation ? ` · ${designation}` : ""}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MRDetailModal({ mrId, open, onClose }: Props) {
  const [mr, setMr] = useState<MusterRollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/muster-rolls/${mrId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setMr(data.musterRoll);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [mrId, open]);

  const attendancePct =
    mr && mr.totalWorkers > 0
      ? Math.round((mr.presentCount / mr.totalWorkers) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-full p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        ) : mr ? (
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-t-2xl">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold bg-white/20 text-white px-2.5 py-1 rounded-full">
                    MR #{mr.msrNo}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    attendancePct >= 80 ? "bg-emerald-400/30 text-emerald-100" :
                    attendancePct >= 50 ? "bg-amber-400/30 text-amber-100" :
                    "bg-red-400/30 text-red-100"
                  }`}>
                    {attendancePct}% present
                  </span>
                </div>
                <DialogTitle className="text-white text-base leading-snug">
                  {mr.workName || mr.workCode}
                </DialogTitle>
                <DialogDescription className="text-blue-200 text-xs mt-1">
                  {mr.workCode}
                </DialogDescription>
              </DialogHeader>

              {/* Location row */}
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 text-blue-100 text-xs">
                  <MapPin className="h-3 w-3" />
                  <span>{mr.panchayatName} · {mr.blockName} · {mr.districtName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-100 text-xs">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(mr.attendanceDate)}</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Total", value: mr.totalWorkers, color: "bg-white/20 text-white" },
                  { label: "Present", value: mr.presentCount, color: "bg-emerald-400/30 text-emerald-100" },
                  { label: "Absent", value: mr.absentCount, color: "bg-red-400/30 text-red-100" },
                ].map((s) => (
                  <div key={s.label} className={`${s.color} rounded-xl py-2.5 text-center`}>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-[10px] uppercase tracking-wide opacity-80">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-5">
              {/* Photos */}
              {(mr.photo1Url || mr.photo2Url) && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" /> Site Photos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mr.photo1Url && (
                      <PhotoCard
                        label="Group Photo 1"
                        url={mr.photo1Url}
                        takenAt={mr.photo1TakenAt}
                        uploadedAt={mr.photo1UploadedAt}
                        coords={mr.photo1Coords}
                        takenBy={mr.photo1TakenBy}
                        designation={mr.photo1Designation}
                      />
                    )}
                    {mr.photo2Url && (
                      <PhotoCard
                        label="Group Photo 2"
                        url={mr.photo2Url}
                        takenAt={mr.photo2TakenAt}
                        uploadedAt={mr.photo2UploadedAt}
                        coords={mr.photo2Coords}
                      />
                    )}
                  </div>
                </section>
              )}

              {/* Worker Table */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Worker Attendance ({mr.workers.length})
                </h3>

                {mr.workers.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No worker records found
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[2rem_1fr_auto] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      <span>#</span>
                      <span>Worker</span>
                      <span>Status</span>
                    </div>
                    {/* Rows */}
                    <div className="divide-y divide-slate-50">
                      {mr.workers.map((w) => (
                        <div
                          key={w.id}
                          className={`grid grid-cols-[2rem_1fr_auto] gap-2 items-center px-3 py-2.5 ${
                            w.isPresent ? "bg-white" : "bg-red-50/40"
                          }`}
                        >
                          <span className="text-xs text-slate-400 font-mono">{w.sno}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {w.workerName}
                              {w.gender && (
                                <span className="ml-1 text-[10px] text-slate-400">
                                  ({w.gender})
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Hash className="h-2.5 w-2.5 text-slate-300" />
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                {w.jobCardNo}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={w.isPresent ? "success" : "destructive"}
                            className="text-[10px] px-2 py-0.5"
                          >
                            {w.isPresent ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" /> P
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <XCircle className="h-2.5 w-2.5" /> A
                              </span>
                            )}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
