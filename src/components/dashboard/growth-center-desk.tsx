"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { GrowthDesk } from "@/lib/growth-center";

export function GrowthCenterDesk({ desk }: { desk: GrowthDesk | undefined }) {
  if (!desk || desk.status !== "linked") return null;
  const facts = desk.catalogFacts;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Growth Center</h2>
          <p className="text-xs text-white/40">
            Catalog desk for {desk.hostname}. Not a sixth clock. MFA stays there.
          </p>
        </div>
        <Link
          href={desk.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
        >
          Open Growth Center
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {facts ? (
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-white/40">
              Image issues
            </dt>
            <dd className="mt-1 text-lg font-semibold text-white">
              {facts.imageIssues}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-white/40">
              Pending drafts
            </dt>
            <dd className="mt-1 text-lg font-semibold text-white">
              {facts.pendingDrafts}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-white/40">
              Last accepted
            </dt>
            <dd className="mt-1 text-lg font-semibold text-white">
              {facts.lastAccepted ? (
                facts.lastAccepted.appliedProducts
              ) : (
                <span className="text-sm font-medium text-white/60">None yet</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-white/50">
          Image issues, drafts, and the last accepted batch stay in SACOS. Ads Pro
          does not copy those numbers.
        </p>
      )}
      {desk.reachability === "unreachable" ? (
        <p className="mt-3 text-xs text-amber-200">
          Growth Center did not answer at {desk.origin}. Open it anyway if the
          operator app is on another port.
        </p>
      ) : null}
    </div>
  );
}
