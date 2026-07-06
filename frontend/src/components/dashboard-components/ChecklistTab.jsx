import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import ChecklistImportModal from "./ChecklistImportModal"
import {
    DndContext, DragOverlay, PointerSensor, TouchSensor,
    useSensor, useSensors, useDraggable, useDroppable,
} from "@dnd-kit/core"
import { CORE_GROUPS } from "../../data/coreChecklist"
import { MAJOR_TEMPLATES, MAJOR_OPTIONS } from "../../data/majorTemplates"
import { classifyCourse, applyChecklistImport } from "../../utils/checklistImport"
import styles from "../../css/ChecklistTab.module.css"
import { supabase } from "../../supabaseClient"

// SECTIONS is built dynamically inside the component so the Minor tab
// appears only when a minor is selected (see useMemo below).

const STORE_KEY       = "rmtwu_checklist_v2"
const MAJOR_KEY       = "rmtwu_major"
const PROG_KEY        = "rmtwu_major_program"
const YEAR_KEY        = "rmtwu_major_calendar_year"
const MINOR_PROG_KEY  = "rmtwu_minor_program"
const MINOR_YEAR_KEY  = "rmtwu_minor_calendar_year"
const MINOR_STORE_KEY = "rmtwu_minor_checklist"   // stores full minor template (sections)

// Attached concentration/specialization/teachable checklists — keyed by
// "<program>::<calendarYear>" so switching majors OR calendar years (e.g.
// importing a prior year's checklist later) never leaks a stale attachment
// from a different major/year into the wrong one.
const ATTACH_STORE_KEY = "rmtwu_attached_concentrations"

function readAttachStore() {
    try { return JSON.parse(localStorage.getItem(ATTACH_STORE_KEY) || "{}") } catch (_) { return {} }
}
function writeAttachStore(store) {
    try { localStorage.setItem(ATTACH_STORE_KEY, JSON.stringify(store)) } catch (_) {}
}

// Flat list of every core slot (groups → subgroups → slots), tagged with its group.
const CORE_SLOTS = CORE_GROUPS.flatMap(g =>
    g.subgroups.flatMap(sg => sg.slots.map(s => ({ ...s, groupId: g.id })))
)
const isCoreSlot = id => CORE_SLOTS.some(s => s.id === id)

const LIBRARY_KEY = "rmtwu_checklist_library"

// ── Community DB helpers ─────────────────────────────────────────────────────
function readLocalLibrary(type = "major") {
    try {
        const raw = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]")
        const lib = raw.filter(t => /[a-zA-Z]/.test(t.program || ""))
        if (type === "minor") {
            // Only cached items whose name contains "minor"
            return lib.filter(t => /minor/i.test(t.program || ""))
        }
        if (type === "concentration") {
            // The local cache (rmtwu_checklist_library) never recorded which
            // type an item was uploaded as, so there's no reliable way to
            // filter it down to "just concentrations" — showing unrelated
            // majors/minors here would be worse than showing nothing. The
            // community DB search (searchCommunity, filtered server-side by
            // type="concentration") is the real source for this list.
            return []
        }
        // major: exclude items that look like minors, seed built-in templates
        const majorLib = lib.filter(t => !/minor/i.test(t.program || ""))
        for (const opt of MAJOR_OPTIONS) {
            const tpl = MAJOR_TEMPLATES[opt.key]
            if (!tpl) continue
            if (!majorLib.some(t => (t.program || "").toLowerCase() === (tpl.program || "").toLowerCase()))
                majorLib.push(tpl)
        }
        return majorLib
    } catch (_) { return [] }
}

async function searchCommunity(query, type = "major") {
    try {
        let q = supabase
            .from("program_checklists")
            .select("program, calendar_year, total_credits, sections, uploaded_at")
            .eq("type", type)
            .order("uploaded_at", { ascending: false })
            .limit(50)
        if (query && query.trim()) q = q.ilike("program", `%${query.trim()}%`)
        const { data, error } = await q
        if (error) return []
        return (data || []).filter(r => /[a-zA-Z]/.test(r.program || ""))
    } catch (_) { return [] }
}

function dbRowToTemplate(row) {
    return {
        program: row.program,
        calendarYear: row.calendar_year || undefined,
        totalCredits: row.total_credits || undefined,
        sections: row.sections,
    }
}

