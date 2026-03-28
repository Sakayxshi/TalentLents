import { Employee } from '@/store/useStore';

export interface ScoreBreakdown {
  total: number;
  breakdown: Record<string, number>;
  skillMatchPct: number;
}

export function calculateCompositeScore(
  employee: Employee,
  requiredSkills: string[] = [],
  requiredCerts: string[] = [],
  priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'High'
): ScoreBreakdown {
  const empSkills = (employee.technical_skills || '').split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const empCerts = (employee.certifications || '').split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const reqSkillsLower = requiredSkills.map(s => s.toLowerCase());
  const reqCertsLower = requiredCerts.map(s => s.toLowerCase());

  // 1. Skill Match (25pts)
  const skillMatches = reqSkillsLower.length > 0
    ? reqSkillsLower.filter(s => empSkills.some(es => es.includes(s) || s.includes(es))).length
    : 0;
  const skillMatch = reqSkillsLower.length > 0 ? (skillMatches / reqSkillsLower.length) * 100 : 50;

  // 2. Performance Rating (15pts) — normalize 1-5 to 0-100
  const performance = (((employee.performance_rating || 3) - 1) / 4) * 100;

  // 3. Products + Success Rate (15pts)
  const successRate = employee.products_deployed > 0
    ? (employee.successful_products_deployed / employee.products_deployed) * 100
    : 50;
  const deliveryScore = (Math.min(employee.products_deployed / 20, 1) * 50) + (successRate * 0.5);

  // 4. Certifications Match (10pts)
  const certMatches = reqCertsLower.length > 0
    ? reqCertsLower.filter(c => empCerts.some(ec => ec.includes(c) || c.includes(ec))).length
    : 0;
  const certMatch = reqCertsLower.length > 0 ? (certMatches / reqCertsLower.length) * 100 : (empCerts.length > 0 ? 50 : 30);

  // 5. Peer Feedback (10pts)
  const peerFeedback = (((employee.peer_feedback_score || 3) - 1) / 4) * 100;

  // 6. KPI/Appraisal (10pts)
  const appraisalMap: Record<string, number> = {
    'Exceptional': 100, 'Exceeds Expectations': 80, 'Meets Expectations': 60,
    'Needs Improvement': 30, 'Unsatisfactory': 0
  };
  const kpi = appraisalMap[employee.appraisal] ?? 50;

  // 7. Availability (10pts) — inverse of commitment level
  const availMap: Record<string, number> = {
    'Lead': 20, 'Core Contributor': 40, 'Contributor': 60, 'Advisor': 80, 'Support': 100
  };
  const availability = availMap[employee.project_position] ?? 60;

  // 8. Flight Risk Penalty
  const riskPenalty = employee.flight_risk?.toLowerCase() === 'high' ? -15
    : employee.flight_risk?.toLowerCase() === 'medium' ? -5 : 0;

  // Adjust weights by priority
  let weights = { skill: 0.25, perf: 0.15, delivery: 0.15, cert: 0.10, peer: 0.10, kpi: 0.10, avail: 0.10 };
  if (priority === 'Critical') {
    weights = { skill: 0.20, perf: 0.15, delivery: 0.15, cert: 0.08, peer: 0.08, kpi: 0.08, avail: 0.18 };
  }

  const raw = (skillMatch * weights.skill) + (performance * weights.perf) + (deliveryScore * weights.delivery)
    + (certMatch * weights.cert) + (peerFeedback * weights.peer) + (kpi * weights.kpi) + (availability * weights.avail);

  const total = Math.max(0, Math.min(100, Math.round(raw + riskPenalty)));

  return {
    total,
    breakdown: {
      'Skill Match': Math.round(skillMatch),
      'Performance': Math.round(performance),
      'Delivery Track Record': Math.round(deliveryScore),
      'Certifications': Math.round(certMatch),
      'Peer Feedback': Math.round(peerFeedback),
      'KPI / Appraisal': Math.round(kpi),
      'Availability': Math.round(availability),
      'Flight Risk': riskPenalty
    },
    skillMatchPct: Math.round(skillMatch)
  };
}

