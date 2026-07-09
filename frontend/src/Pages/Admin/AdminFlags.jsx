import { useState, useEffect, useCallback } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/AdminFlags.module.css"

const REASON_LABEL = {
    "Inappropriate": "Inappropriate",
    "Fake review": "Fake review",
    "Personal attack": "Personal attack",
    "Wrong info": "Wrong info",
    "Other": "Other",
}

export default function AdminFlags() {
    const [statusFilter, setStatusFilter] = useState("pending")
    const [flags, setFlags] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [forbidden, setForbidden] = useState(false)
    const [notes, setNotes] = useState({})       // flag_id -> note text
    const [resolvingId, setResolvingId] = useState(null)

    const authHeaders = useCallback(async () => {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error("Not signed in")
        return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    }, [])

    const loadFlags = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const headers = await authHeaders()
            const res = await fetch(`${API_URL}/admin/flags?status=${statusFilter}`, { headers })

            if (res.status === 403) {
                setForbidden(true)
                setFlags([])
                return
            }
            if (!res.ok) {
                setError("Couldn't load the report queue. Try again.")
                return
            }
            setForbidden(false)
            const data = await res.json()
            setFlags(data)
        } catch (e) {
            setError(e.message || "Something went wrong loading reports.")
        } finally {
            setLoading(false)
        }
    }, [statusFilter, authHeaders])

    useEffect(() => { loadFlags() }, [loadFlags])

    const resolve = async (flagId, resolution) => {
        setResolvingId(flagId)
        try {
            const headers = await authHeaders()
            const res = await fetch(`${API_URL}/admin/flags/${flagId}/resolve`, {
                method: "POST",
                headers,
                body: JSON.stringify({ resolution, note: notes[flagId] || null }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError(body.detail || "Couldn't resolve this report.")
                return
            }
            // pull it out of the current (pending) view immediately
            setFlags(prev => prev.filter(f => f.id !== flagId))
        } catch (e) {
            setError(e.message || "Couldn't resolve this report.")
        } finally {
            setResolvingId(null)
        }
    }

    if (forbidden) {
        return (
            <Layout>
                <div className={styles.page}>
                    <p className={styles.forbidden}>
                        You don't have access to the moderation queue. If you're one of the operators,
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
                        <h1 className={styles.title}>Report queue</h1>
                        <p className={styles.subtitle}>
                            Reviews flagged by users. Resolve within our stated timelines — acknowledge
                            within 2 business days, decide within 5.
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
                ) : flags.length === 0 ? (
                    <p className={styles.empty}>
                        {statusFilter === "pending" ? "No open reports. Queue is clear." : "No resolved reports yet."}
                    </p>
                ) : (
                    <div className={styles.list}>
                        {flags.map(flag => (
                            <div key={flag.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <div>
                                        <span className={styles.reasonBadge}>{REASON_LABEL[flag.reason] || flag.reason}</span>
                                        {flag.other_text && <span className={styles.otherText}>&ldquo;{flag.other_text}&rdquo;</span>}
                                        {flag.review_is_hidden && <span className={styles.hiddenBadge}>Hidden from public view</span>}
                                    </div>
                                    <span className={styles.reportedAt}>
                                        Reported {new Date(flag.reported_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                </div>

                                <div className={styles.context}>
                                    <span className={styles.profName}>{flag.professor_name}</span>
                                    <span className={styles.courseCode}>{flag.course_code}</span>
                                </div>

                                <p className={styles.reviewText}>{flag.review_text}</p>

                                {flag.status === "resolved" ? (
                                    <div className={styles.resolvedInfo}>
                                        <span className={styles.resolutionBadge}>{flag.resolution}</span>
                                        {flag.resolution_note && <span className={styles.resolutionNote}>{flag.resolution_note}</span>}
                                        <span className={styles.resolvedAt}>
                                            {flag.resolved_at && new Date(flag.resolved_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                    </div>
                                ) : (
                                    <div className={styles.actions}>
                                        <input
                                            type="text"
                                            className={styles.noteInput}
                                            placeholder="Optional note (why you decided this)…"
                                            value={notes[flag.id] || ""}
                                            onChange={(e) => setNotes(prev => ({ ...prev, [flag.id]: e.target.value }))}
                                        />
                                        <div className={styles.actionBtns}>
                                            <button
                                                className={styles.keepBtn}
                                                disabled={resolvingId === flag.id}
                                                onClick={() => resolve(flag.id, "kept")}
                                            >
                                                Keep review
                                            </button>
                                            <button
                                                className={styles.editBtn}
                                                disabled={resolvingId === flag.id}
                                                onClick={() => resolve(flag.id, "edited")}
                                            >
                                                Mark edited
                                            </button>
                                            <button
                                                className={styles.removeBtn}
                                                disabled={resolvingId === flag.id}
                                                onClick={() => resolve(flag.id, "removed")}
                                            >
                                                Remove review
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
