"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import {
  Users,
  UserCheck,
  Crown,
  TrendingDown,
  Download,
  HeartHandshake,
  Sparkles,
  AlertTriangle,
  Store,
} from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  AnimatedSection,
  StaggerContainer,
  fadeInUp,
} from "@/components/ui/animated-section";
import { useIsoDateRange } from "@/components/ui/date-range-picker";
import { api } from "@/lib/trpc/react";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useActiveBrand } from "@/hooks/use-active-brand";
import { DeskFilterRow, MarketSplitStrip } from "@/components/brands/desk-filters";
import { useCurrency } from "@/components/providers/currency";
import { asClockNumber } from "@/lib/operator-clocks";
import { RFM_SEGMENT_COLOR, type RfmSegment } from "@/lib/woo-customers";
import { useActiveMarket } from "@/hooks/use-active-market";

// ---------------------------------------------------------------------------
// Demo data — Customer Intelligence snapshot
// ---------------------------------------------------------------------------

const KPIS = [
  { label: "Total Customers", value: 34892, prefix: "", suffix: "", decimals: 0, delta: "+12.4% MoM", positive: true, icon: Users, color: "#F59E0B" },
  { label: "Active Customers", value: 28441, prefix: "", suffix: "", decimals: 0, delta: "81.5% of base", positive: true, icon: UserCheck, color: "#10B981" },
  { label: "Average LTV", value: 847, prefix: "€", suffix: "", decimals: 0, delta: "+5.4% QoQ", positive: true, icon: Crown, color: "#38BDF8" },
  { label: "Churn Rate", value: 4.2, prefix: "", suffix: "%", decimals: 1, delta: "-0.8pp", positive: true, icon: TrendingDown, color: "#F43F5E" },
];

const RFM = [
  { name: "Champions", value: 6280, color: "#10B981" },
  { name: "Loyal", value: 8375, color: "#38BDF8" },
  { name: "Potential Loyalist", value: 7327, color: "#8B5CF6" },
  { name: "New", value: 5234, color: "#22D3EE" },
  { name: "At Risk", value: 4885, color: "#F59E0B" },
  { name: "Hibernating", value: 2791, color: "#71717A" },
];

const SEGMENT_STYLES: Record<string, string> = {
  Champion: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  Loyal: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  "Potential Loyalist": "border-violet-500/20 bg-violet-500/10 text-violet-400",
  New: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  "At Risk": "border-amber-500/20 bg-amber-500/10 text-amber-400",
  Hibernating: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
};

const CHURN_RISK = [
  { name: "Elena Karali", email: "elena.karali@gmail.com", risk: 87, ltv: "€2,340", loss: "€1,180", action: "Win-back offer +15%" },
  { name: "Dimitris Vlachos", email: "d.vlachos@proton.me", risk: 74, ltv: "€1,120", loss: "€640", action: "Loyalty tier upgrade" },
  { name: "Sofia Andreou", email: "sofia.andreou@gmail.com", risk: 61, ltv: "€890", loss: "€410", action: "Personalized email drip" },
];

const CUSTOMERS = [
  { name: "Maria Papadopoulou", email: "maria.pap@gmail.com", ltv: 3420, orders: 34, segment: "Champion", lastActive: "2h ago" },
  { name: "Giannis Antoniou", email: "g.antoniou@outlook.com", ltv: 2890, orders: 28, segment: "Champion", lastActive: "5h ago" },
  { name: "Elena Karali", email: "elena.karali@gmail.com", ltv: 2340, orders: 24, segment: "At Risk", lastActive: "12d ago" },
  { name: "Nikos Papazoglou", email: "n.papazoglou@yahoo.gr", ltv: 1975, orders: 21, segment: "Loyal", lastActive: "1d ago" },
  { name: "Katerina Ioannidou", email: "k.ioannidou@gmail.com", ltv: 1840, orders: 19, segment: "Loyal", lastActive: "3h ago" },
  { name: "Alexandros Dimitriou", email: "a.dimitriou@icloud.com", ltv: 1560, orders: 17, segment: "Loyal", lastActive: "8h ago" },
  { name: "Christina Nikolaidou", email: "c.nikolaidou@gmail.com", ltv: 1280, orders: 14, segment: "Potential Loyalist", lastActive: "1d ago" },
  { name: "Dimitris Vlachos", email: "d.vlachos@proton.me", ltv: 1120, orders: 15, segment: "At Risk", lastActive: "9d ago" },
  { name: "Anastasia Lambrou", email: "a.lambrou@gmail.com", ltv: 2105, orders: 22, segment: "Champion", lastActive: "1h ago" },
  { name: "Sofia Andreou", email: "sofia.andreou@gmail.com", ltv: 890, orders: 12, segment: "At Risk", lastActive: "7d ago" },
  { name: "Panagiotis Georgiou", email: "p.georgiou@gmail.com", ltv: 740, orders: 11, segment: "Potential Loyalist", lastActive: "2d ago" },
  { name: "Ioanna Stavrou", email: "ioanna.stavrou@gmail.com", ltv: 620, orders: 9, segment: "New", lastActive: "4h ago" },
  { name: "Michalis Oikonomou", email: "m.oikonomou@workmail.gr", ltv: 540, orders: 8, segment: "New", lastActive: "6h ago" },
  { name: "Despina Vasiliou", email: "despina.v@gmail.com", ltv: 410, orders: 6, segment: "Hibernating", lastActive: "24d ago" },
  { name: "Thanasis Roussos", email: "t.roussos@freemail.gr", ltv: 380, orders: 5, segment: "Hibernating", lastActive: "31d ago" },
];

