export default function RadioOption({value, name, options, setFunction}) {
    return (
        <div>
            {options.map(option => (
                <label key={option}>
                    <input
                        type="radio"
                        name={name}
                        value={option}
                        checked={String(value)===String(option)}
                        onChange={(e) => setFunction(e.target.value)}
                    />
                    {option}
                </label>
            ))}
        </div>
    )
}