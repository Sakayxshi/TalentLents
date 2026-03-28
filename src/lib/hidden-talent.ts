import { ProjectRecord } from '@/store/useStore';

export interface HiddenTalent {
  tag: string;
  evidence: string;
  score: number; // 0-100
}

export interface EmployeeTalentProfile {
  employeeId: string;
  talents: HiddenTalent[];
  crossFunctionalSkills: string[];
  peakPerformanceProject: { name: string; score: number; contribution: string } | null;
  leadershipSignal: boolean;
  mentorSignal: boolean;
  innovatorSignal: boolean;
  versatilityScore: number; // how many different skill areas they've worked in
  consistencyScore: number; // avg performance across all projects
  hiddenSkills: string[];   // skills used in projects but NOT in their main technical_skills
}

const LEADERSHIP_KEYWORDS = ['led', 'managed', 'coordinated', 'spearheaded', 'directed', 'oversaw', 'architected'];
const MENTOR_KEYWORDS = ['mentored', 'trained', 'coached', 'onboarded', 'taught', 'guided', 'junior'];
const INNOVATOR_KEYWORDS = ['designed', 'built', 'created', 'implemented', 'automated', 'pipeline', 'reduced', 'cutting', 'improved', 'innovated'];

function textContains(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export function analyzeEmployeeTalents(
  employeeId: string,
  records: ProjectRecord[],
  currentTechnicalSkills: string
): EmployeeTalentProfile {
  const myRecords = records.filter(r => r.employee_id === employeeId);

  if (myRecords.length === 0) {
    return {
      employeeId,
      talents: [],
      crossFunctionalSkills: [],
      peakPerformanceProject: null,
      leadershipSignal: false,
      mentorSignal: false,
      innovatorSignal: false,
      versatilityScore: 0,
      consistencyScore: 0,
      hiddenSkills: [],
    };
  }

  const talents: HiddenTalent[] = [];

  // All skills used across projects
  const allAppliedSkills = new Set<string>();
  myRecords.forEach(r => {
    (r.skills_applied || '').split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean)
      .forEach(s => allAppliedSkills.add(s));
  });

  // Current skills from profile
  const profileSkills = new Set(
    currentTechnicalSkills.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean)
  );

  // Hidden skills: used in projects but not listed in profile
  const hiddenSkills = [...allAppliedSkills].filter(s =>
    !profileSkills.has(s) && ![...profileSkills].some(ps => ps.includes(s) || s.includes(ps))
  );

  if (hiddenSkills.length > 0) {
    talents.push({
      tag: 'Unlisted Skills',
      evidence: `Used in projects but not in profile: ${hiddenSkills.slice(0, 4).join(', ')}`,
      score: Math.min(100, hiddenSkills.length * 20),
    });
  }

  // Cross-functional: unique project domains
  const projectNames = [...new Set(myRecords.map(r => r.project_name))];
  const departments = [...new Set(myRecords.map(r => r.department))];
  const versatilityScore = Math.min(100, projectNames.length * 15);

  if (projectNames.length >= 4) {
    talents.push({
      tag: 'Cross-Functional',
      evidence: `Contributed to ${projectNames.length} different projects across ${departments.length} area(s)`,
      score: versatilityScore,
    });
  }

  // Leadership signal
  const leadershipSignal = myRecords.some(r =>
    r.project_position === 'Lead' || r.project_position === 'Core Contributor' ||
    textContains(r.contribution_summary || '', LEADERSHIP_KEYWORDS)
  );
  if (leadershipSignal) {
    const leadProjects = myRecords.filter(r => r.project_position === 'Lead' || r.project_position === 'Core Contributor');
    talents.push({
      tag: 'Leadership Potential',
      evidence: leadProjects.length > 0
        ? `Lead/Core Contributor on ${leadProjects.length} project(s): ${leadProjects.map(r => r.project_name).slice(0, 2).join(', ')}`
        : `Contribution summaries indicate leadership: ${myRecords.find(r => textContains(r.contribution_summary || '', LEADERSHIP_KEYWORDS))?.contribution_summary?.slice(0, 80)}...`,
      score: Math.min(100, 60 + leadProjects.length * 10),
    });
  }

  // Mentor signal
  const mentorSignal = myRecords.some(r => textContains(r.contribution_summary || '', MENTOR_KEYWORDS));
  if (mentorSignal) {
    const mentorRecord = myRecords.find(r => textContains(r.contribution_summary || '', MENTOR_KEYWORDS));
    talents.push({
      tag: 'Mentor / Knowledge Sharer',
      evidence: mentorRecord?.contribution_summary?.slice(0, 100) || 'Mentoring activities detected',
      score: 75,
    });
  }

  // Innovator signal
  const innovatorSignal = myRecords.some(r => textContains(r.contribution_summary || '', INNOVATOR_KEYWORDS));
  if (innovatorSignal) {
    const innovatorRecords = myRecords.filter(r => textContains(r.contribution_summary || '', INNOVATOR_KEYWORDS));
    const bestInnovation = innovatorRecords.sort((a, b) => b.performance_in_project - a.performance_in_project)[0];
    talents.push({
      tag: 'Builder / Innovator',
      evidence: bestInnovation?.contribution_summary?.slice(0, 100) || 'Innovation activities detected',
      score: Math.min(100, 55 + innovatorRecords.length * 10),
    });
  }

  // Peak performance project
  const completedOrActive = myRecords.filter(r => r.performance_in_project > 0);
  const peakProject = completedOrActive.sort((a, b) => b.performance_in_project - a.performance_in_project)[0];
  const peakPerformanceProject = peakProject ? {
    name: peakProject.project_name,
    score: peakProject.performance_in_project,
    contribution: peakProject.contribution_summary || '',
  } : null;

  if (peakProject && peakProject.performance_in_project >= 4.5) {
    talents.push({
      tag: 'Star Performer',
      evidence: `Scored ${peakProject.performance_in_project}/5.0 on "${peakProject.project_name}": ${peakProject.contribution_summary?.slice(0, 80)}`,
      score: Math.round(peakProject.performance_in_project * 20),
    });
  }

  // Consistency: high avg across all projects
  const avgPerf = completedOrActive.reduce((s, r) => s + r.performance_in_project, 0) / Math.max(completedOrActive.length, 1);
  const consistencyScore = Math.round((avgPerf / 5) * 100);

  if (avgPerf >= 4.0 && completedOrActive.length >= 3) {
    talents.push({
      tag: 'Consistent High Performer',
      evidence: `Avg ${avgPerf.toFixed(1)}/5.0 across ${completedOrActive.length} projects`,
      score: consistencyScore,
    });
  }

  // Deliverables diversity
  const deliverables = [...new Set(myRecords.map(r => r.key_deliverable).filter(Boolean))];
  if (deliverables.length >= 4) {
    talents.push({
      tag: 'Versatile Contributor',
      evidence: `Delivered diverse outputs: ${deliverables.slice(0, 3).join(', ')}`,
      score: Math.min(100, deliverables.length * 18),
    });
  }

  // Cross-functional skills (skills from other domains)
  const crossFunctionalSkills = hiddenSkills.filter(s =>
    !['documentation', 'jira', 'analysis', 'reporting', 'testing'].includes(s)
  );

  return {
    employeeId,
    talents: talents.sort((a, b) => b.score - a.score),
    crossFunctionalSkills,
    peakPerformanceProject,
    leadershipSignal,
    mentorSignal,
    innovatorSignal,
    versatilityScore,
    consistencyScore,
    hiddenSkills,
  };
}

export function analyzeAllEmployees(
  records: ProjectRecord[],
  employees: { employee_id: string; technical_skills: string }[]
): Map<string, EmployeeTalentProfile> {
  const map = new Map<string, EmployeeTalentProfile>();
  employees.forEach(emp => {
    map.set(emp.employee_id, analyzeEmployeeTalents(emp.employee_id, records, emp.technical_skills));
  });
  return map;
}
