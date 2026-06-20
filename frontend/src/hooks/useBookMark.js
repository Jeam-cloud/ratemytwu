import { useState, useEffect } from "react"

import { API_URL } from "../config"
import { supabase } from "../supabaseClient"

export function useBookMark() {
    
    const [bookmark, setBookMark] = useState([])
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadData = async() => {

            const { data } = await supabase.auth.getSession()
            if (!data.session) return
            const token = data.session.access_token

            const response = await fetch(`${API_URL}/bookmark/`, {
                method: "GET",
                headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
            })

            if (!response.ok) {
                setError("Failed to load bookmarks")
                return
            }

            const data2 = await response.json()
            setBookMark(data2)
        }

        loadData()
    }, [])


    return { bookmark, error }
}