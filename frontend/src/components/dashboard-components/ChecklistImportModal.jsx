import { useState, useRef, useEffect, useCallback } from "react"
import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import { applyChecklistImport, previewCounts } from "../../utils/checklistImport"
import { MAJOR_TEMPLATES, MAJOR_OPTIONS } from "../../data/majorTemplates"
import styles from "../../css/ExportPDF.module.css"

const STORE_KEY   = "rmtwu_checklist_v2"
const MAJOR_KEY   = "rmtwu_major"
const LIBRARY_KEY = "rmtwu_checklist_library"

// ── Local library helpers ────────────────────────────────────────────────────
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

        // Seed built-in templates so they always appear
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
        const filtered = lib.filter(
            t => (t.program || "").toLowerCase() !== (template.program || "").toLowerCase()
        )
        localStorage.setItem(LIBRARY_KEY, JSON.stringify([template, ...filtered]))
    } catch (_) {}
}

// ── Community DB helpers ─────────────────────────────────────────────────────

// Normalize to Title Case before storing so the UNIQUE constraint is consistent
function normProgram(s) {
    return (s || "")
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase())
}

async function searchCommunity(query) {
    try {
        let q = supabase
            .from("program_checklists")
            .select("program, calendar_year, total_credits, sections, uploaded_at")
            .order("uploaded_at", { ascending: false })
            .limit(50)
        if (query && query.trim()) {
            q = q.ilike("program", `%${query.trim()}%`)
        }
        const { data, error } = await q
        if (error) return []
        return data || []
    } catch (_) { return [] }
}

async function publishToDb(template) {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        await supabase.from("program_checklists").upsert({
            program: normProgram(template.program),
            calendar_year: template.calendarYear || "",
            total_credits: template.totalCredits || null,
            sections: template.sections,
            uploaded_by: session.user.id,
            uploaded_at: new Date().toISOString(),
        }, { onConflict: "program,calendar_year" })
    } catch (_) {}
}

// DB row → template shape for applyChecklistImport
function dbRowToTemplate(row) {
    return {
        program: row.program,
        calendarYear: row.calendar_year || undefined,
        totalCredits: row.total_credits || undefined,
        sections: row.sections,
    }
}

// ── IIFE: seed built-ins into localStorage on module load ────────────────────
;(function seedBuiltins() {
    try {
        const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]")
        let changed = false
        for (const opt of MAJOR_OPTIONS) {
            const tpl = MAJOR_TEMPLATES[opt.key]
            if (!tpl?.program) continue
            if (!lib.some(t => (t.program || "").toLowerCase() === tpl.program.toLowerCase())) {
                lib.push(tpl)
                changed = true
            }
        }
        if (changed) localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib))
    } catch (_) {}
})()

/**
 * "Set up checklist" modal — search community pool or upload a new PDF.
 */
