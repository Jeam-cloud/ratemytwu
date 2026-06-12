import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"

import { API_URL } from "../../config"


function getInitials(name) {
    const parts = name.trim().split(" ")
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ProfessorList() {

    const [searchParam] = useSearchParams()
    const [results, setResults] = useState([])

    const navigate = useNavigate()
    
    const query = searchParam.get("search_professor")
    const [input, setInput] = useState(query ?? "")

    // fetches professors everytime user searches
    useEffect( () => {

        if (!query) {
            return
        }

        const fetchProfessors =  async () => {
        
            const response = await fetch(`${API_URL}/professor/?search_professor=${query}`)
            const data = await response.json()

            setResults(data)
        }

        fetchProfessors()

    }, [query])

    const handleSearch = () => {
        const trimmed = input.trim()
        if (trimmed.length < 2) {
            return
        }
        navigate(`/professor/?search_professor=${trimmed}`)
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSearch()
    }

    return(

        <div>
            <h1>SHOWING RESULTS FOR</h1>
            <input 
                type="text"
                placeholder="Search a professor name..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
            />

            <button onClick={handleSearch}>Search</button>

            <p>{results.length} {results.length == 1 ? "professor" : "professors"}</p>
            {results.map((professor) => {

                const initials = getInitials(professor.name)
                const hasReviews = professor.review_count > 0

                return (
                <div key={professor.id }onClick={() => navigate(`/professor/${professor.id}/`) }>
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