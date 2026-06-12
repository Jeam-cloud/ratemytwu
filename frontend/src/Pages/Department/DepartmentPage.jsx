import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { API_URL } from "../../config"

import { supabase } from "../../supabaseClient"


function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function DepartmentPage() {
    const [profs, setProfs] = useState([])
    const [courses, setCourses] = useState([])
    const { department_name } = useParams()
    const [bookmarked, setBookmarked] = useState(new Set())

    const [error, setError] = useState("")
    const navigate = useNavigate()

    useEffect(() => {

        const getProfessor = async () => {
            const response = await fetch(`${API_URL}/department/${department_name}/professors`)
            const data = await response.json()

            setProfs(data)
        }

        const getCourse = async () => {
            const response = await fetch(`${API_URL}/department/${department_name}/courses`)
            const data = await response.json()
            
            setCourses(data)
        }

        getProfessor()
        getCourse()
    }, [department_name])


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

    // bookmark for courses
    const handleBookmark = async (e, courseId) => {
        e.stopPropagation()

        const { data } = await supabase.auth.getSession()

        if (!data.session) {
            setError("You must be logged in to bookmark a course")
            return
        }

        const token = data.session.access_token

        const isBookmarked = bookmarked.has(courseId)

        const response = await fetch(`${API_URL}/bookmark/${courseId}`, {
            method: isBookmarked ? "DELETE" : "POST",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
        })

        if (!response.ok) {
            const error = await response.json()
            setError(error.detail || "something went wrong")
            return
        }

        setBookmarked(prev => {
            const next = new Set(prev)
            isBookmarked ? next.delete(courseId) : next.add(courseId)
            return next
        })

    }
    
    return(
        <>

        <button onClick={() => navigate("/departments")}>← All departments</button>
        <h1>{department_name}</h1>
        <p>{profs.length} professors · {courses.length} courses</p>

        
            {error && <p>{error}</p>}
            {/*returns a list of professors in that department that are individually clickable */}
            {profs.map((professor) => {
                const initials = getInitials(professor.name)
                const hasReviews = professor.review_count > 0

                return (
                    <div key={professor.id} onClick={() => navigate(`/professor/${professor.id}`)}>
                        <div>
                            <div>{initials}</div>
                            <div>
                                <p>{professor.name}</p>
                                <p>{professor.department}</p>
                            </div>
                        </div>
                        <div>
                            {hasReviews ? (
                                <>
                                    <p>★ {professor.average_rating}</p>
                                    <p>{professor.review_count} {professor.review_count === 1 ? "review" : "reviews"}</p>
                                </>
                            ) : (
                                <p>No reviews yet</p>
                            )}
                            <span>›</span>
                        </div>
                    </div>
                )
            })}

            {/*returns a list of courses in that department that are individually clickable */}
            {courses.map((course) => (
                <div key={course.id} onClick={() => navigate(`/course/${course.id}`)}>

                    {/* Left: code + department */}
                    <div>
                        <p>{course.code}</p>
                        <p>{course.department}</p>
                    </div>

                    {/* Right: bookmark button + chevron */}
                    <div>
                        <button onClick={(e) => handleBookmark(e, course.id)}>
                            {bookmarked.has(course.id) ? "Bookmarked" : "Bookmark"}
                        </button>
                        <span>›</span>
                    </div>

                </div>
            ))}
        </>
    )
}