import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom" 
import { API_URL } from "../../config"
export default function HomeDepartment(){

    const[department, setDepartment] = useState([])

    const[input, setInput] = useState("")

    const navigate = useNavigate()

    useEffect(() => {

        const getDepartments = async () => {
            const response = await fetch(`${API_URL}/department`)
            const data = await response.json()


            setDepartment(data)
        }

        getDepartments()
    }, [])


    const filteredDepartment = department.filter((p) => 
        p.department.toLowerCase().includes(input.toLowerCase())
    )



    return(
        <>
            <input
                placeholder="Look up your department..."
                value={input}
                onChange={(e)=>setInput(e.target.value)}
            />

            {filteredDepartment.map((p) => 
                <div key={p.id} onClick={() => navigate(`/department/${p.department}`)}>{p.department} - {p.professor_count} professors</div>
            )}

        </>
    )
}