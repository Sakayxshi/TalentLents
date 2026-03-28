import { Employee } from '@/store/useStore';

export function computeCompositeScore(
  emp: Employee,
  requiredSkills: string[] = [],
  requiredCerts: string[] = []
): number {
  const empSkills = emp.technical_skills?.split(',').map(s => s.trim().toLowerCase()) || [];
  const empCerts = emp.certifications?.split(',').map(s => s.trim().toLowerCase()) || [];

  // Skill Match 25%
  const skillMatch = requiredSkills.length > 0
    ? (requiredSkills.filter(s => empSkills.includes(s.toLowerCase())).length / requiredSkills.length) * 100
    : 70;
  const skillScore = skillMatch * 0.25;

  // Performance 15%
  const perfScore = Math.min((emp.performance_rating || 3) / 5, 1) * 100 * 0.15;

  // Products/Success 15%
  const successRate = emp.products_deployed > 0
    ? (emp.successful_products_deployed / emp.products_deployed) * 100
    : 50;
  const productScore = Math.min(successRate, 100) * 0.15;

  // Certifications 10%
  const certMatch = requiredCerts.length > 0
    ? (requiredCerts.filter(c => empCerts.includes(c.toLowerCase())).length / requiredCerts.length) * 100
    : empCerts.length > 0 ? 60 : 30;
  const certScore = certMatch * 0.10;

  // Peer Feedback 10%
  const peerScore = Math.min((emp.peer_feedback_score || 3) / 5, 1) * 100 * 0.10;

  // KPI/Appraisal 10%
  const appraisalMap: Record<string, number> = {
    'Exceptional': 100, 'Exceeds Expectations': 80, 'Meets Expectations': 60,
    'Needs Improvement': 30, 'Unsatisfactory': 10
  };
  const appraisalScore = (appraisalMap[emp.appraisal] || 50) * 0.10;

  // Availability 10%
  const availScore = 70 * 0.10;

  // Flight Risk penalty -5%
  const riskPenalty = emp.flight_risk?.toLowerCase() === 'high' ? 5
    : emp.flight_risk?.toLowerCase() === 'medium' ? 2.5 : 0;

  return Math.round(Math.min(100, Math.max(0,
    skillScore + perfScore + productScore + certScore + peerScore + appraisalScore + availScore - riskPenalty
  )));
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
