/**
 * generate-sitemap.js
 * Run before `vite build` to produce public/sitemap.xml
 * Usage: node generate-sitemap.js
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = "https://ratemytwu.com"
const API_URL  = process.env.VITE_API_URL || "https://ratemytwu-backend.onrender.com"

const STATIC_PATHS = ["/", "/professor", "/course", "/departments", "/compare"]

async function fetchIds(endpoint) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`)
        if (!res.ok) return []
        return await res.json()
    } catch {
        console.warn(`⚠ Could not fetch ${endpoint} — skipping dynamic routes`)
        return []
    }
}

async function generate() {
    console.log(`Fetching data from ${API_URL}...`)

    const [professors, courses] = await Promise.all([
        fetchIds("/professor/"),
        fetchIds("/course/"),
    ])

    const paths = [
        ...STATIC_PATHS,
        ...professors.map(p => `/professor/${p.id}`),
        ...courses.map(c => `/course/${c.id}`),
    ]

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...paths.map(p => `  <url><loc>${BASE_URL}${p}</loc></url>`),
        "</urlset>",
    ].join("\n")

    const out = path.join(__dirname, "public", "sitemap.xml")
    fs.mkdirSync(path.join(__dirname, "public"), { recursive: true })
    fs.writeFileSync(out, xml, "utf8")
    console.log(`✓ sitemap.xml written with ${paths.length} URLs`)
}

generate()
