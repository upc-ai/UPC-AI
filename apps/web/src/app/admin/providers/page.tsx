"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@upc/ui";
import styles from "../admin-panel.module.css";

interface ProviderRow {
  name: string;
  baseUrl?: string;
  model: string;
  tier: "fast" | "standard" | "frontier";
  source: "panel" | "env" | "builtin";
  keyStatus: "set" | "missing";
  enabled: boolean;
  apiKeyEnv?: string;
  apiKeyName?: string;
  costPerMTokIn?: number;
  costPerMTokOut?: number;
}

interface ProvidersData {
  providers: ProviderRow[];
  quota: { daily_message_limit: number };
  keyEnvHints: string[];
}

/** Editable shape for panel-managed providers (what the PUT accepts). */
interface Editable {
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  apiKeyName: string;
  model: string;
  tier: "fast" | "standard" | "frontier";
  costPerMTokIn: number;
  costPerMTokOut: number;
  enabled: boolean;
}

const EMPTY: Editable = {
  name: "",
  baseUrl: "",
  apiKeyEnv: "",
  apiKeyName: "",
  model: "",
  tier: "standard",
  costPerMTokIn: 0,
  costPerMTokOut: 0,
  enabled: true,
};

export default function AdminProvidersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [editable, setEditable] = useState<Editable[]>([]);
  const [quota, setQuota] = useState(20);
  const [hints, setHints] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<ProvidersData>("/api/v1/admin/providers");
      setRows(r.providers ?? []);
      setEditable(
        (r.providers ?? [])
          .filter((p) => p.source === "panel")
          .map((p) => ({
            name: p.name,
            baseUrl: p.baseUrl ?? "",
            apiKeyEnv: p.apiKeyEnv ?? "",
            apiKeyName: p.apiKeyName ?? p.name,
            model: p.model,
            tier: p.tier,
            costPerMTokIn: p.costPerMTokIn ?? 0,
            costPerMTokOut: p.costPerMTokOut ?? 0,
            enabled: p.enabled,
          })),
      );
      setQuota(r.quota?.daily_message_limit ?? 20);
      setHints(r.keyEnvHints ?? []);
    } catch {
      /* error surfaces on next render */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (i: number, patch: Partial<Editable>) => {
    setEditable((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const add = () => setEditable((prev) => [...prev, { ...EMPTY }]);

  const remove = (i: number) => setEditable((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (saving) return;
    const bad = editable.find((p) => !p.name.trim() || !p.baseUrl.trim() || !p.model.trim() || !p.apiKeyEnv.trim());
    if (bad) {
      toast.error("Every provider needs a name, base URL, model, and key env var.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/v1/admin/providers", {
        method: "PUT",
        body: JSON.stringify({
          providers: editable.map((p) => ({
            ...p,
            name: p.name.trim(),
            baseUrl: p.baseUrl.trim(),
            model: p.model.trim(),
            apiKeyEnv: p.apiKeyEnv.trim(),
            apiKeyName: p.apiKeyName.trim() || p.name.trim(),
          })),
          daily_message_limit: quota,
        }),
      });
      await load();
      toast.success("Saved — routing and quota are live immediately.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.content}>
      <h1 className={styles.title}>Providers & Models</h1>
      <p className={styles.subtitle}>
        Add or change AI models without a redeploy. Users always see UPC-1 / Plus / Pro — the tier decides which.
      </p>

      <section className={styles.card} aria-label="Managed providers">
        <h2 className={styles.cardTitle}>Your providers (live — take effect instantly)</h2>
        <p className={styles.note}>
          API keys are NEVER stored in the database. Each provider points at an environment variable
          (e.g. <code>GEMINI_API_KEY</code>) that holds the key — set those once in Vercel; everything else
          changes here. Order within a tier decides failover priority: your providers first, then env
          customs, then built-ins.
        </p>
        {editable.map((p, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0", borderTop: "1px solid var(--app-hairline)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <div>
                <label className={styles.label}>Name</label>
                <input className={styles.input} value={p.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="gemini-main" />
              </div>
              <div>
                <label className={styles.label}>Model</label>
                <input className={styles.input} value={p.model} onChange={(e) => update(i, { model: e.target.value })} placeholder="gemini-flash-latest" />
              </div>
              <div>
                <label className={styles.label}>Serves tier</label>
                <select className={styles.input} value={p.tier} onChange={(e) => update(i, { tier: e.target.value as Editable["tier"] })}>
                  <option value="fast">UPC-1 (fast)</option>
                  <option value="standard">UPC-1 Plus (standard)</option>
                  <option value="frontier">UPC-1 Pro (frontier)</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <div>
                <label className={styles.label}>Base URL (OpenAI-compatible)</label>
                <input className={styles.input} value={p.baseUrl} onChange={(e) => update(i, { baseUrl: e.target.value })} placeholder="https://generativelanguage.googleapis.com/v1beta/openai" />
              </div>
              <div>
                <label className={styles.label}>Key env var</label>
                <input
                  className={styles.input}
                  value={p.apiKeyEnv}
                  onChange={(e) => update(i, { apiKeyEnv: e.target.value })}
                  placeholder="GEMINI_API_KEY"
                  list="key-env-hints"
                />
              </div>
              <div>
                <label className={styles.label}>Key label (shown in panel)</label>
                <input className={styles.input} value={p.apiKeyName} onChange={(e) => update(i, { apiKeyName: e.target.value })} placeholder="Gemini main key" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <div style={{ width: 130 }}>
                <label className={styles.label}>$ / 1M in</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={p.costPerMTokIn} onChange={(e) => update(i, { costPerMTokIn: Number(e.target.value) })} />
              </div>
              <div style={{ width: 130 }}>
                <label className={styles.label}>$ / 1M out</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={p.costPerMTokOut} onChange={(e) => update(i, { costPerMTokOut: Number(e.target.value) })} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--app-muted)" }}>
                <input type="checkbox" checked={p.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
                Enabled
              </label>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => remove(i)} type="button">Remove</button>
            </div>
          </div>
        ))}
        <datalist id="key-env-hints">
          {hints.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className={styles.btn} onClick={add} type="button">+ Add provider</button>
        </div>
      </section>

      <section className={styles.card} aria-label="Quota">
        <h2 className={styles.cardTitle}>Daily message limit</h2>
        <p className={styles.note}>
          Applies to UPC-1 and UPC-1 Plus per user per IST day. UPC-1 Pro stays unrestricted. Saved with the button above.
        </p>
        <div style={{ maxWidth: 160 }}>
          <input className={styles.input} type="number" min={0} max={1000} value={quota} onChange={(e) => setQuota(Number(e.target.value))} />
        </div>
      </section>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void save()} disabled={saving} type="button">
          {saving ? "Saving…" : "Save — live immediately"}
        </button>
      </div>

      <section className={styles.card} aria-label="Effective routing">
        <h2 className={styles.cardTitle}>Effective routing (what chat actually uses)</h2>
        {!loaded ? (
          <div className={styles.loading}>Loading…</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Tier</th>
                  <th>Source</th>
                  <th>Key</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={`${p.source}-${p.name}-${i}`}>
                    <td className={styles.tinyMuted}>{i + 1}</td>
                    <td>{p.name}</td>
                    <td className={styles.mono}>{p.model}</td>
                    <td>{p.tier}</td>
                    <td><span className={styles.chipSource}>{p.source === "panel" ? "this panel" : p.source}</span></td>
                    <td>
                      <span className={p.keyStatus === "set" ? `${styles.chip} ${styles.chipGood}` : `${styles.chip} ${styles.chipBad}`}>
                        {p.keyStatus === "set" ? "key set" : "key missing"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.note}>
          Failover order: your panel providers → env providers → built-ins. Within a tier, earlier rows serve first.
        </p>
      </section>
    </div>
  );
}
