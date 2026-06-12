import { useState, useEffect } from "react"

import { API_URL } from "../config"
import { supabase } from "../supabaseClient"

export function useReview() {

    const [reviews, setReviews] = useState([])

    useEffect(() => {

        const loadData = async () => {

            const response = await supabase.auth.getSession()
            const token = response.data.session.access_token

            const response2 = await fetch(`${API_URL}/user/reviews`, {
                method: "GET",
                headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
            })

            if (!response2.ok) {
                console.log("no reviews yet")
                return
            }

            const data = await response2.json()
            setReviews(data)
        }

        loadData()
    }, [])


    const deleteReview = async (reviewId) => {

        const response = await supabase.auth.getSession()
        const token = response.data.session.access_token

        const response2 = await fetch(`${API_URL}/professor/review/${reviewId}`, {
            method: "DELETE",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
        })

        if (response2.ok) {
            setReviews(prev => prev.filter(r => r.id !== reviewId))
        }
    }

    return { reviews, deleteReview }
}