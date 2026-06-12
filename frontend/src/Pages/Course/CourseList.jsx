import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"

import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"

export default function CourseList() {

    const [results, setResults] = useState([])
    const [searchParam] = useSearchParams()
    const [error, setError] = useState("")
    const [bookmarked, setBookmarked] = useState(new Set())

    const query = searchParam.get("search_course")
    const [input, setInput] = useState(query ?? "")

    const navigate = useNavigate()


    // fetch courses based on user input
    useEffect(() => {
        
        if (!query) {
            return
        }
        const searchCourse = async () => {
            const response = await fetch(`${API_URL}/course/?search_course=${query}`)
            const data = await response.json()
 
            setResults(data)
        }

        searchCourse()
    }, [query])

    useEffect(() => {
        const loadBookmarks = async () => {
            const { data } = await supabase.auth.getSession()
            if (!data.session) return

            const token = data.session.access_token
            const res = await fetch(`${API_URL}/bookmark/`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            if (!res.ok) return

            const data2 = await res.json()
            setBookmarked(new Set(data2.map(c => c.id)))
        }

        loadBookmarks()
    }, [])

    // lets users bookmark the course and delete when toggled
    const handleBookmark = async (e, courseId) => {
        e.stopPropagation()

        const { data } = await supabase.auth.getSession()
        if (!data.session) { setError("You must be logged in to bookmark a course"); return }

        const token = data.session.access_token
        const isBookmarked = bookmarked.has(courseId)

        const res = await fetch(`${API_URL}/bookmark/${courseId}`, {
            method: isBookmarked ? "DELETE" : "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        })

        if (!res.ok) { setError("Something went wrong"); return }

        setBookmarked(prev => {
            const next = new Set(prev)
            isBookmarked ? next.delete(courseId) : next.add(courseId)
            return next
        })
    }

    const handleSearch = () => {
        const trimmed = input.trim()
        if (trimmed.length < 2) return
        navigate(`/course?search_course=${trimmed}`)
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSearch()
    }

    return (
        <>
            <h2>SHOWING RESULTS FOR</h2>
            <input
                type="text"
                placeholder="Search a course code..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <button onClick={handleSearch}>Search</button>

            <p>{results.length} {results.length === 1 ? "course" : "courses"}</p>

            
            {error && <p>{error}</p>}
            {results.map((course) => ( 
                 <div key={course.id} onClick={() => navigate(`/course/${course.id}`)}>
                    <div>
                        <h4>{course.code}</h4>
                        <p>{course.department} · {course.professor_count} {course.professor_count === 1 ? "professor" : "professors"}</p>
                    </div>

                    <div>
                        <button onClick={(e) => {handleBookmark(e, course.id) } }>
                            {bookmarked.has(course.id) ? "Bookmarked": "Bookmark"}
                        </button>
                                <span>›</span>
                    </div>

                 </div>
            ))}
        </>
    )
}