import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { getRecruitingWeeks } from '@/lib/scoring';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TimelinePage() {
  const { projectConfig, employees, roster, upskillCandidates, externalCandidates, shortlistedCandidates, scenarios, selectedScenarioId, markPageComplete } = useStore();

  const scenario = scenarios.find(s => s.id === selectedScenarioId);

  // Compute timeline entries dynamically
  const { timelineData, phases, readyByMonth, dayOneCount, bottleneck } = useMemo(() => {
    if (!scenario) return { timelineData: [], phases: [], readyByMonth: 0, dayOneCount: 0, bottleneck: 'N/A' };

    const entries: { name: string; lane: 'internal' | 'upskill' | 'external'; start: number; duration: number; color: string }[] = [];
    let maxEnd = 0;

    // Internal roster members
    const rosterEmps = employees.filter(e => roster.includes(e.employee_id));
    const isUpskilling = (id: string) => upskillCandidates.some(u => u.employeeId === id);

    let immediateCount = 0;

    rosterEmps.forEach(e => {
      if (isUpskilling(e.employee_id)) return; // handled in upskill lane
      let startMonth = 0;
      let handoverDuration = 0;
      if (e.project_position === 'Lead' || e.project_position === 'Core Contributor') {
        startMonth = 1;
        handoverDuration = 1;
      } else if (e.project_position === 'Contributor') {
        startMonth = 0.5;
        handoverDuration = 0.5;
      } else {
        immediateCount++;
      }
      const activeDuration = 6;
      if (handoverDuration > 0) {
        entries.push({ name: `${e.name} (handover)`, lane: 'internal', start: startMonth, duration: handoverDuration, color: 'bg-primary/40' });
      }
      entries.push({ name: `${e.name}`, lane: 'internal', start: startMonth + handoverDuration, duration: activeDuration, color: 'bg-primary' });
      maxEnd = Math.max(maxEnd, startMonth + handoverDuration + activeDuration);
    });

    // Upskill candidates
    upskillCandidates.filter(u => u.approved).forEach(u => {
      const emp = employees.find(e => e.employee_id === u.employeeId);
      const trainingWeeks = u.totalWeeks || 8;
      const trainingMonths = Math.ceil(trainingWeeks / 4);
      entries.push({ name: `${emp?.name || 'Unknown'} (training)`, lane: 'upskill', start: 0, duration: trainingMonths, color: 'bg-warning' });
      entries.push({ name: `${emp?.name || 'Unknown'} (active)`, lane: 'upskill', start: trainingMonths, duration: 6, color: 'bg-success' });
      maxEnd = Math.max(maxEnd, trainingMonths + 6);
    });

    // External candidates
    const shortlisted = externalCandidates.filter(c => shortlistedCandidates.includes(c.id));
    shortlisted.forEach(c => {
      const recruitWeeks = getRecruitingWeeks(c.current_role);
      const recruitMonths = Math.ceil(recruitWeeks / 4);
      const noticeMonths = Math.ceil(c.notice_period_weeks / 4);
      const onboardMonths = 1;
      entries.push({ name: `Recruit: ${c.name}`, lane: 'external', start: 0, duration: recruitMonths, color: 'bg-muted-foreground/30' });
      entries.push({ name: `Notice: ${c.name}`, lane: 'external', start: recruitMonths, duration: noticeMonths, color: 'bg-score-amber/40' });
      entries.push({ name: `${c.name} (active)`, lane: 'external', start: recruitMonths + noticeMonths + onboardMonths, duration: 4, color: 'bg-success' });
      maxEnd = Math.max(maxEnd, recruitMonths + noticeMonths + onboardMonths + 4);
    });

    // If no entries, add defaults
    if (entries.length === 0) {
      entries.push({ name: 'No team configured', lane: 'internal', start: 0, duration: 1, color: 'bg-muted' });
    }

    // Compute phases
    const totalPeople = rosterEmps.length + upskillCandidates.filter(u => u.approved).length + shortlisted.length;
    const q1People = immediateCount + rosterEmps.filter(e => e.project_position === 'Contributor' && !isUpskilling(e.employee_id)).length;
    const q2People = q1People + rosterEmps.filter(e => ['Core Contributor', 'Lead'].includes(e.project_position) && !isUpskilling(e.employee_id)).length;
    const q3People = q2People + upskillCandidates.filter(u => u.approved).length;
    const q4People = totalPeople;

    const phaseData = [
      { label: 'Q1 2026', title: 'Foundation', desc: `Internal team assembled. ${q1People} people active.`, people: q1People },
      { label: 'Q2 2026', title: 'Scaling', desc: `Senior handovers complete. Upskilling underway. ${q2People} people.`, people: q2People },
      { label: 'Q3 2026', title: 'Full Capacity', desc: `External hires onboarded. Upskill cohort certified. ${q3People} people.`, people: q3People },
      { label: 'Q4 2026', title: 'Optimization', desc: `Full team of ${q4People}. Performance tuning.`, people: q4People },
    ];

    const longestExternal = shortlisted.length > 0 ? Math.max(...shortlisted.map(c => Math.ceil(getRecruitingWeeks(c.current_role) / 4) + Math.ceil(c.notice_period_weeks / 4) + 1)) : 0;
    const longestUpskill = upskillCandidates.filter(u => u.approved).length > 0 ? Math.max(...upskillCandidates.filter(u => u.approved).map(u => Math.ceil((u.totalWeeks || 8) / 4))) : 0;

    return {
      timelineData: entries,
      phases: phaseData,
      readyByMonth: Math.max(longestExternal, longestUpskill, 3),
      dayOneCount: q1People,
      bottleneck: longestExternal > longestUpskill ? 'External Recruiting' : 'Upskilling Pipeline',
    };
  }, [scenario, employees, roster, upskillCandidates, externalCandidates, shortlistedCandidates]);

  // Parse deadline month
  const deadlineMonth = useMemo(() => {
    if (!projectConfig?.targetDeadline) return 8;
    const q = projectConfig.targetDeadline.split(' ')[0];
    return { Q1: 2, Q2: 5, Q3: 8, Q4: 11 }[q] || 8;
  }, [projectConfig]);

  const readyDate = months[Math.min(readyByMonth, 11)];
  const readyYear = readyByMonth > 11 ? 2027 : 2026;
  const isOnTrack = readyByMonth <= deadlineMonth;

  if (!scenario) {
    return (
      <div>
        <PageHeader title="Timeline" />
        <div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario first.</p></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Timeline" subtitle="Project staffing timeline and milestones" />

      <div className="card-surface p-6 mb-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Team Ready By</p>
        <p className={`text-3xl font-bold ${isOnTrack ? 'text-success' : 'text-destructive'}`}>{readyDate} {readyYear}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Target: {projectConfig?.targetDeadline || 'Not set'} {isOnTrack ? '✓ On track' : '⚠ At risk'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard label="Months to Full Capacity" value={readyByMonth} />
        <MetricCard label="People on Day One" value={dayOneCount} />
        <MetricCard label="Critical Path" value={bottleneck} subtitle="Bottleneck" />
      </div>

      {/* Gantt chart */}
      <div className="card-surface p-5 mb-6 overflow-x-auto">
        <h3 className="font-semibold text-foreground mb-4">Gantt Chart</h3>
        <div className="min-w-[800px]">
          <div className="flex mb-2 ml-32">
            {months.map((m, i) => (
              <div key={m} className="flex-1 text-xs text-muted-foreground text-center relative">
                {m}
                {i === deadlineMonth && <div className="absolute top-6 left-1/2 w-0.5 h-[120px] bg-destructive/50 border-l border-dashed border-destructive" />}
              </div>
            ))}
          </div>

          {(['internal', 'upskill', 'external'] as const).map(lane => {
            const laneItems = timelineData.filter(t => t.lane === lane);
            return (
              <div key={lane} className="flex items-center mb-1">
                <div className="w-32 text-xs text-muted-foreground capitalize pr-2 shrink-0">
                  {lane === 'upskill' ? 'Upskilling' : lane === 'internal' ? 'Internal' : 'External'}
                </div>
                <div className="flex-1 relative h-8">
                  {laneItems.slice(0, 6).map((t, i) => (
                    <div
                      key={i}
                      className={`absolute h-6 top-1 rounded ${t.color} flex items-center px-2`}
                      style={{ left: `${(t.start / 12) * 100}%`, width: `${Math.max(0.5, t.duration) / 12 * 100}%` }}
                      title={t.name}
                    >
                      <span className="text-[10px] text-foreground truncate">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {phases.map(p => (
          <div key={p.label} className="card-surface p-4">
            <Badge variant="badge-blue">{p.label}</Badge>
            <h4 className="font-semibold text-foreground mt-2">{p.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
            <p className="text-lg font-bold text-foreground mt-2">{p.people} <span className="text-xs text-muted-foreground font-normal">people</span></p>
          </div>
        ))}
      </div>

      {/* Risk timeline */}
      <div className="card-surface p-5">
        <h3 className="font-semibold text-foreground mb-3">Risk Alerts by Phase</h3>
        <div className="space-y-2">
          {scenario.roles.filter(r => r.gap > r.headcount * 0.3).slice(0, 2).map((r, i) => (
            <div key={r.role} className="flex items-center gap-3 text-sm">
              <Badge variant="badge-red">Month {i + 2}</Badge>
              <span className="text-foreground">{r.role} shortage ({r.gap} unfilled) may delay critical workstreams</span>
            </div>
          ))}
          {externalCandidates.filter(c => shortlistedCandidates.includes(c.id) && c.notice_period_weeks > 8).length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="badge-amber">Month 4</Badge>
              <span className="text-foreground">External candidate notice periods could cause onboarding gaps</span>
            </div>
          )}
          {upskillCandidates.filter(u => u.approved).length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="badge-green">Month {readyByMonth}</Badge>
              <span className="text-foreground">Upskill cohort completes training — additional capacity unlocked</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
