import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X, ArrowRight, Sparkles, RotateCcw } from 'lucide-react';
import { getSkillOverlap, getMissingSkills, getMatchedSkills } from '@/lib/scoring';
import { useToast } from '@/hooks/use-toast';
import { invokeAI, GeneratedTrainingPaths } from '@/lib/aiService';
import { buildTrainingPath, getSkillsAfterTraining } from '@/lib/bmw-training-catalogue';


export default function UpskillingPage() {
  const { employees, upskillCandidates, completedTrainings, addUpskillCandidate, approveUpskill, removeUpskillCandidate, roster, scenarios, selectedScenarioId, setUpskillTrainingPath, completeTraining, markPageComplete } = useStore();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [generatingPaths, setGeneratingPaths] = useState(false);
  const [aiTrainingPaths, setAiTrainingPaths] = useState<Record<string, { courses: any[]; totalCost: number; totalWeeks: number }>>({});

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

          // Use AI-generated training path if available, otherwise show placeholder
          const aiPath = aiTrainingPaths[e.employee_id];
          // Fallback: build path from BMW catalogue if no AI path yet
          const cataloguePath = buildTrainingPath(missing);
          const trainingPath = aiPath?.courses.map(c => ({
            course: c.course, duration: c.duration, cost: c.cost, method: c.method, coversSkills: c.coversSkills,
          })) || cataloguePath.courses.map(c => ({
            course: c.name, duration: `${c.duration_weeks}w`, cost: c.cost_eur, method: c.delivery, coversSkills: c.skillsGranted,
          }));
          const totalCost = aiPath?.totalCost ?? cataloguePath.totalCost;
          const totalWeeks = aiPath?.totalWeeks ?? cataloguePath.totalWeeks;

          return {
            ...e,
            targetRole: role.role,
            overlap: Math.round(overlap * 100),
            missingSkills: missing,
            matchedSkills: matched,
            trainingPath,
            totalCost,
            totalWeeks,
          };
        })
        .filter(e => e.overlap >= 40 && e.overlap < 95)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 4);
    });
  }, [employees, roles, roster, upskillCandidates, aiTrainingPaths]);

  const handleGenerateTrainingPaths = async () => {
    setGeneratingPaths(true);
    try {
      const candidatesPayload = uniqueCandidates.slice(0, 10).map(c => ({
        employeeId: c.employee_id,
        name: c.name,
        currentRole: c.role,
        targetRole: c.targetRole,
        currentSkills: c.technical_skills,
        missingSkills: c.missingSkills,
        overlap: c.overlap,
      }));

      const result = await invokeAI<GeneratedTrainingPaths>('generate-upskilling', { candidates: candidatesPayload });

      const pathMap: Record<string, { courses: any[]; totalCost: number; totalWeeks: number }> = {};
      result.trainingPaths.forEach(tp => {
        pathMap[tp.employeeId] = { courses: tp.courses, totalCost: tp.totalCost, totalWeeks: tp.totalWeeks };
      });
      setAiTrainingPaths(pathMap);
      toast({ title: 'AI Training Paths Generated', description: `${result.trainingPaths.length} personalized paths created` });
    } catch (err) {
      console.error('Training path generation failed:', err);
      toast({ title: 'Generation Failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setGeneratingPaths(false);
    }
  };

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
      <PageHeader title="Upskilling Paths" subtitle="AI-powered training plans for internal candidates">
        <div className="flex gap-2">
          <Button size="sm" onClick={handleGenerateTrainingPaths} disabled={generatingPaths || uniqueCandidates.length === 0}>
            <Sparkles size={14} className="mr-2" />{generatingPaths ? 'Generating...' : 'Generate AI Training Paths'}
          </Button>
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
                const isCompleted = completedTrainings.includes(c.employee_id);
                return (
                  <tr key={c.employee_id} className={`border-b border-border hover:bg-secondary/30 ${isCompleted ? 'opacity-60' : ''}`}>
                    <td className="p-3 text-foreground font-medium">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.role}</td>
                    <td className="p-3 text-foreground">{c.targetRole}</td>
                    <td className="p-3"><span className={c.overlap >= 70 ? 'score-green' : 'score-amber'}>{c.overlap}%</span></td>
                    <td className="p-3 text-muted-foreground">{c.totalWeeks}w</td>
                    <td className="p-3 text-foreground">€{c.totalCost.toLocaleString()}</td>
                    <td className="p-3"><Badge variant={c.flight_risk?.toLowerCase() === 'high' ? 'badge-red' : c.flight_risk?.toLowerCase() === 'medium' ? 'badge-amber' : 'badge-green'}>{c.flight_risk}</Badge></td>
                    <td className="p-3">
                      {isCompleted ? (
                        <span className="text-xs text-success font-medium flex items-center gap-1"><CheckCircle2 size={12} />Done</span>
                      ) : (
                        <div className="flex gap-1">
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
                          {isApproved && (
                            <Button size="sm" variant="outline" className="text-success border-success/40" onClick={() => {
                              const emp = employees.find(e2 => e2.employee_id === c.employee_id);
                              if (!emp) return;
                              const cataloguePath = buildTrainingPath(c.missingSkills);
                              const newSkills = getSkillsAfterTraining(emp.technical_skills, cataloguePath.courses);
                              completeTraining(c.employee_id, newSkills);
                              toast({ title: '✓ Complete', description: `${c.name} skills updated` });
                            }}>✓</Button>
                          )}
                        </div>
                      )}
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
            const isCompleted = completedTrainings.includes(c.employee_id);
            return (
              <div key={c.employee_id} className={`card-surface p-5 animate-fade-in-up ${isCompleted ? 'opacity-75 border-success/30' : ''}`}>
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
                  {c.trainingPath.length > 0 ? (
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
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Click "Generate AI Training Paths" to create a personalized plan</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {isCompleted ? (
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded bg-success/10 border border-success/30">
                      <CheckCircle2 size={14} className="text-success" />
                      <span className="text-xs text-success font-medium">Training Complete — Gap Analysis Updated</span>
                      <RotateCcw size={12} className="text-success ml-auto" />
                    </div>
                  ) : (
                    <>
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
                      {isApproved && (
                        <Button size="sm" variant="outline" className="text-success border-success/40 hover:bg-success/10" onClick={() => {
                          // LOOP: update employee skills → gap analysis recalculates automatically
                          const emp = employees.find(e2 => e2.employee_id === c.employee_id);
                          if (!emp) return;
                          const cataloguePath = buildTrainingPath(c.missingSkills);
                          const newSkills = getSkillsAfterTraining(emp.technical_skills, cataloguePath.courses);
                          completeTraining(c.employee_id, newSkills);
                          toast({ title: '✓ Training Completed', description: `${c.name}'s skills updated — Gap Analysis recalculated` });
                        }}>
                          <CheckCircle2 size={13} className="mr-1" />Mark Complete
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { removeUpskillCandidate(c.employee_id); toast({ title: 'Removed' }); }}><X size={14} /></Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
