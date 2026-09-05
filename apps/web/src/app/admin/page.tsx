"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import styles from "./admin-panel.module.css";

interface OverviewData {
  users: { total: number; students: number; faculty: number; active: number };
  today: { messagesToday: number; activeUsersToday: number };
  documents: { published: number; pending: number; failed: number; totalChunks: number };
  trend: { day: string; messages: number; activeUsers: number }[];
  recent: { at: string; actor: string | null; action: string; summary: string | null }[];
  quota: { daily_message_limit: number };
}

function TrendChart({ data }: { data: { day: string; messages: number; activeUsers: number }[] }) {
  if (data.length < 2) {
    return <div className={styles.empty}>Not enough data yet — the trend appears after a few days of usage.</div>;
  }
  const W = 640;
  const H = 200;
  const PAD = 28;
  const max = Math.max(1, ...data.map((d) => d.messages));
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (data.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.messages)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - PAD} L${x(0)},${H - PAD} Z`;

  return (
    <div>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Messages per day, last 7 days">
        <path d={area} fill="color-mix(in srgb, currentColor 8%, transparent)" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={d.day} cx={x(i)} cy={y(d.messages)} r={3} fill="currentColor" />
        ))}
        {data.map((d, i) =>
          i % 2 === 0 ? (
            <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.55}>
              {d.day.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div className={styles.chartLegend} style={{ marginTop: 8 }}>
        <span><span className={styles.legendDot} style={{ background: "var(--accent)" }} />Messages per day (max {max})</span>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await api<OverviewData>("/api/v1/admin/overview");
        if (alive) setData(r);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className={styles.empty}>{error}</div>;
  if (!data) return <div className={styles.loading}>Loading overview…</div>;

  const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);

  return (
    <div className={styles.content}>
      <h1 className={styles.title}>Overview</h1>
      <p className={styles.subtitle}>Live numbers from the UPC AI pilot — users, usage, and knowledge base.</p>

      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Users</span>
          <span className={styles.statValue}>{fmt(data.users.total)}</span>
          <span className={styles.statHint}>{data.users.students} students · {data.users.faculty} faculty · {data.users.active} active</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Messages today</span>
          <span className={styles.statValue}>{fmt(data.today.messagesToday)}</span>
          <span className={styles.statHint}>{data.today.activeUsersToday} active users today (IST)</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Published docs</span>
          <span className={styles.statValue}>{fmt(data.documents.published)}</span>
          <span className={styles.statHint}>{data.documents.pending} in pipeline · {data.documents.failed} failed · {fmt(data.documents.totalChunks)} chunks</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Daily limit</span>
          <span className={styles.statValue}>{data.quota.daily_message_limit}</span>
          <span className={styles.statHint}>messages/user on UPC-1 & Plus</span>
        </div>
      </div>

      <section className={styles.card} aria-label="Usage trend">
        <h2 className={styles.cardTitle}>Usage trend · last 7 days</h2>
        <TrendChart data={data.trend} />
      </section>

      <section className={styles.card} aria-label="Recent activity">
        <h2 className={styles.cardTitle}>Recent activity</h2>
        {data.recent.length === 0 ? (
          <div className={styles.empty}>No activity recorded yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={i}>
                    <td className={styles.mono}>{new Date(r.at).toLocaleString()}</td>
                    <td>{r.actor ?? "—"}</td>
                    <td><span className={styles.chip}>{r.action}</span></td>
                    <td className={styles.muted}>{r.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
