import { useDroppable } from "@dnd-kit/core"
import BoardCard from "./BoardCard"
import styles from "../../css/DashBoardColumn.module.css"

export default function DashBoardColumn({ col, cards, onDelete, onUpdate }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `${col.year}-${col.term}`,
        data: { col }
    })

    const termCredits = cards.reduce((sum, c) => sum + (c.credits || 0), 0)

    return (
        <div ref={setNodeRef} className={`${styles.column} ${isOver ? styles.over : ""}`}>
            <div className={styles.head}>
                <span className={styles.label}>{col.label}</span>
                <span className={styles.credits}>{termCredits} cr</span>
            </div>

            {cards.length === 0 ? (
                <div className={styles.dropzone}>Drag a course here</div>
            ) : (
                <div className={styles.cards}>
                    {cards.map((card) => (
                        <BoardCard key={card.id} card={card} onDelete={onDelete} onUpdate={onUpdate} />
                    ))}
                </div>
            )}
        </div>
    )
}