// Legacy compatibility
export function computeCompositeScore(
  emp: Employee,
  requiredSkills: string[] = [],
  requiredCerts: string[] = []
): number {
  return calculateCompositeScore(emp, requiredSkills, requiredCerts).total;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'score-green';
  if (score >= 60) return 'score-amber';
  return 'score-red';
}

export function getAppraisalVariant(appraisal: string): string {
  switch (appraisal) {
    case 'Exceptional': return 'badge-green';
    case 'Exceeds Expectations': return 'badge-blue';
    case 'Meets Expectations': return 'badge-amber';
    case 'Needs Improvement': return 'badge-amber';
    case 'Unsatisfactory': return 'badge-red';
    default: return 'badge-amber';
  }
}

export function getRiskVariant(risk: string): string {
  switch (risk?.toLowerCase()) {
    case 'high': return 'badge-red';
    case 'medium': return 'badge-amber';
    case 'low': return 'badge-green';
    default: return 'badge-amber';
  }
}

export function getSkillOverlap(empSkills: string[], requiredSkills: string[]): number {
  if (requiredSkills.length === 0) return 0;
  const empLower = empSkills.map(s => s.toLowerCase());
  const reqLower = requiredSkills.map(s => s.toLowerCase());
  const matches = reqLower.filter(s => empLower.some(es => es.includes(s) || s.includes(es))).length;
  return matches / reqLower.length;
}

export function getMissingSkills(empSkills: string[], requiredSkills: string[]): string[] {
  const empLower = empSkills.map(s => s.toLowerCase());
  return requiredSkills.filter(s => !empLower.some(es => es.includes(s.toLowerCase()) || s.toLowerCase().includes(es)));
}

export function getMatchedSkills(empSkills: string[], requiredSkills: string[]): string[] {
  const empLower = empSkills.map(s => s.toLowerCase());
  return requiredSkills.filter(s => empLower.some(es => es.includes(s.toLowerCase()) || s.toLowerCase().includes(es)));
}

// ─── External Candidate Scoring ──────────────────────────────────────────────

export type RankingMode = 'best_overall' | 'fastest' | 'lowest_cost' | 'long_term';

export interface ExternalCandidateScore {
  composite: number;
  breakdown: {
    skillMatch: number;
    experienceRelevance: number;
    certificationMatch: number;
    educationFit: number;
    salaryFit: number;
    availability: number;
  };
}

const RANKING_WEIGHTS: Record<RankingMode, ExternalCandidateScore['breakdown']> = {
  best_overall: { skillMatch: 0.30, experienceRelevance: 0.20, certificationMatch: 0.15, educationFit: 0.10, salaryFit: 0.15, availability: 0.10 },
  fastest:      { skillMatch: 0.20, experienceRelevance: 0.15, certificationMatch: 0.10, educationFit: 0.05, salaryFit: 0.10, availability: 0.40 },
  lowest_cost:  { skillMatch: 0.25, experienceRelevance: 0.15, certificationMatch: 0.10, educationFit: 0.10, salaryFit: 0.35, availability: 0.05 },
  long_term:    { skillMatch: 0.25, experienceRelevance: 0.30, certificationMatch: 0.20, educationFit: 0.15, salaryFit: 0.05, availability: 0.05 },
};

