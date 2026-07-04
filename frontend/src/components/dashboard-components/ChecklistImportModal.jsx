import { useState, useRef } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import { applyChecklistImport, previewCounts } from "../../utils/checklistImport"
import { MAJOR_OPTIONS, MAJOR_TEMPLATES } from "../../data/majorTemplates"
import styles from "../../css/ExportPDF.module.css"

const STORE_KEY = "rmtwu_checklist_v2"
const MAJOR_KEY = "rmtwu_major"

/**
 * "Set up checklist" modal — two paths:
 *   1. Pick a built-in template (instant, no backend needed)
 *   2. Upload a PDF for majors not yet in the built-in list
 */
export default function ChecklistImportModal({ cards = [], onClose, onImported }) {
    const fileRef = useRef(null)
    const [step, setStep] = useState("idle")   // idle | parsing | preview
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState("")
    const [parsed, setParsed] = useState(null)

    // ── Path 1: built-in template ──────────────────────────────────────────
    const applyBuiltin = (key) => {
        try {
            localStorage.setItem(MAJOR_KEY, key)
            const raw = localStorage.getItem(STORE_KEY)
            const o = raw ? JSON.parse(raw) : {}
            localStorage.setItem(STORE_KEY, JSON.stringify({ ...o, placements: {} }))
        } catch (_) {}
        onImported?.()
        onClose()
    }

    // ── Path 2: PDF upload ─────────────────────────────────────────────────
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

    const applyParsed = () => {
        applyChecklistImport(parsed, cards)
        // Also clear the major key so the built-in template doesn't override
        try { localStorage.removeItem(MAJOR_KEY) } catch (_) {}
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
                    <h2 className={styles.title}>Set up checklist</h2>
                    <button className={styles.close} onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.body}>
                    {step !== "preview" ? (
                        <>
                            {/* ── Built-in templates ── */}
                            <p className={styles.hint} style={{ marginBottom: 10 }}>
                                Pick your major to instantly sort your courses:
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                                {MAJOR_OPTIONS.map(o => {
                                    const tpl = MAJOR_TEMPLATES[o.key]
                                    return (
                                        <button
                                            key={o.key}
                                            onClick={() => applyBuiltin(o.key)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                border: "1px solid var(--border)",
                                                borderRadius: 10,
                                                padding: "13px 16px",
                                                background: "var(--surface)",
                                                cursor: "pointer",
                                                fontFamily: "var(--font-sans)",
                                                textAlign: "left",
                                                transition: "border-color 0.15s, box-shadow 0.15s",
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--focus-ring)" }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{o.label}</div>
                                                {tpl?.calendarYear && (
                                                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                                                        {tpl.calendarYear} · {tpl.totalCredits} s.h.
                                                    </div>
                                                )}
                                            </div>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m9 18 6-6-6-6" />
                                            </svg>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* ── Divider ── */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                                    my major isn't listed
                                </span>
                                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                            </div>

                            {/* ── PDF upload fallback ── */}
                            <div
                                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragging ? "var(--blue)" : "var(--border-strong)"}`,
                                    borderRadius: 12,
                                    padding: "24px 20px",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    background: dragging ? "var(--blue-tint)" : "var(--cream)",
                                    color: "var(--ink-2)",
                                    fontFamily: "var(--font-sans)",
                                    fontSize: 13,
                                    transition: "border-color 0.15s, background 0.15s",
                                }}
                            >
                                {step === "parsing"
                                    ? "Reading your checklist…"
                                    : <><strong>Upload checklist PDF</strong><br />from twu.ca/advising</>}
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="application/pdf"
                                    style={{ display: "none" }}
                                    onChange={e => processFile(e.target.files?.[0])}
                                />
                            </div>
                            {error && (
                                <p style={{ color: "var(--negative)", fontSize: 13, marginTop: 10, fontFamily: "var(--font-sans)" }}>
                                    {error}
                                </p>
                            )}
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
                        <button className={styles.exportBtn} onClick={applyParsed}>
                            Sort my courses
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
