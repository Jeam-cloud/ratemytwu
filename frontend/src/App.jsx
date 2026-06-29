import ProfessorList from "./Pages/Professor/ProfessorList"
import SearchResults from "./Pages/Search/SearchResults"
import CourseList from "./Pages/Course/CourseList"
import CoursePage from "./Pages/Course/CoursePage"

import ProfessorPage from "./Pages/Professor/ProfessorPage"
import ReviewPage from "./Pages/Professor/ReviewPage"

import HomeProf from "./Pages/HomePages/HomeProf"
import HomeCourse from "./Pages/HomePages/HomeCourse"
import HomeDepartment from "./Pages/HomePages/HomeDepartment"

import DepartmentPage from "./Pages/Department/DepartmentPage"

import CompareProf from "./Pages/Compare/CompareProf"

import SignupPage from "./auth/SignupPage"
import LoginPage from "./auth/LoginPage"

import Dashboard from "./Pages/Dashboard/Dashboard"

import ProtectedRoute from "./components/ProtectedRoute"

import HowItWorksPage from "./Pages/Static/HowItWorksPage"
import ReportPage from "./Pages/Static/ReportPage"
import ContactPage from "./Pages/Static/ContactPage"
import PrivacyPage from "./Pages/Static/PrivacyPage"

import { Routes, Route, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { supabase } from "./supabaseClient"

export default function App() {
  const navigate = useNavigate()

  // After email confirmation, redirect to stored path instead of homepage
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        const redirect = localStorage.getItem("postAuthRedirect")
        if (redirect) {
          localStorage.removeItem("postAuthRedirect")
          navigate(redirect, { replace: true })
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
        <>
          <Routes>

            {/* Routes for prof homepage and course homepage*/}
            <Route path="/" element={<HomeProf />} />
            <Route path="/departments" element={<HomeDepartment />} />

            {/* Routes for list of professors and list of courses*/}
            <Route path="/professor" element={<ProfessorList />} />
            <Route path="/course" element={<CourseList />} />

            {/* Routes for individual professor, review page, list of professors associated with course*/}
            <Route path="/professor/:id" element={<ProfessorPage />} />
            <Route path="/professor/:id/review" element={
              <ProtectedRoute>
                <ReviewPage />
              </ProtectedRoute>
            } />
            <Route path="/course/:id" element={<CoursePage />} />
            <Route path="/department/:department_name" element={<DepartmentPage />}/>

            <Route path="/search" element={<SearchResults />} />
            <Route path="/compare" element={<CompareProf />} />
            
            {/* user stuff */}
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path="/dashboard" element={<Dashboard />} />

            {/* static pages */}
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

          </Routes>

        </>
  )
}

