import { useState, useEffect } from "react"
import { Navigate } from "react-router-dom"
import { supabase } from "../supabaseClient"

export default function ProtectedRoute({ children }) {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession()
            setSession(data.session)
            setLoading(false)
        }
        checkSession()
    }, [])

    if (loading) return null
    if (!session) return <Navigate to="/login" />
    return children
}