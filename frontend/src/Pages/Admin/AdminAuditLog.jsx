import { useState, useEffect, useCallback } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/AdminAuditLog.module.css"

// A flat, chronological, unfiltered record of every report resolution ever
// made — separate from the working queue on purpose. This is the page you'd
// hand to TWU's legal team or a professor's lawyer if either ever asked
// "show me how you've handled reports." The queue is for doing the work;
// this is for proving the work got done.
export default function AdminAuditLog() {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [forbidden, setForbidden] = useState(false)
    const [resolutionFilter, setResolutionFilter] = useState("all")

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const { data } = await supabase.auth.getSession()
            const token = data.session?.access_token
            if (!token) throw new Error("Not signed in")

            const res = await fetch(`${API_URL}/admin/flags?status=resolved`, {
                headers: { "Authorization": `Bearer ${token}` },
            })

            if (res.status === 403) {
                setForbidden(true)
                setEntries([])
                return
            }
            if (!res.ok) {
                setError("Couldn't load the audit log.")
                return
            }
            setForbidden(false)
            const data2 = await res.json()
            // most recent decision first
            data2.sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at))
            setEntries(data2)
        } catch (e) {
            setError(e.message || "Something went wrong.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            setEntries([])
            setForbidden(false)
            setLoading(true)
            load()
        })
        return () => subscription.unsubscribe()
    }, [load])

    const visible = entries.filter(e => resolutionFilter === "all" || e.resolution === resolutionFilter)

    const copyAsText = () => {
        const lines = visible.map(e => {
            const resolvedDate = e.resolved_at ? new Date(e.resolved_at).toISOString() : ""
            return `${resolvedDate} | ${e.resolution?.toUpperCase()} | ${e.professor_name} (${e.course_code}) | reason: ${e.reason} | note: ${e.resolution_note || "—"} | review: "${e.review_text}"`
        })
        navigator.clipboard.writeText(lines.join("\n"))
    }

    if (forbidden) {
        return (
            <Layout>
                <div className={styles.page}>
                    <p className={styles.forbidden}>
                        You don't have access to the audit log. If you're one of the operators,
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
                        <h1 className={styles.title}>Audit log</h1>
                        <p className={styles.subtitle}>
                            Every report decision ever made, in order. This is the record —
                            not the working queue.
                        </p>
                    </div>
                    <button className={styles.copyBtn} onClick={copyAsText} disabled={visible.length === 0}>
                        Copy as text
                    </button>
                </div>

                <div className={styles.filters}>
                    {["all", "removed", "kept"].map(f => (
                        <button
                            key={f}
                            className={resolutionFilter === f ? `${styles.filterBtn} ${styles.filterBtnOn}` : styles.filterBtn}
                            onClick={() => setResolutionFilter(f)}
                        >
                            {f === "all" ? "All" : f === "removed" ? "Removed" : "Kept"}
                        </button>
                    ))}
                </div>

                {error && <p className={styles.error}>{error}</p>}

                {loading ? (
                    <p className={styles.empty}>Loading…</p>
                ) : visible.length === 0 ? (
                    <p className={styles.empty}>No resolved reports match this filter.</p>
                ) : (
                    <div className={styles.log}>
                        {visible.map(e => (
                            <div key={e.id} className={styles.entry}>
                                <div className={styles.entryTop}>
                                    <span className={`${styles.resolutionTag} ${e.resolution === "removed" ? styles.tagRemoved : styles.tagKept}`}>
                                        {e.resolution}
                                    </span>
                                    <span className={styles.entryReason}>{e.reason}</span>
                                    <span className={styles.entryDate}>
                                        {e.resolved_at && new Date(e.resolved_at).toLocaleString("en-CA", {
                                            month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                                <div className={styles.entryContext}>
                                    <strong>{e.professor_name}</strong> · {e.course_code}
                                </div>
                                <p className={styles.entryReview}>&ldquo;{e.review_text}&rdquo;</p>
                                {e.resolution_note && (
                                    <p className={styles.entryNote}>Note: {e.resolution_note}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    )
}
