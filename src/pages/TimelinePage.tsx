import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const timelineData = [
  { name: 'Internal Team Onboarding', lane: 'internal', start: 0, duration: 2, color: 'bg-primary' },
  { name: 'Battery Engineers Handover', lane: 'internal', start: 1, duration: 3, color: 'bg-primary/60' },
  { name: 'Data Science Team Active', lane: 'internal', start: 2, duration: 6, color: 'bg-primary' },
  { name: 'Upskill: Battery Training', lane: 'upskill', start: 0, duration: 3, color: 'bg-warning' },
  { name: 'Upskill: Certification', lane: 'upskill', start: 3, duration: 2, color: 'bg-success' },
  { name: 'Upskill: Quality Engineers', lane: 'upskill', start: 1, duration: 4, color: 'bg-warning' },
  { name: 'Recruiting: Battery Eng.', lane: 'external', start: 0, duration: 2, color: 'bg-muted-foreground/30' },
  { name: 'Notice Period', lane: 'external', start: 2, duration: 2, color: 'bg-score-amber/40' },
  { name: 'External Onboarded', lane: 'external', start: 4, duration: 4, color: 'bg-success' },
];

const phases = [
  { label: 'Q1 2026', title: 'Foundation', desc: 'Internal team assembled, upskilling begins. 45 people onboarded.', people: 45 },
  { label: 'Q2 2026', title: 'Scaling', desc: 'First external hires arrive. Upskill cohort 1 certified. 68 people.', people: 68 },
  { label: 'Q3 2026', title: 'Full Capacity', desc: 'All external hires onboarded. Team at full capacity. 89 people.', people: 89 },
  { label: 'Q4 2026', title: 'Optimization', desc: 'Performance tuning, final certifications. Full team of 95.', people: 95 },
];

const deadlineMonth = 8; // September

export default function TimelinePage() {
  const { projectConfig } = useStore();

  return (
    <div>
      <PageHeader title="Timeline" subtitle="Project staffing timeline and milestones" />

      <div className="card-surface p-6 mb-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Team Ready By</p>
        <p className="text-3xl font-bold text-success">September 2026</p>
        <p className="text-sm text-muted-foreground mt-1">
          {projectConfig?.targetDeadline ? `Target: ${projectConfig.targetDeadline}` : 'On track with projected timeline'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard label="Months to Full Capacity" value="9" />
        <MetricCard label="People on Day One" value="45" />
        <MetricCard label="Critical Path" value="External Recruiting" subtitle="Bottleneck" />
      </div>

      {/* Gantt chart */}
      <div className="card-surface p-5 mb-6 overflow-x-auto">
        <h3 className="font-semibold text-foreground mb-4">Gantt Chart</h3>
        <div className="min-w-[800px]">
          {/* Month headers */}
          <div className="flex mb-2 ml-32">
            {months.map((m, i) => (
              <div key={m} className="flex-1 text-xs text-muted-foreground text-center relative">
                {m}
                {i === deadlineMonth && <div className="absolute top-6 left-1/2 w-0.5 h-[200px] bg-destructive/50 border-l border-dashed border-destructive" />}
              </div>
            ))}
          </div>

          {/* Lanes */}
          {(['internal', 'upskill', 'external'] as const).map(lane => (
            <div key={lane} className="flex items-center mb-1">
              <div className="w-32 text-xs text-muted-foreground capitalize pr-2 shrink-0">{lane === 'upskill' ? 'Upskilling' : lane === 'internal' ? 'Internal' : 'External'}</div>
              <div className="flex-1 relative h-8">
                {timelineData.filter(t => t.lane === lane).map((t, i) => (
                  <div
                    key={i}
                    className={`absolute h-6 top-1 rounded ${t.color} flex items-center px-2`}
                    style={{ left: `${(t.start / 12) * 100}%`, width: `${(t.duration / 12) * 100}%` }}
                    title={t.name}
                  >
                    <span className="text-[10px] text-foreground truncate">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="badge-red">Month 2</Badge>
            <span className="text-foreground">Battery Engineer shortage may delay cell production line setup</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="badge-amber">Month 4</Badge>
            <span className="text-foreground">External candidate notice periods could cause 4-week gap</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="badge-green">Month 7</Badge>
            <span className="text-foreground">First upskill cohort completes certification — capacity unlocked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
