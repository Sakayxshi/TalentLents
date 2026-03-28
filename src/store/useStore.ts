import { create } from 'zustand';

export interface Employee {
  employee_id: string;
  name: string;
  department: string;
  role: string;
  location: string;
  hire_date: string;
  years_at_company: number;
  manager_id: string;
  salary_band: string;
  employment_type: string;
  performance_rating: number;
  products_deployed: number;
  successful_products_deployed: number;
  feedback_score: number;
  appraisal: string;
  certifications: string;
  technical_skills: string;
  education: string;
  languages: string;
  flight_risk: string;
  internal_moves: number;
  current_project: string;
  project_position: string;
  peer_feedback_score: number;
  composite_score?: number;
  skill_match_pct?: number;
}

export interface RoleRequirement {
  role: string;
  headcount: number;
  internalAvailable: number;
  gap: number;
  requiredSkills: string[];
  requiredCerts: string[];
}

export interface Scenario {
  id: string;
  name: string;
  label: string;
  totalHeadcount: number;
  costEstimate: string;
  timeline: string;
  risk: 'Low' | 'Medium' | 'High' | 'None';
  roles: RoleRequirement[];
  pros: string[];
  cons: string[];
  rationale: string;
}

export interface ProjectConfig {
  name: string;
  description: string;
  targetDeadline: string;
  budgetMin: number;
  budgetMax: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  staffEstimate: string;
}

export interface ExternalCandidate {
  id: string;
  name: string;
  current_company: string;
  current_role: string;
  targetRole: string;
  years_experience: number;
  education: string;
  technical_skills: string;
  certifications: string;
  languages: string;
  salary_expectation: number;
  notice_period_weeks: number;
  portfolio_summary: string;
  composite_score?: number;
  skill_match?: number;
  location: string;
}

export interface UpskillCandidate {
  employeeId: string;
  targetRole: string;
  approved: boolean;
  trainingPath?: TrainingStep[];
  totalCost?: number;
  totalWeeks?: number;
}

export interface TrainingStep {
  course: string;
  duration: string;
  cost: number;
  method: 'Online' | 'In-person' | 'Hybrid';
  coversSkills: string[];
}

export interface JobPosting {
  roleId: string;
  role: string;
  department: string;
  location: string;
  salaryBand: string;
  status: 'Draft' | 'Ready' | 'Posted';
  description: {
    opening: string;
    roleOverview: string;
    requiredQualifications: string[];
    preferredQualifications: string[];
    bmwOffers: string;
  } | null;
}

export type PageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

interface AppState {
  currentPage: PageId;
  completedPages: Set<PageId>;
  setCurrentPage: (page: PageId) => void;
  markPageComplete: (page: PageId) => void;

  employees: Employee[];
  uploadStats: { total: number; departments: number; locations: number; skipped: number } | null;
  setEmployees: (employees: Employee[], stats: { total: number; departments: number; locations: number; skipped: number }) => void;

  projectConfig: ProjectConfig | null;
  setProjectConfig: (config: ProjectConfig) => void;

  scenarios: Scenario[];
  selectedScenarioId: string | null;
  setScenarios: (scenarios: Scenario[]) => void;
  selectScenario: (id: string) => void;

  roster: string[];
  addToRoster: (employeeId: string) => void;
  removeFromRoster: (employeeId: string) => void;

  upskillCandidates: UpskillCandidate[];
  addUpskillCandidate: (candidate: UpskillCandidate) => void;
  approveUpskill: (employeeId: string) => void;
  removeUpskillCandidate: (employeeId: string) => void;
  setUpskillTrainingPath: (employeeId: string, path: TrainingStep[], totalCost: number, totalWeeks: number) => void;

  externalCandidates: ExternalCandidate[];
  shortlistedCandidates: string[];
  setExternalCandidates: (candidates: ExternalCandidate[]) => void;
  shortlistCandidate: (id: string) => void;
  unshortlistCandidate: (id: string) => void;

  jobPostings: JobPosting[];
  setJobPostings: (postings: JobPosting[]) => void;
  updateJobPosting: (roleId: string, updates: Partial<JobPosting>) => void;
}

export const useStore = create<AppState>((set) => ({
  currentPage: 1,
  completedPages: new Set<PageId>(),
  setCurrentPage: (page) => set({ currentPage: page }),
  markPageComplete: (page) => set((state) => {
    const newSet = new Set(state.completedPages);
    newSet.add(page);
    return { completedPages: newSet };
  }),

  employees: [],
  uploadStats: null,
  setEmployees: (employees, stats) => set({ employees, uploadStats: stats }),

  projectConfig: null,
  setProjectConfig: (config) => set({ projectConfig: config }),

  scenarios: [],
  selectedScenarioId: null,
  setScenarios: (scenarios) => set({ scenarios }),
  selectScenario: (id) => set({ selectedScenarioId: id }),

  roster: [],
  addToRoster: (employeeId) => set((s) => ({
    roster: s.roster.includes(employeeId) ? s.roster : [...s.roster, employeeId]
  })),
  removeFromRoster: (employeeId) => set((s) => ({
    roster: s.roster.filter(id => id !== employeeId)
  })),

  upskillCandidates: [],
  addUpskillCandidate: (candidate) => set((s) => ({
    upskillCandidates: s.upskillCandidates.some(c => c.employeeId === candidate.employeeId)
      ? s.upskillCandidates
      : [...s.upskillCandidates, candidate]
  })),
  approveUpskill: (employeeId) => set((s) => ({
    upskillCandidates: s.upskillCandidates.map(c =>
      c.employeeId === employeeId ? { ...c, approved: true } : c
    )
  })),
  removeUpskillCandidate: (employeeId) => set((s) => ({
    upskillCandidates: s.upskillCandidates.filter(c => c.employeeId !== employeeId)
  })),
  setUpskillTrainingPath: (employeeId, path, totalCost, totalWeeks) => set((s) => ({
    upskillCandidates: s.upskillCandidates.map(c =>
      c.employeeId === employeeId ? { ...c, trainingPath: path, totalCost, totalWeeks } : c
    )
  })),

  externalCandidates: [],
  shortlistedCandidates: [],
  setExternalCandidates: (candidates) => set({ externalCandidates: candidates }),
  shortlistCandidate: (id) => set((s) => ({
    shortlistedCandidates: s.shortlistedCandidates.includes(id) ? s.shortlistedCandidates : [...s.shortlistedCandidates, id]
  })),
  unshortlistCandidate: (id) => set((s) => ({
    shortlistedCandidates: s.shortlistedCandidates.filter(i => i !== id)
  })),

  jobPostings: [],
  setJobPostings: (postings) => set({ jobPostings: postings }),
  updateJobPosting: (roleId, updates) => set((s) => ({
    jobPostings: s.jobPostings.map(p => p.roleId === roleId ? { ...p, ...updates } : p)
  })),
}));
