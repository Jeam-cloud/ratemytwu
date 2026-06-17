import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { API_URL } from "../../config"
import Layout from "../../components/Layout"
import styles from "../../css/HomeDepartment.module.css"

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
        <Layout>
            <div className={styles.page}>
                <h1 className={styles.title}>Browse by department</h1>
                <p className={styles.subtitle}>{department.length} departments at TWU</p>

                <div className={styles.searchBar}>
                    <svg width="16" height="16" fill="none" stroke="#877C70" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        placeholder="Filter departments..."
                        value={input}
                        onChange={(e)=>setInput(e.target.value)}
                    />
                </div>

                <div className={styles.grid}>
                    {filteredDepartment.map((p) =>
                        <div
                            key={p.id}
                            className={styles.tile}
                            onClick={() => navigate(`/department/${p.department}`)}
                        >
                            <span className={styles.deptName}>{p.department}</span>
                            <span className={styles.deptCount}>{p.professor_count} profs</span>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
