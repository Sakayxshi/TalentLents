import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard } from '@/components/ui/MetricCard';

const internalUpskilling = [
  { name: 'K. Weber', from: 'Mechanical Eng.', to: 'Battery Engineer', training: '€4,200', cert: '€1,500', total: '€5,700' },
  { name: 'L. Fischer', from: 'Data Analyst', to: 'Data Scientist', training: '€3,800', cert: '€900', total: '€4,700' },
  { name: 'M. Braun', from: 'Process Eng.', to: 'Automation Eng.', training: '€5,100', cert: '€1,200', total: '€6,300' },
];

const externalRecruiting = [
  { role: 'Battery Engineer', feePercent: '18%', fee: '€16,200', salary: '€90,000', onboarding: '€3,500' },
  { role: 'Data Scientist', feePercent: '20%', fee: '€17,000', salary: '€85,000', onboarding: '€3,000' },
  { role: 'Quality Engineer', feePercent: '15%', fee: '€12,000', salary: '€80,000', onboarding: '€2,800' },
  { role: 'Automation Engineer', feePercent: '18%', fee: '€16,200', salary: '€90,000', onboarding: '€3,500' },
];

export default function CostsPage() {
  const { scenarios, selectedScenarioId } = useStore();

  return (
    <div>
      <PageHeader title="Internal & External Costs" subtitle="Comprehensive cost breakdown" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Cost" value="€2.4M" />
        <MetricCard label="Internal Total" value="€890k" subtitle="Upskilling + reallocation" />
        <MetricCard label="External Total" value="€1.51M" subtitle="Recruiting + salaries" />
        <MetricCard label="Cost Per Head" value="€25.2k" subtitle="Average" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Internal */}
        <div className="card-surface p-5">
          <h3 className="font-semibold text-foreground mb-4">Internal Costs</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Upskilling</p>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-xs text-muted-foreground">Name</th>
                <th className="text-left p-2 text-xs text-muted-foreground">Path</th>
                <th className="text-right p-2 text-xs text-muted-foreground">Training</th>
                <th className="text-right p-2 text-xs text-muted-foreground">Cert</th>
                <th className="text-right p-2 text-xs text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {internalUpskilling.map(r => (
                <tr key={r.name} className="border-b border-border">
                  <td className="p-2 text-foreground">{r.name}</td>
                  <td className="p-2 text-muted-foreground text-xs">{r.from} → {r.to}</td>
                  <td className="p-2 text-right text-foreground">{r.training}</td>
                  <td className="p-2 text-right text-foreground">{r.cert}</td>
                  <td className="p-2 text-right font-medium text-foreground">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">€16,700</span>
          </div>
        </div>

        {/* External */}
        <div className="card-surface p-5">
          <h3 className="font-semibold text-foreground mb-4">External Costs</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Recruiting & First-Year</p>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-xs text-muted-foreground">Role</th>
                <th className="text-right p-2 text-xs text-muted-foreground">Fee</th>
                <th className="text-right p-2 text-xs text-muted-foreground">Salary</th>
                <th className="text-right p-2 text-xs text-muted-foreground">Onboard</th>
              </tr>
            </thead>
            <tbody>
              {externalRecruiting.map(r => (
                <tr key={r.role} className="border-b border-border">
                  <td className="p-2 text-foreground">{r.role}</td>
                  <td className="p-2 text-right text-foreground">{r.fee}</td>
                  <td className="p-2 text-right text-foreground">€{Number(r.salary.replace(/[€,]/g, '')).toLocaleString()}</td>
                  <td className="p-2 text-right text-foreground">{r.onboarding}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">€406,200</span>
          </div>
        </div>
      </div>

      {/* Scenario comparison */}
      {scenarios.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {scenarios.map(s => (
            <div key={s.id} className={`card-surface p-5 ${selectedScenarioId === s.id ? 'ring-2 ring-primary' : ''}`}>
              <h4 className="font-semibold text-foreground mb-2">{s.label}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Cost</span><span className="text-foreground font-medium">{s.costEstimate}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Headcount</span><span className="text-foreground">{s.totalHeadcount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Timeline</span><span className="text-foreground">{s.timeline}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-surface p-5">
        <h3 className="font-semibold text-foreground mb-3">AI Cost Insights</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Based on current market conditions and BMW's internal capabilities, the optimal approach combines 
          upskilling 18 existing employees (saving ~€1.2M vs full external hiring) with targeted external recruitment 
          for 13 critical roles. Prioritizing internal battery engineering talent for upskilling yields the highest ROI, 
          with an estimated 42% cost savings and 3-month faster time-to-productivity compared to external alternatives.
        </p>
      </div>
    </div>
  );
}
