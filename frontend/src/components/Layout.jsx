import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"
import "../styles/layout.css"

export default function Layout({ children }) {
    const [session, setSession] = useState(null)
    const [searchInput, setSearchInput] = useState("")
    const navigate = useNavigate()

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session))
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })
        return () => listener.subscription.unsubscribe()
    }, [])

    const handleSearch = (e) => {
        if (e.key !== "Enter") return
        const trimmed = searchInput.trim()
        if (trimmed.length < 2) return
        navigate(`/professor?search_professor=${trimmed}`)
    }

    // derive initials from the logged-in user's email
    const getInitials = () => {
        const email = session?.user?.email
        if (!email) return "?"
        return email.slice(0, 2).toUpperCase()
    }

    return (
        <div className="app">
            <div className="app-bar">
                <div className="app-bar-inner">

                    {/* Brand */}
                    <Link to="/" className="app-brand">
                        <span className="app-wordmark">Rate<span className="my">My</span>TWU</span>
                    </Link>

                    {/* Search */}
                    <div className="app-search">
                        <input
                            placeholder="Search professors or courses…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={handleSearch}
                        />
                    </div>

                    {/* Nav links */}
                    <nav className="app-nav">
                        <Link to="/?mode=professor">Professors</Link>
                        <Link to="/departments">Departments</Link>
                        <Link to="/?mode=course">Courses</Link>
                        <Link to="/compare">Compare</Link>
                        {session && <Link to="/dashboard">Dashboard</Link>}
                    </nav>

                    {/* Avatar / auth */}
                    {session ? (
                        <div className="app-avatar" onClick={() => navigate("/dashboard")}>
                            {getInitials()}
                        </div>
                    ) : (
                        <Link to="/login" className="app-login">Log in</Link>
                    )}

                </div>
            </div>

            <main className="app-main">
                {children}
            </main>
        </div>
    )
}