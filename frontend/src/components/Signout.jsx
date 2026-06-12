import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function SignOut() {

    const navigate = useNavigate()

    const handleSignOut = async () => {
        const response = await supabase.auth.signOut()

        if (!response.error) {
            navigate("/courses")
        }
    }

    return(
        <button onClick={handleSignOut}>sign out</button>
    )
}