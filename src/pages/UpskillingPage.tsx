import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X, ArrowRight, Sparkles } from 'lucide-react';
import { getSkillOverlap, getMissingSkills, getMatchedSkills } from '@/lib/scoring';
import { useToast } from '@/hooks/use-toast';
import { invokeAI, GeneratedTrainingPaths } from '@/lib/aiService';


export default function UpskillingPage() {
  const { employees, upskillCandidates, addUpskillCandidate, approveUpskill, removeUpskillCandidate, roster, scenarios, selectedScenarioId, setUpskillTrainingPath, markPageComplete } = useStore();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const roles = scenario?.roles || [];

  const candidates = useMemo(() => {
    if (roles.length === 0) return [];
    return roles.flatMap(role => {
      return employees
        .filter(e => !roster.includes(e.employee_id) || upskillCandidates.some(u => u.employeeId === e.employee_id))
        .map(e => {
          const empSkills = (e.technical_skills || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
          const overlap = getSkillOverlap(empSkills, role.requiredSkills);
          const missing = getMissingSkills(empSkills, role.requiredSkills);
          const matched = getMatchedSkills(empSkills, role.requiredSkills);

          // Generate training path based on missing skills
          const path = trainingCourses.filter(course =>
            course.skills.some(cs => missing.some(ms => ms.toLowerCase().includes(cs) || cs.includes(ms.toLowerCase())))
          ).slice(0, 4);
          const totalCost = path.reduce((s, c) => s + c.cost, 0);
          const totalWeeks = path.reduce((s, c) => s + c.weeks, 0);

          return {
            ...e,
            targetRole: role.role,
            overlap: Math.round(overlap * 100),
            missingSkills: missing,
            matchedSkills: matched,
            trainingPath: path.map(p => ({
              course: p.name, duration: `${p.weeks} weeks`, cost: p.cost, method: p.method, coversSkills: p.skills,
            })),
            totalCost,
            totalWeeks,
          };
        })
        .filter(e => e.overlap >= 40 && e.overlap < 95)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 4);
    });
  }, [employees, roles, roster, upskillCandidates]);

  // Deduplicate by employee
  const uniqueCandidates = useMemo(() => {
    const seen = new Set<string>();
    return candidates.filter(c => {
      if (seen.has(c.employee_id)) return false;
      seen.add(c.employee_id);
      return true;
    });
  }, [candidates]);

  const approved = upskillCandidates.filter(c => c.approved);
  const totalBudget = approved.reduce((s, c) => {
    const cand = uniqueCandidates.find(u => u.employee_id === c.employeeId);
    return s + (cand?.totalCost || c.totalCost || 0);
  }, 0);
  const avgTime = uniqueCandidates.length > 0 ? Math.round(uniqueCandidates.reduce((s, c) => s + c.totalWeeks, 0) / uniqueCandidates.length) : 0;

  if (roles.length === 0) {
    return (
      <div>
        <PageHeader title="Upskilling Paths" />
        <div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario on the Dashboard first.</p></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Upskilling Paths" subtitle="Training plans for internal candidates">
        <div className="flex gap-2">
          <Button size="sm" variant={viewMode === 'card' ? 'default' : 'outline'} onClick={() => setViewMode('card')}>Cards</Button>
          <Button size="sm" variant={viewMode === 'table' ? 'default' : 'outline'} onClick={() => setViewMode('table')}>Table</Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Candidates" value={uniqueCandidates.length} />
        <MetricCard label="Avg Time to Ready" value={`${avgTime} weeks`} />
        <MetricCard label="Total Budget" value={`€${totalBudget.toLocaleString()}`} />
        <MetricCard label="Savings vs External" value={uniqueCandidates.length > 0 ? `${Math.round((1 - totalBudget / (uniqueCandidates.length * 85000)) * 100)}%` : '—'} subtitle="Compared to external hires" />
      </div>

      {viewMode === 'table' ? (
        <div className="card-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs text-muted-foreground">Name</th>
                <th className="text-left p-3 text-xs text-muted-foreground">Current Role</th>
                <th className="text-left p-3 text-xs text-muted-foreground">Target Role</th>
                <th className="text-left p-3 text-xs text-muted-foreground">Skill Match</th>
                <th className="text-left p-3 text-xs text-muted-foreground">Time</th>
                <th className="text-left p-3 text-xs text-muted-foreground">Cost</th>
                <th className="text-left p-3 text-xs text-muted-foreground">Risk</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {uniqueCandidates.map(c => {
                const isApproved = upskillCandidates.some(u => u.employeeId === c.employee_id && u.approved);
                return (
                  <tr key={c.employee_id} className="border-b border-border hover:bg-secondary/30">
                    <td className="p-3 text-foreground font-medium">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.role}</td>
                    <td className="p-3 text-foreground">{c.targetRole}</td>
                    <td className="p-3"><span className={c.overlap >= 70 ? 'score-green' : 'score-amber'}>{c.overlap}%</span></td>
                    <td className="p-3 text-muted-foreground">{c.totalWeeks}w</td>
                    <td className="p-3 text-foreground">€{c.totalCost.toLocaleString()}</td>
                    <td className="p-3"><Badge variant={c.flight_risk?.toLowerCase() === 'high' ? 'badge-red' : c.flight_risk?.toLowerCase() === 'medium' ? 'badge-amber' : 'badge-green'}>{c.flight_risk}</Badge></td>
                    <td className="p-3">
                      <Button size="sm" variant={isApproved ? 'outline' : 'default'} onClick={() => {
                        if (!isApproved) {
                          addUpskillCandidate({ employeeId: c.employee_id, targetRole: c.targetRole, approved: true, trainingPath: c.trainingPath, totalCost: c.totalCost, totalWeeks: c.totalWeeks });
                          markPageComplete(5);
                          toast({ title: 'Approved', description: `${c.name} approved for upskilling` });
                        } else {
                          removeUpskillCandidate(c.employee_id);
                        }
                      }}>
                        {isApproved ? 'Approved ✓' : 'Approve'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {uniqueCandidates.map(c => {
            const isApproved = upskillCandidates.some(u => u.employeeId === c.employee_id && u.approved);
            return (
              <div key={c.employee_id} className="card-surface p-5 animate-fade-in-up">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{c.name}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">{c.role} <ArrowRight size={12} /> {c.targetRole}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{c.totalWeeks} weeks</p>
                    <p className="text-sm font-medium text-foreground">€{c.totalCost.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Skill Overlap</span>
                    <span className="text-foreground">{c.overlap}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${c.overlap}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {c.matchedSkills.map(s => <span key={s} className="px-2 py-0.5 text-xs rounded badge-green">{s}</span>)}
                  {c.missingSkills.map(s => <span key={s} className="px-2 py-0.5 text-xs rounded badge-red">{s}</span>)}
                </div>

                <div className="border-t border-border pt-3 mb-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Training Path</p>
                  <div className="space-y-1.5">
                    {c.trainingPath.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-medium">{i + 1}</span>
                        <span className="text-foreground flex-1">{t.course}</span>
                        <span className="text-muted-foreground">{t.duration}</span>
                        <span className="text-muted-foreground">€{t.cost.toLocaleString()}</span>
                        <Badge variant="badge-blue">{t.method}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant={isApproved ? 'outline' : 'default'} className="flex-1" onClick={() => {
                    if (!isApproved) {
                      addUpskillCandidate({ employeeId: c.employee_id, targetRole: c.targetRole, approved: true, trainingPath: c.trainingPath, totalCost: c.totalCost, totalWeeks: c.totalWeeks });
                      markPageComplete(5);
                      toast({ title: 'Approved', description: `${c.name} approved for upskilling` });
                    } else {
                      removeUpskillCandidate(c.employee_id);
                    }
                  }}>
                    {isApproved ? <><CheckCircle2 size={14} className="mr-1" /> Approved</> : 'Approve'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { removeUpskillCandidate(c.employee_id); toast({ title: 'Removed' }); }}><X size={14} /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
