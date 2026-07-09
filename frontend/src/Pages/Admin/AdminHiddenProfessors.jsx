import { useState, useEffect, useCallback } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/AdminReports.module.css"

// The restore side of a soft hide. Only professors hidden via "Hide profile"
// (not "Delete permanently") ever show up here — a deleted professor no
// longer exists in the DB, so there's nothing to list or undo.
export default function AdminHiddenProfessors() {
    const [professors, setProfessors] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [forbidden, setForbidden] = useState(false)
    const [restoringId, setRestoringId] = useState(null)

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
            const res = await fetch(`${API_URL}/admin/professors/hidden`, { headers })
            if (res.status === 403) {
                setForbidden(true)
                return
            }
            if (!res.ok) {
                setError("Couldn't load hidden professors.")
                return
            }
            setForbidden(false)
            setProfessors(await res.json())
        } catch (e) {
            setError(e.message || "Something went wrong.")
        } finally {
            setLoading(false)
        }
    }, [authHeaders])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            setProfessors([])
            setForbidden(false)
            setLoading(true)
            load()
        })
        return () => subscription.unsubscribe()
    }, [load])

    const restore = async (professorId) => {
        setRestoringId(professorId)
        try {
            const headers = await authHeaders()
            const res = await fetch(`${API_URL}/admin/professors/${professorId}/restore`, {
                method: "POST",
                headers,
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError(body.detail || "Couldn't restore this professor.")
                return
            }
            setProfessors(prev => prev.filter(p => p.id !== professorId))
        } catch (e) {
            setError(e.message || "Couldn't restore this professor.")
        } finally {
            setRestoringId(null)
        }
    }

    if (forbidden) {
        return (
            <Layout>
                <div className={styles.page}>
                    <p className={styles.forbidden}>
                        You don't have access to this page. If you're one of the operators,
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
                        <h1 className={styles.title}>Hidden professors</h1>
                        <p className={styles.subtitle}>
                            Professors hidden via a takedown request. Their reviews are still in the
                            database — restoring one puts the profile and its reviews straight back
                            on the public site.
                        </p>
                    </div>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                {loading ? (
                    <p className={styles.empty}>Loading…</p>
                ) : professors.length === 0 ? (
                    <p className={styles.empty}>No hidden professors right now.</p>
                ) : (
                    <div className={styles.list}>
                        {professors.map(p => (
                            <div key={p.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <div className={styles.cardTopLeft}>
                                        <span className={styles.profName}>{p.name}</span>
                                        <span className={styles.courseCode}>{p.department}</span>
                                    </div>
                                    <span className={styles.reportedAt}>
                                        {p.review_count} review{p.review_count === 1 ? "" : "s"} on file
                                    </span>
                                </div>

                                {p.hidden_reason && <p className={styles.description}>{p.hidden_reason}</p>}

                                <div className={styles.actionBtns}>
                                    <button
                                        className={styles.approveBtn}
                                        disabled={restoringId === p.id}
                                        onClick={() => restore(p.id)}
                                    >
                                        Restore to public site
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    )
}
