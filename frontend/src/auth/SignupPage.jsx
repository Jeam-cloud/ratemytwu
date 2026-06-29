import { useState, useEffect } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { supabase } from "../supabaseClient"
import styles from "../css/Auth.module.css"

export default function SignupPage() {

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState(null)

    const navigate = useNavigate()
    const location = useLocation()

    const from = location.state?.from?.pathname || "/dashboard"

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) navigate(from, { replace: true })
        })
    }, [])

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

        const authError = response.error

        if (authError) {
            setError(authError.message)
            return
        }

        if (!response.data.session) {
            // Store where to redirect after they confirm their email and come back
            if (from && from !== "/dashboard") {
                localStorage.setItem("postAuthRedirect", from)
            }
            setError("Check your email to confirm your account before logging in.")
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

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSubmit()
    }

    return (
        <div className={styles.page}>
            <div className={styles.photo} />
            <div className={styles.scrim} />

            <div className={styles.card}>
                <Link to="/" className={styles.brand}>
                    <span className={styles.wordmark}>Rate<span className={styles.my}>My</span>TWU</span>
                </Link>

                <h1 className={styles.title}>Create your account</h1>
                <p className={styles.subtitle}>Join to leave reviews and plan your degree.</p>

                {error && <p className={styles.error}>{error}</p>}

                <label className={styles.label}>Email</label>
                <input
                    className={styles.input}
                    type="email"
                    placeholder="john.doe@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                />

                <label className={styles.label}>Password</label>
                <div className={styles.passwordWrap}>
                    <input
                        className={styles.input}
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><path d="m2 2 20 20" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                        )}
                    </button>
                </div>

                <label className={styles.label}>Confirm password</label>
                <input
                    className={styles.input}
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                />

                <button className={styles.primaryBtn} onClick={handleSubmit}>Create account</button>

                <div className={styles.divider}><span>OR</span></div>

                <button className={styles.googleBtn} onClick={handleSubmitGoogle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
                        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
                    </svg>
                    Continue with Google
                </button>

                <p className={styles.footer}>
                    Already have an account? <Link to="/login" state={location.state} className={styles.footerLink}>Log in</Link>
                </p>
            </div>
        </div>
    )
}