// ── Inline major search dropdown ──────────────────────────────────────────────
function MajorSearch({ onSelect, onClose, onUpload, type = "major" }) {
    const [query, setQuery]       = useState("")
    const [results, setResults]   = useState([])
    const [loading, setLoading]   = useState(true)
    const inputRef  = useRef(null)
    const wrapRef   = useRef(null)
    const timerRef  = useRef(null)
    const localLib  = useMemo(() => readLocalLibrary(type), [type])

    const fetch = useCallback(async (q) => {
        setLoading(true)
        const rows = await searchCommunity(q, type)
        setResults(rows)
        setLoading(false)
    }, [type])

    useEffect(() => {
        fetch("")
        setTimeout(() => inputRef.current?.focus(), 30)
    }, [fetch])

    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose()
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [onClose])

    const handleChange = (e) => {
        const val = e.target.value
        setQuery(val)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => fetch(val), 280)
    }

    // Merge DB results + local-only built-ins not yet in DB
    const dbItems = results.map(r => ({ ...dbRowToTemplate(r), _community: true }))
    const localOnly = localLib.filter(
        l => !results.some(r => r.program.toLowerCase() === (l.program || "").toLowerCase())
    )
    const filteredLocal = query.trim()
        ? localOnly.filter(l => (l.program || "").toLowerCase().includes(query.trim().toLowerCase()))
        : localOnly
    const merged = [...dbItems, ...filteredLocal]

    return (
        <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <div style={{ position: "relative" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    placeholder="Search your major…"
                    onKeyDown={e => e.key === "Escape" && onClose()}
                    style={{
                        width: "100%", boxSizing: "border-box",
                        paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                        border: "1px solid var(--blue)",
                        borderRadius: 8,
                        background: "var(--surface)",
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        color: "var(--ink)",
                        outline: "none",
                        boxShadow: "0 0 0 3px var(--focus-ring)",
                    }}
                />
            </div>

            {/* Dropdown */}
            <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
                zIndex: 200,
                maxHeight: 220,
                overflowY: "auto",
            }}>
                {loading && results.length === 0 && (
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", padding: "12px 14px" }}>
                        Loading…
                    </div>
                )}
                {!loading && merged.length === 0 && (
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", padding: "12px 14px" }}>
                        No results yet — upload a checklist PDF below.
                    </div>
                )}
                {merged.map((item, i) => (
                    <button
                        key={`${item.program}-${item.calendarYear || i}`}
                        onMouseDown={e => { e.preventDefault(); onSelect(item) }}
                        style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            width: "100%", padding: "10px 14px",
                            border: "none", borderBottom: "1px solid var(--border)",
                            background: "none", cursor: "pointer",
                            fontFamily: "var(--font-sans)", textAlign: "left",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--cream)"}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{item.program}</div>
                            {(item.calendarYear || item.totalCredits) && (
                                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
                                    {item.calendarYear}{item.totalCredits ? ` · ${item.totalCredits} s.h.` : ""}
                                </div>
                            )}
                        </div>
                        {item._community && (
                            <span style={{
                                fontSize: 10, color: "var(--blue)", background: "var(--blue-tint)",
                                borderRadius: 4, padding: "2px 6px", fontWeight: 600, whiteSpace: "nowrap",
                            }}>community</span>
                        )}
                    </button>
                ))}
                {onUpload && (
                    <button
                        onMouseDown={e => { e.preventDefault(); onUpload() }}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            width: "100%", padding: "10px 14px",
                            border: "none", borderTop: merged.length ? "1px solid var(--border)" : "none",
                            background: "var(--cream)", cursor: "pointer",
                            fontFamily: "var(--font-sans)", fontSize: 12,
                            color: "var(--blue)", fontWeight: 600, textAlign: "left",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--blue-tint)"}
                        onMouseLeave={e => e.currentTarget.style.background = "var(--cream)"}
                    >
                        ↑ Upload checklist PDF
                    </button>
                )}
            </div>
        </div>
    )
}

// ── Draggable course pill ─────────────────────────────────────────────────────
function CoursePill({ code, where, onRemove, onSelect, selected, status }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `${where}:${code}`,
        data: { code },
    })

    // Pick dot style based on completion status. "Planned" previously fell
    // through to `null` here — visually identical to a course with no status
    // at all — so a planned-but-unfinished course looked indistinguishable
    // from an unclassified one. Give it its own (blue) dot.
    const dotCls = status === "Completed"   ? styles.statusCompleted
                 : status === "In Progress" ? styles.statusProgress
                 : status === "Planned"     ? styles.statusPlanned
                 : null

    return (
        <span
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`${styles.pill} ${selected ? styles.pillSelected : ""}`}
            style={{ opacity: isDragging ? 0.35 : 1 }}
            onClick={onSelect ? (e) => { e.stopPropagation(); onSelect() } : undefined}
        >
            {dotCls && <span className={`${styles.statusDot} ${dotCls}`} />}
            <span className={styles.grip}>⠿</span>
            {code}
            {onRemove && (
                <button
                    className={styles.pillX}
                    aria-label="Remove"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onRemove() }}
                >×</button>
            )}
        </span>
    )
}

// Any box can become a drop target (and an optional click target).
function Drop({ id, className, children, onClick }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    return (
        <div ref={setNodeRef} onClick={onClick} className={`${className} ${isOver ? styles.over : ""}`}>
            {children}
        </div>
    )
}

// When a slot is only partially filled, tell the student what's still
// needed instead of just showing an empty gap. If exactly as many eligible
// courses remain as slots still open, there's no real choice left (e.g.
// Foundations: FNDN 101 + 102 taken, only FNDN 201 is eligible and only one
// slot remains) — name it directly. Otherwise there's still a genuine
// choice among several options (e.g. Academic Writing: any 2 of ENGL
// 101–104), so a specific name would be misleading — show a generic count.
function remainingHint(slot, courses) {
    const have = new Set(courses.map(c => c.code))
    const needed = slot.capacity - courses.length
    if (needed <= 0) return null
    const remainingEligible = (slot.eligible || []).filter(code => !have.has(code))
    if (remainingEligible.length > 0 && remainingEligible.length === needed) {
        return `still need: ${remainingEligible.join(", ")}`
    }
    return `choose ${needed} more`
}

