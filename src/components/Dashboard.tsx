"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Users, CheckCircle2, XCircle, MapPin, RefreshCw,
  Clock, AlertCircle, CheckCheck, Loader2, Calendar,
  TrendingUp, Building2, FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MRDetailModal from "@/components/MRDetailModal";
import { formatDate, todayISO } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPI {
  totalPanchayats: number;
  totalMRs: number;
  totalPresent: number;
  totalAbsent: number;
  totalWorkers: number;
}

interface PanchayatRow {
  panchayatCode: string;
  panchayatName: string;
  districtName: string;
  blockName: string;
  mrCount: number;
  presentCount: number;
  absentCount: number;
  totalWorkers: number;
}

interface MRRow {
  id: number;
  msrNo: string;
  workCode: string;
  workName: string | null;
  panchayatName: string;
  blockName: string;
  districtName: string;
  totalWorkers: number;
  presentCount: number;
  absentCount: number;
  photo1Url: string | null;
  photo2Url: string | null;
}

interface ScrapeStatus {
  status: "none" | "running" | "success" | "partial" | "failed";
  date?: string;
  totalMRs?: number;
  processedMRs?: number;
  failedMRs?: number;
  percentComplete?: number | null;
  elapsedSeconds?: number | null;
  estimatedSecondsRemaining?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  message?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function attendancePct(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

// ─── Scrape Status Banner ─────────────────────────────────────────────────────

function ScrapeBanner({
  status,
  date,
  onScrape,
  scraping,
}: {
  status: ScrapeStatus;
  date: string;
  onScrape: () => void;
  scraping: boolean;
}) {
  const isToday = date === todayISO();
  const pct = status.percentComplete ?? 0;

  // Already done
  if (status.status === "success" || status.status === "partial") {
    const completedAt = status.completedAt
      ? new Date(status.completedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : null;
    return (
      <div className={`rounded-2xl p-4 flex items-center gap-3 ${
        status.status === "success"
          ? "bg-emerald-50 border border-emerald-200"
          : "bg-amber-50 border border-amber-200"
      }`}>
        <CheckCheck className={`h-5 w-5 flex-shrink-0 ${
          status.status === "success" ? "text-emerald-600" : "text-amber-600"
        }`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${
            status.status === "success" ? "text-emerald-800" : "text-amber-800"
          }`}>
            {status.status === "success" ? "Data fetched successfully" : "Partial data fetched"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {status.totalMRs} MRs scraped
            {status.failedMRs ? `, ${status.failedMRs} failed` : ""}
            {completedAt ? ` · Completed at ${completedAt}` : ""}
          </p>
        </div>
        <Badge variant="outline" className="text-xs text-slate-500 flex-shrink-0">
          Locked
        </Badge>
      </div>
    );
  }

  // Currently running
  if (status.status === "running" || scraping) {
    const elapsed = status.elapsedSeconds;
    const eta = status.estimatedSecondsRemaining;
    const processed = status.processedMRs ?? 0;
    const total = status.totalMRs ?? 0;

    return (
      <div className="rounded-2xl p-4 bg-blue-50 border border-blue-200">
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800">
              Fetching data from MGNREGA portal…
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {total > 0
                ? `${processed} of ${total} muster rolls processed`
                : "Connecting to portal, please wait…"}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-blue-100 rounded-full h-2 mb-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(pct, total > 0 ? 2 : 0)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-blue-600">
          <span>{total > 0 ? `${pct}% complete` : "Starting…"}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {eta != null && eta > 0
              ? `~${fmtDuration(eta)} remaining`
              : elapsed != null
              ? `${fmtDuration(elapsed)} elapsed`
              : "Estimating time…"}
          </span>
        </div>

        {total > 0 && (
          <p className="text-[11px] text-blue-400 mt-2 text-center">
            Please keep this page open. Data will appear automatically as it loads.
          </p>
        )}
      </div>
    );
  }

  // Failed
  if (status.status === "failed") {
    return (
      <div className="rounded-2xl p-4 bg-red-50 border border-red-200">
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Fetch failed</p>
            {status.message && (
              <p className="text-xs text-red-600 mt-0.5 truncate">{status.message}</p>
            )}
          </div>
        </div>
        {isToday && (
          <Button
            size="sm"
            variant="outline"
            onClick={onScrape}
            disabled={scraping}
            className="w-full border-red-200 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry Fetch
          </Button>
        )}
      </div>
    );
  }

  // No data yet — show fetch button
  return (
    <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-3 mb-3">
        <FileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-700">
            No data for {formatDate(date)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {isToday
              ? "Fetch today's muster roll data from the MGNREGA portal."
              : "No data was fetched for this date."}
          </p>
        </div>
      </div>
      {isToday && (
        <Button
          size="sm"
          onClick={onScrape}
          disabled={scraping}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {scraping ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Starting…</>
          ) : (
            <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Fetch Today&apos;s Data</>
          )}
        </Button>
      )}
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <div className={`inline-flex p-2 rounded-xl mb-3 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value.toLocaleString("en-IN")}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [date, setDate] = useState(todayISO());
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [panchayats, setPanchayats] = useState<PanchayatRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPanchayat, setSelectedPanchayat] = useState<string | null>(null);
  const [mrs, setMrs] = useState<MRRow[]>([]);
  const [loadingMRs, setLoadingMRs] = useState(false);
  const [selectedMRId, setSelectedMRId] = useState<number | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>({ status: "none" });
  const [scraping, setScraping] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch dashboard data ──
  const loadDashboard = useCallback(async (d: string) => {
    setLoadingDashboard(true);
    try {
      const res = await fetch(`/api/dashboard?date=${d}`);
      const data = await res.json();
      if (!data.error) {
        setKpi(data.kpi);
        setPanchayats(data.panchayats);
      }
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  // ── Fetch scrape status ──
  const loadScrapeStatus = useCallback(async (d: string) => {
    const res = await fetch(`/api/scrape/status?date=${d}`);
    const data: ScrapeStatus = await res.json();
    setScrapeStatus(data);
    return data;
  }, []);

  // ── Poll while running ──
  const startPolling = useCallback((d: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const status = await loadScrapeStatus(d);
      // Refresh dashboard data as MRs come in
      await loadDashboard(d);
      if (status.status !== "running") {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setScraping(false);
      }
    }, 5000); // poll every 5s
  }, [loadScrapeStatus, loadDashboard]);

  // ── Initial load ──
  useEffect(() => {
    loadDashboard(date);
    loadScrapeStatus(date).then((s) => {
      if (s.status === "running") {
        setScraping(true);
        startPolling(date);
      }
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [date, loadDashboard, loadScrapeStatus, startPolling]);

  // ── Trigger scrape ──
  const handleScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch(`/api/scrape?date=${date}`, { method: "POST" });
      const data = await res.json();
      if (res.status === 409) {
        // Already running or done — just refresh status
        await loadScrapeStatus(date);
        setScraping(false);
        return;
      }
      if (data.success) {
        await loadScrapeStatus(date);
        startPolling(date);
      } else {
        setScraping(false);
      }
    } catch {
      setScraping(false);
    }
  };

  // ── Load MRs for selected panchayat ──
  const handlePanchayatClick = async (code: string) => {
    if (selectedPanchayat === code) {
      setSelectedPanchayat(null);
      setMrs([]);
      return;
    }
    setSelectedPanchayat(code);
    setLoadingMRs(true);
    try {
      const res = await fetch(`/api/muster-rolls?date=${date}&panchayatCode=${code}`);
      const data = await res.json();
      setMrs(data.musterRolls || []);
    } finally {
      setLoadingMRs(false);
    }
  };

  const filteredPanchayats = panchayats.filter(
    (p) =>
      p.panchayatName.toLowerCase().includes(search.toLowerCase()) ||
      p.blockName.toLowerCase().includes(search.toLowerCase()) ||
      p.districtName.toLowerCase().includes(search.toLowerCase())
  );

  const hasData = kpi && kpi.totalMRs > 0;
  const isRunning = scrapeStatus.status === "running" || scraping;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-800 truncate">MGNREGA MR Tracker</h1>
            <p className="text-xs text-slate-500">Jharkhand · Daily Attendance</p>
          </div>
          {/* Date picker */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => {
                setDate(e.target.value);
                setSelectedPanchayat(null);
                setMrs([]);
                setSearch("");
              }}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* ── Scrape Banner ── */}
        <ScrapeBanner
          status={scrapeStatus}
          date={date}
          onScrape={handleScrape}
          scraping={scraping}
        />

        {/* ── KPI Cards ── */}
        {hasData && (
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard icon={Building2} label="Panchayats" value={kpi!.totalPanchayats} color="bg-blue-100 text-blue-600" />
              <KpiCard icon={FileText} label="Muster Rolls" value={kpi!.totalMRs} color="bg-indigo-100 text-indigo-600" />
              <KpiCard icon={CheckCircle2} label="Present" value={kpi!.totalPresent} color="bg-emerald-100 text-emerald-600" />
              <KpiCard icon={XCircle} label="Absent" value={kpi!.totalAbsent} color="bg-red-100 text-red-600" />
            </div>

            {/* Attendance bar */}
            <div className="mt-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Overall Attendance</span>
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {attendancePct(kpi!.totalPresent, kpi!.totalWorkers)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${attendancePct(kpi!.totalPresent, kpi!.totalWorkers)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                <span>{kpi!.totalPresent.toLocaleString("en-IN")} present</span>
                <span>{kpi!.totalWorkers.toLocaleString("en-IN")} total workers</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Loading skeleton ── */}
        {loadingDashboard && !hasData && !isRunning && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* ── Panchayat List ── */}
        {hasData && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                Panchayats ({filteredPanchayats.length})
              </h2>
              {isRunning && (
                <span className="text-xs text-blue-500 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Updating…
                </span>
              )}
            </div>

            <Input
              placeholder="Search panchayat, block or district…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 bg-white"
            />

            <div className="space-y-2">
              {filteredPanchayats.map((p) => {
                const pct = attendancePct(p.presentCount, p.totalWorkers);
                const isSelected = selectedPanchayat === p.panchayatCode;
                return (
                  <div key={p.panchayatCode}>
                    <button
                      onClick={() => handlePanchayatClick(p.panchayatCode)}
                      className={`w-full text-left rounded-2xl p-4 border transition-all ${
                        isSelected
                          ? "bg-blue-50 border-blue-200 shadow-sm"
                          : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {p.panchayatName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {p.blockName} · {p.districtName}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className={`text-sm font-bold ${
                            pct >= 80 ? "text-emerald-600" :
                            pct >= 50 ? "text-amber-600" : "text-red-500"
                          }`}>{pct}%</span>
                          <p className="text-[10px] text-slate-400">{p.mrCount} MRs</p>
                        </div>
                      </div>

                      {/* Mini attendance bar */}
                      <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            pct >= 80 ? "bg-emerald-500" :
                            pct >= 50 ? "bg-amber-400" : "bg-red-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>{p.presentCount} present</span>
                        <span>{p.totalWorkers} total</span>
                      </div>
                    </button>

                    {/* ── MR List (expanded) ── */}
                    {isSelected && (
                      <div className="mt-2 ml-3 space-y-2">
                        {loadingMRs ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                          </div>
                        ) : mrs.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-4">No muster rolls found</p>
                        ) : (
                          mrs.map((mr) => {
                            const mrPct = attendancePct(mr.presentCount, mr.totalWorkers);
                            return (
                              <button
                                key={mr.id}
                                onClick={() => setSelectedMRId(mr.id)}
                                className="w-full text-left bg-white rounded-xl p-3 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-slate-700 truncate">
                                      {mr.workName || mr.workCode}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] text-slate-400 font-mono">MR #{mr.msrNo}</span>
                                      {(mr.photo1Url || mr.photo2Url) && (
                                        <span className="text-[10px] text-blue-400">📷 Photos</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 flex items-center gap-2">
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      <span className="text-emerald-600 font-medium">{mr.presentCount}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <XCircle className="h-3 w-3 text-red-400" />
                                      <span className="text-red-500 font-medium">{mr.absentCount}</span>
                                    </div>
                                    <Badge
                                      variant={mrPct >= 80 ? "success" : mrPct >= 50 ? "warning" : "destructive"}
                                      className="text-[10px] px-1.5 py-0"
                                    >
                                      {mrPct}%
                                    </Badge>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Empty state when no data and not running ── */}
        {!hasData && !isRunning && !loadingDashboard && scrapeStatus.status === "none" && (
          <div className="text-center py-16 text-slate-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No data available for {formatDate(date)}</p>
            {date === todayISO() && (
              <p className="text-xs mt-1">Use the &quot;Fetch Today&apos;s Data&quot; button above</p>
            )}
          </div>
        )}
      </main>

      {/* ── MR Detail Modal ── */}
      {selectedMRId !== null && (
        <MRDetailModal
          mrId={selectedMRId}
          open={selectedMRId !== null}
          onClose={() => setSelectedMRId(null)}
        />
      )}
    </div>
  );
}
