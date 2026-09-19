"use client";

import { api } from "@/lib/trpc/react";
import { GOOGLE_REPORTING_QUERY_SCOPE } from "@/lib/google-reporting-scope";

const count = (value: number | null) => value === null ? "unknown" : value.toLocaleString();

/** Read-only evidence. Never launches Sync or OAuth to obtain a receipt. */
export function GoogleCoveragePanel({ adAccountId }: { adAccountId: string }) {
  const query = api.syncStatus.getGoogleCoverage.useQuery({ adAccountId });
  let notice: string | null = null;
  if (query.isLoading) notice = "Loading Google reporting receipts…";
  else if (query.isError) notice = "Coverage receipts could not be loaded. Reporting remains unverified.";
  else if (query.data?.availability === "migration_required") notice = "Coverage receipt migration is not applied. No run coverage is verified.";
  else if (!query.data?.jobs.length) notice = "No Google reporting runs with coverage evidence. Reporting remains unverified.";

  return (
    <section aria-label="Google reporting receipts" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/70">
      <h2 className="font-semibold text-white/90">Google reporting receipts</h2>
      <p className="mt-1 text-white/45">Run-specific evidence, not a completeness guarantee for the Dashboard&apos;s selected window. Check each run&apos;s campaign scope.</p>
      {notice ? <p role="status" className="mt-3 text-amber-200">{notice}</p> : (
        <div className="mt-3 space-y-3">
          {query.data?.jobs.slice(0, 3).map((job) => {
            const receipt = job.coverageReceipt;
            if (!receipt) return <div key={job.id} className="border-t border-white/10 pt-3">
              <p className="font-mono text-white/45">Run {job.id} · {job.status}</p>
              <p className="mt-1 text-amber-200">No coverage receipt for this run. Legacy success does not verify a reporting window.</p>
            </div>;
            const historicalScope = receipt.queryScope === GOOGLE_REPORTING_QUERY_SCOPE;
            const knownScope = historicalScope || receipt.queryScope === "non_removed_campaigns";
            const complete = receipt.version === 1 && Boolean(receipt.completedAt)
              && knownScope && receipt.transport === "google_ads_search_stream"
              && job.status === "completed" && receipt.status === "completed" && !receipt.storageMayBePartial
              && Boolean(receipt.providerTimezone) && receipt.metricRowsFetched !== null && receipt.campaignRowsFetched !== null
              && receipt.metricRowsPersisted !== null && receipt.campaignRowsPersisted !== null;
            return <div key={job.id} className="space-y-1 border-t border-white/10 pt-3">
              <p className={complete ? "font-semibold text-emerald-200" : "font-semibold text-amber-200"}>{complete ? "Completed scoped run" : "Unverified run"}</p>
              <p className="font-mono text-white/50">Run {job.id} · {job.status} / {receipt.status} · {receipt.executionPath} · stage {receipt.stage}</p>
              <p className="text-white/45">{receipt.transport} · {receipt.providerApiVersion} · {receipt.queryScope}</p>
              <p className={historicalScope ? "text-white/55" : "text-amber-200"}>{historicalScope
                ? "Campaign scope: ENABLED, PAUSED and REMOVED. Removed campaigns are reporting-only, never reactivated by Sync."
                : receipt.queryScope === "non_removed_campaigns"
                  ? "Campaign scope: non-removed only. This is not complete historical campaign coverage."
                  : "Campaign scope unknown. Reporting remains unverified."}</p>
              <p>Account {receipt.customerId}{receipt.loginCustomerId ? ` · MCC ${receipt.loginCustomerId}` : ""} · {receipt.providerCurrency ?? "currency unknown"}</p>
              <p>{receipt.startDate} → {receipt.endDate} · {receipt.providerTimezone ?? "provider timezone unknown"}</p>
              <p>Metrics: {count(receipt.metricRowsFetched)} fetched · {count(receipt.metricRowsPersisted)} persisted</p>
              <p>Campaigns: {count(receipt.campaignRowsFetched)} fetched · {count(receipt.campaignRowsPersisted)} persisted</p>
              <p className="text-white/45">{receipt.completedAt ? `Run ended ${receipt.completedAt.toISOString()}` : `Started ${receipt.startedAt.toISOString()}`}</p>
              {receipt.storageMayBePartial ? <p className="text-amber-200">Storage may be partial. Unknown counts are not zero; completed batched writes are not rolled back by a later failure.</p> : null}
              {complete && receipt.metricRowsFetched === 0 ? <p className="text-white/55">0 metric rows returned for this {historicalScope ? "ENABLED, PAUSED and REMOVED" : "non-removed-campaign"} scope and window. This is not evidence of zero all account activity or coverage of a different selected window. Empty results do not clear old stored rows.</p> : null}
            </div>;
          })}
        </div>
      )}
    </section>
  );
}
