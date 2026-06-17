import styles from "../css/RadioOption.module.css"

// capitalize only the first letter for display; the stored value is unchanged
function label(option) {
    const s = String(option)
    return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function RadioOption({ value, name, options, setFunction }) {
    return (
        <div className={styles.group} role="radiogroup" aria-label={name}>
            {options.map(option => {
                const selected = String(value) === String(option)
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`${styles.chip} ${selected ? styles.selected : ""}`}
                        onClick={() => setFunction(String(option))}
                    >
                        {label(option)}
                    </button>
                )
            })}
        </div>
    )
}
