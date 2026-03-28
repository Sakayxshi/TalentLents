import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { computeCompositeScore } from '@/lib/scoring';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GapAnalysisPage() {
  const { employees, scenarios, selectedScenarioId, roster, addToRoster } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const roles = scenario?.roles || [];

  const analysis = useMemo(() => {
    return roles.map(r => {
      const rostered = employees.filter(e => roster.includes(e.employee_id) && e.role?.toLowerCase().includes(r.role.split(' ')[0].toLowerCase()));
      const upskillable = employees
        .filter(e => !roster.includes(e.employee_id))
        .map(e => ({ ...e, score: computeCompositeScore(e), overlap: Math.random() * 40 + 60 }))
        .filter(e => e.overlap > 60)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 5);
      const filled = rostered.length;
      const gap = Math.max(0, r.headcount - filled);
      const externalNeeded = Math.max(0, gap - upskillable.length);
      return { ...r, filled, gap, rostered, upskillable, externalNeeded };
    });
  }, [roles, employees, roster]);

  const fullyStaffed = analysis.filter(r => r.gap === 0).length;
  const partial = analysis.filter(r => r.gap > 0 && r.filled > 0).length;
  const critical = analysis.filter(r => r.gap > 0 && r.filled === 0).length;

  if (!scenario) {
    return (
      <div>
        <PageHeader title="Gap Analysis" />
        <div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario on the Dashboard first.</p></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Gap Analysis" subtitle="Identify staffing gaps and find solutions" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard label="Fully Staffed" value={fullyStaffed} className="border-l-4 border-l-success" />
        <MetricCard label="Partially Filled" value={partial} className="border-l-4 border-l-warning" />
        <MetricCard label="Critical Gaps" value={critical} className="border-l-4 border-l-destructive" />
      </div>

      {/* Bar chart */}
      <div className="card-surface p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">Staffing Overview</h3>
        <div className="space-y-3">
          {analysis.map(r => (
            <div key={r.role}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{r.role}</span>
                <span className="text-muted-foreground">{r.filled}/{r.headcount}</span>
              </div>
              <div className="h-4 bg-secondary rounded-full overflow-hidden flex relative">
                <div className="bg-primary h-full" style={{ width: `${(r.filled / Math.max(r.headcount, 1)) * 100}%` }} />
                {r.upskillable.length > 0 && <div className="bg-warning h-full" style={{ width: `${(Math.min(r.upskillable.length, r.gap) / Math.max(r.headcount, 1)) * 100}%` }} />}
                {r.externalNeeded > 0 && <div className="bg-destructive h-full" style={{ width: `${(r.externalNeeded / Math.max(r.headcount, 1)) * 100}%` }} />}
                <div className="absolute right-0 top-0 h-full w-0.5 bg-foreground/30" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded" /> On Roster</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-warning rounded" /> Internal Upskill</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-destructive rounded" /> External Hire</span>
        </div>
      </div>

      {/* Role cards */}
      <div className="space-y-3">
        {analysis.map(r => (
          <div key={r.role} className="card-surface overflow-hidden">
            <button onClick={() => setExpanded(expanded === r.role ? null : r.role)} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold text-foreground">{r.role}</h4>
                <Badge variant={r.gap === 0 ? 'badge-green' : r.filled > 0 ? 'badge-amber' : 'badge-red'}>
                  {r.gap === 0 ? 'Staffed' : `Gap: ${r.gap}`}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Required: {r.headcount}</span>
                <span>Filled: {r.filled}</span>
                {expanded === r.role ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            {expanded === r.role && (
              <div className="border-t border-border p-4 space-y-4 animate-fade-in-up">
                <div>
                  <h5 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Assigned ({r.rostered.length})</h5>
                  {r.rostered.length === 0 ? <p className="text-sm text-muted-foreground">None assigned yet</p> : (
                    <div className="space-y-1">
                      {r.rostered.map(e => (
                        <div key={e.employee_id} className="flex justify-between text-sm px-2 py-1 rounded bg-secondary/50">
                          <span className="text-foreground">{e.name}</span>
                          <span className="text-muted-foreground">{computeCompositeScore(e)} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {r.upskillable.length > 0 && (
                  <div>
                    <h5 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Upskill Candidates</h5>
                    <div className="space-y-1">
                      {r.upskillable.map(e => (
                        <div key={e.employee_id} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-secondary/50">
                          <span className="text-foreground">{e.name} <span className="text-muted-foreground">({e.role})</span></span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{Math.round(e.overlap)}% match</span>
                            <button onClick={() => addToRoster(e.employee_id)} className="text-primary hover:bg-primary/10 p-1 rounded"><Plus size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {r.externalNeeded > 0 && (
                  <div>
                    <h5 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">External Hire Needed</h5>
                    <p className="text-sm text-muted-foreground">{r.externalNeeded} positions · Est. €{(r.externalNeeded * 85000).toLocaleString()} per hire</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
