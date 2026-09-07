"use client";

import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";
import {
  Search, Activity, TrendingUp, TrendingDown, Minus,
  Link2, Lightbulb, Swords,
} from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedSection, StaggerContainer, fadeInUp } from "@/components/ui/animated-section";
import { useActiveOrg } from "@/hooks/use-active-org";
import { LiveSearchLab } from "@/components/search-lab/live-search-lab";

// Demo data — SEO Lab snapshot
const SCORE_BREAKDOWN = [
  { category: "Technical", score: 85, color: "#10B981" },
  { category: "Content", score: 74, color: "#38BDF8" },
  { category: "Authority", score: 71, color: "#F59E0B" },
  { category: "UX & Core Vitals", score: 82, color: "#8B5CF6" },
];
const SEO_STATS = [
  { label: "Organic Traffic", value: "24.8K", delta: "+16.2%" },
  { label: "Top-3 Keywords", value: "34", delta: "+6" },
  { label: "Backlinks", value: "1,284", delta: "+102" },
  { label: "Ref. Domains", value: "342", delta: "+7" },
];
const BACKLINKS = [
  { month: "Sep", backlinks: 612, refDomains: 198 },
  { month: "Oct", backlinks: 668, refDomains: 214 },
  { month: "Nov", backlinks: 705, refDomains: 226 },
  { month: "Dec", backlinks: 748, refDomains: 241 },
  { month: "Jan", backlinks: 791, refDomains: 252 },
  { month: "Feb", backlinks: 838, refDomains: 268 },
  { month: "Mar", backlinks: 874, refDomains: 279 },
  { month: "Apr", backlinks: 921, refDomains: 294 },
  { month: "May", backlinks: 989, refDomains: 311 },
  { month: "Jun", backlinks: 1081, refDomains: 326 },
  { month: "Jul", backlinks: 1182, refDomains: 335 },
  { month: "Aug", backlinks: 1284, refDomains: 342 },
];
const KEYWORDS = [
  { keyword: "leather crossbody bag", pos: 3, change: 2, volume: 12100, difficulty: 42, url: "/collections/crossbody-bags" },
  { keyword: "vegan leather tote", pos: 5, change: 1, volume: 8900, difficulty: 38, url: "/collections/totes" },
  { keyword: "mini shoulder bag", pos: 7, change: 4, volume: 6600, difficulty: 35, url: "/products/mini-shoulder" },
  { keyword: "everyday tote bag", pos: 8, change: 0, volume: 5400, difficulty: 44, url: "/collections/totes" },
  { keyword: "canvas tote bag", pos: 14, change: 5, volume: 9800, difficulty: 29, url: "/products/canvas-tote" },
  { keyword: "leather backpack women", pos: 11, change: 3, volume: 4700, difficulty: 48, url: "/collections/backpacks" },
  { keyword: "quilted handbag", pos: 12, change: -2, volume: 3900, difficulty: 41, url: "/products/quilted-bag" },
  { keyword: "office bag women", pos: 18, change: -1, volume: 3300, difficulty: 46, url: "/collections/office" },
  { keyword: "leather sling bag", pos: 16, change: 1, volume: 2900, difficulty: 33, url: "/products/sling-bag" },
  { keyword: "designer laptop bag", pos: 24, change: 2, volume: 4100, difficulty: 55, url: "/products/laptop-tote" },
  { keyword: "small crossbody purse", pos: 26, change: -3, volume: 5100, difficulty: 40, url: "/products/mini-purse" },
  { keyword: "leather bucket bag", pos: 21, change: 6, volume: 2400, difficulty: 37, url: "/products/bucket-bag" },
  { keyword: "travel tote bag", pos: 33, change: 7, volume: 6200, difficulty: 43, url: "/products/travel-tote" },
  { keyword: "leather hobo bag", pos: 29, change: 4, volume: 1900, difficulty: 31, url: "/products/hobo-bag" },
  { keyword: "genuine leather satchel", pos: 37, change: 1, volume: 1600, difficulty: 39, url: "/products/satchel" },
  { keyword: "nylon shoulder bag", pos: 41, change: -2, volume: 2700, difficulty: 27, url: "/products/nylon-bag" },
  { keyword: "leather clutch evening", pos: 45, change: 9, volume: 3600, difficulty: 34, url: "/collections/clutches" },
  { keyword: "monogram tote bag", pos: 52, change: 11, volume: 1400, difficulty: 25, url: "/products/monogram-tote" },
  { keyword: "leather messenger women", pos: 58, change: 3, volume: 1200, difficulty: 36, url: "/products/messenger" },
  { keyword: "oversized tote bag", pos: 64, change: 14, volume: 2200, difficulty: 30, url: "/products/oversized-tote" },
];
const CONTENT_GAPS = [
  { title: "Sustainable leather alternatives", volume: "3,400/mo", difficulty: 28, note: "No ranking content — 0 URLs" },
  { title: "How to care for leather bags", volume: "2,100/mo", difficulty: 22, note: "Competitor guide outranks us" },
  { title: "Best work bags for commuting", volume: "1,800/mo", difficulty: 31, note: "SERP shows shopping results" },
  { title: "Leather bag styling guide", volume: "1,200/mo", difficulty: 19, note: "Quick win — low effort" },
];
const COMPETITORS = [
  { name: "You", da: 42, keywords: "1,284", traffic: "24.8K", backlinks: "1,284", you: true },
  { name: "Mila & Vera", da: 51, keywords: "2,140", traffic: "41.2K", backlinks: "2,890", you: false },
  { name: "Studio Nord", da: 47, keywords: "1,760", traffic: "33.6K", backlinks: "2,240", you: false },
  { name: "Bagatelle", da: 38, keywords: "980", traffic: "15.1K", backlinks: "940", you: false },
];
const diffColor = (d: number) => (d < 30 ? "#10B981" : d <= 50 ? "#F59E0B" : "#F43F5E");

