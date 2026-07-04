// Pre-built TWU degree checklist templates.
// Each entry is consumed by classifyCourse() in checklistImport.js to
// auto-sort planner courses into Major / Ancillary / Electives.
//
// Template fields used by classifyCourse():
//   sections[key="major"].required        exact course codes that are required
//   sections[key="major"].choose          "choose one of these" options (still major)
//   sections[key="major"].electivePrefix  prefix of courses that count as major electives
//   sections[key="major"].electiveMinLevel  minimum course number for elective to count
//   sections[key="ancillary"].required    exact ancillary course codes

export const MAJOR_TEMPLATES = {
  "computing-science": {
    program: "Computing Science",
    calendarYear: "2023-24",
    totalCredits: 122,
    sections: [
      {
        key: "major",
        label: "Required Computing Science Courses",
        // Core required CMPT courses
        required: ["CMPT 140", "CMPT 150", "CMPT 166", "CMPT 231"],
        // Choose one from this list (counts as required major)
        choose: ["CMPT 211", "CMPT 242", "CMPT 385"],
        // Any CMPT numbered 130+ counts toward the 42 s.h. major requirement
        // (per checklist note: "CMPT courses numbered below 130 do not count")
        electivePrefix: "CMPT",
        electiveMinLevel: 130,
        target: 42,
      },
      {
        key: "ancillary",
        label: "Ancillary Requirements",
        required: ["MATH 123", "MATH 124", "NATS 483"],
        target: 9,
      },
    ],
  },
}

// Ordered list for the major selector dropdown.
export const MAJOR_OPTIONS = [
  { key: "computing-science", label: "Computing Science (122 s.h.)" },
]
