import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"
import "../styles/layout.css"

export default function Layout({ children, fullBleed = false, wide = false }) {
    const [session, setSession] = useState(null)
    const [searchInput, setSearchInput] = useState("")
    // when fullBleed (landing), the bar floats over the hero until you scroll
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const navigate = useNavigate()

    const handleSignOut = async () => {
        setMenuOpen(false)
        await supabase.auth.signOut()
        navigate("/login")
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session))
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })
        return () => listener.subscription.unsubscribe()
    }, [])

    // only track scroll on landing — keeps every other page untouched
    useEffect(() => {
        if (!fullBleed) return
        const onScroll = () => setScrolled(window.scrollY > 40)
        onScroll()
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [fullBleed])

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

    const barClass = [
        "app-bar",
        fullBleed ? "app-bar--float" : "",
        fullBleed && !scrolled ? "app-bar--transparent" : "",
    ].filter(Boolean).join(" ")

    return (
        <div className="app">
            <div className={barClass}>
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
                        <Link to="/?mode=course">Courses</Link>
                        <Link to="/departments">Departments</Link>
                        <Link to="/compare">Compare</Link>
                        <Link to="/dashboard">My Courses</Link>
                    </nav>

                    {/* Avatar / auth */}
                    {session ? (
                        <div className="app-avatar-wrap">
                            <button
                                className="app-avatar"
                                onClick={() => setMenuOpen((o) => !o)}
                                aria-label="Account menu"
                            >
                                {getInitials()}
                            </button>
                            {menuOpen && (
                                <>
                                    <div className="app-menu-backdrop" onClick={() => setMenuOpen(false)} />
                                    <div className="app-menu">
                                        {/* <button className="app-menu-item" onClick={() => { setMenuOpen(false); navigate("/dashboard") }}>
                                            Dashboard
                                        </button> */}
                                        <button className="app-menu-item app-menu-signout" onClick={handleSignOut}>
                                            Sign out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <Link to="/login" className="app-login">Log in</Link>
                    )}

                </div>
            </div>

            <main className={fullBleed ? "app-main app-main--full" : wide ? "app-main app-main--wide" : "app-main"}>
                {children}
            </main>
        </div>
    )
}