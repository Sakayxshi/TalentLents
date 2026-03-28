import Papa from 'papaparse';
import { Employee, ExternalCandidate, ProjectRecord } from '@/store/useStore';

const departments = ['Engineering', 'Data & Analytics', 'Quality', 'Operations', 'Supply Chain', 'R&D', 'Manufacturing', 'IT'];
const roles = ['Battery Engineer', 'Data Scientist', 'Quality Engineer', 'Automation Engineer', 'Supply Chain Analyst', 'Safety Specialist', 'Project Manager', 'UX Designer', 'Mechanical Engineer', 'Software Engineer', 'Process Engineer', 'Materials Scientist'];
const locations = ['Munich', 'Berlin', 'Stuttgart', 'Dingolfing', 'Leipzig', 'Regensburg'];
const salaryBands = ['E1', 'E2', 'E3', 'E4', 'E5', 'T1', 'T2', 'T3', 'M1', 'M2'];
const appraisals = ['Exceptional', 'Exceeds Expectations', 'Meets Expectations', 'Needs Improvement', 'Unsatisfactory'];
const risks = ['Low', 'Medium', 'High'];
const positions = ['Lead', 'Core Contributor', 'Contributor', 'Advisor', 'Support'];
const projects = ['EV Platform', 'Battery R&D', 'iDrive Next', 'ADAS System', 'Factory 4.0', 'None'];
const educations = ['B.Sc. Mechanical Engineering', 'M.Sc. Electrical Engineering', 'Ph.D. Chemistry', 'B.Sc. Computer Science', 'M.Sc. Data Science', 'B.Eng. Automotive', 'M.Sc. Materials Science', 'MBA'];
const languages = ['German, English', 'German, English, French', 'English, Mandarin', 'German, English, Spanish', 'German', 'English'];

const skillSets = [
  'Battery Chemistry, Thermal Management, BMS Design, Cell Testing',
  'Python, Machine Learning, Deep Learning, SQL, Tableau',
  'Six Sigma, ISO 9001, SPC, Root Cause Analysis, FMEA',
  'PLC Programming, SCADA, Robotics, Industrial IoT, AutoCAD',
  'SAP MM, Demand Forecasting, Logistics, Excel, Power BI',
  'HAZOP, Risk Assessment, ISO 45001, Emergency Planning',
  'Agile, JIRA, Stakeholder Management, Budgeting, SAFe',
  'Figma, Prototyping, User Research, Design Systems, CSS',
  'CAD, FEA, GD&T, SolidWorks, CATIA, Structural Analysis',
  'C++, Embedded Systems, AUTOSAR, Linux, Git, CI/CD',
  'Lean Manufacturing, Value Stream, Kaizen, Process Optimization',
  'XRD, SEM, Polymer Science, Nanomaterials, Lab Management',
];

const certSets = [
  'ISO 26262, EV Safety Level 2',
  'AWS Certified, TensorFlow Certificate',
  'Six Sigma Green Belt, ISO 9001 Auditor',
  'PMP, SCRUM Master, ABB Robotics',
  'APICS CSCP, SAP Certified',
  'NEBOSH, ISO 45001 Lead Auditor',
  'PMP, SAFe Agilist',
  'Google UX Certificate',
  'CATIA V5 Certified, GD&T Level 3',
  'AUTOSAR Certified, Embedded Linux',
  'Lean Six Sigma Black Belt, IATF 16949',
  'Materials Science Professional',
];