// ── One core requirement row ──────────────────────────────────────────────────
function CoreSlotRow({ slot, courses, satisfied, target, muted, onToggleSat, onRemove, onPlace, statusMap }) {
    const [menu, setMenu] = useState(false)
    const filled = courses.length
    const allCompleted = filled > 0 && filled >= slot.capacity &&
        courses.every(c => statusMap[c.code] === "Completed")
    const status = satisfied ? "sat"
        : allCompleted ? "verified"
        : filled >= slot.capacity ? "done"
        : filled > 0 ? "partial" : "empty"
    // "done" means the slot is FULL but the course(s) in it aren't all marked
    // Completed yet (e.g. still Planned/In Progress) — that's not the same as
    // actually finished, so it shouldn't get the same ✓ as "verified"/"sat".
    // Give it its own dot instead, matching the yellow used for Planned pills.
    const icon = { sat: "✓", verified: "✓", done: "●", partial: "•", empty: "○" }[status]
    const cls = `${styles.slotRow} ${target ? styles.slotTarget : ""} ${muted ? styles.slotMuted : ""}`

    return (
        <Drop id={`slot:${slot.id}`} className={cls} onClick={onPlace}>
            <span className={`${styles.slotStatus} ${styles[`st_${status}`]}`}>{icon}</span>

            <div className={styles.slotMain}>
                {slot.label && <div className={styles.slotLabel}>{slot.label}</div>}
                <div className={styles.slotChips}>
                    {satisfied ? (
                        <span className={styles.satTag}>Satisfied — no course needed</span>
                    ) : filled ? (
                        <>
                            {courses.map(c => (
                                <CoursePill
                                    key={c.code}
                                    code={c.code}
                                    where="row"
                                    onRemove={() => onRemove(c.code)}
                                    status={statusMap[c.code]}
                                />
                            ))}
                            {filled < slot.capacity && (
                                <span className={styles.dropHint}>{remainingHint(slot, courses)}</span>
                            )}
                        </>
                    ) : (
                        <span className={styles.dropHint}>
                            {slot.hint || (slot.capacity > 1 ? `drag ${slot.capacity} courses here` : "drag a course here")}
                        </span>
                    )}
                </div>
            </div>

            <span className={styles.slotSh}>{slot.credits || "–"}</span>

            <div className={styles.menuWrap}>
                <button className={styles.menuBtn} aria-label="Options" onClick={(e) => { e.stopPropagation(); setMenu(m => !m) }}>⋯</button>
                {menu && (
                    <>
                        <div className={styles.menuBackdrop} onClick={(e) => { e.stopPropagation(); setMenu(false) }} />
                        <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                            <button className={styles.menuItem} onClick={() => { onToggleSat(slot.id); setMenu(false) }}>
                                {satisfied ? "Unmark satisfied" : "Mark satisfied"}
                            </button>
                            {filled > 0 && (
                                <button className={styles.menuItem} onClick={() => { courses.forEach(c => onRemove(c.code)); setMenu(false) }}>
                                    Clear course{filled > 1 ? "s" : ""}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Drop>
    )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChecklistTab({ cards = [] }) {
    const [tab, setTab]                     = useState("core")
    const [placements, setPlacements]       = useState({}) // code -> slotId | sectionId | "pool"
    const [satisfied, setSatisfied]         = useState({}) // slotId -> true
    const [dragCode, setDragCode]           = useState(null)
    const [selectedCode, setSelected]       = useState(null) // click-to-place
    const [query, setQuery]                 = useState("")
    const [majorSearchOpen, setMajorSearchOpen] = useState(() => {
        // Auto-open on first load when no major has been set yet
        try { return !localStorage.getItem(PROG_KEY) && !localStorage.getItem(MAJOR_KEY) } catch (_) { return true }
    })
    const [minorSearchOpen, setMinorSearchOpen] = useState(false)
    const [minorImportOpen, setMinorImportOpen] = useState(false)
    // Explicit state for major — set directly in applyMajorItem so the bar updates in the same render
    const [savedMajorName, setSavedMajorName] = useState(() => {
        try { return localStorage.getItem(PROG_KEY) || "" } catch (_) { return "" }
    })
    const [savedCalendarYear, setSavedCalendarYear] = useState(() => {
        try { return localStorage.getItem(YEAR_KEY) || "" } catch (_) { return "" }
    })
    // Minor — label only, no course sorting
    const [savedMinorName, setSavedMinorName] = useState(() => {
        try { return localStorage.getItem(MINOR_PROG_KEY) || "" } catch (_) { return "" }
    })
    const [savedMinorCalendarYear, setSavedMinorCalendarYear] = useState(() => {
        try { return localStorage.getItem(MINOR_YEAR_KEY) || "" } catch (_) { return "" }
    })
    // Bumped on every applyMajorItem so the template memo re-reads localStorage even when major stays ""
    const [templateKey, setTemplateKey] = useState(0)
    const [minorTemplateKey, setMinorTemplateKey] = useState(0)

    // Major selection — drives template-based auto-classification
    const [major, setMajor] = useState(() => {
        try { return localStorage.getItem(MAJOR_KEY) || "" } catch (_) { return "" }
    })

    // Resolve which template to use: built-in key first, then any PDF-imported one
    const template = useMemo(() => {
        if (major && MAJOR_TEMPLATES[major]) return MAJOR_TEMPLATES[major]
        try {
            const raw = localStorage.getItem(STORE_KEY)
            if (raw) {
                const o = JSON.parse(raw)
                return o.template || null
            }
        } catch (_) {}
        return null
    }, [major, templateKey])

    // Minor template — stored separately so course classification can use it
    const minorTemplate = useMemo(() => {
        try {
            const raw = localStorage.getItem(MINOR_STORE_KEY)
            if (raw) return JSON.parse(raw)
        } catch (_) {}
        return null
    }, [minorTemplateKey])

    // Human-readable name for the currently active template.
    // savedMajorName is set directly in applyMajorItem so it's always current —
    // prefer it over template?.program which may still be the previous selection's value.
    const currentProgram      = savedMajorName || template?.program || null
    const currentCalendarYear = savedCalendarYear || template?.calendarYear || null

    // ── Attached concentration/specialization/teachable checklists ──────────
    // Some majors (parser tags these sections key:"attachment") don't list
    // real courses themselves — they point at a SEPARATE checklist the
    // student must pick and attach (e.g. Humanities' "Minors and
    // Concentrations", Education's two Teachable Specializations). This
    // stores whichever checklist the student attached for each such slot,
    // scoped to the current program+year so switching majors (or importing
    // a different calendar year later) never carries over a stale one.
    const majorSignature = `${currentProgram || ""}::${currentCalendarYear || ""}`
    const [attachKey, setAttachKey] = useState(0) // bump to force re-read after (de)attaching
    const [attachModalSlot, setAttachModalSlot] = useState(null) // slot title currently in the upload modal, or null
    const [attachSearchSlot, setAttachSearchSlot] = useState(null) // slot title currently showing the inline search, or null

    const attachedForMajor = useMemo(() => {
        return readAttachStore()[majorSignature] || {}
    }, [majorSignature, attachKey])

    const attachSlots = useMemo(
        () => (template?.sections || []).filter(s => s.key === "attachment"),
        [template],
    )

    // The Concentration slot is always available, regardless of whether the
    // active major actually requires one — every student can voluntarily add
    // a concentration/specialization, not just majors with a mandatory one.
    // If the parsed template DOES have a real "attachment" section (e.g.
    // Humanities), use its real title/credits so it still reads as required;
    // otherwise fall back to a generic, stable title so the slot's storage
    // key doesn't change across majors that have no such requirement.
    const primaryConcentrationSlot = attachSlots[0] || { title: "Concentration", credits: 0 }

    // Light sanity check (not a hard block) — a legit concentration/
    // specialization checklist should have at least one major/ancillary
    // section with real required courses in it. If someone attaches
    // something else by mistake (wrong PDF, a checklist that itself needs
    // its OWN attachment, etc.) there'd be nothing to actually count toward
    // the slot — worth a visible warning so the student notices before
    // wondering why their courses aren't sorting.
    const attachmentLooksPlausible = (parsed) => {
        if (!parsed?.sections?.length) return false
        return parsed.sections.some(s =>
            (s.key === "major" || s.key === "ancillary") && (s.required?.length || s.choose?.length))
    }

    const saveAttachment = useCallback((slotTitle, parsed) => {
        const store = readAttachStore()
        store[majorSignature] = { ...(store[majorSignature] || {}), [slotTitle]: parsed }
        writeAttachStore(store)
        setAttachKey(k => k + 1)
    }, [majorSignature])

    const removeAttachment = useCallback((slotTitle) => {
        const store = readAttachStore()
        if (store[majorSignature]) {
            const next = { ...store[majorSignature] }
            delete next[slotTitle]
            store[majorSignature] = next
            writeAttachStore(store)
        }
        setAttachKey(k => k + 1)
    }, [majorSignature])

    // Every attached concentration's major/ancillary sections, combined into
    // one synthetic template — this is its OWN tab (like Minor), not folded
    // into Major/Ancillary, so a student can see concentration courses
    // separately from their main major's requirements.
    const concentrationTemplate = useMemo(() => {
        const attachedList = Object.values(attachedForMajor)
        if (attachedList.length === 0) return null
        const sections = attachedList.flatMap(
            parsed => (parsed?.sections || []).filter(s => s.key === "major" || s.key === "ancillary")
        )
        const totalCredits = attachedList.reduce((sum, p) => sum + (p?.totalCredits || 0), 0)
            || primaryConcentrationSlot.credits || 30
        return { sections, totalCredits }
    }, [attachedForMajor, primaryConcentrationSlot])

    // Section tabs — Minor/Concentration tabs only appear once something's
    // actually attached/selected for them.
    //
    // Major/Ancillary targets used to be hardcoded to 42/9 regardless of
    // which major was active — those numbers only happened to be right for
    // Computing Science. Every parsed template already carries its own real
    // credit totals per section (template.sections[].credits), so sum those
    // instead of guessing. Falls back to 42/9 only when there's no template
    // loaded yet (nothing better to show).
    const CORE_CREDITS_TARGET = 43 // University Core requirement — fixed across all TWU programs
    const majorCreditsTarget = useMemo(() => {
        if (!template) return 42
        const sum = (template.sections || [])
            .filter(s => s.key === "major")
            .reduce((a, s) => a + (s.credits || 0), 0)
        return sum || 42
    }, [template])
    const ancillaryCreditsTarget = useMemo(() => {
        if (!template) return 9
        const sum = (template.sections || [])
            .filter(s => s.key === "ancillary")
            .reduce((a, s) => a + (s.credits || 0), 0)
        return sum || 9
    }, [template])
    // Electives isn't its own section in any parsed template — it's whatever
    // credit is left over after Core/Major/Ancillary. Derive it from the
    // major's total program credits when we have one; otherwise fall back to
    // a generic 28 s.h. placeholder.
    const electivesCreditsTarget = useMemo(() => {
        if (!template?.totalCredits) return 28
        const remaining = template.totalCredits - CORE_CREDITS_TARGET - majorCreditsTarget - ancillaryCreditsTarget
        return remaining > 0 ? remaining : 28
    }, [template, majorCreditsTarget, ancillaryCreditsTarget])

    const SECTIONS = useMemo(() => {
        const base = [
            { id: "core",      label: "Core",      target: CORE_CREDITS_TARGET },
            { id: "major",     label: "Major",     target: majorCreditsTarget },
            { id: "ancillary", label: "Ancillary", target: ancillaryCreditsTarget },
        ]
        if (savedMinorName || minorTemplate) {
            base.push({ id: "minor", label: "Minor", target: minorTemplate?.totalCredits || 24 })
        }
        if (concentrationTemplate) {
            base.push({ id: "concentration", label: "Concentration", target: concentrationTemplate.totalCredits || 30 })
        }
        base.push({ id: "electives", label: "Electives", target: electivesCreditsTarget })
        return base
    }, [savedMinorName, minorTemplate, concentrationTemplate, majorCreditsTarget, ancillaryCreditsTarget, electivesCreditsTarget])

    // Status map: code → "Completed" | "In Progress" | "Planned"
    // When a course appears multiple times, pick the highest-priority status.
    const statusMap = useMemo(() => {
        const priority = { Completed: 3, "In Progress": 2, Planned: 1 }
        const m = {}
        for (const c of cards) {
            if (!c.code) continue
            if (!m[c.code] || (priority[c.status] || 0) > (priority[m[c.code]] || 0)) {
                m[c.code] = c.status
            }
        }
        return m
    }, [cards])

    // Persist both maps so the layout survives a refresh (browser-local for now).
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORE_KEY)
            if (raw) {
                const o = JSON.parse(raw)
                setPlacements(o.placements || {})
                setSatisfied(o.satisfied || {})
            }
        } catch (_) {}
    }, [])
    useEffect(() => {
        try {
            // Preserve any other keys (e.g. template) already in the store
            const existing = localStorage.getItem(STORE_KEY)
            const prev = existing ? JSON.parse(existing) : {}
            localStorage.setItem(STORE_KEY, JSON.stringify({ ...prev, placements, satisfied }))
        } catch (_) {}
    }, [placements, satisfied])

    // Apply a major template selected from the inline search
    const applyMajorItem = useCallback((item) => {
        applyChecklistImport(item, cards)
        try { localStorage.removeItem(MAJOR_KEY) } catch (_) {}
        const progName = item.program || ""
        const calYear  = item.calendarYear || ""
        try { localStorage.setItem(PROG_KEY, progName) } catch (_) {}
        try { localStorage.setItem(YEAR_KEY, calYear) } catch (_) {}
        try {
            const raw = localStorage.getItem(STORE_KEY)
            if (raw) { const o = JSON.parse(raw); setPlacements(o.placements || {}) }
        } catch (_) {}
        setMajor("")
        setTemplateKey(k => k + 1)   // force template memo to re-read STORE_KEY
        setSavedMajorName(progName)
        setSavedCalendarYear(calYear)
        setMajorSearchOpen(false)
    }, [cards])

    // Apply a minor selected from the community search
    const applyMinorItem = useCallback((item) => {
        // Clear any "electives"/"pool" placements for courses in the minor so
        // they fall through to auto-classification instead of staying in Electives
        const minorCodes = new Set(
            (item.sections || []).flatMap(s => [
                ...(s.required || []),
                ...(s.choose  || []),
            ])
        )
        setPlacements(prev => {
            const next = { ...prev }
            for (const code of minorCodes) {
                if (next[code] === "electives" || next[code] === "pool") delete next[code]
            }
            return next
        })
        const name = item.program || ""
        const year = item.calendarYear || ""
        try { localStorage.setItem(MINOR_PROG_KEY, name) } catch (_) {}
        try { localStorage.setItem(MINOR_YEAR_KEY, year) } catch (_) {}
        try { localStorage.setItem(MINOR_STORE_KEY, JSON.stringify(item)) } catch (_) {}
        setSavedMinorName(name)
        setSavedMinorCalendarYear(year)
        setMinorTemplateKey(k => k + 1)
        setMinorSearchOpen(false)
    }, [setPlacements])

    const clearMinor = useCallback(() => {
        try { localStorage.removeItem(MINOR_PROG_KEY) } catch (_) {}
        try { localStorage.removeItem(MINOR_YEAR_KEY) } catch (_) {}
        try { localStorage.removeItem(MINOR_STORE_KEY) } catch (_) {}
        setSavedMinorName("")
        setSavedMinorCalendarYear("")
        setMinorTemplateKey(k => k + 1)
    }, [])

    const clearMajor = useCallback(() => {
        try { localStorage.removeItem(PROG_KEY) } catch (_) {}
        try { localStorage.removeItem(YEAR_KEY) } catch (_) {}
        try { localStorage.removeItem(MAJOR_KEY) } catch (_) {}
        try { localStorage.removeItem(STORE_KEY) } catch (_) {}
        setPlacements({})
        setSatisfied({})
        setMajor("")
        setSavedMajorName("")
        setSavedCalendarYear("")
        setTemplateKey(k => k + 1)
        setMajorSearchOpen(false)
    }, [setPlacements])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    )

    // One entry per unique course code (the planner can hold dupes).
    const courses = useMemo(() => {
        const m = new Map()
        for (const c of cards) if (!m.has(c.code)) m.set(c.code, c)
        return [...m.values()]
    }, [cards])

    // Resolve every course to a target:
    //   1. Explicit user placement wins
    //   2. Core auto-fill (eligible list in coreChecklist.js)
    //   3. Template-based classification (major / ancillary / electives)
    //   4. Pool (unclassified)
    const assignment = useMemo(() => {
        const res = {}
        const used = {}
        const bump = id => { used[id] = (used[id] || 0) + 1 }

        // Pass 1: explicit placements
        for (const c of courses) {
            const p = placements[c.code]
            if (p !== undefined) { res[c.code] = p; if (isCoreSlot(p)) bump(p) }
        }

        // Pass 2: Core slot auto-fill
        for (const c of courses) {
            if (res[c.code] !== undefined) continue
            const slot = CORE_SLOTS.find(s => s.eligible.includes(c.code) && (used[s.id] || 0) < s.capacity)
            if (slot) { res[c.code] = slot.id; bump(slot.id) }
        }

        // Pass 3: major template classification, then concentration, then minor, then pool
        for (const c of courses) {
            if (res[c.code] !== undefined) continue

            // 3a. Major template — "major"/"ancillary" are final; "electives" is tentative
            //     (null = core-eligible but slot full, falls through too)
            let majorResult = null
            if (template) {
                majorResult = classifyCourse(c.code, template)
                if (majorResult && majorResult !== "electives") { res[c.code] = majorResult; continue }
            }

            // 3b. Concentration template — its own tab, checked the same way as
            //     Minor below (required/choose lists + electivePrefix ranges),
            //     so an attached concentration's courses show up separately
            //     instead of being folded into Major/Ancillary.
            if (concentrationTemplate) {
                const lvl = code => { const m = String(code || "").match(/(\d{3})/); return m ? Number(m[1]) : 0 }
                const inConcentration = (concentrationTemplate.sections || []).some(s => {
                    if ((s.required || []).includes(c.code) || (s.choose || []).includes(c.code)) return true
                    if (s.electivePrefix &&
                        c.code.toUpperCase().startsWith(s.electivePrefix.toUpperCase()) &&
                        lvl(c.code) >= (s.electiveMinLevel || 130)) return true
                    return false
                })
                if (inConcentration) { res[c.code] = "concentration"; continue }
            }

            // 3c. Minor template beats the elective fallback
            //     Checks: explicit required/choose lists AND electivePrefix for
            //     open-slot minors (e.g. Psychology Minor where most slots are
            //     "choose any PSYC 300+ course")
            if (minorTemplate) {
                const lvl = code => { const m = String(code || "").match(/(\d{3})/); return m ? Number(m[1]) : 0 }
                const inMinor = (minorTemplate.sections || []).some(s => {
                    if ((s.required || []).includes(c.code) || (s.choose || []).includes(c.code)) return true
                    if (s.electivePrefix &&
                        c.code.toUpperCase().startsWith(s.electivePrefix.toUpperCase()) &&
                        lvl(c.code) >= (s.electiveMinLevel || 130)) return true
                    return false
                })
                if (inMinor) { res[c.code] = "minor"; continue }
            }

            // 3d. Commit elective or pool
            res[c.code] = majorResult || "pool"
        }

        return res
    }, [courses, placements, template, concentrationTemplate, minorTemplate])

    const coursesIn = target => courses.filter(c => assignment[c.code] === target)
    const pool = coursesIn("pool")

    // Pool search filter (space-insensitive: "cmpt140" / "cmpt 140" / "140").
    const norm = s => s.toLowerCase().replace(/\s+/g, "")
    const visiblePool = query ? pool.filter(c => norm(c.code).includes(norm(query))) : pool

    // The course currently being moved — by drag OR by click-select.
    const activeCode = dragCode || selectedCode
    const slotHasRoom = (slot, exclude) =>
        coursesIn(slot.id).filter(c => c.code !== exclude).length < slot.capacity
    const isTargetSlot = slot =>
        !!activeCode && slot.eligible.includes(activeCode) && slotHasRoom(slot, activeCode)

    // Per-section + per-group credit totals (satisfied core slots count in full).
    const sectionCredits = id => {
        if (id !== "core") return coursesIn(id).reduce((a, c) => a + (c.credits || 0), 0)
        return CORE_SLOTS.reduce((sum, s) =>
            sum + (satisfied[s.id] ? s.credits : coursesIn(s.id).reduce((a, c) => a + (c.credits || 0), 0)), 0)
    }
    const groupStats = g => {
        const slots = g.subgroups.flatMap(sg => sg.slots)
        const target = slots.reduce((a, s) => a + s.credits, 0)
        const earned = slots.reduce((a, s) =>
            a + (satisfied[s.id] ? s.credits : coursesIn(s.id).reduce((x, c) => x + (c.credits || 0), 0)), 0)
        return { target, earned, done: target > 0 && earned >= target }
    }

    const place    = (code, target) => setPlacements(p => ({ ...p, [code]: target }))
    const unplace  = (code) => setPlacements(p => ({ ...p, [code]: "pool" }))
    const toggleSat = (id) => setSatisfied(s => {
        const n = { ...s }; if (n[id]) delete n[id]; else n[id] = true; return n
    })

    // Click-to-place handlers
    const pickSelect = code => setSelected(prev => (prev === code ? null : code))
    const placeSelectedInSlot = slot => {
        if (selectedCode && slotHasRoom(slot, selectedCode)) { place(selectedCode, slot.id); setSelected(null) }
    }
    const placeSelectedInSection = sec => {
        if (selectedCode) { place(selectedCode, sec); setSelected(null) }
    }

    const onDragEnd = ({ active, over }) => {
        setDragCode(null)
        if (!over) return
        const code = active.data.current?.code
        const t = String(over.id)
        if (t === "pool") return unplace(code)
        if (t.startsWith("slot:")) {
            const slotId = t.slice(5)
            const slot = CORE_SLOTS.find(s => s.id === slotId)
            const taken = coursesIn(slotId).filter(c => c.code !== code).length
            if (slot && taken >= slot.capacity) return
            return place(code, slotId)
        }
        if (t.startsWith("tab:")) {
            const sec = t.slice(4)
            if (sec === "core") {
                const slot = CORE_SLOTS.find(s =>
                    s.eligible.includes(code) && coursesIn(s.id).filter(c => c.code !== code).length < s.capacity)
                return slot ? place(code, slot.id) : undefined
            }
            return place(code, sec)
        }
        if (t.startsWith("body:")) {
            const sec = t.slice(5)
            if (sec !== "core") place(code, sec)
        }
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={({ active }) => { setSelected(null); setDragCode(active.data.current?.code) }}
            onDragEnd={onDragEnd}
        >
            <div className={styles.checklist}>

                {/* ── Major / Minor / Concentration bar ──
                    Concentration is always shown as a third column — every
                    student can add one, not just majors that require it. If
                    the active major's parsed template DOES have a real
                    "attachment" section (e.g. Humanities), that real slot is
                    used so it still reads as required for that major. */}
                <div className={styles.majorBar}>
                    {/* Major half */}
                    <div className={styles.majorHalf}>
                        <span className={styles.majorLabel}>Major</span>
                        {majorSearchOpen ? (
                            <MajorSearch
                                type="major"
                                onSelect={applyMajorItem}
                                onClose={() => setMajorSearchOpen(false)}
                            />
                        ) : currentProgram ? (
                            <>
                                <span className={styles.majorName}>{currentProgram}</span>
                                {currentCalendarYear && (
                                    <span className={styles.majorBadge}>{currentCalendarYear}</span>
                                )}
                                <button className={styles.barChangeBtn} onClick={() => setMajorSearchOpen(true)}>Change</button>
                                <button className={styles.barClearBtn} onClick={clearMajor} aria-label="Remove major">×</button>
                            </>
                        ) : (
                            <button className={styles.addMinorBtn} onClick={() => setMajorSearchOpen(true)}>
                                + Select major
                            </button>
                        )}
                    </div>

                    {/* Divider */}
                    <div className={styles.majorDivider} />

                    {/* Minor half */}
                    <div className={styles.majorHalf}>
                        <span className={styles.majorLabel}>Minor</span>
                        {minorSearchOpen ? (
                            <MajorSearch
                                type="minor"
                                onSelect={applyMinorItem}
                                onClose={() => setMinorSearchOpen(false)}
                                onUpload={() => { setMinorSearchOpen(false); setMinorImportOpen(true) }}
                            />
                        ) : savedMinorName ? (
                            <>
                                <span className={styles.majorName}>{savedMinorName}</span>
                                {savedMinorCalendarYear && (
                                    <span className={styles.majorBadge}>{savedMinorCalendarYear}</span>
                                )}
                                <button className={styles.barChangeBtn} onClick={() => setMinorSearchOpen(true)}>Change</button>
                                <button className={styles.barClearBtn} onClick={clearMinor} aria-label="Remove minor">×</button>
                            </>
                        ) : (
                            <button className={styles.addMinorBtn} onClick={() => setMinorSearchOpen(true)}>
                                + Add minor
                            </button>
                        )}
                    </div>

                    {/* Divider */}
                    <div className={styles.majorDivider} />

                    {/* Concentration half — always available. Only the FIRST
                        attachment slot renders here; any additional REAL slots
                        (e.g. Education's two Teachables) render as extra stacked
                        rows below since this column only has room for one. */}
                    {(() => {
                        const slot = primaryConcentrationSlot
                        const attached = attachedForMajor[slot.title]
                        const searching = attachSearchSlot === slot.title
                        return (
                            <div className={styles.majorHalf}>
                                <span className={styles.majorLabel}>Concentration</span>
                                {searching ? (
                                    <MajorSearch
                                        type="concentration"
                                        onSelect={(item) => { saveAttachment(slot.title, item); setAttachSearchSlot(null) }}
                                        onClose={() => setAttachSearchSlot(null)}
                                        onUpload={() => { setAttachSearchSlot(null); setAttachModalSlot(slot.title) }}
                                    />
                                ) : attached ? (
                                    <>
                                        <span className={styles.majorName}>{attached.program || "Attached"}</span>
                                        {attached.calendarYear && <span className={styles.majorBadge}>{attached.calendarYear}</span>}
                                        <button className={styles.barChangeBtn} onClick={() => setAttachSearchSlot(slot.title)}>Change</button>
                                        <button className={styles.barClearBtn} onClick={() => removeAttachment(slot.title)} aria-label="Remove attachment">×</button>
                                    </>
                                ) : (
                                    <button className={styles.addMinorBtn} onClick={() => setAttachSearchSlot(slot.title)}>
                                        + Attach checklist
                                    </button>
                                )}
                            </div>
                        )
                    })()}
                </div>

                {/* Plausibility warning for the primary Concentration slot, and any
                    additional REAL attachment slots beyond the first (rare — only
                    multi-slot majors like Education's two Teachables need these). */}
                {(() => {
                    const firstSlot = primaryConcentrationSlot
                    const firstAttached = attachedForMajor[firstSlot.title]
                    const firstPlausible = firstAttached ? attachmentLooksPlausible(firstAttached) : true
                    const restSlots = attachSlots.slice(1)
                    if (firstPlausible && restSlots.length === 0) return null
                    return (
                        <div className={styles.majorBar} style={{ flexDirection: "column", alignItems: "stretch", gap: 6, padding: "10px 14px" }}>
                            {firstAttached && !firstPlausible && (
                                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--negative, #b45309)" }}>
                                    ⚠ This checklist doesn't seem to list real course requirements — double check it's the right one for {firstSlot.title.replace(/:$/, "")}.
                                </div>
                            )}
                            {restSlots.map(slot => {
                                const attached = attachedForMajor[slot.title]
                                const searching = attachSearchSlot === slot.title
                                const plausible = attached ? attachmentLooksPlausible(attached) : true
                                return (
                                    <div key={slot.title}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: 13 }}>
                                            <span style={{ color: "var(--ink-3)", fontWeight: 600, minWidth: 0, whiteSpace: "nowrap" }}>
                                                {slot.title}{slot.credits ? ` (${slot.credits} s.h.)` : ""}
                                            </span>
                                            {searching ? (
                                                <MajorSearch
                                                    type="concentration"
                                                    onSelect={(item) => { saveAttachment(slot.title, item); setAttachSearchSlot(null) }}
                                                    onClose={() => setAttachSearchSlot(null)}
                                                    onUpload={() => { setAttachSearchSlot(null); setAttachModalSlot(slot.title) }}
                                                />
                                            ) : attached ? (
                                                <>
                                                    <span className={styles.majorName}>{attached.program || "Attached"}</span>
                                                    {attached.calendarYear && <span className={styles.majorBadge}>{attached.calendarYear}</span>}
                                                    <button className={styles.barChangeBtn} onClick={() => setAttachSearchSlot(slot.title)}>Change</button>
                                                    <button className={styles.barClearBtn} onClick={() => removeAttachment(slot.title)} aria-label="Remove attachment">×</button>
                                                </>
                                            ) : (
                                                <button className={styles.addMinorBtn} onClick={() => setAttachSearchSlot(slot.title)}>
                                                    + Attach checklist
                                                </button>
                                            )}
                                        </div>
                                        {attached && !plausible && (
                                            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--negative, #b45309)", marginTop: 2 }}>
                                                ⚠ This checklist doesn't seem to list real course requirements — double check it's the right one for {slot.title.replace(/:$/, "")}.
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })()}

                {/* Click-to-place banner */}
                {selectedCode && (
                    <div className={styles.placingBanner}>
                        Placing <strong>{selectedCode}</strong> — tap a highlighted slot to drop it.
                        <button className={styles.placingCancel} onClick={() => setSelected(null)}>Cancel</button>
                    </div>
                )}

                {/* Section tabs — also drop targets */}
                <div className={styles.tabs}>
                    {SECTIONS.map(s => {
                        const cr = sectionCredits(s.id)
                        const pct = Math.min(100, Math.round((cr / s.target) * 100))
                        const frac = s.id === "electives" ? `${cr} s.h.` : `${cr} / ${s.target}`
                        return (
                            <Drop key={s.id} id={`tab:${s.id}`}
                                  className={`${styles.tab} ${tab === s.id ? styles.tabOn : ""}`}>
                                <button className={styles.tabBtn} onClick={() => setTab(s.id)}>
                                    <span className={styles.tabLabel}>{s.label}</span>
                                    <span className={styles.tabFrac}>{frac}</span>
                                    <span className={styles.tabBar}>
                                        <span className={styles.tabBarFill} style={{ width: `${pct}%` }} />
                                    </span>
                                </button>
                            </Drop>
                        )
                    })}
                </div>

                {/* Core = structured groups → sub-sections → slots; other tabs = bucket */}
                {tab === "core" ? (
                    <div className={styles.core}>
                        {CORE_GROUPS.map(g => {
                            const gs = groupStats(g)
                            return (
                                <div key={g.id} className={styles.group}>
                                    <div className={styles.groupHead}>
                                        <span>{g.title}</span>
                                        <span className={`${styles.groupProg} ${gs.done ? styles.groupDone : ""}`}>
                                            {gs.earned} / {gs.target}{gs.done ? " ✓" : ""}
                                        </span>
                                    </div>
                                    {g.note && <div className={styles.groupNote}>{g.note}</div>}
                                    {g.subgroups.map(sg => {
                                        const multi = sg.slots.find(s => s.capacity > 1)
                                        return (
                                            <div key={sg.title} className={styles.subgroup}>
                                                <div className={styles.subHead}>
                                                    {sg.title}
                                                    {multi && <span className={styles.subCap}> · {multi.caption || `choose ${multi.capacity}`}</span>}
                                                </div>
                                                {sg.slots.map(slot => (
                                                    <CoreSlotRow
                                                        key={slot.id}
                                                        slot={slot}
                                                        courses={coursesIn(slot.id)}
                                                        satisfied={!!satisfied[slot.id]}
                                                        target={isTargetSlot(slot)}
                                                        muted={!!activeCode && !isTargetSlot(slot)}
                                                        onToggleSat={toggleSat}
                                                        onRemove={unplace}
                                                        onPlace={() => placeSelectedInSlot(slot)}
                                                        statusMap={statusMap}
                                                    />
                                                ))}
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <Drop id={`body:${tab}`} className={styles.tableWrap} onClick={() => placeSelectedInSection(tab)}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.thCheck}>✓</th>
                                    <th>Course</th>
                                    <th className={styles.thSh}>S.H.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coursesIn(tab).map(c => {
                                    const st = statusMap[c.code]
                                    return (
                                        <tr key={c.code}>
                                            <td className={styles.tdCheck}>
                                                {st === "Completed"
                                                    ? <span className={styles.checkDone}>✓</span>
                                                    : st === "In Progress"
                                                        ? <span className={styles.checkProgress}>◑</span>
                                                        : st === "Planned"
                                                            ? <span className={styles.checkPlanned}>●</span>
                                                            : <span className={styles.checkEmpty}>○</span>}
                                            </td>
                                            <td>
                                                <CoursePill
                                                    code={c.code}
                                                    where="row"
                                                    onRemove={() => unplace(c.code)}
                                                    status={st}
                                                />
                                            </td>
                                            <td className={styles.tdSh}>{c.credits ?? "–"}</td>
                                        </tr>
                                    )
                                })}
                                {coursesIn(tab).length === 0 && (
                                    <tr><td colSpan={3} className={styles.emptyRow}>
                                        {!major && tab !== "electives"
                                            ? "Select your major above to auto-fill this section"
                                            : "Drag or tap-to-place courses here"}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </Drop>
                )}

                {/* Unplaced courses */}
                <Drop id="pool" className={styles.pool}>
                    <div className={styles.poolHead}>
                        <span>Your courses</span>
                        {pool.length > 0 && (
                            <div className={styles.poolSearchWrap}>
                                <input
                                    className={styles.poolSearch}
                                    type="text"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Filter…"
                                    aria-label="Filter courses"
                                />
                                {query && (
                                    <button className={styles.poolSearchClear} onClick={() => setQuery("")} aria-label="Clear search">×</button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={styles.poolChips}>
                        {courses.length === 0
                            ? <span className={styles.poolEmpty}>No courses yet — add them in "My courses".</span>
                            : pool.length === 0
                                ? <span className={styles.poolEmpty}>Everything's placed.</span>
                                : visiblePool.length === 0
                                    ? <span className={styles.poolEmpty}>No courses match "{query}".</span>
                                    : visiblePool.map(c => (
                                        <CoursePill
                                            key={c.code}
                                            code={c.code}
                                            where="pool"
                                            onSelect={() => pickSelect(c.code)}
                                            selected={selectedCode === c.code}
                                            status={statusMap[c.code]}
                                        />
                                      ))}
                    </div>
                </Drop>
            </div>

            <DragOverlay>
                {dragCode ? <span className={styles.pillGhost}>{dragCode}</span> : null}
            </DragOverlay>

            {minorImportOpen && (
                <ChecklistImportModal
                    cards={cards}
                    onClose={() => setMinorImportOpen(false)}
                    onMinorImported={(parsed) => {
                        // Clear elective/pool placements for minor courses
                        const minorCodes = new Set(
                            (parsed.sections || []).flatMap(s => [
                                ...(s.required || []),
                                ...(s.choose  || []),
                            ])
                        )
                        setPlacements(prev => {
                            const next = { ...prev }
                            for (const code of minorCodes) {
                                if (next[code] === "electives" || next[code] === "pool") delete next[code]
                            }
                            return next
                        })
                        const name = parsed.program || ""
                        const year = parsed.calendarYear || ""
                        try { localStorage.setItem(MINOR_PROG_KEY, name) } catch (_) {}
                        try { localStorage.setItem(MINOR_YEAR_KEY, year) } catch (_) {}
                        try { localStorage.setItem(MINOR_STORE_KEY, JSON.stringify(parsed)) } catch (_) {}
                        setSavedMinorName(name)
                        setSavedMinorCalendarYear(year)
                        setMinorTemplateKey(k => k + 1)
                        setMinorImportOpen(false)
                        setMinorSearchOpen(false)
                    }}
                />
            )}

            {attachModalSlot && (
                <ChecklistImportModal
                    cards={cards}
                    attachmentLabel={attachModalSlot}
                    onClose={() => setAttachModalSlot(null)}
                    onAttachmentImported={(parsed) => {
                        // Clear elective/pool placements for the attached checklist's
                        // courses so they fall through to Major/Ancillary classification
                        // instead of staying wherever they'd landed before.
                        const attachedCodes = new Set(
                            (parsed.sections || []).flatMap(s => [
                                ...(s.required || []),
                                ...(s.choose  || []),
                            ])
                        )
                        setPlacements(prev => {
                            const next = { ...prev }
                            for (const code of attachedCodes) {
                                if (next[code] === "electives" || next[code] === "pool") delete next[code]
                            }
                            return next
                        })
                        saveAttachment(attachModalSlot, parsed)
                        setAttachModalSlot(null)
                    }}
                />
            )}
        </DndContext>
    )
}
