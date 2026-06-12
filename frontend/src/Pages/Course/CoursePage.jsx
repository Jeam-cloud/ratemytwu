import { useState, useEffect} from "react"
import { useParams, useNavigate } from "react-router-dom"

import { API_URL } from "../../config"

function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function CoursePage() {
        const [professors, setProfessors] = useState([])
        const { id } = useParams()
        const navigate = useNavigate()

        useEffect(() => {
            const getProfessors = async () => {
                const response = await fetch(`${API_URL}/course/${id}`)
                const data = await response.json()

                setProfessors(data)
            } 
            
            getProfessors()
        }, [id]

        )

        return(

            <div>
                
                {/* Back link */}
                <button onClick={() => navigate(-1)}>← Course results</button>

                <h2>WHO'S TEACHING IT</h2>
                <p>{professors.length} {professors.length === 1 ? "professor" : "professors"}</p>


                {professors.map((professor) => {

                    const initials = getInitials(professor.name)
                    const hasReviews = professor.review_count > 0

                    return(
                        <div key={professor.id} onClick={() => navigate(`/professor/${professor.id}`)}>
                            {/* Left: avatar + name + department */}
                            <div>
                                <div>{initials}</div>
                                <div>
                                    <p>{professor.name}</p>
                                    <p>{professor.department}</p>
                                </div>
                            </div>

                            {/* Right: stats or empty state + chevron */}
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
            </div>
        )
}