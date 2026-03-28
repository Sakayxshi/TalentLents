export interface TrainingCourse {
  id: string;
  name: string;
  duration_weeks: number;
  cost_eur: number;
  delivery: 'Online' | 'In-person' | 'Hybrid';
  skillsGranted: string[];
  prerequisites: string[];
  location?: string;
}

export const BMW_COURSES: TrainingCourse[] = [
  {
    id: 'c01', name: 'Battery Cell Fundamentals', duration_weeks: 4, cost_eur: 1200,
    delivery: 'Online', prerequisites: [],
    skillsGranted: ['Battery Chemistry', 'Cell Testing', 'Electrochemistry basics'],
  },
  {
    id: 'c02', name: 'BMS Architecture & Design', duration_weeks: 6, cost_eur: 2400,
    delivery: 'In-person', prerequisites: ['c01'], location: 'Munich',
    skillsGranted: ['BMS Design', 'BMS Protocols', 'CAN Bus'],
  },
  {
    id: 'c03', name: 'High-Voltage Safety Certification', duration_weeks: 2, cost_eur: 800,
    delivery: 'In-person', prerequisites: [],
    skillsGranted: ['High-Voltage Safety', 'HV Systems'],
  },
  {
    id: 'c04', name: 'ISO 26262 Functional Safety', duration_weeks: 3, cost_eur: 2400,
    delivery: 'In-person', prerequisites: [],
    skillsGranted: ['ISO 26262', 'Functional Safety', 'FMEA'],
  },
  {
    id: 'c05', name: 'Solid-State Battery Technology', duration_weeks: 4, cost_eur: 1800,
    delivery: 'Online', prerequisites: ['c01'],
    skillsGranted: ['Solid-State Technology', 'Solid Electrolytes'],
  },
  {
    id: 'c06', name: 'Embedded C for Automotive', duration_weeks: 6, cost_eur: 1600,
    delivery: 'Online', prerequisites: [],
    skillsGranted: ['Embedded C', 'RTOS', 'Automotive Software'],
  },
  {
    id: 'c07', name: 'AUTOSAR Fundamentals', duration_weeks: 3, cost_eur: 1200,
    delivery: 'Online', prerequisites: ['c06'],
    skillsGranted: ['AUTOSAR', 'ECU Software Architecture'],
  },
  {
    id: 'c08', name: 'Six Sigma Green Belt', duration_weeks: 8, cost_eur: 3200,
    delivery: 'Hybrid', prerequisites: [],
    skillsGranted: ['Six Sigma', 'Process Improvement', 'Statistical Analysis'],
  },
  {
    id: 'c09', name: 'Agile/SAFe for Hardware Teams', duration_weeks: 2, cost_eur: 900,
    delivery: 'Online', prerequisites: [],
    skillsGranted: ['SAFe', 'Agile', 'Sprint Planning'],
  },
  {
    id: 'c10', name: 'IATF 16949 Quality Systems', duration_weeks: 3, cost_eur: 1400,
    delivery: 'In-person', prerequisites: [],
    skillsGranted: ['IATF 16949', 'Quality Management', 'Supplier Auditing'],
  },
  {
    id: 'c11', name: 'Python for Data Engineering', duration_weeks: 4, cost_eur: 1000,
    delivery: 'Online', prerequisites: [],
    skillsGranted: ['Python', 'Data Engineering', 'Pandas', 'Automation'],
  },
  {
    id: 'c12', name: 'Leadership for Technical Leads', duration_weeks: 2, cost_eur: 1600,
    delivery: 'In-person', prerequisites: [], location: 'Munich',
    skillsGranted: ['Team Leadership', 'Team Mentoring', 'Stakeholder Management'],
  },
  {
    id: 'c13', name: 'Thermal Management Systems', duration_weeks: 3, cost_eur: 1500,
    delivery: 'Online', prerequisites: ['c01'],
    skillsGranted: ['Thermal Management', 'Cooling Systems', 'Heat Transfer'],
  },
  {
    id: 'c14', name: 'MATLAB/Simulink for Engineers', duration_weeks: 4, cost_eur: 1100,
    delivery: 'Online', prerequisites: [],
    skillsGranted: ['MATLAB', 'Simulink', 'Model-Based Design'],
  },
  {
    id: 'c15', name: 'Supply Chain Digitalization', duration_weeks: 3, cost_eur: 900,
    delivery: 'Online', prerequisites: [],
    skillsGranted: ['Supply Chain Analytics', 'SAP MM', 'Digital Procurement'],
  },
];

function topologicalSort(courses: TrainingCourse[]): TrainingCourse[] {
  const courseMap = new Map(courses.map(c => [c.id, c]));
  const visited = new Set<string>();
  const result: TrainingCourse[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const course = courseMap.get(id);
    if (!course) return;
    course.prerequisites.forEach(prereqId => {
      if (courseMap.has(prereqId)) visit(prereqId);
    });
    result.push(course);
  }

  courses.forEach(c => visit(c.id));
  return result;
}

export function buildTrainingPath(missingSkills: string[]): {
  courses: TrainingCourse[];
  totalCost: number;
  totalWeeks: number;
} {
  if (missingSkills.length === 0) {
    return { courses: [], totalCost: 0, totalWeeks: 0 };
  }

  const missingLower = missingSkills.map(s => s.toLowerCase());

  const directMatches = BMW_COURSES.filter(course =>
    course.skillsGranted.some(skill =>
      missingLower.some(missing =>
        skill.toLowerCase().includes(missing) || missing.includes(skill.toLowerCase())
      )
    )
  );

  // Resolve prerequisites
  const allIds = new Set(directMatches.map(c => c.id));
  directMatches.forEach(course => {
    course.prerequisites.forEach(prereqId => {
      if (!allIds.has(prereqId)) {
        const prereq = BMW_COURSES.find(c => c.id === prereqId);
        if (prereq) {
          directMatches.push(prereq);
          allIds.add(prereqId);
        }
      }
    });
  });

  const sorted = topologicalSort(directMatches);
  const totalCost = sorted.reduce((s, c) => s + c.cost_eur, 0);
  // Max parallel duration + 2 week buffer
  const totalWeeks = sorted.reduce((s, c) => s + c.duration_weeks, 0) + 2;

  return { courses: sorted, totalCost, totalWeeks };
}

export function getSkillsAfterTraining(
  currentSkills: string,
  courses: TrainingCourse[]
): string {
  const existing = currentSkills.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const gained = courses.flatMap(c => c.skillsGranted);
  const all = [...new Set([...existing, ...gained])];
  return all.join('; ');
}
