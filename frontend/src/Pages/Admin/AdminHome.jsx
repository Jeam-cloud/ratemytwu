import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import AdminExportModal from "./AdminExportModal"
import styles from "../../css/AdminHome.module.css"

export default function AdminHome() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [forbidden, setForbidden] = useState(false)
    const [error, setError] = useState(null)
    const [exportOpen, setExportOpen] = useState(false)

    // Fast-track queue: pending professor takedowns, actionable right here
    // without leaving the dashboard. Kept in its own piece of state (not
    // part of /admin/stats) so approving/dismissing one can update this
    // list instantly without re-fetching the whole dashboard.
    const [takedowns, setTakedowns] = useState([])
    const [takedownsLoading, setTakedownsLoading] = useState(true)
    const [resolvingId, setResolvingId] = useState(null)
    const [notes, setNotes] = useState({})

    const authHeaders = useCallback(async () => {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error("Not signed in")
        return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const headers = await authHeaders()

            const res = await fetch(`${API_URL}/admin/stats`, { headers })
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
    }, [authHeaders])

    const loadTakedowns = useCallback(async () => {
        setTakedownsLoading(true)
        try {
            const headers = await authHeaders()
            const res = await fetch(
                `${API_URL}/admin/reports?category=professor_takedown&status=pending`,
                { headers }
            )
            if (res.ok) setTakedowns(await res.json())
        } catch {
            // stats panel already surfaces the error state; keep this quiet
        } finally {
            setTakedownsLoading(false)
        }
    }, [authHeaders])

    useEffect(() => { load(); loadTakedowns() }, [load, loadTakedowns])

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            setStats(null)
            setForbidden(false)
            setLoading(true)
            setTakedowns([])
            load()
            loadTakedowns()
        })
        return () => subscription.unsubscribe()
    }, [load, loadTakedowns])

    const resolveTakedown = async (reportId, resolution) => {
        if (resolution === "deleted") {
            const ok = window.confirm(
                "This permanently deletes the professor and every review on their profile. " +
                "This cannot be undone — there is no restore for a deletion. Continue?"
            )
            if (!ok) return
        }
        setResolvingId(reportId)
        try {
            const headers = await authHeaders()
            const res = await fetch(`${API_URL}/admin/reports/${reportId}/resolve`, {
                method: "POST",
                headers,
                body: JSON.stringify({ resolution, note: notes[reportId] || null }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError(body.detail || "Couldn't resolve this takedown request.")
                return
            }
            setTakedowns(prev => prev.filter(r => r.id !== reportId))
            // stats card (pending_professor_takedowns / pending_site_reports) is now stale by one — refresh it
            load()
        } catch (e) {
            setError(e.message || "Couldn't resolve this takedown request.")
        } finally {
            setResolvingId(null)
        }
    }

    if (forbidden) {
        return (
            <Layout wide>
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

    // Simple breakdown chart data — no charting library, just bars sized
    // by percentage of the largest value in the set. Keeps this dependency-free.
    const queueBreakdown = stats ? [
        { label: "Review flags", value: stats.pending_flags, color: "#c9a84c" },
        { label: "Professor takedowns", value: stats.pending_professor_takedowns, color: "#92400e" },
        { label: "Other site reports", value: Math.max(stats.pending_site_reports - stats.pending_professor_takedowns, 0), color: "#2563eb" },
    ] : []
    const maxBreakdown = Math.max(1, ...queueBreakdown.map(b => b.value))

    const hiddenPct = stats && stats.total_reviews > 0
        ? Math.round((stats.hidden_reviews / stats.total_reviews) * 100)
        : 0

    return (
        <Layout wide>
            <div className={styles.page}>
                <div className={styles.pageHeader}>
                    <div>
                        <h1 className={styles.title}>Admin</h1>
                        <p className={styles.subtitle}>Operator-only tools for RateMyTWU.</p>
                    </div>
                    <button className={styles.exportTrigger} onClick={() => setExportOpen(true)}>
                        Export audit log as PDF
                    </button>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                {!loading && stats && (
                    <>
                        <div className={styles.statGrid}>
                            <StatCard
                                label="Pending review flags"
                                value={stats.pending_flags}
                                tone={stats.pending_flags > 0 ? "warn" : "ok"}
                                sub={daysSinceOldestPending !== null ? `Oldest: ${daysSinceOldestPending} day${daysSinceOldestPending === 1 ? "" : "s"} ago` : "None waiting"}
                            />
                            <StatCard
                                label="Pending site reports"
                                value={stats.pending_site_reports}
                                tone={stats.pending_professor_takedowns > 0 ? "warn" : stats.pending_site_reports > 0 ? "neutral" : "ok"}
                                sub={stats.pending_professor_takedowns > 0 ? `${stats.pending_professor_takedowns} professor takedown${stats.pending_professor_takedowns === 1 ? "" : "s"}` : "None waiting"}
                            />
                            <StatCard
                                label="Resolved flags (7 days)"
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

                        <div className={styles.chartRow}>
                            <div className={styles.chartCard}>
                                <p className={styles.chartTitle}>Pending queue breakdown</p>
                                <div className={styles.barChart}>
                                    {queueBreakdown.map(b => (
                                        <div key={b.label} className={styles.barRow}>
                                            <span className={styles.barLabel}>{b.label}</span>
                                            <div className={styles.barTrack}>
                                                <div
                                                    className={styles.barFill}
                                                    style={{ width: `${(b.value / maxBreakdown) * 100}%`, background: b.color }}
                                                />
                                            </div>
                                            <span className={styles.barValue}>{b.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.chartCard}>
                                <p className={styles.chartTitle}>Review visibility</p>
                                <div className={styles.donutWrap}>
                                    <div
                                        className={styles.donut}
                                        style={{ background: `conic-gradient(#92400e 0% ${hiddenPct}%, #e5e7eb ${hiddenPct}% 100%)` }}
                                    >
                                        <div className={styles.donutHole}>
                                            <span className={styles.donutPct}>{hiddenPct}%</span>
                                            <span className={styles.donutLabel}>hidden</span>
                                        </div>
                                    </div>
                                    <div className={styles.donutLegend}>
                                        <p><span className={styles.dotHidden} /> {stats.hidden_reviews} hidden</p>
                                        <p><span className={styles.dotVisible} /> {stats.total_reviews - stats.hidden_reviews} visible</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fast-track: professor takedown requests are the highest-priority
                            category (a wrongly-listed or disputed profile carries real risk),
                            so they get their own section with actions right on the dashboard
                            instead of only living inside the general reports queue. */}
                        <div className={styles.takedownSection}>
                            <div className={styles.takedownHeader}>
                                <h2 className={styles.takedownTitle}>Professor takedown requests</h2>
                                <Link to="/admin/takedowns" className={styles.takedownLink}>View all →</Link>
                            </div>

                            {takedownsLoading ? (
                                <p className={styles.empty}>Loading…</p>
                            ) : takedowns.length === 0 ? (
                                <p className={styles.empty}>No pending takedown requests.</p>
                            ) : (
                                <div className={styles.takedownList}>
                                    {takedowns.slice(0, 4).map(r => (
                                        <div key={r.id} className={styles.takedownCard}>
                                            <div className={styles.takedownCardTop}>
                                                <span className={styles.takedownProf}>{r.professor_name || "Unlisted professor"}</span>
                                                <span className={styles.takedownDate}>
                                                    {new Date(r.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                                                </span>
                                            </div>
                                            <p className={styles.takedownEmail}>{r.contact_email}</p>
                                            <p className={styles.takedownDesc}>{r.description}</p>
                                            <input
                                                type="text"
                                                className={styles.takedownNote}
                                                placeholder="Optional note…"
                                                value={notes[r.id] || ""}
                                                onChange={(e) => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                                            />
                                            <div className={styles.takedownBtns}>
                                                <button
                                                    className={styles.takedownDismiss}
                                                    disabled={resolvingId === r.id}
                                                    onClick={() => resolveTakedown(r.id, "dismissed")}
                                                >
                                                    Dismiss
                                                </button>
                                                <button
                                                    className={styles.takedownApprove}
                                                    disabled={resolvingId === r.id}
                                                    onClick={() => resolveTakedown(r.id, "approved")}
                                                >
                                                    Hide
                                                </button>
                                                <button
                                                    className={styles.takedownDelete}
                                                    disabled={resolvingId === r.id}
                                                    onClick={() => resolveTakedown(r.id, "deleted")}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {takedowns.length > 4 && (
                                <p className={styles.takedownMore}>
                                    +{takedowns.length - 4} more — <Link to="/admin/takedowns">view all</Link>
                                </p>
                            )}
                        </div>

                        <div className={styles.cardGrid}>
                            <Link to="/admin/flags" className={styles.actionCard}>
                                <span className={styles.actionTitle}>Report queue</span>
                                <span className={styles.actionBody}>
                                    Review and resolve flagged reviews. {stats.pending_flags > 0 && `${stats.pending_flags} waiting.`}
                                </span>
                            </Link>
                            <Link to="/admin/takedowns" className={styles.actionCard}>
                                <span className={styles.actionTitle}>Professor takedowns</span>
                                <span className={styles.actionBody}>
                                    High-priority deletion requests. {stats.pending_professor_takedowns > 0 && `${stats.pending_professor_takedowns} waiting.`}
                                </span>
                            </Link>
                            <Link to="/admin/hidden-professors" className={styles.actionCard}>
                                <span className={styles.actionTitle}>Hidden professors</span>
                                <span className={styles.actionBody}>
                                    Restore a profile that was hidden (not permanently deleted).
                                </span>
                            </Link>
                            <Link to="/admin/reports" className={styles.actionCard}>
                                <span className={styles.actionTitle}>Site reports</span>
                                <span className={styles.actionBody}>
                                    Wrong info and bug reports.
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

            {exportOpen && <AdminExportModal onClose={() => setExportOpen(false)} />}
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