const firstNames = ['Maximilian', 'Sophie', 'Alexander', 'Emma', 'Lukas', 'Mia', 'Felix', 'Hannah', 'Jonas', 'Lea', 'Ben', 'Anna', 'Paul', 'Laura', 'Tim', 'Lena', 'Nico', 'Clara', 'David', 'Julia', 'Simon', 'Marie', 'Moritz', 'Amelie', 'Jan', 'Charlotte', 'Philipp', 'Lina', 'Adrian', 'Ella', 'Tobias', 'Sophia', 'Marco', 'Eva', 'Sebastian', 'Nora', 'Christian', 'Ida', 'Daniel', 'Johanna', 'Stefan', 'Katharina', 'Matthias', 'Theresa', 'Andreas', 'Helena', 'Florian', 'Victoria', 'Patrick', 'Carla'];
const lastNames = ['Müller', 'Schmidt', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Köhler', 'Maier', 'Hermann', 'König', 'Bauer', 'Walter', 'Peters', 'Frank', 'Keller', 'Beck', 'Lorenz', 'Berger', 'Kaiser', 'Huber', 'Scholz', 'Jung', 'Möller', 'Sauer', 'Vogel', 'Stein', 'Jäger', 'Otto', 'Groß', 'Roth', 'Engel', 'Graf'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateDemoEmployees(count: number = 100): Employee[] {
  const rand = seededRandom(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const employees: Employee[] = [];

  for (let i = 0; i < count; i++) {
    const roleIdx = i % roles.length;
    const yearsAtCompany = Math.round(rand() * 18 + 1);
    const productsDeployed = Math.round(rand() * 25);
    const successfulProducts = Math.round(productsDeployed * (0.5 + rand() * 0.5));
    const perfRating = Math.round(rand() * 2 + 3 * (rand() > 0.3 ? 1 : 0)) || 1;

    employees.push({
      employee_id: `BMW-${String(1000 + i).padStart(5, '0')}`,
      name: `${pick(firstNames)} ${pick(lastNames)}`,
      department: departments[roleIdx % departments.length],
      role: roles[roleIdx],
      location: pick(locations),
      hire_date: `${2006 + Math.floor(rand() * 19)}-${String(Math.floor(rand() * 12) + 1).padStart(2, '0')}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}`,
      years_at_company: yearsAtCompany,
      manager_id: `BMW-${String(1000 + Math.floor(rand() * 20)).padStart(5, '0')}`,
      salary_band: pick(salaryBands),
      employment_type: rand() > 0.1 ? 'Full-time' : 'Contract',
      performance_rating: Math.min(5, Math.max(1, perfRating)),
      products_deployed: productsDeployed,
      successful_products_deployed: successfulProducts,
      feedback_score: Math.round((rand() * 2 + 3) * 10) / 10,
      appraisal: appraisals[Math.min(Math.floor(rand() * 5), 4)],
      certifications: certSets[roleIdx % certSets.length],
      technical_skills: skillSets[roleIdx % skillSets.length],
      education: pick(educations),
      languages: pick(languages),
      flight_risk: risks[Math.min(Math.floor(rand() * 3), 2)],
      internal_moves: Math.floor(rand() * 4),
      current_project: pick(projects),
      project_position: pick(positions),
      peer_feedback_score: Math.round((rand() * 2 + 3) * 10) / 10,
    });
  }
  return employees;
}

const extCompanies = ['CATL', 'Samsung SDI', 'Continental', 'Bosch', 'Siemens', 'LG Energy Solution', 'Panasonic', 'BYD', 'SK Innovation', 'Northvolt', 'BASF', 'Infineon'];
const extFirstNames = ['Anna', 'Thomas', 'Sarah', 'Max', 'Elena', 'Felix', 'Laura', 'Jan', 'Marie', 'David', 'Sophie', 'Paul', 'Lea', 'Tim', 'Klara', 'Nico', 'Mia', 'Lukas', 'Hannah', 'Moritz', 'Emma', 'Jonas', 'Lena', 'Ben', 'Amelie', 'Philipp', 'Charlotte', 'Simon', 'Julia', 'Niklas', 'Clara', 'Mark', 'Sophia', 'Adrian', 'Lisa'];
const extLastNames = ['Müller', 'Weber', 'Fischer', 'Schmidt', 'Braun', 'Hoffmann', 'Wagner', 'Becker', 'Schulz', 'Krüger', 'Richter', 'Neumann', 'Schwarz', 'Zimmermann', 'Wolf', 'Schäfer', 'König', 'Peters', 'Lang', 'Frank', 'Walter', 'Baumann', 'Meier', 'Huber', 'Koch', 'Weiß', 'Hartmann', 'Keller', 'Lorenz', 'Bauer', 'Berger', 'Engel', 'Horn', 'Roth', 'Graf'];

export async function loadBmwDatabase(): Promise<{
  employees: Employee[];
  stats: { total: number; departments: number; locations: number; skipped: number };
}> {
  const response = await fetch('/bmw_workforce_database.csv');
  if (!response.ok) throw new Error('Failed to fetch BMW workforce database');
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        const skipped = results.errors.length + data.filter(r => !r.employee_id || !r.name).length;
        const valid = data.filter(r => r.employee_id && r.name);

        const employees: Employee[] = valid.map(row => ({
          employee_id: row.employee_id,
          name: row.name,
          department: row.department || '',
          role: row.role || '',
          location: row.location || '',
          hire_date: row.hire_date || '',
          years_at_company: Number(row.years_at_company) || 0,
          manager_id: row.manager_id || '',
          salary_band: row.salary_band || '',
          employment_type: row.employment_type || '',
          performance_rating: Number(row.performance_rating) || 3,
          products_deployed: Number(row.products_deployed) || 0,
          successful_products_deployed: Number(row.successful_products_deployed) || 0,
          feedback_score: Number(row.feedback_score) || 3,
          appraisal: row.appraisal || 'Meets Expectations',
          certifications: row.certifications || '',
          technical_skills: row.technical_skills || '',
          education: row.education || '',
          languages: row.languages || '',
          flight_risk: row.flight_risk || 'Low',
          internal_moves: Number(row.internal_moves) || 0,
          current_project: row.current_project || '',
          project_position: row.project_position || '',
          peer_feedback_score: Number(row.peer_feedback_score) || 3,
        }));

        const departments = new Set(employees.map(e => e.department)).size;
        const locations = new Set(employees.map(e => e.location)).size;

        resolve({ employees, stats: { total: employees.length, departments, locations, skipped } });
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

export async function loadProjectHistory(): Promise<ProjectRecord[]> {
  const response = await fetch('/bmw_employee_projects.csv');
  if (!response.ok) throw new Error('Failed to fetch project history');
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        const records: ProjectRecord[] = data
          .filter(r => r.employee_id && r.project_name)
          .map(row => ({
            employee_id: row.employee_id,
            employee_name: row.employee_name || '',
            department: row.department || '',
            role: row.role || '',
            project_name: row.project_name || '',
            project_position: row.project_position || '',
            project_status: row.project_status || '',
            start_date: row.start_date || '',
            end_date: row.end_date || '',
            skills_applied: row.skills_applied || '',
            certifications_applied: row.certifications_applied || '',
            contribution_summary: row.contribution_summary || '',
            performance_in_project: Number(row.performance_in_project) || 0,
            key_deliverable: row.key_deliverable || '',
          }));
        resolve(records);
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

export function generateExternalCandidates(targetRoles: string[]): ExternalCandidate[] {
  const rand = seededRandom(123);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const candidates: ExternalCandidate[] = [];

  for (let i = 0; i < 35; i++) {
    const targetRole = targetRoles[i % targetRoles.length];
    const roleIdx = roles.indexOf(targetRole);
    const skills = roleIdx >= 0 ? skillSets[roleIdx % skillSets.length] : pick(skillSets);
    const certs = roleIdx >= 0 ? certSets[roleIdx % certSets.length] : pick(certSets);

    candidates.push({
      id: `ext-${i}`,
      name: `${extFirstNames[i % extFirstNames.length]} ${extLastNames[i % extLastNames.length]}`,
      current_company: pick(extCompanies),
      current_role: targetRole,
      targetRole,
      years_experience: Math.round(rand() * 12 + 3),
      education: pick(educations),
      technical_skills: skills,
      certifications: certs,
      languages: pick(languages),
      salary_expectation: Math.round((55000 + rand() * 60000) / 1000) * 1000,
      notice_period_weeks: [4, 8, 12, 0][Math.floor(rand() * 4)],
      portfolio_summary: `Experienced ${targetRole} with track record in automotive/energy sector`,
      location: pick(locations),
    });
  }
  return candidates;
}
