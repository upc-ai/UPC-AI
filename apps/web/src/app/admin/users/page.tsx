"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import styles from "../admin-panel.module.css";

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  user_type: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
  roles: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await api<{ users: UserRow[]; total: number }>(`/api/v1/admin/users?q=${encodeURIComponent(q)}`);
          if (alive) {
            setUsers(r.users ?? []);
            setTotal(r.total ?? 0);
          }
        } catch {
          if (alive) setUsers([]);
        } finally {
          if (alive) setLoaded(true);
        }
      })();
    }, 250); // debounce search
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className={styles.content}>
      <h1 className={styles.title}>Users</h1>
      <p className={styles.subtitle}>{total} accounts. Read-only for now — role changes go through the promote CLI.</p>

      <section className={styles.card} aria-label="Users">
        <input
          className={styles.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email or name…"
          style={{ maxWidth: 320 }}
        />
        {!loaded ? (
          <div className={styles.loading}>Loading users…</div>
        ) : users.length === 0 ? (
          <div className={styles.empty}>No matching users.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Logins</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.display_name}</td>
                    <td className={styles.mono}>{u.email}</td>
                    <td>{u.user_type}</td>
                    <td className={styles.muted}>{u.roles || "—"}</td>
                    <td>
                      <span className={u.is_active ? `${styles.chip} ${styles.chipGood}` : `${styles.chip} ${styles.chipBad}`}>
                        {u.is_active ? "active" : "blocked"}
                      </span>
                    </td>
                    <td className={styles.muted}>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "never"}</td>
                    <td className={styles.muted}>{u.login_count}</td>
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
