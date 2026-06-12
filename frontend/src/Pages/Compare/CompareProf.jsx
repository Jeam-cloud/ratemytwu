import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { API_URL } from "../../config"

export default function CompareProf() {

    const [firstProfId, setFirstProfId] = useState(null)
    const [secondProfId, setSecondProfId] = useState(null)

    const [firstProf, setFirstProf] = useState([])
    const [secondProf, setSecondProf] = useState([])

    const [firstInput, setFirstInput] = useState("")
    const [secondInput, setSecondInput] = useState("")

    const [error, setError] = useState("")


    const handleFirstId = async () => {


        const response = await fetch(`${API_URL}/professor/?search_professor=${firstInput}`)
        const data = await response.json()

        if (!data.length) {
            setError("Professor not found")
            return
        }
        setFirstProfId(data[0].id)
    }

    const handleSecondId = async () => {
        const response = await fetch(`${API_URL}/professor/?search_professor=${secondInput}`)
        const data = await response.json()

        if (!data) {
            setError("Professor not found")
            return
        }
        setSecondProfId(data[0].id)
    }

    useEffect(() => {
        const handleFirstProf = async () => {

            // useefffect fires once always, safeguard when firstProfId is null
            if (!firstProfId)  {
                return
            }
            const response = await fetch(`${API_URL}/professor/${firstProfId}/everything`)
            const data = await response.json()

            setFirstProf(data)

        }
        handleFirstProf()
    }, [firstProfId])

    useEffect(() => {
        const handleSecondProf = async () => {

            if (!firstProfId) {
                return
            }
            const response = await fetch(`${API_URL}/professor/${secondProfId}/everything`)
            const data = await response.json()
            setSecondProf(data)
        }
        handleSecondProf()

    }, [secondProfId])




    return(
        <>
            <div>
                <input
                    placeholder="First Professor"
                    value={firstInput}
                    onChange={(event) => setFirstInput(event.target.value)}
                />
                <button onClick={handleFirstId}>Submit</button>

            </div>

            <div>
                <input 
                    placeholder="Second Professor"
                    value={secondInput}
                    onChange={(event) => setSecondInput(event.target.value)}
                />

                <button onClick={handleSecondId}>Submit</button>

            </div>
            
            {error && <p>{error}</p>}
            
            <div>
                {firstProf.name}
                <p>rating: {firstProf.average_rating}</p>
                <p>difficulty: {firstProf.average_difficulty}</p>
                <p>take again: {firstProf.average_take_again}</p>
            </div>

            <div>
                {secondProf.name}
                <p>rating: {secondProf.average_rating}</p>
                <p>difficulty: {secondProf.average_difficulty}</p>
                <p>take again: {secondProf.average_take_again}</p>
            </div>
        </>
    )
}