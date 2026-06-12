import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"

import { supabase } from "../../supabaseClient"
import { API_URL } from "../../config"
import RadioOption from "../../components/RadioOption"

export default function ReviewPage() {
    const [courseCode, setCourseCode] = useState("")
    const [rating, setRating] = useState(null)
    const [difficulty, setDifficulty] = useState(null)
    const [takeAgain, setTakeAgain] = useState(null)
    const [gradingFairness, setGradingFairness] = useState("")
    const [lectureQuality, setLectureQuality] = useState("")
    const [officeHours, setOfficeHours] = useState("")
    const [extensionPolicy, setExtensionPolicy] = useState("")

    const [groupWork, setGroupWork] = useState("")
    const [attendance, setAttendance] = useState("")
    const [examFormat, setExamFormat] = useState("")
    const [textBookRequired, setTextBookRequired] = useState("")
    const [extraCredit, setExtraCredit] = useState("")

    const [review, setReview] = useState("")
    const [gradeReceived, setGradeReceived] = useState("")
    const [tips, setTips] = useState("")


    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [profName, setProfName] = useState("")

    const { id } = useParams()
    const numArray = [1, 2, 3, 4, 5]
    const navigate = useNavigate()
  
    useEffect(() => {
        const loadProf = async() => {
            const response = await fetch(`${API_URL}/professor/${id}/everything`)
            const data = await response.json()

            setProfName(data.name)
        }
        loadProf()
    }, [id])


    const handleSubmit = async () => {

        // guards for review double clicks 
        if (submitting) {
            return
        }

        // checks to see if user selected anything
        if (!courseCode.trim()) { setError("Valid course code required"); return }
        if (!rating) { setError("Please select a rating"); return}
        if (!difficulty) { setError("Please select a difficulty"); return}
        if (takeAgain === null) { setError("Please answer if you would take again"); return }
        if (!gradingFairness) { setError("Please select grading fairness"); return }
        if (!lectureQuality) { setError("Please select lecture quality"); return }
        if (!officeHours) { setError("Please select office hours"); return }
        if (!extensionPolicy) { setError("Please select extension policy"); return }
        if (!groupWork)  { setError("Please select group works"); return }
        if (!attendance) { setError("Please select attendance"); return }
        if (!examFormat) { setError("Please select exam format"); return }
        if (!textBookRequired) { setError("Please select text book required"); return }
        if (!extraCredit) { setError("Please select extra credit"); return }
        if (!gradeReceived) { setError("Please fill out grade received"); return }
        if (review.trim().length < 10) { setError("Please leave a review that is more than 10 characters"); return }

        setSubmitting(true)
        setError("")

        const { data } = await supabase.auth.getSession()

        if (!data.session) {
            setError("You must be logged in for a review")
            setSubmitting(false)
            return
        }
        const token = data.session.access_token

        


        const newReview = { 
            "course_code": courseCode.trim().toUpperCase(), 
            "rating": Number(rating), 
            "difficulty": Number(difficulty), 
            "take_again": takeAgain === "Yes" ? 1.0 : 0.0, 
            "review": review,
            "grading_fairness": gradingFairness,
            "lecture_quality": lectureQuality,
            "office_hours": officeHours,
            "extension_policy": extensionPolicy,

            "group_work": groupWork,
            "attendance": attendance,
            "exam_format": examFormat,
            "textbook_required": textBookRequired,
            "extra_credit": extraCredit,

            "grade_received": gradeReceived.trim(),
            "tips": tips.trim() || null
        }

        const res = await fetch(`${API_URL}/professor/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(newReview)
        })

        if (!res.ok) {
            const error = await res.json()
            setError(error.detail || "something went wrong")
            setSubmitting(false)
            return
        }

        setSubmitted(true)
    }

    if (submitted) {
        return (
            <div>
                <p>✓</p>
                <h2>Review posted — thank you</h2>
                <p>Your honest take helps the next student choose well.</p>
                <button onClick={() => navigate(`/professor/${id}`)}>
                    Back to {profName}
                </button>
            </div>
        )   
    }
  
    return (

        <div>
            <h1>Review Page</h1>

            <button onClick={() => navigate(`/professor/${id}`)}>
                ← Back to {profName}
            </button>

            <p>LEAVE A REVIEW</p>
            <h1>{profName}</h1>
            <p>Your review is posted anonymously</p>
            {error && <p>{error}</p>}

            <section>
                <h2>Professor Specific Rating</h2>
                <p>1 OF 3</p>

                <div>
                    <p>Overall Rating 1-5</p>
                    <RadioOption
                        value={rating}
                        name="rating"
                        options={[1, 2, 3, 4, 5]}
                        setFunction={setRating}
                    />
                </div>

                <div>
                    <p>Overall difficulty 1-5</p>
                    <RadioOption
                        value={difficulty}
                        name="difficulty"
                        options={[1, 2, 3, 4, 5]}
                        setFunction={setDifficulty}
                    />
                </div>

                <div>
                    <p>Would you take this professor again?</p>
                    <RadioOption
                        value={takeAgain}
                        name="takeAgain"
                        options={["Yes", "No"]}
                        setFunction={setTakeAgain}
                    />
                </div>

                <div>
                    <p>Grading Fairness</p>
                    <RadioOption
                        value={gradingFairness}
                        name="gradingFairness"
                        options={["Lenient Grader", "Moderate Grader", "Tough Grader"]}
                        setFunction={setGradingFairness}
                    />
                </div>

                <div>
                    <p>Lecture Quality</p>
                    <RadioOption
                        value={lectureQuality}
                        name="lectureQuality"
                        options={["very bad", "bad", "decent", "good", "very good"]}
                        setFunction={setLectureQuality}
                    />
                </div>

                <div>
                    <p>Office Hours</p>
                    <RadioOption
                        value={officeHours}
                        name="officeHours"
                        options={["helpful", "not helpful", "never went"]}
                        setFunction={setOfficeHours}
                    />
                </div>

                <div>
                    <p>Extension Policy</p>
                    <RadioOption
                        value={extensionPolicy}
                        name="extensionPolicy"
                        options={["lenient", "moderate", "unforgiving"]}
                        setFunction={setExtensionPolicy}
                    />
                </div>
            </section>

            <section>
                <h2>Course Specific Rating</h2>
                <p>2 OF 3</p>

                <div>
                    <p>course code</p>
                    <input  
                        type="text"
                        value={courseCode}
                        onChange={(event) => setCourseCode(event.target.value)}
                        maxLength={9}
                    />
                </div>

                <div>
                    <p>Group Works</p>
                    <RadioOption
                        value={groupWork}
                        name="groupWork"
                        options={["All individual", "Occasional Group Work", "Heavy Group Work"]}
                        setFunction={setGroupWork}
                    />
                </div>

                <div>
                    <p>attendance</p>
                    <RadioOption
                        value={attendance}
                        name="attendance"
                        options={["graded", "optional", "recorded but not graded"]}
                        setFunction={setAttendance}
                    />
                </div>

                <div>
                    <p>Exam Format</p>
                    <RadioOption
                        value={examFormat}
                        name="examFormat"
                        options={["multiple choice", "written", "mixed", "take-home/online", "other"]}
                        setFunction={setExamFormat}
                    />
                </div>

                <div>
                    <p>Textbook Required?</p>
                    <RadioOption
                        value={textBookRequired}
                        name="textBookRequired"
                        options={["yes", "no"]}
                        setFunction={setTextBookRequired}
                    />
                </div>

                <div>
                    <p>Extra Credit</p>
                    <RadioOption
                        value={extraCredit}
                        name="extraCredit"
                        options={["yes", "no"]}
                        setFunction={setExtraCredit}
                    />
                </div>   
            </section>

            <section>
                <h2>User Review</h2> 
                <p>3 OF 3</p>
                <div>
                    <p>Grade Received</p>
                    <input 
                        type="text"
                        value={gradeReceived}
                        onChange={(event) => setGradeReceived(event.target.value)}
                        maxLength={2}
                    />
                </div>

                <div>
                    <p>Give an honest review about this professor</p>
                    <textarea
                        value={review}
                        maxLength={500}
                        onChange={(e) => setReview(e.target.value)}
                    />
                </div>

                <div>
                    <p>tips and tricks</p>
                    <textarea
                        value={tips}
                        maxLength={500}
                        onChange={(e) => setTips(e.target.value)}
                    />
                </div>
            </section>


            <button onClick={handleSubmit}>Submit Review</button>
        </div>
    )
}