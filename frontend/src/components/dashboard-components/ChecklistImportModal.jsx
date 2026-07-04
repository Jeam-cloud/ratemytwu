import { useState, useRef } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import { applyChecklistImport, previewCounts } from "../../utils/checklistImport"
import { MAJOR_TEMPLATES, MAJOR_OPTIONS } from "../../data/majorTemplates"
import styles from "../../css/ExportPDF.module.css"

const STORE_KEY   = "rmtwu_checklist_v2"
const MAJOR_KEY   = "rmtwu_major"
const LIBRARY_KEY = "rmtwu_checklist_library"

// ── Tiny library helpers ──────────────────────────────────────────────────────
function readLibrary() {
    try {
        let lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]")
        let dirty = false

        // One-time migration: include any existing imported template
        try {
            const stored = JSON.parse(localStorage.getItem(STORE_KEY) || "{}")
            if (stored.template?.program) {
                const prog = stored.template.program.toLowerCase()
                if (!lib.some(t => (t.program || "").toLowerCase() === prog)) {
                    lib = [stored.template, ...lib]
                    dirty = true
                }
            }
        } catch (_) {}

        // Seed built-in templates so they always appear even when their PDF
        // can't be parsed (e.g. vector-only PDFs with no text layer).
        for (const opt of MAJOR_OPTIONS) {
            const tpl = MAJOR_TEMPLATES[opt.key]
            if (!tpl) continue
            const prog = (tpl.program || "").toLowerCase()
            if (!lib.some(t => (t.program || "").toLowerCase() === prog)) {
                lib = [...lib, tpl]
                dirty = true
            }
        }

        if (dirty) {
            try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)) } catch (_) {}
        }
        return lib
    } catch (_) { return [] }
}
function saveToLibrary(template) {
    try {
        const lib = readLibrary()
        // Deduplicate by program name (case-insensitive); newest import wins
        const filtered = lib.filter(
            t => (t.program || "").toLowerCase() !== (template.program || "").toLowerCase()
        )
        localStorage.setItem(LIBRARY_KEY, JSON.stringify([template, ...filtered]))
    } catch (_) {}
}

/**
 * "Set up checklist" modal — two paths:
 *   1. Pick from your saved library (built up from prior PDF uploads)
 *   2. Upload a new PDF to parse & add to the library
 */
export default function ChecklistImportModal({ cards = [], onClose, onImported }) {
    const fileRef = useRef(null)
    const [step, setStep]       = useState("idle")   // idle | parsing | preview
    const [dragging, setDragging] = useState(false)
    const [error, setError]     = useState("")
    const [parsed, setParsed]   = useState(null)
    const [library, setLibrary] = useState(() => readLibrary())

    // ── Path 1: pick a saved library item ─────────────────────────────────────
    const applyLibraryItem = (item) => {
        applyChecklistImport(item, cards)
        try { localStorage.removeItem(MAJOR_KEY) } catch (_) {}
        onImported?.()
        onClose()
    }

    const removeLibraryItem = (program, e) => {
        e.stopPropagation()
        const updated = library.filter(
            t => (t.program || "").toLowerCase() !== (program || "").toLowerCase()
        )
        try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(updated)) } catch (_) {}
        setLibrary(updated)
    }

    // ── Path 2: PDF upload ─────────────────────────────────────────────────────
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
            const result = await res.json()
            // Save to library immediately so it persists even if user cancels preview
            saveToLibrary(result)
            setLibrary(readLibrary())
            setParsed(result)
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
        try { localStorage.removeItem(MAJOR_KEY) } catch (_) {}
        onImported?.()
        onClose()
    }

    const counts    = parsed ? previewCounts(parsed, cards) : null
    const majorSec  = parsed?.sections.find(s => s.key === "major")
    const ancSec    = parsed?.sections.find(s => s.key === "ancillary")

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
                            {/* ── Saved library ── */}
                            {library.length > 0 && (
                                <>
                                    <p className={styles.hint} style={{ marginBottom: 10 }}>
                                        Pick your major to instantly sort your courses:
                                    </p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                                        {library.map(item => (
                                            <button
                                                key={item.program}
                                                onClick={() => applyLibraryItem(item)}
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
                                                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{item.program}</div>
                                                    {item.calendarYear && (
                                                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                                                            {item.calendarYear}{item.totalCredits ? ` · ${item.totalCredits} s.h.` : ""}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <button
                                                        onClick={e => removeLibraryItem(item.program, e)}
                                                        title="Remove from library"
                                                        style={{
                                                            border: "none", background: "none",
                                                            color: "var(--ink-3)", cursor: "pointer",
                                                            fontSize: 16, lineHeight: 1, padding: "2px 4px",
                                                            borderRadius: 4,
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.color = "var(--negative)"}
                                                        onMouseLeave={e => e.currentTarget.style.color = "var(--ink-3)"}
                                                    >×</button>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="m9 18 6-6-6-6" />
                                                    </svg>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Divider */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                                        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                                            add another major
                                        </span>
                                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                                    </div>
                                </>
                            )}

                            {/* ── PDF upload ── */}
                            {library.length === 0 && (
                                <p className={styles.hint} style={{ marginBottom: 12 }}>
                                    Upload your major checklist PDF from <strong>twu.ca/advising</strong> to auto-sort your courses.
                                </p>
                            )}
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
