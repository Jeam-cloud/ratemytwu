import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"

import { supabase } from "../supabaseClient"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState(null)

    const navigate = useNavigate()
    const location = useLocation()

    const from = location.state?.from?.pathname || "/dashboard"

    useEffect(() => {
        supabase.auth.getSession().then(({data}) => {
            if (data.session) navigate(from, {replace: true})
        })
    }, [])

    const handleSubmit = async () => {
        if (!email || !password) {
            setError("Please fill in the required fields.")
            return
        }

        const response = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        })

        const data = response.data
        const authError = response.error

        if (authError) {
            setError(authError.message)
            return
        }

        navigate(from, { replace: true })


    }

    const handleSubmitGoogle = async () => {
        const response = await supabase.auth.signInWithOAuth({
            provider: "google",

            options: {
                redirectTo: `${window.location.origin}/dashboard`
            }
        })

        if (response.error) {
            setError(response.error.message)
        }


    }
    

    return(
        <>
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={handleSubmit}>Sign in</button>
            <button onClick={handleSubmitGoogle}>Sign in with Google</button>
            {error && <p>{error}</p>}
        </>
    )
}