import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import styles from "../../css/BookMarkCard.module.css"

export default function BookMarkCards({ course }) {

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: course.id,
        data: {course}
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.9 : 1,
        // lift the chip above the columns while dragging so it doesn't slide behind them
        position: "relative",
        zIndex: isDragging ? 1000 : "auto",
        boxShadow: isDragging ? "var(--shadow-lg, 0 12px 32px rgba(0,27,61,0.22))" : undefined,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={styles.card}
            {...listeners}
            {...attributes}
        >
            <span className={styles.code}>{course.code}</span>
            <span className={styles.grip} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" />
                    <circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" />
                </svg>
            </span>
        </div>
    )
}
