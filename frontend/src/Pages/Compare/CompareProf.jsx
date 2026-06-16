import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { API_URL } from "../../config"

export default function CompareProf() {

    const [firstProf, setFirstProf] = useState(null)
    const [secondProf, setSecondProf] = useState(null)

    const [firstInput, setFirstInput] = useState("")
    const [secondInput, setSecondInput] = useState("")

    const [error, setError] = useState("")

    const handleFirstProf = async () => {
        const response = await fetch(`${API_URL}/professor/?search_professor=${firstInput}`, {
            method: "GET",
            headers: {"Content-Type": "application/json"}
        })
        const data = await response.json()

        if (!data.length) {
            setError("First professor not found")
            return
        }
        setError("")
        setFirstProf(data[0])
    }

    const handleSecondProf = async () => {
        
        const response = await fetch(`${API_URL}/professor/?search_professor=${secondInput}`, {
            method: "GET",
            headers: {"Content-Type": "application/json"}
        })
        const data = await response.json()

        if (!data.length) {
            setError("Second professor not found")
            return
        }
        setError("")
        setSecondProf(data[0])
    }

    return(
        <>
            <div>
                <h2>First Prof</h2>
                <input
                    type="text"
                    placeholder="First Professor"
                    value={firstInput}
                    onChange={(e) => setFirstInput(e.target.value)}
                />
                
                <button onClick={handleFirstProf}>Search</button>
            </div>

            <div>
                <h2>Second Prof</h2>
                <input
                    type="text"
                    placeholder="Second Professor"
                    value={secondInput}
                    onChange={(e) => setSecondInput(e.target.value)}
                />
                <button onClick={handleSecondProf}>Search</button>
            </div>

            {error && <p>{error}</p>}

            {firstProf && secondProf && (
                <div>
                    <div>
                        {firstProf.name}
                        <p>rating: {firstProf.average_rating}</p>
                        <p>difficulty: {firstProf.average_difficulty}</p>
                        <p>take again: {firstProf.average_take_again}</p>
                        <p>reviews: {firstProf.review_count}</p>
                    </div>

                    <div>
                        {secondProf.name}
                        <p>rating: {secondProf.average_rating}</p>
                        <p>difficulty: {secondProf.average_difficulty}</p>
                        <p>take again: {secondProf.average_take_again}</p>
                        <p>reviews: {secondProf.review_count}</p>
                    </div>
                </div>
            )}

        </>
    )
}