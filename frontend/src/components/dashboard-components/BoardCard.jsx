import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import styles from "../../css/BoardCard.module.css"

// status → badge tone (per design: Planned neutral · In Progress blue · Completed gold)
const STATUS_TONE = {
    "Planned": styles.tonePlanned,
    "In Progress": styles.toneProgress,
    "Completed": styles.toneCompleted,
}

export default function BoardCard({ card, onDelete, onUpdate, startYear, autoOpen, onAutoEditDone }) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
        if (autoOpen) {
            setModalOpen(true)
            onAutoEditDone?.()
        }
    }, [autoOpen])

    // makes the whole card draggable between term columns
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `card-${card.id}`,
        data: { card }
    })

    const dragStyle = {
        touchAction: "none",
        opacity: isDragging ? 0 : 1,  // hide original while DragOverlay shows the ghost
        cursor: "grab",
    }

    const [term, setTerm] = useState(card.term)
    const [credits, setCredits] = useState(card.credits || "")
    const [status, setStatus] = useState(card.status || "Planned")
    const [grade, setGrade] = useState(card.grade || "")
    const [notes, setNotes] = useState(card.notes || "")

    const handleSave = () => {
        onUpdate(card.id, {
            year: card.year,
            term,
            credits: credits ? Number(credits) : null,
            status,
            grade: grade || null,
            notes: notes || null
        })
        setModalOpen(false)
    }

    return (
        <div ref={setNodeRef} style={dragStyle} className={styles.card} {...listeners} {...attributes}>
            <div className={styles.cardTop}>
                <span className={styles.code}>{card.code}</span>
                <div className={styles.cardTopRight}>
                    <span className={styles.credits}>{card.credits ? `${card.credits} cr` : "— cr"}</span>
                    {/* stop drag from starting when interacting with the menu button */}
                    <button
                        className={styles.menuBtn}
                        onClick={() => setMenuOpen(!menuOpen)}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Card options"
                    >⋮</button>
                </div>
            </div>

            <div className={styles.badges}>
                {card.status && (
                    <span className={`${styles.statusBadge} ${STATUS_TONE[card.status] || styles.tonePlanned}`}>
                        <span className={styles.statusDot} /> {card.status}
                    </span>
                )}
                {card.grade && <span className={styles.gradePill}>{card.grade}</span>}
            </div>

            {card.notes && (
                <p className={styles.notes}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h6" />
                    </svg>
                    {card.notes}
                </p>
            )}

            {/* Action sheet */}
            {menuOpen && (
                <>
                    <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
                    <div className={styles.menu} onPointerDown={(e) => e.stopPropagation()}>
                        <div className={styles.menuHeader}>
                            {card.code} · {card.term} {card.year ? "" : ""}
                            <span className={styles.menuSub}>{card.credits ? `${card.credits} credits` : "No credits set"}</span>
                        </div>
                        <button className={styles.menuEdit} onClick={() => { setModalOpen(true); setMenuOpen(false) }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                            Edit course details
                        </button>
                        <button className={styles.menuRemove} onClick={() => { onDelete(card.id); setMenuOpen(false) }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            </svg>
                            Remove from planner
                        </button>
                    </div>
                </>
            )}

            {/* Edit modal — portaled to body so an ancestor's transform (column hover lift)
                doesn't trap this position:fixed overlay inside the column */}
            {modalOpen && createPortal(
                <div
                    className={styles.overlay}
                    onClick={() => setModalOpen(false)}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHead}>
                            <div>
                                <h3 className={styles.modalTitle}>Edit {card.code}</h3>
                                <p className={styles.modalSub}>{card.term} {(startYear ?? new Date().getFullYear()) + (card.year - 1)}</p>
                            </div>
                            <button className={styles.modalClose} onClick={() => setModalOpen(false)} aria-label="Close">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className={styles.formGrid}>
                            <div className={styles.field}>
                                <label className={styles.label}>Term</label>
                                <select className={styles.select} value={term} onChange={(e) => setTerm(e.target.value)}>
                                    <option>Fall</option>
                                    <option>Spring</option>
                                    <option>Summer</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Credits <span className={styles.hint}>e.g. 3, 4, or 5</span></label>
                                <input className={styles.input} type="number" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="3" min={0} max={9} />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Status</label>
                                <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                                    <option>Planned</option>
                                    <option>In Progress</option>
                                    <option>Completed</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Grade <span className={styles.hint}>optional</span></label>
                                <input className={styles.input} type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="B+" maxLength={2} />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Notes <span className={styles.hint}>optional</span></label>
                            <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='e.g. "Hard but rewarding", "Great professor"' />
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className={styles.saveBtn} onClick={handleSave}>Save changes</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
