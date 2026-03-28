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
}

export interface RoleRequirement {
  role: string;
  headcount: number;
  internalAvailable: number;
  gap: number;
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
}

export interface ProjectConfig {
  name: string;
  description: string;
  targetDeadline: string;
  budgetMin: number;
  budgetMax: number;
  priority: 'Critical' | 'High' | 'Medium';
  staffEstimate: string;
}

export interface ExternalCandidate {
  id: string;
  name: string;
  company: string;
  role: string;
  targetRole: string;
  skills: string[];
  certifications: string[];
  yearsExperience: number;
  salaryExpectation: number;
  noticePeriod: string;
  compositeScore: number;
  skillMatch: number;
  education: string;
  location: string;
}

export type PageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

interface AppState {
  // Navigation
  currentPage: PageId;
  completedPages: Set<PageId>;
  setCurrentPage: (page: PageId) => void;
  markPageComplete: (page: PageId) => void;

  // Upload
  employees: Employee[];
  uploadStats: { total: number; departments: number; locations: number; skipped: number } | null;
  setEmployees: (employees: Employee[], stats: { total: number; departments: number; locations: number; skipped: number }) => void;

  // Project
  projectConfig: ProjectConfig | null;
  setProjectConfig: (config: ProjectConfig) => void;

  // Scenarios
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  setScenarios: (scenarios: Scenario[]) => void;
  selectScenario: (id: string) => void;

  // Roster
  roster: string[];
  addToRoster: (employeeId: string) => void;
  removeFromRoster: (employeeId: string) => void;

  // Upskill
  upskillCandidates: string[];
  addUpskillCandidate: (employeeId: string) => void;
  removeUpskillCandidate: (employeeId: string) => void;

  // External
  externalCandidates: ExternalCandidate[];
  shortlistedCandidates: string[];
  setExternalCandidates: (candidates: ExternalCandidate[]) => void;
  shortlistCandidate: (id: string) => void;
  unshortlistCandidate: (id: string) => void;
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
  addToRoster: (employeeId) => set((s) => ({ roster: [...s.roster, employeeId] })),
  removeFromRoster: (employeeId) => set((s) => ({ roster: s.roster.filter(id => id !== employeeId) })),

  upskillCandidates: [],
  addUpskillCandidate: (employeeId) => set((s) => ({ upskillCandidates: [...s.upskillCandidates, employeeId] })),
  removeUpskillCandidate: (employeeId) => set((s) => ({ upskillCandidates: s.upskillCandidates.filter(id => id !== employeeId) })),

  externalCandidates: [],
  shortlistedCandidates: [],
  setExternalCandidates: (candidates) => set({ externalCandidates: candidates }),
  shortlistCandidate: (id) => set((s) => ({ shortlistedCandidates: [...s.shortlistedCandidates, id] })),
  unshortlistCandidate: (id) => set((s) => ({ shortlistedCandidates: s.shortlistedCandidates.filter(i => i !== id) })),
}));
