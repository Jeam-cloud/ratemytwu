import { useState } from "react"

export default function BoardCard({ card, onDelete, onUpdate }) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)

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
        <div>
            <p>{card.code}</p>
            <p>{card.status}</p>
            <p>{card.credits ? `${card.credits} cr` : "No credits set"}</p>
            {card.grade && <p>{card.grade}</p>}
            {card.notes && <p>{card.notes}</p>}
            <button onClick={() => setMenuOpen(!menuOpen)}>⋮</button>
        
            {menuOpen && (
            <div>
                <button onClick={() => { setModalOpen(true); setMenuOpen(false)}}>Edit Course Details</button>
                <button onClick={() => onDelete(card.id)}>Remove from planner</button>
            </div>
        )}

        {modalOpen && (
            <div>

                <h3>Edit {card.code}</h3>

                <select value={term} onChange={(event) => setTerm(event.target.value)}>
                    <option>Fall</option>
                    <option>Spring</option>
                    <option>Summer</option>
                </select>

                <input type="number" 
                    value={credits} 
                    onChange={(event) => setCredits(event.target.value)} 
                    placeholder="Credits" 
                    min={0} 
                    max={4}
                    maxLength={1} 
                />

                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option>Planned</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                </select>

                <input
                    type="text"
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    placeholder="Grade"
                    maxLength={2}
                />

                <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Notes"
                />

                <button onClick={handleSave}>Save changes</button>
                <button onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
        )}
        </div>


    )
}