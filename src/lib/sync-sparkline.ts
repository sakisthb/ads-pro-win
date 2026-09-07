/**
 * Connections sparklines from SyncJob rows.
 * Records processed is not ad spend, not delivered email, not list growth.
 */

export type SparkJob = {
  platform: string;
  records: number;
  timestamp: number;
  status: string;
};

export type SparkPoint = {
  label: string;
  records: number;
};

function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function sparklineForPlatform(jobs: SparkJob[], platformId: string, limit = 10): SparkPoint[] {
  return jobs
    .filter((job) => job.platform === platformId)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit)
    .map((job) => ({
      label: utcDay(job.timestamp).slice(5),
      records: job.status === "failed" ? 0 : Math.max(0, job.records),
    }));
}

export function dailySyncVolume(
  jobs: SparkJob[],
  days = 7,
  now = Date.now(),
): { rows: Array<Record<string, string | number>>; keys: string[] } {
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dayKeys.push(utcDay(now - i * 86_400_000));
  }
  const platforms = [...new Set(jobs.map((job) => job.platform))].sort();
  const rows = dayKeys.map((day) => {
    const row: Record<string, string | number> = { day: day.slice(5) };
    for (const platform of platforms) {
      row[platform] = jobs
        .filter(
          (job) =>
            job.platform === platform &&
            job.status === "success" &&
            utcDay(job.timestamp) === day,
        )
        .reduce((sum, job) => sum + Math.max(0, job.records), 0);
    }
    return row;
  });
  const keys = platforms.filter((platform) => rows.some((row) => Number(row[platform]) > 0));
  return { rows, keys };
}
