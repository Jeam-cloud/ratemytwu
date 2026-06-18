export function toTitleCase(name) {
    if (!name) return ""
    return name
        .trim()
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
}
