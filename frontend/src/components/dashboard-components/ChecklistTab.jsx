import { useState, useEffect, useMemo } from "react"
import {
    DndContext, DragOverlay, PointerSensor, TouchSensor,
    useSensor, useSensors, useDraggable, useDroppable,
} from "@dnd-kit/core"
import { CORE_GROUPS } from "../../data/coreChecklist"
import styles from "../../css/ChecklistTab.module.css"

// Four buckets every checklist has. Targets are just the bar denominators.
const SECTIONS = [
    { id: "core",      label: "Core",      target: 43 },
    { id: "major",     label: "Major",     target: 42 },
    { id: "ancillary", label: "Ancillary", target: 9  },
    { id: "electives", label: "Electives", target: 28 },
]

const STORE_KEY = "rmtwu_checklist_v2"

// Flat list of every core slot (groups → subgroups → slots), tagged with its group.
const CORE_SLOTS = CORE_GROUPS.flatMap(g =>
    g.subgroups.flatMap(sg => sg.slots.map(s => ({ ...s, groupId: g.id })))
)
const isCoreSlot = id => CORE_SLOTS.some(s => s.id === id)

// ── Draggable course pill ─────────────────────────────────────────────────────
// `where` keeps the dnd id unique between the pool copy and a placed copy.
function CoursePill({ code, where, onRemove, onSelect, selected }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `${where}:${code}`,
        data: { code },
    })
    return (
        <span
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`${styles.pill} ${selected ? styles.pillSelected : ""}`}
            style={{ opacity: isDragging ? 0.35 : 1 }}
            onClick={onSelect ? (e) => { e.stopPropagation(); onSelect() } : undefined}
        >
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
function CoreSlotRow({ slot, courses, satisfied, target, muted, onToggleSat, onRemove, onPlace }) {
    const [menu, setMenu] = useState(false)
    const filled = courses.length
    const status = satisfied ? "sat"
        : filled >= slot.capacity ? "done"
        : filled > 0 ? "partial" : "empty"
    const icon = { sat: "✓", done: "✓", partial: "•", empty: "○" }[status]
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
                                <CoursePill key={c.code} code={c.code} where="row" onRemove={() => onRemove(c.code)} />
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
    const [tab, setTab]               = useState("core")
    const [placements, setPlacements] = useState({}) // code -> slotId | sectionId | "pool"
    const [satisfied, setSatisfied]   = useState({}) // slotId -> true
    const [dragCode, setDragCode]     = useState(null)
    const [selectedCode, setSelected] = useState(null) // click-to-place
    const [query, setQuery]           = useState("")

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
        try { localStorage.setItem(STORE_KEY, JSON.stringify({ placements, satisfied })) } catch (_) {}
    }, [placements, satisfied])

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

    // Resolve every course to a target: explicit placement wins; otherwise auto-fill
    // into the first eligible core slot that still has room; otherwise the pool.
    const assignment = useMemo(() => {
        const res = {}
        const used = {}
        const bump = id => { used[id] = (used[id] || 0) + 1 }
        for (const c of courses) {
            const p = placements[c.code]
            if (p !== undefined) { res[c.code] = p; if (isCoreSlot(p)) bump(p) }
        }
        for (const c of courses) {
            if (res[c.code] !== undefined) continue
            const slot = CORE_SLOTS.find(s => s.eligible.includes(c.code) && (used[s.id] || 0) < s.capacity)
            if (slot) { res[c.code] = slot.id; bump(slot.id) }
            else res[c.code] = "pool"
        }
        return res
    }, [courses, placements])

    const coursesIn = target => courses.filter(c => assignment[c.code] === target)
    const pool = coursesIn("pool")

    // Pool search filter (space-insensitive: "cmpt140" / "cmpt 140" / "140").
    const norm = s => s.toLowerCase().replace(/\s+/g, "")
    const visiblePool = query ? pool.filter(c => norm(c.code).includes(norm(query))) : pool

    // The course currently being moved — by drag OR by click-select. Drives the
    // "valid slot" highlighting so the move is guided rather than blind.
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
                                                    {multi && <span className={styles.subCap}> · choose {multi.capacity}</span>}
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
                                {coursesIn(tab).map(c => (
                                    <tr key={c.code}>
                                        <td className={styles.tdCheck}>✓</td>
                                        <td><CoursePill code={c.code} where="row" onRemove={() => unplace(c.code)} /></td>
                                        <td className={styles.tdSh}>{c.credits ?? "–"}</td>
                                    </tr>
                                ))}
                                {coursesIn(tab).length === 0 && (
                                    <tr><td colSpan={3} className={styles.emptyRow}>Drag or tap-to-place courses here</td></tr>
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
                            ? <span className={styles.poolEmpty}>No courses yet — add them in “My courses”.</span>
                            : pool.length === 0
                                ? <span className={styles.poolEmpty}>Everything’s placed.</span>
                                : visiblePool.length === 0
                                    ? <span className={styles.poolEmpty}>No courses match “{query}”.</span>
                                    : visiblePool.map(c => (
                                        <CoursePill
                                            key={c.code}
                                            code={c.code}
                                            where="pool"
                                            onSelect={() => pickSelect(c.code)}
                                            selected={selectedCode === c.code}
                                        />
                                      ))}
                    </div>
                </Drop>
            </div>

            <DragOverlay>
                {dragCode ? <span className={styles.pillGhost}>{dragCode}</span> : null}
            </DragOverlay>
        </DndContext>
    )
}