export default function CustomersPage() {
  const { isDemo, isLoading } = useActiveOrg();
  const { symbol, format, formatExact } = useCurrency();
  const { brands, brandId, setBrandId } = useActiveBrand();
  const { market, setDesks } = useActiveMarket();

  const dateRange = useIsoDateRange(90);
  const datesValid = dateRange.startDate !== "";
  const salesQuery = api.commerce.getActualSales.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, brandId, ...(market !== "all" ? { market } : {}) },
    { enabled: !isDemo && !isLoading && Boolean(brandId) && datesValid, retry: false },
  );
  const productsQuery = api.commerce.getProductProfitability.useQuery(
    { brandId: brandId ?? "", limit: 10, sortBy: "profit" },
    { enabled: !isDemo && !isLoading && !!brandId, retry: false },
  );
  const mixQuery = api.commerce.getOrderSourceMix.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, brandId, ...(market !== "all" ? { market } : {}) },
    { enabled: !isDemo && !isLoading && Boolean(brandId) && datesValid, retry: false },
  );
  const lowStockQuery = api.commerce.getLowStockCatalog.useQuery(
    { brandId: brandId ?? "", stockThreshold: 5, limit: 8 },
    { enabled: !isDemo && !isLoading && !!brandId, retry: false },
  );
  const peopleQuery = api.commerce.getCustomerIntelligence.useQuery(
    { startDate: dateRange.startDate, endDate: dateRange.endDate, brandId: brandId ?? "", ...(market !== "all" ? { market } : {}) },
    { enabled: !isDemo && !isLoading && !!brandId && datesValid, retry: false },
  );

  useEffect(() => {
    setDesks(salesQuery.data?.data?.markets);
  }, [salesQuery.data?.data?.markets, setDesks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Real workspace: actual WooCommerce sales + product profitability
  // -------------------------------------------------------------------------
  if (!isDemo) {
    const sales = salesQuery.data?.data;
    const products = productsQuery.data?.data?.products ?? [];
    const rankedBy = productsQuery.data?.data?.rankedBy ?? "unit";
    const mix = mixQuery.data?.data?.channels ?? mixQuery.data?.data?.rows ?? [];
    const emailMix = mix.find((row) => "channel" in row && row.channel === "email");
    const lowStock = lowStockQuery.data?.data?.products ?? [];
    const people = peopleQuery.data?.data;
    const loading = salesQuery.isLoading || (!!brandId && productsQuery.isLoading);
    const hasData = !!sales && (sales.orderCount > 0 || products.length > 0);
    const netSales = asClockNumber(sales?.netSales);
    const orderCount = asClockNumber(sales?.orderCount);
    const avgOrderValue =
      asClockNumber(sales?.avgOrderValue) || (orderCount > 0 ? netSales / orderCount : 0);
    const cogsKnown = sales?.cogsKnown === true;

    const fmt = (v: number, decimals = 0) =>
      decimals > 0 ? formatExact(v) : format(v);

    const kpis = sales
      ? [
          { label: "Gross Sales (90d)", value: format(asClockNumber(sales.grossSales)), icon: Crown, color: "#F59E0B" },
          { label: "Net Sales (90d)", value: format(netSales), icon: HeartHandshake, color: "#10B981" },
          { label: "Orders", value: orderCount.toLocaleString("en-US"), icon: Users, color: "#38BDF8" },
          { label: "Unique customers", value: asClockNumber(people?.uniqueCustomers).toLocaleString("en-US"), icon: UserCheck, color: "#8B5CF6" },
          { label: "Avg Order Value", value: formatExact(avgOrderValue), icon: Sparkles, color: "#22D3EE" },
          ...(cogsKnown
            ? [
                { label: "Gross Profit", value: format(asClockNumber(sales.grossProfit)), icon: UserCheck, color: "#8B5CF6" },
                { label: "Gross Margin", value: `${asClockNumber(sales.grossMargin).toFixed(1)}%`, icon: TrendingDown, color: "#F43F5E" },
              ]
            : [
                { label: "Refunds", value: format(asClockNumber(sales.refunds)), icon: TrendingDown, color: "#F43F5E" },
              ]),
        ]
      : [];

    return (
      <div className="relative">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl space-y-6 px-1">
          {/* Header */}
          <AnimatedSection>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-amber-400" />
                  <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">Store performance · last 90 days</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Customer Intelligence</span>
                </h1>
                <p className="text-sm text-zinc-400">Woo till — last-click mix and RFM from synced orders, not pixel conversions</p>
                <DeskFilterRow brands={brands} brandId={brandId} onSelect={setBrandId} />
              </div>
            </div>
          </AnimatedSection>

          {sales?.markets ? (
            <MarketSplitStrip markets={sales.markets} marketMode={sales.marketMode} />
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
            </div>
          ) : !hasData ? (
            <AnimatedSection>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-20 text-center backdrop-blur-xl">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
                  <Store className="h-7 w-7 text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">No store data yet</h2>
                    <p className="mt-2 max-w-md text-sm text-zinc-400">
                  Connect a WooCommerce store from Connections, then Sync Now, to see real sales, orders, RFM, and catalog stock here. Demo names are not shown on live orgs.
                    </p>
                <Link
                  href="/connections?connect=woocommerce"
                  className="mt-5 inline-flex items-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Connect WooCommerce
                </Link>
              </div>
            </AnimatedSection>
          ) : (
            <>
              {/* KPI summary */}
              <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {kpis.map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <motion.div key={kpi.label} variants={fadeInUp} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:border-white/20">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${kpi.color}20` }}>
                          <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                        </div>
                      </div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">{kpi.label}</p>
                      <p className="mt-1 text-3xl font-bold text-white tabular-nums">{kpi.value}</p>
                      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{ backgroundColor: kpi.color }} />
                    </motion.div>
                  );
                })}
              </StaggerContainer>

              {/* Sales breakdown */}
              {sales && (
                <AnimatedSection>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <h2 className="text-sm font-semibold text-white/80">Sales breakdown</h2>
                    <p className="mt-0.5 text-xs text-zinc-400">New-customer orders vs returning, discounts, refunds, shipping, VAT — last 90 days. New count is first-order flags, not unique people.</p>
                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                      {[
                        { label: "New-customer orders", value: sales.newCustomers.toLocaleString() },
                        { label: "New-customer net", value: fmt(sales.newCustomerNet ?? 0) },
                        { label: "Returning orders", value: sales.returningCustomers.toLocaleString() },
                        { label: "Refunds", value: fmt(sales.refunds) },
                        { label: "Shipping charged", value: fmt(sales.shipping) },
                        { label: "VAT in window", value: fmt(sales.tax) },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                          <p className="text-[10px] uppercase tracking-wider text-white/30">{item.label}</p>
                          <p className="mt-1 text-lg font-bold text-white tabular-nums">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </AnimatedSection>
              )}

              {people && people.rfm.length > 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <AnimatedSection className="lg:col-span-5" delay={0.11}>
                    <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                      <h2 className="text-sm font-semibold text-white/80">RFM from store emails</h2>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {people.lifetimeCustomers.toLocaleString()} people with an email · {people.guestOrders} guest orders ignored
                      </p>
                      <div className="relative mt-4 h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={people.rfm} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="88%" paddingAngle={2} strokeWidth={0}>
                              {people.rfm.map((s) => (
                                <Cell key={s.name} fill={s.color} fillOpacity={0.85} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {people.rfm.map((s) => (
                          <span key={s.name} className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/60">
                            {s.name} {s.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </AnimatedSection>
                  <AnimatedSection className="lg:col-span-7" delay={0.12}>
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                      <div className="border-b border-white/5 p-6 pb-4">
                        <h2 className="text-sm font-semibold text-white/80">Highest lifetime net</h2>
                        <p className="mt-0.5 text-xs text-zinc-400">Paid orders only. Repeat rate in this window: {people.uniqueCustomers > 0 ? Math.round((people.repeatCustomers / people.uniqueCustomers) * 100) : 0}%</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30">
                              <th className="px-6 py-3 font-medium">Email</th>
                              <th className="px-4 py-3 font-medium">Orders</th>
                              <th className="px-4 py-3 font-medium">Net</th>
                              <th className="px-6 py-3 text-right font-medium">Segment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {people.top.map((c) => (
                              <tr key={c.email} className="border-b border-white/5 last:border-0">
                                <td className="px-6 py-3 font-medium text-white">{c.email}</td>
                                <td className="px-4 py-3 tabular-nums text-zinc-300">{c.orders}</td>
                                <td className="px-4 py-3 tabular-nums text-white">{fmt(c.netSales)}</td>
                                <td className="px-6 py-3 text-right text-xs" style={{ color: RFM_SEGMENT_COLOR[c.segment as RfmSegment] }}>{c.segment}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </AnimatedSection>
                </div>
              )}

              {/* Top products */}
              <AnimatedSection delay={0.1}>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/5 p-6 pb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-white/80">
                        {rankedBy === "sold"
                          ? "Top products by till contribution"
                          : cogsKnown
                            ? "Catalog by unit margin"
                            : "Catalog · price & stock"}
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {rankedBy === "sold"
                          ? "Line net minus catalog cost × units from the last Woo sync. Variations missing from the catalog roll up to the parent. Not incremental ad profit."
                          : cogsKnown
                            ? "List price minus catalog cost. Not till profit — sold qty is not on these rows yet."
                            : "COGS is not on these products yet — profit is hidden on purpose"}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-white/50">
                      {products.length} PRODUCT{products.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  {products.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <p className="text-sm text-zinc-400">No product data synced yet — run a store sync from Connections.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30">
                            <th className="px-6 py-3 font-medium">Product</th>
                            <th className="px-4 py-3 font-medium">Price</th>
                            {rankedBy === "sold" && <th className="px-4 py-3 font-medium">Sold</th>}
                            {rankedBy === "sold" && <th className="px-4 py-3 font-medium">Sold net</th>}
                            {cogsKnown && <th className="px-4 py-3 font-medium">{rankedBy === "sold" ? "Contribution" : "Unit profit"}</th>}
                            {cogsKnown && <th className="px-4 py-3 font-medium">Margin</th>}
                            <th className="px-6 py-3 text-right font-medium">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => (
                            <tr key={p.id} className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]">
                              <td className="px-6 py-3">
                                <p className="font-medium text-white">{p.name}</p>
                                {p.sku && <p className="text-[11px] text-zinc-400">{p.sku}</p>}
                              </td>
                              <td className="px-4 py-3 font-semibold text-white tabular-nums">{fmt(p.revenue)}</td>
                              {rankedBy === "sold" && (
                                <td className="px-4 py-3 tabular-nums text-zinc-300">{p.soldQty}</td>
                              )}
                              {rankedBy === "sold" && (
                                <td className="px-4 py-3 tabular-nums text-white">{fmt(p.soldNet)}</td>
                              )}
                              {cogsKnown && (
                                <td className={`px-4 py-3 font-semibold tabular-nums ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(p.profit)}</td>
                              )}
                              {cogsKnown && (
                                <td className="px-4 py-3 text-zinc-400 tabular-nums">{p.margin.toFixed(1)}%</td>
                              )}
                              <td className="px-6 py-3 text-right text-zinc-400 capitalize">{p.stockQty} · {p.stockStatus ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </AnimatedSection>

              {mix.length > 0 && (
                <AnimatedSection delay={0.12}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <h2 className="text-sm font-semibold text-white/80">Order source mix</h2>
                    <p className="mt-0.5 text-xs text-zinc-400">Last-click from Woo UTM / Order Attribution — net, GP, and refunds. Not incremental.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {mix.slice(0, 9).map((row) => {
                        const label = "label" in row ? row.label : row.source;
                        const key = "channel" in row ? row.channel : row.source;
                        const gp = "grossProfit" in row ? row.grossProfit : 0;
                        const refunds = "refunds" in row ? row.refunds : 0;
                        return (
                        <div key={key} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                          <p className="truncate text-[10px] uppercase tracking-wider text-white/30">{label}</p>
                          <p className="mt-1 text-lg font-bold text-white tabular-nums">{fmt(row.netSales)}</p>
                          <p className="text-[11px] text-zinc-500">
                            {row.orders} order{row.orders === 1 ? "" : "s"}
                            {"grossProfit" in row ? ` · GP ${fmt(gp)} · refunds ${fmt(refunds)}` : ""}
                          </p>
                        </div>
                        );
                      })}
                    </div>
                    {emailMix && emailMix.orders > 0 && (
                      <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-500/[0.06] p-4">
                        <p className="text-sm font-semibold text-teal-100">Email last-click is till</p>
                        <p className="mt-1 text-xs leading-relaxed text-white/50">
                          Woo last-click email is {emailMix.orders} orders ({fmt(emailMix.netSales)}).
                          That is this mix — not Brevo delivered and not Pixel ROAS. RFM below is store
                          emails on the order, a different clock from ESP unique opens.
                        </p>
                        <Link
                          href="/email"
                          className="mt-2 inline-flex text-[11px] font-semibold text-teal-300 hover:text-teal-200"
                        >
                          Open Email desk
                        </Link>
                      </div>
                    )}
                  </div>
                </AnimatedSection>
              )}

              {lowStock.length > 0 && (
                <AnimatedSection delay={0.14}>
                  <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.06] p-6">
                    <h2 className="text-sm font-semibold text-amber-100">Low / out of stock</h2>
                    <p className="mt-0.5 text-xs text-amber-100/60">Do not scale ads on these SKUs until stock recovers</p>
                    <ul className="mt-3 space-y-2">
                      {lowStock.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-white">{p.name}</span>
                          <span className="shrink-0 text-xs capitalize text-amber-200">{p.stockStatus} · {p.stockQty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </AnimatedSection>
              )}

              {people && (people.rfm.length > 0 || people.top.length > 0) && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  {people.rfm.length > 0 && (
                    <AnimatedSection className="lg:col-span-5">
                      <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                        <h2 className="text-sm font-semibold text-white/80">RFM from Woo emails</h2>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {people.lifetimeCustomers} identified · {people.guestOrders} guest orders ignored
                        </p>
                        <div className="mt-4 h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={people.rfm} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                                {people.rfm.map((row) => (
                                  <Cell key={row.name} fill={row.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                content={(props: TooltipContentProps<number, string>) => {
                                  if (!props.active || !props.payload?.length) return null;
                                  const row = props.payload[0];
                                  return (
                                    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-xs">
                                      <p className="font-medium text-white">{row.name}</p>
                                      <p className="text-white/60">{row.value} customers</p>
                                    </div>
                                  );
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                          {people.rfm.map((row) => (
                            <li key={row.name} className="flex justify-between">
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                                {row.name}
                              </span>
                              <span className="tabular-nums text-white/70">{row.value}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </AnimatedSection>
                  )}
                  {people.top.length > 0 && (
                    <AnimatedSection className={people.rfm.length > 0 ? "lg:col-span-7" : "lg:col-span-12"} delay={0.05}>
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                        <div className="border-b border-white/5 p-6 pb-4">
                          <h2 className="text-sm font-semibold text-white/80">Top customers by lifetime net</h2>
                          <p className="mt-0.5 text-xs text-zinc-400">Emails from synced Woo orders — not demo names</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30">
                                <th className="px-6 py-3 font-medium">Email</th>
                                <th className="px-4 py-3 font-medium">Segment</th>
                                <th className="px-4 py-3 font-medium">Orders</th>
                                <th className="px-6 py-3 text-right font-medium">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {people.top.map((row) => (
                                <tr key={row.email} className="border-b border-white/5 last:border-0">
                                  <td className="px-6 py-3 font-medium text-white">{row.email}</td>
                                  <td className="px-4 py-3">
                                    <span
                                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                      style={{
                                        color: RFM_SEGMENT_COLOR[row.segment as RfmSegment],
                                        backgroundColor: `${RFM_SEGMENT_COLOR[row.segment as RfmSegment]}22`,
                                      }}
                                    >
                                      {row.segment}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 tabular-nums text-white/70">{row.orders}</td>
                                  <td className="px-6 py-3 text-right tabular-nums text-white">{fmt(row.netSales)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </AnimatedSection>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6 px-1">
        {/* Header */}
        <AnimatedSection>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-amber-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">WooCommerce customer intelligence</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Customer Intelligence</span>
              </h1>
              <p className="text-sm text-zinc-400">RFM segmentation, lifetime value and churn predictions for 34,892 customers</p>
            </div>
            <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-transform hover:scale-[1.02]">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </AnimatedSection>

        {/* KPI summary */}
        <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <motion.div key={kpi.label} variants={fadeInUp} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:border-white/20">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${kpi.color}20` }}>
                    <Icon className="h-5 w-5" style={{ color: kpi.color }} />
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">{kpi.delta}</span>
                </div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">{kpi.label}</p>
                <p className="mt-1 text-3xl font-bold text-white">
                  <AnimatedCounter target={kpi.value} prefix={kpi.prefix === "€" ? symbol : kpi.prefix} suffix={kpi.suffix} decimals={kpi.decimals} className="tabular-nums" />
                </p>
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" style={{ backgroundColor: kpi.color }} />
              </motion.div>
            );
          })}
        </StaggerContainer>

        {/* RFM donut + churn risk */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <AnimatedSection className="lg:col-span-7">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-white/80">RFM Segmentation</h2>
              </div>
              <p className="text-xs text-zinc-400">Recency · Frequency · Monetary — 6 behavioral cohorts</p>
              <div className="relative mt-4 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={RFM} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="88%" paddingAngle={2} strokeWidth={0}>
                      {RFM.map((s) => (
                        <Cell key={s.name} fill={s.color} fillOpacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }: TooltipContentProps<number, string>) => {
                        if (!active || !payload?.length) return null;
                        const seg = RFM.find((s) => s.name === payload[0]?.name);
                        const total = RFM.reduce((acc, s) => acc + s.value, 0);
                        const value = Number(payload[0]?.value ?? 0);
                        return (
                          <div className="rounded-lg border border-white/10 bg-gray-950/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg?.color }} />
                              <span className="font-medium text-white">{seg?.name}</span>
                            </div>
                            <p className="mt-1 text-white/50">
                              {value.toLocaleString()} customers · <span className="font-semibold text-white">{((value / total) * 100).toFixed(0)}%</span>
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold text-white">
                    <AnimatedCounter target={34892} className="tabular-nums" />
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">Customers</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {RFM.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-[11px] text-zinc-400">{s.name}</span>
                    <span className="ml-auto text-[11px] font-semibold text-white tabular-nums">{s.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection className="lg:col-span-5" delay={0.1}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h2 className="text-sm font-semibold text-white/80">Churn Risk Predictions</h2>
              </div>
              <p className="mb-4 text-xs text-zinc-400">ML model flagged 412 customers — top 3 by revenue at risk</p>
              <div className="space-y-3">
                {CHURN_RISK.map((c, i) => (
                  <div key={c.email} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{c.name}</p>
                        <p className="text-[10px] text-zinc-400">{c.email} · LTV {c.ltv.replace("€", symbol)}</p>
                      </div>
                      <span className={`text-lg font-bold tabular-nums ${c.risk >= 80 ? "text-red-400" : c.risk >= 70 ? "text-amber-400" : "text-yellow-400"}`}>{c.risk}%</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${c.risk}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.2 + i * 0.15, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">Predicted LTV loss <span className="font-semibold text-white/70">{c.loss.replace("€", symbol)}</span></span>
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{c.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Customer table */}
        <AnimatedSection>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/5 p-6 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-white/80">Customer Directory</h2>
                <p className="mt-0.5 text-xs text-zinc-400">Top customers by lifetime value</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold text-white/50">15 OF 34,892</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30">
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">LTV</th>
                    <th className="px-4 py-3 font-medium">Orders</th>
                    <th className="px-4 py-3 font-medium">Segment</th>
                    <th className="px-6 py-3 text-right font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {CUSTOMERS.map((c) => (
                    <tr key={c.email} className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]">
                      <td className="px-6 py-3">
                        <p className="font-medium text-white">{c.name}</p>
                        <p className="text-[11px] text-zinc-400">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white tabular-nums">{format(c.ltv)}</td>
                      <td className="px-4 py-3 text-zinc-400 tabular-nums">{c.orders}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEGMENT_STYLES[c.segment]}`}>{c.segment}</span>
                      </td>
                      <td className="px-6 py-3 text-right text-zinc-400">{c.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
