import { useDroppable } from "@dnd-kit/core"
import BoardCard from "./BoardCard"

export default function DashBoardColumn({ col, cards, onDelete, onUpdate }) {
    const { setNodeRef } = useDroppable({
        id: `${col.year}-${col.term}`,
        data: { col }
    })

    return (
        <div ref={setNodeRef}>
            <p>{col.label}</p>

            {cards.map((card) => (
                <BoardCard key={card.id} card={card} onDelete={onDelete} onUpdate={onUpdate}/>
            ))}
        </div>
    )
}