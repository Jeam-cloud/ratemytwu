import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/AdminReports.module.css"

// Professor takedown requests get their own dedicated page (split out of
// AdminReports, which now only handles wrong_info/bug) so this
// highest-priority category isn't mixed in with lower-stakes reports.
export default function AdminTakedowns() {
    const [statusFilter, setStatusFilter] = useState("pending")
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [forbidden, setForbidden] = useState(false)
    const [notes, setNotes] = useState({})
    const [resolvingId, setResolvingId] = useState(null)

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
            const params = new URLSearchParams({ status: statusFilter, category: "professor_takedown" })
            const res = await fetch(`${API_URL}/admin/reports?${params}`, { headers })

            if (res.status === 403) {
                setForbidden(true)
                setReports([])
                return
            }
            if (!res.ok) {
                setError("Couldn't load takedown requests. Try again.")
                return
            }
            setForbidden(false)
            setReports(await res.json())
        } catch (e) {
            setError(e.message || "Something went wrong loading takedown requests.")
        } finally {
            setLoading(false)
        }
    }, [statusFilter, authHeaders])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            setReports([])
            setForbidden(false)
            setLoading(true)
            load()
        })
        return () => subscription.unsubscribe()
    }, [load])

    const resolve = async (reportId, resolution) => {
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
                setError(body.detail || "Couldn't resolve this request.")
                return
            }
            setReports(prev => prev.filter(r => r.id !== reportId))
        } catch (e) {
            setError(e.message || "Couldn't resolve this request.")
        } finally {
            setResolvingId(null)
        }
    }

    if (forbidden) {
        return (
            <Layout>
                <div className={styles.page}>
                    <p className={styles.forbidden}>
                        You don't have access to this queue. If you're one of the operators,
                        make sure your account ID is listed in <code>ADMIN_USER_IDS</code>.
                    </p>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <div className={styles.page}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Professor takedowns</h1>
                        <p className={styles.subtitle}>
                            Highest-priority requests, split out from site reports.
                            "Hide" is reversible from <Link to="/admin/hidden-professors">Hidden professors</Link>.
                            "Delete permanently" is not.
                        </p>
                    </div>
                    <div className={styles.filters}>
                        {["pending", "resolved"].map(s => (
                            <button
                                key={s}
                                className={statusFilter === s ? `${styles.filterBtn} ${styles.filterBtnOn}` : styles.filterBtn}
                                onClick={() => setStatusFilter(s)}
                            >
                                {s === "pending" ? "Pending" : "Resolved"}
                            </button>
                        ))}
                    </div>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                {loading ? (
                    <p className={styles.empty}>Loading…</p>
                ) : reports.length === 0 ? (
                    <p className={styles.empty}>
                        {statusFilter === "pending" ? "No open takedown requests." : "No resolved takedown requests yet."}
                    </p>
                ) : (
                    <div className={styles.list}>
                        {reports.map(r => (
                            <div key={r.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <div className={styles.cardTopLeft}>
                                        <span className={`${styles.categoryBadge} ${styles.badgeTakedown}`}>
                                            Professor takedown
                                        </span>
                                        {r.professor_name && <span className={styles.profName}>{r.professor_name}</span>}
                                    </div>
                                    <span className={styles.reportedAt}>
                                        {new Date(r.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                </div>

                                <p className={styles.contactEmail}>{r.contact_email}</p>
                                <p className={styles.description}>{r.description}</p>

                                {r.status === "resolved" ? (
                                    <div className={styles.resolvedInfo}>
                                        <span className={styles.resolutionBadge}>{r.resolution}</span>
                                        {r.resolution_note && <span className={styles.resolutionNote}>{r.resolution_note}</span>}
                                        <span className={styles.resolvedAt}>
                                            {r.resolved_at && new Date(r.resolved_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                    </div>
                                ) : (
                                    <div className={styles.actions}>
                                        <input
                                            type="text"
                                            className={styles.noteInput}
                                            placeholder="Optional note (why you decided this)…"
                                            value={notes[r.id] || ""}
                                            onChange={(e) => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                                        />
                                        <div className={styles.actionBtns}>
                                            <button
                                                className={styles.dismissBtn}
                                                disabled={resolvingId === r.id}
                                                onClick={() => resolve(r.id, "dismissed")}
                                            >
                                                Dismiss
                                            </button>
                                            <button
                                                className={styles.approveBtn}
                                                disabled={resolvingId === r.id}
                                                onClick={() => resolve(r.id, "approved")}
                                            >
                                                Hide profile
                                            </button>
                                            <button
                                                className={styles.deleteBtn}
                                                disabled={resolvingId === r.id}
                                                onClick={() => resolve(r.id, "deleted")}
                                            >
                                                Delete permanently
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    )
}
