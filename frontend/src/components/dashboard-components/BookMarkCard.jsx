import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

export default function BookMarkCards({ course }) {

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: course.id,
        data: {course}
    })

    const style = {
        transform: CSS.Translate.toString(transform)
    }

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {course.code}
        </div>
    )
}