import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { DndContext } from "@dnd-kit/core"

import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"

import { useReview } from "../../hooks/useReview"
import { useBookMark } from "../../hooks/useBookMark"

import BookMarkCard from "../../components/dashboard-components/BookMarkCard"
import DashBoardColumn from "../../components/dashboard-components/DashBoardColumn"

export default function Dashboard() {

    const { reviews, deleteReview } = useReview()    
    const { bookmark } = useBookMark()
    const navigate = useNavigate()
    const [years, setYears] = useState(null)
    const [error, setError] = useState(null)
    const [cards, setCards] = useState([])

    const totalCredits = cards.reduce((sum, card) => sum + (card.credits || 0), 0)
    const percent = Math.round((totalCredits / 120) * 100)

    // loads up how many years the user said last session
    useEffect(() => {
        const saved = localStorage.getItem("year")
        if (saved) {
            setYears(Number(saved))
        }

        // GET cards request
        const loadCards = async () => {
            const { data } = await supabase.auth.getSession()
            const token = data.session.access_token

            const response = await fetch(`${API_URL}/board/cards`, {
                method: "GET",
                headers: {"Content-type": "application/json", "Authorization": `Bearer ${token}`}
            })

            if (!response.ok) {
                setError("Failed to load cards")
                return
            }

            const data2 = await response.json()
            setCards(data2)
        }

        loadCards()
    }, [])

    // updates year state variable after being prompted how many years
    const handleYear = (year) => {
        localStorage.setItem("year", year)
        setYears(year)
    }

    // generates the labels of the columns and how many columns based on years
    const generateColumns = (years) => {
        const startYear = new Date().getFullYear()
        const columns = []

        for (let i = 0; i < years; i++) {
            columns.push({term: "Fall", year: i+1, label: `Fall ${startYear + i}`})
            columns.push({term: "Spring", year: i+1, label: `Spring ${startYear + i + 1}`})
            columns.push({term: "Summer", year: i+1, label: `Summer ${startYear + i +1}`})
        }

        return columns
    }

    // on drag logic of firing making a new card dragging from bookmarks column to actual column
    const handleDragEnd = async (event) => {
        const { active, over } = event

        if (!over) {
            return
        }

        const course = active.data.current.course
        const col = over.data.current.col

        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const response = await fetch(`${API_URL}/board/${course.id}`, {
            method: "POST",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`},
            body: JSON.stringify({
                year: col.year,
                term: col.term
            })
        })

        if (!response.ok) {
            setError("Card not created")
            console.log("card error")

            return
        }
        const newCard = await response.json()
        setCards((prev) => [...prev, newCard])
        console.log("card created", newCard)
    }

    const handleDelete = async (cardId) => {
        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const response = await fetch(`${API_URL}/board/${cardId}`, {
            method: "DELETE",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
        })

        if (!response.ok) {
            console.log("failed to delete card")
            return
        }

        setCards(prev => prev.filter(card => card.id !== cardId))
    }

    const handleUpdate = async (cardId, updatedFields) => {
        const { data } = await supabase.auth.getSession()
        const token = data.session.access_token

        const response = await fetch(`${API_URL}/board/${cardId}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`},
            body: JSON.stringify(updatedFields)
        })

        if (!response.ok) {
            setError("card not updated successfully")
            return
        }

        const updated = await response.json()

        setCards(prev => prev.map(card => card.id === cardId ? updated : card))
    }


    return(
        <div>
            <h1>User Dashboard</h1>

            <div>
                <p>{totalCredits} / 120 credits planned</p>
                <div style={{width: "100%", background: "#ccc"}}>
                    <div style={{width: `${percent}%`, background: "#1556A3", height: "8px"}}></div>
                </div>
                <p>{percent}% to graduation</p>
            </div>
            
            <div>

                <DndContext onDragEnd={handleDragEnd}>
                    {/* loads bookmark*/}
                    <div>
                        <p>BOOKMARKS</p>
                        {bookmark.filter(course => !cards.some(card => card.course_id === course.id))
                                 .map(course => (
                                    <BookMarkCard key={course.id} course={course} />
                                 ))
                        }
                    </div>

                    {/* if user has fresh dashboard ask how many years otherwise load up all the droppable columns*/}
                    {years === null ? (
                        <div>
                            <p>how many years until is your entire trinity western lifespan?</p>
                            {[2, 3, 4, 5, 6, 7].map((y) => (
                                <button key={y} onClick={() => handleYear(y)}>{y} years</button>
                            ))}
                        </div>
                    ) : (<div>
                            {generateColumns(years).map((col) => (
                                <DashBoardColumn 
                                    key={`${col.year}-${col.term}`} 
                                    col={col} 
                                    cards={cards.filter(c => c.year === col.year && c.term === col.term)} 
                                    onDelete={handleDelete}
                                    onUpdate={handleUpdate}
                                />                       
                            ))}
                        </div>
                    )}

                </DndContext>




                {reviews.map((review) => (
                    <div key={review.id} onClick={() => navigate(`/professor/${review.professor_id}`)}> 
                        <p>{review.course_code}</p>
                        <p>{review.rating}</p>
                        <p>{review.review}</p>

                        <button onClick={(e) => {
                            e.stopPropagation()
                            deleteReview(review.id)}}>Delete Review</button>
                    </div>
                ))}
            </div>
        </div>

    )
}