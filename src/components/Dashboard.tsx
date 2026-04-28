"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Users, CheckCircle2, XCircle, Calendar,
  Search, RefreshCw, TrendingUp, MapPin, FileText,
  ChevronRight, Loader2, AlertCircle, Zap, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

interface PanchayatSummary {
  panchayatCode: string;
  panchayatName: string;
  districtName: string;
  blockName: string;
  mrCount: number;
  presentCount: number;
  absentCount: number;
  totalWorkers: number;
}

interface MusterRoll {
  id: number;
  attendanceDate: string;
  districtName: string;
  blockName: string;
  panchayatCode: string;
  panchayatName: string;
  workCode: string;
  msrNo: string;
  workName: string | null;
  totalWorkers: number;
  presentCount: number;
  absentCount: number;
  photo1Url: string | null;
  photo2Url: string | null;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  gradient,
  iconBg,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  gradient: string;
  iconBg: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} text-white shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
          {sub && <p className="mt-1 text-xs opacity-75">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      {/* Decorative circle */}
      <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/5" />
    </div>
  );
}

// ─── Attendance Bar ────────────────────────────────────────────────────────────
function AttendanceBar({ present, total }: { present: number; total: number }) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── MR Card ──────────────────────────────────────────────────────────────────
function MRCard({ mr, onClick }: { mr: MusterRoll; onClick: () => void }) {
  const attendancePct =
    mr.totalWorkers > 0 ? Math.round((mr.presentCount / mr.totalWorkers) * 100) : 0;
  const statusColor =
    attendancePct >= 80 ? "success" : attendancePct >= 50 ? "warning" : "destructive";

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 p-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              MR #{mr.msrNo}
            </span>
            <Badge variant={statusColor as "success" | "warning" | "destructive"}>
              {attendancePct}%
            </Badge>
          </div>
          <p className="text-sm font-medium text-slate-800 truncate leading-snug">
            {mr.workName || mr.workCode}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{mr.workCode}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-50 rounded-xl py-2">
          <p className="text-lg font-bold text-slate-700">{mr.totalWorkers}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
        </div>
        <div className="bg-emerald-50 rounded-xl py-2">
          <p className="text-lg font-bold text-emerald-600">{mr.presentCount}</p>
          <p className="text-[10px] text-emerald-500 uppercase tracking-wide">Present</p>
        </div>
        <div className="bg-red-50 rounded-xl py-2">
          <p className="text-lg font-bold text-red-500">{mr.absentCount}</p>
          <p className="text-[10px] text-red-400 uppercase tracking-wide">Absent</p>
        </div>
      </div>

      <div className="mt-3">
        <AttendanceBar present={mr.presentCount} total={mr.totalWorkers} />
      </div>

      {(mr.photo1Url || mr.photo2Url) && (
        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
          <FileText className="h-3 w-3" />
          <span>{[mr.photo1Url, mr.photo2Url].filter(Boolean).length} photo(s) uploaded</span>
        </div>
      )}
    </button>
  );
}

