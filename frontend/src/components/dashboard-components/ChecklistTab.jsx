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

    // Pick dot style based on completion status
    const dotCls = status === "Completed"   ? styles.statusCompleted
                 : status === "In Progress" ? styles.statusProgress
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
    const icon = { sat: "✓", verified: "✓", done: "✓", partial: "•", empty: "○" }[status]
    const cls = `${styles.slotRow} ${target ? styles.slotTarget : ""} ${muted ? styles.slotMuted : ""}`

    return (
        <Drop id={`slot:${slot.id}`} className={cls} onClick={onPlace}>
            <span className={`${styles.slotStatus} ${styles[`st_${status}`]}`}>{icon}</span>

            <div className={styles.slotMain}>
                {slot.label && <div className={styles.slotLabel}>{slot.label}</div>}
                <div className={styles.slotChips}>
                    {satisfied
                        ? <span className={styles.satTag}>Satisfied — no course needed</span>
                        : filled
                            ? courses.map(c => (
                                <CoursePill
                                    key={c.code}
                                    code={c.code}
                                    where="row"
                                    onRemove={() => onRemove(c.code)}
                                    status={statusMap[c.code]}
                                />
                              ))
                            : <span className={styles.dropHint}>
                                {slot.hint || (slot.capacity > 1 ? `drag ${slot.capacity} courses here` : "drag a course here")}
                              </span>}
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
    const [majorSearchOpen, setMajorSearchOpen] = useState(false)
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

    // Section tabs — Minor tab only appears when a minor is selected
    const SECTIONS = useMemo(() => {
        const base = [
            { id: "core",      label: "Core",      target: 43 },
            { id: "major",     label: "Major",     target: 42 },
            { id: "ancillary", label: "Ancillary", target: 9  },
        ]
        if (savedMinorName || minorTemplate) {
            base.push({ id: "minor", label: "Minor", target: minorTemplate?.totalCredits || 24 })
        }
        base.push({ id: "electives", label: "Electives", target: 28 })
        return base
    }, [savedMinorName, minorTemplate])

    // Human-readable name for the currently active template.
    // savedMajorName is set directly in applyMajorItem so it's always current —
    // prefer it over template?.program which may still be the previous selection's value.
    const currentProgram      = savedMajorName || template?.program || null
    const currentCalendarYear = savedCalendarYear || template?.calendarYear || null

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

        // Pass 3: major template classification, then minor, then pool
        for (const c of courses) {
            if (res[c.code] !== undefined) continue

            // 3a. Major template — "major"/"ancillary" are final; "electives" is tentative
            //     (null = core-eligible but slot full, falls through too)
            let majorResult = null
            if (template) {
                majorResult = classifyCourse(c.code, template)
                if (majorResult && majorResult !== "electives") { res[c.code] = majorResult; continue }
            }

            // 3b. Minor template beats the elective fallback
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

            // 3c. Commit elective or pool
            res[c.code] = majorResult || "pool"
        }

        return res
    }, [courses, placements, template, minorTemplate])

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

                {/* ── Major / Minor bar ── */}
                <div className={styles.majorBar}>
                    {/* Major half */}
                    <div className={styles.majorHalf}>
                        <span className={styles.majorLabel}>Major</span>
                        {(majorSearchOpen || !currentProgram) ? (
                            <MajorSearch
                                type="major"
                                onSelect={applyMajorItem}
                                onClose={() => setMajorSearchOpen(false)}
                            />
                        ) : (
                            <>
                                <span className={styles.majorName}>{currentProgram}</span>
                                {currentCalendarYear && (
                                    <span className={styles.majorBadge}>{currentCalendarYear}</span>
                                )}
                                <button className={styles.barChangeBtn} onClick={() => setMajorSearchOpen(true)}>Change</button>
                            </>
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
                </div>

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
        </DndContext>
    )
}
