import { Link, NavLink, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { supabase } from "../supabaseClient"
import "../styles/layout.css"

export default function Layout({ children, fullBleed = false, wide = false }) {
    const [session, setSession] = useState(null)
    const [searchInput, setSearchInput] = useState("")
    // when fullBleed (landing), the bar floats over the hero until you scroll
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const navigate = useNavigate()

    const closeMobile = () => setMobileOpen(false)

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
        navigate(`/search?q=${trimmed}`)
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
                        <NavLink to="/professor" className={({ isActive }) => isActive ? "app-nav-active" : ""}>Professors</NavLink>
                        <NavLink to="/course" className={({ isActive }) => isActive ? "app-nav-active" : ""}>Courses</NavLink>
                        <NavLink to="/departments" className={({ isActive }) => isActive ? "app-nav-active" : ""}>Departments</NavLink>
                        <NavLink to="/compare" className={({ isActive }) => isActive ? "app-nav-active" : ""}>Compare</NavLink>
                        <NavLink to="/dashboard" className={({ isActive }) => isActive ? "app-nav-active" : ""}>My Courses</NavLink>
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

                    {/* Hamburger (mobile only) */}
                    <button
                        className="app-hamburger"
                        aria-label="Menu"
                        onClick={() => setMobileOpen((o) => !o)}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
                        </svg>
                    </button>

                </div>

                {/* Mobile dropdown menu */}
                {mobileOpen && (
                    <div className="app-mobile-menu">
                        <NavLink to="/professor" onClick={closeMobile} className={({ isActive }) => isActive ? "app-nav-active" : ""}>Professors</NavLink>
                        <NavLink to="/course" onClick={closeMobile} className={({ isActive }) => isActive ? "app-nav-active" : ""}>Courses</NavLink>
                        <NavLink to="/departments" onClick={closeMobile} className={({ isActive }) => isActive ? "app-nav-active" : ""}>Departments</NavLink>
                        <NavLink to="/compare" onClick={closeMobile} className={({ isActive }) => isActive ? "app-nav-active" : ""}>Compare</NavLink>
                        <NavLink to="/dashboard" onClick={closeMobile} className={({ isActive }) => isActive ? "app-nav-active" : ""}>My Courses</NavLink>
                        <div className="app-mobile-divider" />
                        {session ? (
                            <button className="app-mobile-signout" onClick={() => { closeMobile(); handleSignOut() }}>
                                Sign out
                            </button>
                        ) : (
                            <Link to="/login" onClick={closeMobile}>Log in</Link>
                        )}
                    </div>
                )}
            </div>

            <main className={fullBleed ? "app-main app-main--full" : wide ? "app-main app-main--wide" : "app-main"}>
                {children}
            </main>
        </div>
    )
}