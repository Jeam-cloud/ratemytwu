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

    // Bookmark a course the student found via search and dragged straight onto
    // the board — without this, a course only ever became a "bookmark" if the
    // student clicked the explicit Bookmark button first, so anything dragged
    // in from search never showed up as bookmarked elsewhere (e.g. the course
    // list page's Bookmarked toggle). Silently no-ops for guests (no session)
    // and if the course is already bookmarked, matching the guard callers use.
    const addBookmark = async (course) => {
        const { data } = await supabase.auth.getSession()
        if (!data.session) return
        if (bookmark.some(b => b.id === course.id)) return

        const token = data.session.access_token
        const response = await fetch(`${API_URL}/bookmark/${course.id}`, {
            method: "POST",
            headers: {"Content-Type": "application/json", "Authorization": `Bearer ${token}`}
        })
        if (!response.ok) return
        setBookMark(prev => prev.some(b => b.id === course.id) ? prev : [...prev, course])
    }

    return { bookmark, error, addBookmark }
}