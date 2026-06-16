import { useState } from "react"
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


    // decides which side wins one stat row
    const getWinner = ({ firstValue, secondValue, higherWins }) => {
        // can't compare if either value is missing (prof has no reviews)
        if (firstValue === null || secondValue === null) {
            return "tie"
        }

        // equal values → nobody wins (e.g. difficulty 3.1 vs 3.1)
        if (firstValue === secondValue) {
            return "tie"
        }

        if (higherWins) {
            return firstValue > secondValue ? "first" : "second"
        } else {
            return firstValue < secondValue ? "first" : "second"
        }
    }

    // only build rows once both profs are loaded
    const bothLoaded = firstProf && secondProf

    const rows = bothLoaded ? [
        { label: "Overall Rating", firstValue: firstProf.average_rating, secondValue: secondProf.average_rating, higherWins: true },
        { label: "Difficulty", firstValue: firstProf.average_difficulty, secondValue: secondProf.average_difficulty, higherWins: false },
        { label: "Take Again", firstValue: firstProf.average_take_again, secondValue: secondProf.average_take_again, higherWins: true },
        { label: "Reviews", firstValue: firstProf.review_count, secondValue: secondProf.review_count, higherWins: true },
    ] : []

    // tally wins for the banner
    let firstWins = 0
    let secondWins = 0

    for (const row of rows) {
        const winner = getWinner(row)
        if (winner === "first") firstWins++
        if (winner === "second") secondWins++
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



            {bothLoaded && (
                <div>
                    {/* names */}
                    <div>
                        <h3>{firstProf.name}</h3>
                        <h3>{secondProf.name}</h3>
                    </div>

                    {/* banner */}
                    <p>
                        {firstWins > secondWins
                            ? `${firstProf.name} comes out ahead on ${firstWins} of ${rows.length} stats`
                            : secondWins > firstWins
                            ? `${secondProf.name} comes out ahead on ${secondWins} of ${rows.length} stats`
                            : "Evenly matched"}
                    </p>

                    {/* comparison rows */}
                    {rows.map((row) => {
                        const winner = getWinner(row)
                        return (
                            <div key={row.label}>
                                <span className={winner === "first" ? "winner" : ""}>
                                    {row.firstValue}
                                </span>
                                <span>{row.label}</span>
                                <span className={winner === "second" ? "winner" : ""}>
                                    {row.secondValue}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}

        </>
    )
}