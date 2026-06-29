import { useState, useRef } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import styles from "../../css/TranscriptImport.module.css"

/**
 * Converts a transcript calendar year + term into the planner's year number.
 *
 * Spring start example (startYear=2024, startTerm="Spring"):
 *   - All terms in 2024 → year 1,  2025 → year 2, etc.
 *
 * Fall start example (startYear=2024, startTerm="Fall"):
 *   - Fall 2024 → year 1, Spring/Summer 2025 → year 1,
 *     Fall 2025 → year 2, Spring/Summer 2026 → year 2, etc.
 */
function getPlannerYear(calendarYear, term, startYear, startTerm) {
    if (startTerm === "Fall") {
        if (term === "Fall") return calendarYear - startYear + 1
        return calendarYear - startYear     // Spring / Summer belong to previous Fall's academic year
    }
    // Spring (or Summer) start — all terms in the same calendar year → same planner year
    return calendarYear - startYear + 1
}

export default function TranscriptImportModal({ startYear, startTerm, onClose, onImportDone }) {
    const fileRef = useRef(null)

    // step: "idle" | "parsing" | "preview" | "importing" | "done"
    const [step, setStep] = useState("idle")
    const [error, setError] = useState("")
    const [parsed, setParsed] = useState([])       // raw from backend
    const [selected, setSelected] = useState(new Set())  // indices selected for import
    const [result, setResult] = useState(null)     // import summary

    // ── Step 1: upload PDF and parse ──────────────────────────────────────
    const handleFile = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setError("")
        setStep("parsing")

        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) { setError("You must be logged in to import."); setStep("idle"); return }

        const form = new FormData()
        form.append("file", file)

        try {
            const res = await fetch(`${API_URL}/user/parse-transcript`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: form,
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.detail || `Error ${res.status}`)
            }
            const courses = await res.json()
            // Enrich with planner year and de-dupe display
            const enriched = courses.map((c, i) => ({
                ...c,
                plannerYear: getPlannerYear(c.calendar_year, c.term, startYear, startTerm),
                idx: i,
            }))
            setParsed(enriched)
            setSelected(new Set(enriched.map(c => c.idx)))  // all selected by default
            setStep("preview")
        } catch (err) {
            setError(err.message || "Failed to parse transcript")
            setStep("idle")
        }
    }

    const toggleAll = () => {
        if (selected.size === parsed.length) setSelected(new Set())
        else setSelected(new Set(parsed.map(c => c.idx)))
    }

    const toggleOne = (idx) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(idx) ? next.delete(idx) : next.add(idx)
            return next
        })
    }

    // ── Step 2: send selected courses to bulk import endpoint ──────────────
    const handleImport = async () => {
        setStep("importing")
        setError("")

        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token

        const toImport = parsed
            .filter(c => selected.has(c.idx))
            .map(c => ({
                course_code: c.course_code,
                year: c.plannerYear,
                term: c.term,
                credits: c.credits,
                status: c.status,
                grade: c.grade ?? null,
            }))

        try {
            const res = await fetch(`${API_URL}/board/import`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(toImport),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.detail || `Error ${res.status}`)
            }
            const summary = await res.json()
            setResult(summary)
            setStep("done")
            onImportDone?.()
        } catch (err) {
            setError(err.message || "Import failed")
            setStep("preview")
        }
    }

    const statusBadge = (s) => {
        if (s === "In Progress") return <span className={styles.badgeIp}>In Progress</span>
        if (s === "Completed")   return <span className={styles.badgeDone}>Completed</span>
        return <span className={styles.badgePlan}>Planned</span>
    }

    return (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.head}>
                    <h2 className={styles.title}>Import transcript</h2>
                    <button className={styles.close} onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.body}>

                    {/* ── idle / parsing ─────────────────────────────── */}
                    {(step === "idle" || step === "parsing") && (
                        <div className={styles.upload}>
                            <div className={styles.uploadIcon}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                                    <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" />
                                </svg>
                            </div>
                            <p className={styles.uploadHint}>
                                Upload your TWU unofficial transcript PDF.<br />
                                Courses will be matched against the database and added to your planner.
                            </p>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".pdf"
                                style={{ display: "none" }}
                                onChange={handleFile}
                            />
                            <button
                                className={styles.uploadBtn}
                                onClick={() => fileRef.current?.click()}
                                disabled={step === "parsing"}
                            >
                                {step === "parsing" ? "Parsing…" : "Choose PDF"}
                            </button>
                            {error && <p className={styles.err}>{error}</p>}
                        </div>
                    )}

                    {/* ── preview ────────────────────────────────────── */}
                    {step === "preview" && (
                        <>
                            <p className={styles.previewHint}>
                                {parsed.length} courses found. Select the ones you want to import.
                                Courses not in the database will be skipped automatically.
                            </p>
                            <div className={styles.tableWrap}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.size === parsed.length}
                                                    onChange={toggleAll}
                                                />
                                            </th>
                                            <th>Course</th>
                                            <th>Term</th>
                                            <th>Planner year</th>
                                            <th>Grade</th>
                                            <th>Credits</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsed.map(c => (
                                            <tr key={c.idx} className={selected.has(c.idx) ? styles.rowSel : ""}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(c.idx)}
                                                        onChange={() => toggleOne(c.idx)}
                                                    />
                                                </td>
                                                <td className={styles.code}>{c.course_code}</td>
                                                <td>{c.term} {c.calendar_year}</td>
                                                <td>Year {c.plannerYear}</td>
                                                <td>{c.grade ?? "—"}</td>
                                                <td>{c.credits}</td>
                                                <td>{statusBadge(c.status)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {error && <p className={styles.err}>{error}</p>}
                        </>
                    )}

                    {/* ── done ───────────────────────────────────────── */}
                    {step === "done" && result && (
                        <div className={styles.summary}>
                            <div className={styles.summaryIcon}>✓</div>
                            <p className={styles.summaryLine}>
                                <strong>{result.imported.length}</strong> course{result.imported.length !== 1 ? "s" : ""} imported
                            </p>
                            {result.duplicates.length > 0 && (
                                <p className={styles.summaryNote}>
                                    {result.duplicates.length} already on your board ({result.duplicates.join(", ")})
                                </p>
                            )}
                            {result.not_found.length > 0 && (
                                <p className={styles.summaryNote}>
                                    {result.not_found.length} not in database ({result.not_found.join(", ")})
                                </p>
                            )}
                        </div>
                    )}

                </div>

                {/* ── footer ─────────────────────────────────────────── */}
                <div className={styles.footer}>
                    {step === "preview" && (
                        <>
                            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                            <button
                                className={styles.importBtn}
                                disabled={selected.size === 0 || step === "importing"}
                                onClick={handleImport}
                            >
                                Import {selected.size} course{selected.size !== 1 ? "s" : ""}
                            </button>
                        </>
                    )}
                    {step === "done" && (
                        <button className={styles.importBtn} onClick={onClose}>Done</button>
                    )}
                    {(step === "idle" || step === "parsing") && (
                        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    )}
                </div>
            </div>
        </div>
    )
}
