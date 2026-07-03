// Universal TWU Core (Inquiry: Ways of Knowing) — the same skeleton for every
// major. Mirrors the paper checklist: each group has sub-sections, each with a
// header above its drop area.
//
// Slot fields:
//   capacity   how many courses fit
//   credits    s.h. the slot represents
//   eligible   used to auto-fill known courses AND to highlight valid drop
//              targets while dragging; manual drop still accepts anything
//   label      shown on the row (omit when the sub-section header already says it)
//   hint       faint guidance text shown in the empty drop area

export const CORE_GROUPS = [
  {
    id: "foundational",
    title: "Foundational Inquiries",
    subgroups: [
      {
        title: "Academic Research & Writing",
        slots: [
          { id: "acad-writing", capacity: 2, credits: 6, hint: "ENGL 101–104", eligible: ["ENGL 101", "ENGL 102", "ENGL 103", "ENGL 104"] },
        ],
      },
      {
        title: "Foundations",
        slots: [
          { id: "fndn-101", label: "FNDN 101", capacity: 1, credits: 1, eligible: ["FNDN 101"] },
          { id: "fndn-102", label: "FNDN 102", capacity: 1, credits: 3, eligible: ["FNDN 102"] },
          { id: "fndn-201", label: "FNDN 201", capacity: 1, credits: 3, eligible: ["FNDN 201"] },
        ],
      },
      {
        title: "Logical & Ethical Reasoning",
        slots: [
          { id: "logical", capacity: 1, credits: 3, hint: "PHIL 100 / 103 / 105 / 106 / 109 / 210", eligible: ["PHIL 100", "PHIL 103", "PHIL 105", "PHIL 106", "PHIL 109", "PHIL 210"] },
        ],
      },
      {
        title: "Religious & Spiritual Thought",
        slots: [
          { id: "rels-intro", label: "RELS 110 or 160", capacity: 1, credits: 3, eligible: ["RELS 110", "RELS 160"] },
          { id: "rels-111", label: "RELS 111", capacity: 1, credits: 3, eligible: ["RELS 111"] },
          { id: "rels-112", label: "RELS 112", capacity: 1, credits: 3, eligible: ["RELS 112"] },
        ],
      },
      {
        title: "Scientific Method & Lab Research",
        slots: [
          {
            id: "science", capacity: 1, credits: 3, hint: "a lab science — BIOL, CHEM, GENV, GEOL, PHYS",
            eligible: [
              "BIOL 103", "BIOL 104", "BIOL 113", "BIOL 114", "BIOL 198", "BIOL 199",
              "BIOL 216", "BIOL 241", "BIOL 242", "BIOL 262",
              "CHEM 101", "CHEM 103", "CHEM 198",
              "GENV 109", "GENV 121", "GENV 262", "GEOL 109", "PHYS 111",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "ways-of-knowing",
    title: "Ways of Knowing",
    note: "One course per category. Use the ⋯ menu to mark a category satisfied if your major already covers it.",
    subgroups: [
      {
        title: "Aesthetic & Performance",
        slots: [{
          id: "wok-aesthetic", capacity: 1, credits: 3, hint: "e.g. MUSI 110, ART 181, THTR 130",
          eligible: [
            "ART 181", "ART 182", "ART 230", "ART 250", "ART 280",
            "ENGL 207", "ENGL 208", "ENGL 310", "HKIN 342",
            "MCOM 211", "MCOM 221", "MCOM 231", "MCOM 369",
            "MUSI 110", "PHIL 370", "SAMC 111", "SAMC 370", "THTR 130", "THTR 161",
          ],
        }],
      },
      {
        title: "Cultural & Linguistic",
        slots: [{
          id: "wok-cultural", capacity: 1, credits: 3, hint: "e.g. ANTH 210, HIST 237, RELS 235",
          eligible: [
            "ANTH 210", "ANTH 395", "EDUC 496", "ENGL 334", "ENGL 340", "ENGL 482",
            "GREE 235", "HEBR 245", "HIST 237", "IDIS 201", "POLS 237",
            "RELS 235", "RELS 245", "SOCI 395",
          ],
        }],
      },
      {
        title: "Experiential & Embodied",
        slots: [{
          id: "wok-experiential", capacity: 1, credits: 3, hint: "e.g. ART 305, CMPT 409, MATH 410",
          eligible: ["ART 305", "ART 306", "ART 307", "CMPT 409", "CMPT 410", "MATH 409", "MATH 410"],
        }],
      },
      {
        title: "Historical & Archival",
        slots: [{
          id: "wok-historical", capacity: 1, credits: 3, hint: "e.g. HIST 107, PHIL 203, MUSI 131",
          eligible: [
            "ART 237", "ART 238", "ECON 306", "GENV 312",
            "HIST 107", "HIST 108", "HIST 135", "HIST 306", "HIST 339", "HIST 391",
            "LDRS 302", "MUSI 131", "MUSI 132", "NURS 230",
            "PHIL 203", "PHIL 314", "PHIL 421", "POLS 391", "PSYC 408",
            "RELS 320", "RELS 351", "RELS 352", "RELS 475", "SAMC 112", "SOCI 391", "THTR 331", "THTR 332",
          ],
        }],
      },
      {
        title: "Social & Global",
        slots: [{
          id: "wok-social", capacity: 1, credits: 3, hint: "e.g. SOCI 101, POLS 101, ECON 311",
          eligible: [
            "ANTH 101", "ANTH 220", "ANTH 302", "BUSI 311", "ECON 311", "ECON 354",
            "EDUC 345", "EDUC 365", "ENGL 348",
            "GENV 111", "GENV 212", "GENV 322", "GENV 354", "HKIN 325",
            "LING 101", "LING 210", "LING 302",
            "MCOM 111", "MCOM 171", "MCOM 251", "MCOM 313", "MCOM 315",
            "POLS 101", "POLS 211", "POLS 310", "POLS 312", "POLS 320",
            "RELS 271", "RELS 272", "RELS 285", "SOCI 101", "SOCI 220",
          ],
        }],
      },
      {
        // Usually covered by the major (e.g. CMPT 140 / MATH 190) — no eligible list,
        // so it never pulls a major course out of the Major tab; mark it satisfied.
        title: "Quantitative & Computational",
        slots: [{ id: "wok-quant", capacity: 1, credits: 0, hint: "usually covered by your major — use ⋯ to satisfy", eligible: [] }],
      },
    ],
  },
]
