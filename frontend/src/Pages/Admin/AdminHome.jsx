import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/AdminHome.module.css"

export default function AdminHome() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [forbidden, setForbidden] = useState(false)
    const [error, setError] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const { data } = await supabase.auth.getSession()
            const token = data.session?.access_token
            if (!token) throw new Error("Not signed in")

            const res = await fetch(`${API_URL}/admin/stats`, {
                headers: { "Authorization": `Bearer ${token}` },
            })

            if (res.status === 403) {
                setForbidden(true)
                return
            }
            if (!res.ok) {
                setError("Couldn't load dashboard stats.")
                return
            }
            setForbidden(false)
            setStats(await res.json())
        } catch (e) {
            setError(e.message || "Something went wrong.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            setStats(null)
            setForbidden(false)
            setLoading(true)
            load()
        })
        return () => subscription.unsubscribe()
    }, [load])

    if (forbidden) {
        return (
            <Layout>
                <div className={styles.page}>
                    <p className={styles.forbidden}>
                        You don't have access to the admin dashboard. If you're one of the operators,
                        make sure your account ID is listed in <code>ADMIN_USER_IDS</code>.
                    </p>
                </div>
            </Layout>
        )
    }

    const daysSinceOldestPending = (() => {
        if (!stats?.oldest_pending_reported_at) return null
        const ms = Date.now() - new Date(stats.oldest_pending_reported_at).getTime()
        return Math.floor(ms / (1000 * 60 * 60 * 24))
    })()

    return (
        <Layout>
            <div className={styles.page}>
                <h1 className={styles.title}>Admin</h1>
                <p className={styles.subtitle}>Operator-only tools for RateMyTWU.</p>

                {error && <p className={styles.error}>{error}</p>}

                {!loading && stats && (
                    <>
                        <div className={styles.statGrid}>
                            <StatCard
                                label="Pending reports"
                                value={stats.pending_flags}
                                tone={stats.pending_flags > 0 ? "warn" : "ok"}
                                sub={daysSinceOldestPending !== null ? `Oldest: ${daysSinceOldestPending} day${daysSinceOldestPending === 1 ? "" : "s"} ago` : "None waiting"}
                            />
                            <StatCard
                                label="Resolved (7 days)"
                                value={stats.resolved_last_7_days}
                                sub={`${stats.removed_last_7_days} removed`}
                            />
                            <StatCard
                                label="Hidden reviews"
                                value={stats.hidden_reviews}
                                sub="Currently off public pages"
                            />
                            <StatCard
                                label="Total reviews"
                                value={stats.total_reviews}
                                sub={`${stats.total_professors} professors · ${stats.total_courses} courses`}
                            />
                        </div>

                        <div className={styles.cardGrid}>
                            <Link to="/admin/flags" className={styles.actionCard}>
                                <span className={styles.actionTitle}>Report queue</span>
                                <span className={styles.actionBody}>
                                    Review and resolve flagged content. {stats.pending_flags > 0 && `${stats.pending_flags} waiting.`}
                                </span>
                            </Link>
                            <Link to="/admin/audit-log" className={styles.actionCard}>
                                <span className={styles.actionTitle}>Audit log</span>
                                <span className={styles.actionBody}>
                                    The full, permanent record of every report decision made.
                                </span>
                            </Link>
                        </div>
                    </>
                )}

                {loading && <p className={styles.empty}>Loading…</p>}
            </div>
        </Layout>
    )
}

function StatCard({ label, value, sub, tone = "neutral" }) {
    const toneClass = tone === "warn" ? styles.statWarn : tone === "ok" ? styles.statOk : ""
    return (
        <div className={styles.statCard}>
            <p className={styles.statLabel}>{label}</p>
            <p className={`${styles.statValue} ${toneClass}`}>{value}</p>
            {sub && <p className={styles.statSub}>{sub}</p>}
        </div>
    )
}