export function scoreExternalCandidate(
  candidateSkills: string,
  candidateYearsExp: number,
  candidateCertifications: string,
  candidateEducation: string,
  candidateCompany: string,
  candidateRole: string,
  candidateSalaryExpectation: number,
  candidateNoticePeriodWeeks: number,
  requiredSkills: string[],
  requiredCerts: string[],
  salaryBandMax: number,
  mode: RankingMode = 'best_overall'
): ExternalCandidateScore {
  const skills = candidateSkills.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const certs = candidateCertifications.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);

  // Skill Match
  const matchedSkills = requiredSkills.filter(req =>
    skills.some(s => s.includes(req.toLowerCase()) || req.toLowerCase().includes(s))
  );
  const skillMatch = requiredSkills.length > 0
    ? (matchedSkills.length / requiredSkills.length) * 100
    : 60;

  // Experience Relevance — automotive/EV context boosts score
  const automotiveKeywords = ['bmw', 'mercedes', 'volkswagen', 'tesla', 'automotive', 'ev', 'battery', 'bosch', 'continental', 'siemens'];
  const isAutomotive = automotiveKeywords.some(kw =>
    candidateCompany.toLowerCase().includes(kw) || candidateRole.toLowerCase().includes(kw)
  );
  const baseExp = Math.min(100, (candidateYearsExp / 12) * 100);
  const experienceRelevance = Math.min(100, isAutomotive ? baseExp * 1.3 : baseExp);

  // Certification Match
  const matchedCerts = requiredCerts.filter(req =>
    certs.some(c => c.includes(req.toLowerCase()) || req.toLowerCase().includes(c))
  );
  const certificationMatch = requiredCerts.length > 0
    ? (matchedCerts.length / requiredCerts.length) * 100
    : 70;

  // Education Fit
  const eduKeywords = ['engineering', 'computer science', 'physics', 'chemistry', 'materials', 'informatik', 'maschinenbau'];
  const educationFit = eduKeywords.some(kw => candidateEducation.toLowerCase().includes(kw))
    ? (candidateEducation.toLowerCase().includes('phd') || candidateEducation.toLowerCase().includes('msc') ? 95 : 80)
    : 55;

  // Salary Fit
  let salaryFit: number;
  if (candidateSalaryExpectation <= salaryBandMax) {
    salaryFit = 100;
  } else if (candidateSalaryExpectation <= salaryBandMax * 1.1) {
    salaryFit = 70;
  } else {
    salaryFit = Math.max(20, 100 - ((candidateSalaryExpectation - salaryBandMax) / salaryBandMax) * 200);
  }

  // Availability (based on notice period)
  const availability =
    candidateNoticePeriodWeeks === 0 ? 100 :
    candidateNoticePeriodWeeks <= 4 ? 80 :
    candidateNoticePeriodWeeks <= 8 ? 60 : 35;

  const weights = RANKING_WEIGHTS[mode];
  const composite = Math.round(
    skillMatch * weights.skillMatch +
    experienceRelevance * weights.experienceRelevance +
    certificationMatch * weights.certificationMatch +
    educationFit * weights.educationFit +
    salaryFit * weights.salaryFit +
    availability * weights.availability
  );

  return {
    composite: Math.min(100, Math.max(0, composite)),
    breakdown: {
      skillMatch: Math.round(skillMatch),
      experienceRelevance: Math.round(experienceRelevance),
      certificationMatch: Math.round(certificationMatch),
      educationFit: Math.round(educationFit),
      salaryFit: Math.round(salaryFit),
      availability: Math.round(availability),
    },
  };
}

// ─── Gap Analysis Thresholds ──────────────────────────────────────────────────

export const GAP_THRESHOLDS = {
  INTERNAL_READY: 0.80,  // 80%+ skill match → can fill role directly
  UPSKILLABLE: 0.60,     // 60–79% skill match → needs training
};

// ─── Salary band utilities
export const SALARY_BAND_MIDPOINTS: Record<string, number> = {
  'E1': 45000, 'E2': 55000, 'E3': 65000, 'E4': 78000, 'E5': 92000,
  'T1': 38000, 'T2': 48000, 'T3': 58000,
  'M1': 95000, 'M2': 115000, 'M3': 140000,
};

export const SALARY_BAND_WEEKLY: Record<string, number> = {
  'E1': 800, 'E2': 1000, 'E3': 1200, 'E4': 1500, 'E5': 1800,
  'T1': 700, 'T2': 900, 'T3': 1100,
  'M1': 2000, 'M2': 2500, 'M3': 3000,
};

export function getOnboardingCost(salaryBand: string): number {
  if (['E1', 'E2', 'T1', 'T2'].includes(salaryBand)) return 3000;
  if (['E3', 'E4', 'T3'].includes(salaryBand)) return 5000;
  return 8000;
}

export function getRecruitingWeeks(role: string): number {
  const lower = role.toLowerCase();
  if (lower.includes('battery') || lower.includes('ev') || lower.includes('cell')) return 10;
  if (lower.includes('software') || lower.includes('data')) return 8;
  if (lower.includes('manager') || lower.includes('lead')) return 6;
  return 7;
}
