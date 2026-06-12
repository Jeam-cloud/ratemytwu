import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabaseClient"

export default function SignupPage() {
    
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState(null)

    const navigate = useNavigate()
    const handleSubmit = async () => {
        if(!email || !password) {
            setError("Please fill in the required fields.")
            return
        }

        if(password !== confirmPassword) {
            setError("Passwords do not match, try again.")
            return
        } 

        if(password.length < 6) {
            setError("Password needs to be at least 6 or more characters.")
            return
        }

        const response = await supabase.auth.signUp({
            email: email,
            password: password
        })

        const data = response.data
        const authError = response.error

        if (authError) {
            setError(authError.message)
            return
        }

        if (!authError) {
            navigate("/dashboard")
            console.log("user logged in")
        }

    }

    const handleSubmitGoogle = async () => {
        const response = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/dashboard`
            }
        })
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

            <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button onClick={handleSubmit}>Submit</button>
            <button onClick={handleSubmitGoogle}>Sign in with Google</button>

            {error && <p>{error}</p>}

        </>

    )
}