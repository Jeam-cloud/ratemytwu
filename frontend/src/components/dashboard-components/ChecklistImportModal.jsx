import { useState, useRef } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import { applyChecklistImport, previewCounts } from "../../utils/checklistImport"
import styles from "../../css/ExportPDF.module.css"

/**
 * Upload a TWU program checklist PDF → parse it on the backend → preview how the
 * planner courses will sort → apply (writes the sorted layout the checklist reads).
 */
export default function ChecklistImportModal({ cards = [], onClose, onImported }) {
    const fileRef = useRef(null)
    const [step, setStep] = useState("idle")   // idle | parsing | preview
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState("")
    const [parsed, setParsed] = useState(null)

    const processFile = async (file) => {
        if (!file || file.type !== "application/pdf") { setError("Please choose a PDF file."); return }
        setError(""); setStep("parsing")

        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        const form = new FormData()
        form.append("file", file)

        try {
            const res = await fetch(`${API_URL}/user/parse-checklist`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: form,
            })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                throw new Error(e.detail || `Error ${res.status}`)
            }
            setParsed(await res.json())
            setStep("preview")
        } catch (e) {
            setError(e.message || "Failed to parse checklist")
            setStep("idle")
        }
    }

    const onDrop = (e) => {
        e.preventDefault(); setDragging(false)
        processFile(e.dataTransfer.files?.[0])
    }

    const apply = () => {
        applyChecklistImport(parsed, cards)
        onImported?.()
        onClose()
    }

    const counts = parsed ? previewCounts(parsed, cards) : null
    const majorSec = parsed?.sections.find(s => s.key === "major")
    const ancSec   = parsed?.sections.find(s => s.key === "ancillary")

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.head}>
                    <h2 className={styles.title}>Import checklist</h2>
                    <button className={styles.close} onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.body}>
                    {step !== "preview" ? (
                        <>
                            <p className={styles.hint}>
                                Drop your program checklist PDF (from twu.ca/advising). We&apos;ll read its
                                requirements and sort your planner courses into Core, Major, Ancillary and Electives.
                            </p>
                            <div
                                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragging ? "var(--blue)" : "var(--border-strong)"}`,
                                    borderRadius: 12,
                                    padding: "36px 20px",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    background: dragging ? "var(--blue-tint)" : "var(--cream)",
                                    color: "var(--ink-2)",
                                    fontFamily: "var(--font-sans)",
                                    fontSize: 14,
                                }}
                            >
                                {step === "parsing"
                                    ? "Reading your checklist…"
                                    : <><strong>Choose or drop a PDF</strong><br />checklist for your major</>}
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="application/pdf"
                                    style={{ display: "none" }}
                                    onChange={e => processFile(e.target.files?.[0])}
                                />
                            </div>
                            {error && <p style={{ color: "var(--negative)", fontSize: 13, marginTop: 12, fontFamily: "var(--font-sans)" }}>{error}</p>}
                        </>
                    ) : (
                        <>
                            <p className={styles.hint}>
                                Parsed <strong>{parsed.program || "this program"}</strong>
                                {parsed.calendarYear ? ` (${parsed.calendarYear})` : ""}. Here&apos;s how your
                                courses will sort — you can still drag any of them afterwards.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--font-sans)", fontSize: 14 }}>
                                {[
                                    ["Core", counts.core, "auto-filled into Core slots"],
                                    ["Major", counts.major, majorSec ? `${majorSec.required?.length || 0} required + electives` : ""],
                                    ["Ancillary", counts.ancillary, ancSec ? (ancSec.required || []).join(", ") : ""],
                                    ["Electives", counts.electives, "everything else"],
                                ].map(([label, n, sub]) => (
                                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
                                        <div>
                                            <strong style={{ color: "var(--ink)" }}>{label}</strong>
                                            {sub && <span style={{ color: "var(--ink-3)", fontSize: 12, marginLeft: 8 }}>{sub}</span>}
                                        </div>
                                        <span style={{ fontWeight: 700, color: "var(--blue)" }}>{n} course{n !== 1 ? "s" : ""}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    {step === "preview" && (
                        <button className={styles.exportBtn} onClick={apply}>
                            Sort my courses
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