// ─── Panchayat Section ────────────────────────────────────────────────────────
function PanchayatSection({
  panchayat,
  musterRolls,
  onMRClick,
  date,
}: {
  panchayat: PanchayatSummary;
  musterRolls: MusterRoll[];
  onMRClick: (mr: MusterRoll) => void;
  date: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const pct =
    panchayat.totalWorkers > 0
      ? Math.round((panchayat.presentCount / panchayat.totalWorkers) * 100)
      : 0;

  return (
    <div className="mb-4">
      <div className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
        {/* Left: expand toggle + panchayat info */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <div className="text-left min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{panchayat.panchayatName}</p>
            <p className="text-xs text-slate-400">
              {panchayat.blockName} · {panchayat.districtName}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-700">{panchayat.mrCount} MRs</p>
            <p className="text-xs text-slate-400">{panchayat.totalWorkers} workers</p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {pct}%
          </span>
          {/* View full sheet button */}
          <button
            onClick={() => router.push(`/mr/${panchayat.panchayatCode}?date=${date}`)}
            title="View full attendance sheet"
            className="h-8 w-8 rounded-lg border border-blue-200 bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
          </button>
          <button onClick={() => setExpanded((e) => !e)} className="p-1">
            <ChevronRight
              className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2">
          {musterRolls.map((mr) => (
            <MRCard key={mr.id} mr={mr} onClick={() => onMRClick(mr)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [panchayats, setPanchayats] = useState<PanchayatSummary[]>([]);
  const [musterRolls, setMusterRolls] = useState<MusterRoll[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedMR, setSelectedMR] = useState<MusterRoll | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, mrRes] = await Promise.all([
        fetch(`/api/dashboard?date=${d}`),
        fetch(`/api/muster-rolls?date=${d}`),
      ]);
      const dashData = await dashRes.json();
      const mrData = await mrRes.json();
      setKpi(dashData.kpi);
      setPanchayats(dashData.panchayats || []);
      setMusterRolls(mrData.musterRolls || []);
    } catch {
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(date);
  }, [date, fetchData]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch(`/api/scrape?date=${date}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchData(date);
      } else {
        setError(data.error || "Scrape failed");
      }
    } catch {
      setError("Failed to trigger scraper");
    } finally {
      setScraping(false);
    }
  };

  // Filter panchayats by search
  const filteredPanchayats = panchayats.filter((p) =>
    p.panchayatName.toLowerCase().includes(search.toLowerCase()) ||
    p.blockName.toLowerCase().includes(search.toLowerCase())
  );

  const getMRsForPanchayat = (code: string) =>
    musterRolls.filter((mr) => mr.panchayatCode === code);

  const attendanceRate =
    kpi && kpi.totalWorkers > 0
      ? Math.round((kpi.totalPresent / kpi.totalWorkers) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 leading-tight">MGNREGA Tracker</h1>
                <p className="text-[10px] text-slate-400 leading-tight">Jharkhand · NMMS</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Date picker */}
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 pl-8 pr-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleScrape}
                disabled={scraping}
                className="h-9 px-3 text-xs"
              >
                {scraping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5 hidden sm:inline">Sync</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-8">
        {/* ── Date Banner ── */}
        <div className="mt-4 mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">{formatDate(date)}</h2>
            <p className="text-xs text-slate-400">Attendance Summary</p>
          </div>
          {!loading && kpi && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{attendanceRate}% attendance</span>
            </div>
          )}
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* ── KPI Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : kpi ? (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <KPICard
              icon={Building2}
              label="Panchayats"
              value={kpi.totalPanchayats}
              sub="Active today"
              gradient="bg-gradient-to-br from-blue-500 to-blue-700"
              iconBg="bg-white/20"
            />
            <KPICard
              icon={FileText}
              label="Muster Rolls"
              value={kpi.totalMRs}
              sub="Generated"
              gradient="bg-gradient-to-br from-violet-500 to-purple-700"
              iconBg="bg-white/20"
            />
            <KPICard
              icon={CheckCircle2}
              label="Present"
              value={kpi.totalPresent}
              sub={`of ${kpi.totalWorkers} workers`}
              gradient="bg-gradient-to-br from-emerald-500 to-green-700"
              iconBg="bg-white/20"
            />
            <KPICard
              icon={XCircle}
              label="Absent"
              value={kpi.totalAbsent}
              sub={`${kpi.totalWorkers > 0 ? Math.round((kpi.totalAbsent / kpi.totalWorkers) * 100) : 0}% rate`}
              gradient="bg-gradient-to-br from-rose-500 to-red-700"
              iconBg="bg-white/20"
            />
          </div>
        ) : (
          <Card className="mb-6">
            <CardContent className="py-10 text-center text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No data for {formatDate(date)}</p>
              <p className="text-xs mt-1">Click Sync to fetch today&apos;s data</p>
            </CardContent>
          </Card>
        )}

        {/* ── Search / Filter ── */}
        {!loading && panchayats.length > 0 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search panchayat or block..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 rounded-xl border-slate-200 bg-white shadow-sm text-sm"
            />
          </div>
        )}

        {/* ── Panchayat List ── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredPanchayats.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">
              {search ? "No panchayats match your search" : "No data available"}
            </p>
            {!search && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleScrape}
                disabled={scraping}
              >
                {scraping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Fetch Data
              </Button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-400 mb-3 font-medium">
              {filteredPanchayats.length} panchayat{filteredPanchayats.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </p>
            {filteredPanchayats.map((p) => (
              <PanchayatSection
                key={p.panchayatCode}
                panchayat={p}
                musterRolls={getMRsForPanchayat(p.panchayatCode)}
                onMRClick={setSelectedMR}
                date={date}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── MR Detail Modal ── */}
      {selectedMR && (
        <MRDetailModal
          mrId={selectedMR.id}
          open={!!selectedMR}
          onClose={() => setSelectedMR(null)}
        />
      )}
    </div>
  );
}
