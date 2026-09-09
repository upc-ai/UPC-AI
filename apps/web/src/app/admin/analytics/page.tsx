"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button, useToast } from "@upc/ui";
import styles from "../admin-panel.module.css";

interface AnalyticsData {
  window_days: number;
  usage: { day: string; messages: number; active_users: number }[];
  models: { model: string; provider: string; responses: number; tokens_in: string | number; tokens_out: string | number; cost_usd: number; avg_first_token_ms: number }[];
  month: { month_cost_usd: number; tokens_in: string | number; tokens_out: string | number };
  feedback: { thumbs_up: number; thumbs_down: number };
  top_documents: { title: string; citations: number }[];
}

function fmtUsd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function fmtNum(n: string | number): string {
  return new Intl.NumberFormat("en-IN").format(Number(n ?? 0));
}

interface UnansweredData {
  questions: { question: string; times_asked: number; last_asked: string; fully_refused: boolean; best_score: number | null }[];
  refused_count: number;
  total_count: number;
  window_days: number;
  trend?: {
    refused_this_week: number;
    total_this_week: number;
    refused_last_week: number;
    total_last_week: number;
  };
  top_questions?: { question: string; times_asked: number; last_asked: string; best_score: number | null }[];
}

function UsageChart({ data }: { data: { day: string; messages: number; active_users: number }[] }) {
  if (data.length < 2) {
    return <div className={styles.empty}>Not enough data yet.</div>;
  }
  const W = 640;
  const H = 200;
  const PAD = 28;
  const max = Math.max(1, ...data.map((d) => d.messages));
  const maxU = Math.max(1, ...data.map((d) => d.active_users));
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (data.length - 1);
  const y1 = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const y2 = (v: number) => H - PAD - (v / maxU) * (H - PAD * 2);
  const line1 = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y1(d.messages)}`).join(" ");
  const line2 = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y2(d.active_users)}`).join(" ");

  return (
    <div>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Messages and active users per day">
        <path d={line1} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={line2} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 ? (
            <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.55}>
              {d.day.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div className={styles.chartLegend} style={{ marginTop: 8 }}>
        <span><span className={styles.legendDot} style={{ background: "var(--accent)" }} />Messages / day</span>
        <span><span className={styles.legendDot} style={{ background: "var(--app-muted)" }} />Active users / day</span>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const toast = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unanswered, setUnanswered] = useState<UnansweredData | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await api<AnalyticsData>("/api/v1/admin/analytics?days=30");
        if (alive) setData(r);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load");
      }
      try {
        const u = await api<UnansweredData>("/api/v1/admin/analytics/unanswered?days=30");
        if (alive) setUnanswered(u);
      } catch {
        /* card shows its own empty state */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className={styles.empty}>{error}</div>;
  if (!data) return <div className={styles.loading}>Loading analytics…</div>;

  const totalFeedback = data.feedback.thumbs_up + data.feedback.thumbs_down;
  const positiveRate = totalFeedback ? Math.round((data.feedback.thumbs_up / totalFeedback) * 100) : null;

  return (
    <div className={styles.content}>
      <h1 className={styles.title}>Analytics</h1>
      <p className={styles.subtitle}>Last {data.window_days} days, computed live from every AI turn.</p>

      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>AI cost · this month</span>
          <span className={styles.statValue}>{fmtUsd(data.month.month_cost_usd)}</span>
          <span className={styles.statHint}>{fmtNum(data.month.tokens_in)} in · {fmtNum(data.month.tokens_out)} out tokens</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>👍 feedback</span>
          <span className={styles.statValue}>{data.feedback.thumbs_up}</span>
          <span className={styles.statHint}>vs {data.feedback.thumbs_down} 👎{positiveRate !== null ? ` · ${positiveRate}% positive` : ""}</span>
        </div>
      </div>

      <section className={styles.card} aria-label="Usage">
        <h2 className={styles.cardTitle}>Usage · messages & active users</h2>
        <UsageChart data={data.usage} />
      </section>

      <section className={styles.card} aria-label="Model usage">
        <h2 className={styles.cardTitle}>Model usage & cost</h2>
        {data.models.length === 0 ? (
          <div className={styles.empty}>No AI responses recorded yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Responses</th>
                  <th>Tokens in</th>
                  <th>Tokens out</th>
                  <th>Cost</th>
                  <th>Avg first token</th>
                </tr>
              </thead>
              <tbody>
                {data.models.map((m) => (
                  <tr key={`${m.provider}/${m.model}`}>
                    <td className={styles.mono}>{m.model}</td>
                    <td className={styles.muted}>{m.provider}</td>
                    <td>{fmtNum(m.responses)}</td>
                    <td>{fmtNum(m.tokens_in)}</td>
                    <td>{fmtNum(m.tokens_out)}</td>
                    <td>{fmtUsd(m.cost_usd)}</td>
                    <td className={styles.muted}>{m.avg_first_token_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card} aria-label="Top cited documents">
        <h2 className={styles.cardTitle}>Most-cited documents</h2>
        {data.top_documents.length === 0 ? (
          <div className={styles.empty}>Nothing cited yet — publish documents and ask questions about them.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Citations</th>
                </tr>
              </thead>
              <tbody>
                {data.top_documents.map((d) => (
                  <tr key={d.title}>
                    <td>{d.title}</td>
                    <td>{d.citations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card} aria-label="Unanswered questions">
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardTitle}>Questions the AI couldn&apos;t answer</h2>
          {unanswered && unanswered.questions.length > 0 && (
            <Button
              onClick={() => {
                const text = [
                  `Questions UPC AI couldn't answer (last ${unanswered.window_days} days):`,
                  ...unanswered.questions.map((q) => `- ${q.question} (asked ${q.times_asked}×, ${q.fully_refused ? "no answer" : "weak match"})`),
                ].join("\n");
                void navigator.clipboard.writeText(text).then(
                  () => toast.success("Question list copied — paste it in the chat to tune the knowledge base."),
                  () => toast.error("Copy failed — select the table manually."),
                );
              }}
            >
              Copy list
            </Button>
          )}
        </div>
        <p className={styles.note}>
          What students asked that the knowledge base couldn&apos;t cover — your to-do list for the next sync or upload.
          {unanswered ? ` (${unanswered.refused_count} refusals out of ${unanswered.total_count} knowledge queries in ${unanswered.window_days} days)` : ""}
        </p>
        {unanswered?.trend && (
          <p className={styles.note}>
            This week: {unanswered.trend.refused_this_week} unanswered of {unanswered.trend.total_this_week} queries ·
            last week: {unanswered.trend.refused_last_week} of {unanswered.trend.total_last_week}
            {unanswered.trend.total_this_week > 0
              ? unanswered.trend.refused_this_week <= unanswered.trend.refused_last_week
                ? " — coverage is holding or improving."
                : " — coverage slipping, add documents for the topics below."
              : ""}
          </p>
        )}
        {!unanswered ? (
          <div className={styles.loading}>Loading…</div>
        ) : unanswered.questions.length === 0 ? (
          <div className={styles.empty}>Nothing unanswered so far — the knowledge base is covering every question asked.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Asked</th>
                  <th>Last asked</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {unanswered.questions.map((q) => (
                  <tr key={q.question}>
                    <td>{q.question}</td>
                    <td>{q.times_asked}×</td>
                    <td className={styles.muted}>{new Date(q.last_asked).toLocaleDateString()}</td>
                    <td>
                      <span className={styles.chipBad}>{q.fully_refused ? "no answer" : "weak match"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {unanswered && unanswered.top_questions && unanswered.top_questions.length > 0 && (
        <section className={styles.card} aria-label="Top questions">
          <h2 className={styles.cardTitle}>What students are asking</h2>
          <p className={styles.note}>Most frequent knowledge queries — the demand signal for what matters most.</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Asked</th>
                  <th>Last asked</th>
                  <th>Best match</th>
                </tr>
              </thead>
              <tbody>
                {unanswered.top_questions.map((q) => (
                  <tr key={q.question}>
                    <td>{q.question}</td>
                    <td>{q.times_asked}×</td>
                    <td className={styles.muted}>{new Date(q.last_asked).toLocaleDateString()}</td>
                    <td>{q.best_score != null ? q.best_score.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
