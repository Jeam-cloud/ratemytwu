import { useState, useRef } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import { applyChecklistImport, previewCounts } from "../../utils/checklistImport"
import styles from "../../css/ExportPDF.module.css"

const LIBRARY_KEY = "rmtwu_checklist_library"
const MAJOR_KEY   = "rmtwu_major"

function normProgram(s) {
    return (s || "")
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase())
}

async function publishToDb(template, type = "major") {
    try {
        const prog = normProgram(template.program)
        if (!prog || !/[a-zA-Z]/.test(prog)) return
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        // Don't blindly overwrite — if a row for this program/year already
        // exists and was uploaded by someone else, leave it alone. Only the
        // original uploader (or a fresh program/year combo) can write.
        const { data: existing } = await supabase
            .from("program_checklists")
            .select("uploaded_by")
            .eq("program", prog)
            .eq("calendar_year", template.calendarYear || "")
            .maybeSingle()

        if (existing && existing.uploaded_by && existing.uploaded_by !== session.user.id) return

        await supabase.from("program_checklists").upsert({
            program: prog,
            calendar_year: template.calendarYear || "",
            total_credits: template.totalCredits || null,
            sections: template.sections,
            type,
            uploaded_by: session.user.id,
            uploaded_at: new Date().toISOString(),
        }, { onConflict: "program,calendar_year" })
    } catch (_) {}
}

function saveToLibrary(template) {
    try {
        const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]")
        const filtered = lib.filter(
            t => (t.program || "").toLowerCase() !== (template.program || "").toLowerCase()
        )
        localStorage.setItem(LIBRARY_KEY, JSON.stringify([template, ...filtered]))
    } catch (_) {}
}

/**
 * "Import checklist" modal — PDF upload only.
 * Community search lives on the dashboard (ChecklistTab major bar).
 */
/**
 * Props:
 *   cards         – planner cards (used for major-mode sort preview)
 *   onClose       – close the modal
 *   onImported    – (major mode) called after "Sort my courses"
 *   onMinorImported(parsed) – (minor mode) called instead of sorting; sets the minor label
 *   onAttachmentImported(parsed) – (attachment mode) for concentration/specialization
 *                                  checklists a major requires attaching; merges the
 *                                  parsed sections into the active major template
 *   attachmentLabel – e.g. "First Academic (Teachable) Specialization" — shown in
 *                     the modal title/preview when in attachment mode
 */
export default function ChecklistImportModal({ cards = [], onClose, onImported, onMinorImported, onAttachmentImported, attachmentLabel }) {
    const isMinorMode = !!onMinorImported
    const isAttachMode = !!onAttachmentImported
    const fileRef = useRef(null)
    const [step, setStep]         = useState("idle")   // idle | parsing | preview
    const [dragging, setDragging] = useState(false)
    const [error, setError]       = useState("")
    const [parsed, setParsed]     = useState(null)

    const processFile = async (file) => {
        if (!file || file.type !== "application/pdf") { setError("Please choose a PDF file."); return }
        setError(""); setStep("parsing")

        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) { setError("You must be logged in to import a checklist."); setStep("idle"); return }

        const form = new FormData()
        form.append("file", file)

        try {
            const res = await fetch(`${API_URL}/user/parse-checklist`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            })
            if (!res.ok) {
                const e = await res.json().catch(() => ({}))
                throw new Error(e.detail || `Error ${res.status}`)
            }
            const result = await res.json()
            saveToLibrary(result)
            publishToDb(result, isMinorMode ? "minor" : isAttachMode ? "concentration" : "major") // non-blocking
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

    const counts   = parsed ? previewCounts(parsed, cards) : null
    const majorSec = parsed?.sections.find(s => s.key === "major")
    const ancSec   = parsed?.sections.find(s => s.key === "ancillary")

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.head}>
                    <h2 className={styles.title}>
                        {isAttachMode ? `Attach ${attachmentLabel || "specialization"} checklist`
                            : isMinorMode ? "Import minor checklist PDF" : "Import checklist PDF"}
                    </h2>
                    <button className={styles.close} onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.body}>
                    {step !== "preview" ? (
                        <>
                            <p className={styles.hint} style={{ marginBottom: 14 }}>
                                Upload your {isAttachMode ? (attachmentLabel || "specialization") : isMinorMode ? "minor" : "major"} checklist PDF from{" "}
                                <a href="https://twu.ca/academics/academic-advising/degree-planning/" target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>
                                    twu.ca/advising
                                </a>
                                . It&apos;ll be saved to the community pool so other students can find it too.
                            </p>

                            <div
                                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragging ? "var(--blue)" : "var(--border-strong)"}`,
                                    borderRadius: 12,
                                    padding: "32px 20px",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    background: dragging ? "var(--blue-tint)" : "var(--cream)",
                                    color: "var(--ink-2)",
                                    fontFamily: "var(--font-sans)",
                                    fontSize: 14,
                                    transition: "border-color 0.15s, background 0.15s",
                                }}
                            >
                                {step === "parsing"
                                    ? "Reading your checklist…"
                                    : <>
                                        <strong>Click to upload or drag & drop</strong>
                                        <div style={{ color: "var(--ink-3)", fontSize: 12, marginTop: 4 }}>PDF files only</div>
                                    </>}
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
                    ) : isAttachMode ? (
                        /* ── Attachment preview: confirm + merge into the active major ── */
                        <>
                            <p className={styles.hint}>
                                Parsed <strong>{parsed.program || "this checklist"}</strong>
                                {parsed.calendarYear ? ` (${parsed.calendarYear})` : ""}. Its required
                                courses will count toward your <strong>{attachmentLabel || "specialization"}</strong> requirement
                                and sort into the Major tab.
                            </p>
                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}>
                                ✓ Added to the community pool so other TWU students can find it.
                            </p>
                        </>
                    ) : isMinorMode ? (
                        /* ── Minor preview: just confirm the name, no course-sort table ── */
                        <>
                            <p className={styles.hint}>
                                Parsed <strong>{parsed.program || "this program"}</strong>
                                {parsed.calendarYear ? ` (${parsed.calendarYear})` : ""}.
                                Click <em>Set as my minor</em> to add it to your planner bar.
                            </p>
                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}>
                                ✓ Added to the community pool so other TWU students can find it.
                            </p>
                        </>
                    ) : (
                        /* ── Major preview: full course-sort breakdown ── */
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
                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}>
                                ✓ Added to the community pool so other TWU students can find it.
                            </p>
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    {step === "preview" && (
                        isAttachMode ? (
                            <button className={styles.exportBtn} onClick={() => { onAttachmentImported(parsed); onClose() }}>
                                Attach checklist
                            </button>
                        ) : isMinorMode ? (
                            <button className={styles.exportBtn} onClick={() => { onMinorImported(parsed); onClose() }}>
                                Set as my minor
                            </button>
                        ) : (
                            <button className={styles.exportBtn} onClick={applyParsed}>
                                Sort my courses
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