export default function ChecklistImportModal({ cards = [], onClose, onImported }) {
    const fileRef    = useRef(null)
    const searchRef  = useRef(null)
    const timerRef   = useRef(null)

    const [step, setStep]           = useState("idle")   // idle | parsing | preview
    const [dragging, setDragging]   = useState(false)
    const [error, setError]         = useState("")
    const [parsed, setParsed]       = useState(null)
    const [library]                 = useState(() => readLibrary())
    const [query, setQuery]         = useState("")
    const [community, setCommunity] = useState([])
    const [dbLoading, setDbLoading] = useState(true)

    // ── Fetch from community DB ───────────────────────────────────────────────
    const fetchCommunity = useCallback(async (q) => {
        setDbLoading(true)
        const rows = await searchCommunity(q)
        setCommunity(rows)
        setDbLoading(false)
    }, [])

    useEffect(() => {
        fetchCommunity("")
        // Auto-focus search on open
        setTimeout(() => searchRef.current?.focus(), 50)
    }, [fetchCommunity])

    const handleQueryChange = (e) => {
        const val = e.target.value
        setQuery(val)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetchCommunity(val), 280)
    }

    // Merge: DB results first; fill in local-only items (built-ins) not in DB yet
    const mergedItems = (() => {
        const dbItems = community.map(row => ({ ...dbRowToTemplate(row), _source: "community" }))
        const localFill = library.filter(
            lItem => !community.some(
                row => row.program.toLowerCase() === (lItem.program || "").toLowerCase()
            )
        )
        // Also filter local items by query if one is active
        const filteredLocal = query.trim()
            ? localFill.filter(item =>
                (item.program || "").toLowerCase().includes(query.trim().toLowerCase())
              )
            : localFill
        return [...dbItems, ...filteredLocal.map(item => ({ ...item, _source: "local" }))]
    })()

    // ── Apply a selected item ─────────────────────────────────────────────────
    const applyItem = (item) => {
        applyChecklistImport(item, cards)
        try { localStorage.removeItem(MAJOR_KEY) } catch (_) {}
        onImported?.()
        onClose()
    }

    // ── PDF upload ────────────────────────────────────────────────────────────
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
            // Save locally + publish to community DB (non-blocking)
            saveToLibrary(result)
            publishToDb(result).then(() => fetchCommunity(query))
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
                            {/* ── Search bar ── */}
                            <div style={{ position: "relative", marginBottom: 10 }}>
                                <svg
                                    width="15" height="15" viewBox="0 0 24 24" fill="none"
                                    stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                                >
                                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                                </svg>
                                <input
                                    ref={searchRef}
                                    type="text"
                                    placeholder="Search majors…"
                                    value={query}
                                    onChange={handleQueryChange}
                                    style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        paddingLeft: 36, paddingRight: 12,
                                        paddingTop: 10, paddingBottom: 10,
                                        border: "1px solid var(--border)",
                                        borderRadius: 10,
                                        background: "var(--surface)",
                                        fontFamily: "var(--font-sans)",
                                        fontSize: 14,
                                        color: "var(--ink)",
                                        outline: "none",
                                        transition: "border-color 0.15s",
                                    }}
                                    onFocus={e => e.currentTarget.style.borderColor = "var(--blue)"}
                                    onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
                                />
                            </div>

                            {/* ── Results list ── */}
                            <div style={{
                                display: "flex", flexDirection: "column", gap: 6,
                                marginBottom: 14, maxHeight: 252, overflowY: "auto",
                            }}>
                                {dbLoading && community.length === 0 && (
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "14px 0" }}>
                                        Loading…
                                    </p>
                                )}
                                {!dbLoading && mergedItems.length === 0 && (
                                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "14px 0" }}>
                                        {query.trim() ? "No matches — upload this checklist below to add it." : "No checklists yet — be the first to upload one!"}
                                    </p>
                                )}
                                {mergedItems.map((item, i) => (
                                    <button
                                        key={`${item.program}-${item.calendarYear || i}`}
                                        onClick={() => applyItem(item)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            border: "1px solid var(--border)",
                                            borderRadius: 10,
                                            padding: "11px 16px",
                                            background: "var(--surface)",
                                            cursor: "pointer",
                                            fontFamily: "var(--font-sans)",
                                            textAlign: "left",
                                            flexShrink: 0,
                                            transition: "border-color 0.15s, box-shadow 0.15s",
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--focus-ring)" }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none" }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{item.program}</div>
                                            {(item.calendarYear || item.totalCredits) && (
                                                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                                                    {item.calendarYear}{item.totalCredits ? ` · ${item.totalCredits} s.h.` : ""}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {item._source === "community" && (
                                                <span style={{
                                                    fontSize: 11, color: "var(--blue)",
                                                    background: "var(--blue-tint)", borderRadius: 4,
                                                    padding: "2px 7px", fontFamily: "var(--font-sans)",
                                                    fontWeight: 600,
                                                }}>community</span>
                                            )}
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m9 18 6-6-6-6" />
                                            </svg>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* ── Divider ── */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                                    {mergedItems.length > 0 ? "don't see yours? upload it" : "upload a checklist PDF"}
                                </span>
                                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                            </div>

                            {/* ── PDF upload drop zone ── */}
                            <div
                                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    border: `2px dashed ${dragging ? "var(--blue)" : "var(--border-strong)"}`,
                                    borderRadius: 12,
                                    padding: "18px 20px",
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
                                    : <>
                                        <strong>Upload checklist PDF</strong>
                                        <div style={{ color: "var(--ink-3)", fontSize: 12, marginTop: 3 }}>
                                            from twu.ca/advising · shared with the community
                                        </div>
                                    </>
                                }
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
                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}>
                                ✓ Added to the community pool so other TWU students can find it too.
                            </p>
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
