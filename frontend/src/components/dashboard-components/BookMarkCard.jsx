import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import styles from "../../css/BookMarkCard.module.css"

export default function BookMarkCards({ course }) {

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: course.id,
        data: {course}
    })

    const style = {
        touchAction: "none",
        opacity: isDragging ? 0 : 1,  // hide original while DragOverlay shows the ghost
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
