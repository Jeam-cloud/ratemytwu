import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { API_URL } from "../../config"

export default function CompareProf() {

    const [firstProf, setFirstProf] = useState(null)
    const [secondProf, setSecondProf] = useState(null)

    const [firstInput, setFirstInput] = useState(null)
    const [secondInput, setSecondInput] = useState(null)


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
            </div>

            <div>
                <h2>Second Prof</h2>
                <input
                    type="text"
                    placeholder="Second Professor"
                    value={seconInput}
                    onChange={(e) => setSecondInput(e.target.value)}
                />
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