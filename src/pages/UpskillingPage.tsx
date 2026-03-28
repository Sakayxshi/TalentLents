import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X, ArrowRight } from 'lucide-react';

const trainingPaths = [
  { course: 'Battery Systems Fundamentals', duration: '4 weeks', cost: '€2,800', method: 'Online' },
  { course: 'Advanced Cell Chemistry', duration: '3 weeks', cost: '€4,200', method: 'In-person' },
  { course: 'GMP & Safety Certification', duration: '2 weeks', cost: '€1,500', method: 'Hybrid' },
];

export default function UpskillingPage() {
  const { employees, upskillCandidates, addUpskillCandidate, removeUpskillCandidate } = useStore();

  const candidates = useMemo(() => {
    return employees.slice(0, 20).map((e, i) => ({
      ...e,
      targetRole: ['Battery Engineer', 'Data Scientist', 'Quality Engineer', 'Automation Engineer'][i % 4],
      skillOverlap: Math.round(55 + Math.random() * 35),
      timeToReady: `${Math.round(6 + Math.random() * 12)} weeks`,
      cost: `€${Math.round(5000 + Math.random() * 10000).toLocaleString()}`,
      hasSkills: e.technical_skills?.split(',').slice(0, 3).map(s => s.trim()) || [],
      needsSkills: ['Battery Chemistry', 'Cell Design', 'Thermal Management'].slice(0, Math.floor(Math.random() * 3) + 1),
    }));
  }, [employees]);

  const approved = candidates.filter(c => upskillCandidates.includes(c.employee_id));

  return (
    <div>
      <PageHeader title="Upskilling Paths" subtitle="Training plans for internal candidates" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Candidates" value={candidates.length} />
        <MetricCard label="Avg Time to Ready" value="8 weeks" />
        <MetricCard label="Total Budget" value={`€${(approved.length * 8500).toLocaleString()}`} />
        <MetricCard label="Savings vs External" value="42%" subtitle="Compared to external hires" />
      </div>

      {candidates.length === 0 ? (
        <div className="card-surface p-12 text-center"><p className="text-muted-foreground">Upload employee data to see candidates.</p></div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {candidates.slice(0, 12).map(c => {
            const isApproved = upskillCandidates.includes(c.employee_id);
            return (
              <div key={c.employee_id} className="card-surface p-5 animate-fade-in-up">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{c.name}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">{c.role} <ArrowRight size={12} /> {c.targetRole}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{c.timeToReady}</p>
                    <p className="text-sm font-medium text-foreground">{c.cost}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Skill Overlap</span>
                    <span className="text-foreground">{c.skillOverlap}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${c.skillOverlap}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {c.hasSkills.map(s => <span key={s} className="px-2 py-0.5 text-xs rounded badge-green">{s}</span>)}
                  {c.needsSkills.map(s => <span key={s} className="px-2 py-0.5 text-xs rounded badge-red">{s}</span>)}
                </div>

                <div className="border-t border-border pt-3 mb-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Training Path</p>
                  <div className="space-y-1.5">
                    {trainingPaths.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-medium">{i + 1}</span>
                        <span className="text-foreground flex-1">{t.course}</span>
                        <span className="text-muted-foreground">{t.duration}</span>
                        <Badge variant="badge-blue">{t.method}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant={isApproved ? 'outline' : 'default'} className="flex-1" onClick={() => isApproved ? removeUpskillCandidate(c.employee_id) : addUpskillCandidate(c.employee_id)}>
                    {isApproved ? <><CheckCircle2 size={14} className="mr-1" /> Approved</> : 'Approve'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive"><X size={14} /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