function ScoreGauge({ score }: { score: number }) {
  const R = 84, CX = 110, CY = 104;
  const angle = Math.PI * (score / 100);
  const x = CX - R * Math.cos(angle);
  const y = CY - R * Math.sin(angle);
  return (
    <div className="relative mx-auto w-[220px]">
      <svg viewBox="0 0 220 122" className="w-full">
        <defs>
          <linearGradient id="seoGaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F43F5E" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} strokeLinecap="round" />
        <motion.path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke="url(#seoGaugeGrad)" strokeWidth={12} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-4xl font-bold text-white">
          <AnimatedCounter target={score} className="tabular-nums" />
          <span className="text-lg font-medium text-white/30">/100</span>
        </p>
      </div>
    </div>
  );
}

export default function SeoPage() {
  const { isDemo, isLoading } = useActiveOrg();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  if (!isDemo) {
    return <LiveSearchLab />;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        {/* Header */}
        <AnimatedSection>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">Organic growth laboratory</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight"><span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">SEO Lab</span></h1>
              <p className="text-sm text-zinc-400">Rankings, backlinks, content gaps and competitor benchmarks</p>
            </div>
            <span className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300"><TrendingUp className="h-3.5 w-3.5" />Score up 6 pts this month</span>
          </div>
        </AnimatedSection>

        {/* Score + breakdown */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <AnimatedSection className="lg:col-span-5">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-1 flex items-center gap-2">
                <Search className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white/80">Overall SEO Score</h2>
              </div>
              <p className="mb-3 text-xs text-zinc-400">Weighted across 47 ranking factors</p>
              <ScoreGauge score={78} />
              <div className="mt-6 grid grid-cols-2 gap-2">
                {SEO_STATS.map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-white/30">{s.label}</p>
                    <div className="flex items-baseline justify-between"><span className="text-base font-bold text-white tabular-nums">{s.value}</span><span className="text-[10px] font-bold text-emerald-400">{s.delta}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
          <AnimatedSection className="lg:col-span-7" delay={0.1}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-6 flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-400" />
                <h2 className="text-sm font-semibold text-white/80">Score Breakdown</h2>
              </div>
              <div className="space-y-5">
                {SCORE_BREAKDOWN.map((b, i) => (
                  <div key={b.category}>
                    <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-white/70">{b.category}</span><span className="font-bold text-white tabular-nums">{b.score}<span className="text-white/30">/100</span></span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: `${b.score}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.2 + i * 0.12, ease: "easeOut" }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${b.color}80, ${b.color})` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                <p className="text-xs font-semibold text-amber-300">Next best action</p>
                <p className="mt-1 text-xs text-zinc-400">Build the 4 missing topic clusters — authority is the weakest pillar and blocks 12 keywords from page 1.</p>
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Backlink growth */}
        <AnimatedSection>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white/80">Backlink Growth</h2>
                </div>
                <p className="mt-1 text-xs text-zinc-400">+110% backlinks and +73% referring domains in 12 months</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400" />Backlinks</span>
                <span className="flex items-center gap-1.5 text-teal-300"><span className="h-2 w-2 rounded-full bg-teal-300" />Ref. domains</span>
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={BACKLINKS} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="backlinkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "rgba(9,9,11,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} labelStyle={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }} />
                  <Area yAxisId="left" type="monotone" dataKey="backlinks" stroke="#10B981" strokeWidth={2.5} fill="url(#backlinkGrad)" />
                  <Line yAxisId="right" type="monotone" dataKey="refDomains" stroke="#5EEAD4" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </AnimatedSection>

        {/* Keyword rankings */}
        <AnimatedSection>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/5 p-6 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-white/80">Keyword Rankings</h2>
                <p className="mt-0.5 text-xs text-zinc-400">20 tracked keywords — 14 improving, 4 declining, 2 stable</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-white/50">GOOGLE · GR</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30">
                    <th className="px-6 py-3 font-medium">Keyword</th>
                    <th className="px-4 py-3 font-medium">Position</th>
                    <th className="px-4 py-3 font-medium">Change</th>
                    <th className="px-4 py-3 font-medium">Volume</th>
                    <th className="px-4 py-3 font-medium">Difficulty</th>
                    <th className="px-6 py-3 font-medium">Ranking URL</th>
                  </tr>
                </thead>
                <tbody>
                  {KEYWORDS.map((k) => (
                    <tr key={k.keyword} className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]">
                      <td className="px-6 py-2.5 font-medium text-white">{k.keyword}</td>
                      <td className={`px-4 py-2.5 font-bold tabular-nums ${k.pos <= 3 ? "text-emerald-400" : k.pos <= 10 ? "text-white" : "text-white/60"}`}>{k.pos}</td>
                      <td className="px-4 py-2.5">{k.change > 0 ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-400"><TrendingUp className="h-3 w-3" />+{k.change}</span> : k.change < 0 ? <span className="flex items-center gap-1 text-xs font-bold text-red-400"><TrendingDown className="h-3 w-3" />{k.change}</span> : <span className="flex items-center gap-1 text-xs font-bold text-white/30"><Minus className="h-3 w-3" />0</span>}</td>
                      <td className="px-4 py-2.5 text-zinc-400 tabular-nums">{k.volume.toLocaleString()}</td>
                      <td className="px-4 py-2.5"><span className="flex items-center gap-2 text-zinc-400 tabular-nums"><span className="h-1.5 w-8 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${k.difficulty}%`, backgroundColor: diffColor(k.difficulty) }} /></span>{k.difficulty}</span></td>
                      <td className="px-6 py-2.5 font-mono text-[11px] text-zinc-400">{k.url}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AnimatedSection>

        {/* Content gaps + competitors */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <AnimatedSection className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white/80">Content Gap Analysis — 4 opportunities</h2>
              </div>
              <StaggerContainer className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CONTENT_GAPS.map((g) => (
                  <motion.div key={g.title} variants={fadeInUp} className="h-full rounded-xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:border-amber-500/30">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-white">{g.title}</p>
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">{g.volume} · KD {g.difficulty}</span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-zinc-400">{g.note}</p>
                  </motion.div>
                ))}
              </StaggerContainer>
            </div>
          </AnimatedSection>
          <AnimatedSection className="lg:col-span-5" delay={0.1}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <Swords className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white/80">Competitor Comparison</h2>
              </div>
              <div className="space-y-3">
                {COMPETITORS.map((c) => (
                  <div key={c.name} className={`rounded-xl border p-3.5 ${c.you ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/5 bg-white/[0.03]"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${c.you ? "text-emerald-300" : "text-white/80"}`}>{c.name}{c.you ? " ★" : ""}</span>
                      <span className="text-[10px] text-white/30">DA {c.da}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: `${(c.da / 60) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} className={`h-full rounded-full ${c.you ? "bg-emerald-400" : "bg-white/30"}`} />
                    </div>
                    <div className="mt-2.5 flex justify-between text-[10px]">
                      <span className="text-zinc-400">Keywords <span className="font-semibold text-white/80">{c.keywords}</span></span><span className="text-zinc-400">Traffic <span className="font-semibold text-white/80">{c.traffic}</span></span><span className="text-zinc-400">Links <span className="font-semibold text-white/80">{c.backlinks}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </div>
  );
}
