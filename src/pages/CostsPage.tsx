import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { SALARY_BAND_MIDPOINTS, SALARY_BAND_WEEKLY, getOnboardingCost } from '@/lib/scoring';

export default function CostsPage() {
  const { employees, scenarios, selectedScenarioId, roster, upskillCandidates, externalCandidates, shortlistedCandidates } = useStore();

  const scenario = scenarios.find(s => s.id === selectedScenarioId);

  // Internal costs
  const internalCosts = useMemo(() => {
    // Upskilling costs
    const upskillCosts = upskillCandidates.filter(u => u.approved).map(u => {
      const emp = employees.find(e => e.employee_id === u.employeeId);
      return {
        name: emp?.name || 'Unknown',
        from: emp?.role || '',
        to: u.targetRole,
        trainingCost: u.totalCost || 5000,
        certCost: 1500,
        total: (u.totalCost || 5000) + 1500,
      };
    });

    // Reallocation costs (rostered employees leaving their current projects)
    const reallocationCosts = roster.map(id => {
      const emp = employees.find(e => e.employee_id === id);
      if (!emp) return null;
      const weeklyRate = SALARY_BAND_WEEKLY[emp.salary_band] || 1000;
      const weeks = emp.project_position === 'Lead' ? 6 : emp.project_position === 'Core Contributor' ? 4 : 2;
      return {
        name: emp.name,
        currentProject: emp.current_project,
        productivityLoss: weeklyRate * weeks,
        weeks,
      };
    }).filter(Boolean) as { name: string; currentProject: string; productivityLoss: number; weeks: number }[];

    // Retention costs
    const retentionCosts = roster.map(id => {
      const emp = employees.find(e => e.employee_id === id);
      if (!emp || emp.flight_risk?.toLowerCase() !== 'high') return null;
      return { name: emp.name, role: emp.role, cost: 15000, action: 'Retention bonus + development plan' };
    }).filter(Boolean) as { name: string; role: string; cost: number; action: string }[];

    const upskillTotal = upskillCosts.reduce((s, c) => s + c.total, 0);
    const reallocationTotal = reallocationCosts.reduce((s, c) => s + c.productivityLoss, 0);
    const retentionTotal = retentionCosts.reduce((s, c) => s + c.cost, 0);

    return { upskillCosts, reallocationCosts, retentionCosts, upskillTotal, reallocationTotal, retentionTotal, total: upskillTotal + reallocationTotal + retentionTotal };
  }, [employees, roster, upskillCandidates]);

  // External costs
  const externalCosts = useMemo(() => {
    if (!scenario) return { roles: [], total: 0 };
    const roles = scenario.roles.filter(r => r.gap > 0).map(r => {
      const shortlisted = externalCandidates.filter(c => c.targetRole === r.role && shortlistedCandidates.includes(c.id));
      const avgSalary = shortlisted.length > 0
        ? Math.round(shortlisted.reduce((s, c) => s + c.salary_expectation, 0) / shortlisted.length)
        : SALARY_BAND_MIDPOINTS['E3'] || 65000;
      const count = Math.max(1, r.gap - (upskillCandidates.filter(u => u.targetRole === r.role && u.approved).length));
      const recruitingFee = Math.round(avgSalary * 0.18);
      const onboarding = getOnboardingCost('E3') * count;
      return {
        role: r.role,
        count,
        avgSalary,
        recruitingFee: recruitingFee * count,
        salaryTotal: avgSalary * count,
        onboarding,
        total: recruitingFee * count + avgSalary * count + onboarding,
      };
    });
    return { roles, total: roles.reduce((s, r) => s + r.total, 0) };
  }, [scenario, externalCandidates, shortlistedCandidates, upskillCandidates]);

  const totalCost = internalCosts.total + externalCosts.total;
  const totalHeads = roster.length + externalCosts.roles.reduce((s, r) => s + r.count, 0);
  const costPerHead = totalHeads > 0 ? Math.round(totalCost / totalHeads) : 0;

  // Per-role cost table
  const perRoleCosts = useMemo(() => {
    if (!scenario) return [];
    return scenario.roles.map(r => {
      const internalFills = roster.filter(id => {
        const emp = employees.find(e => e.employee_id === id);
        return emp?.role?.toLowerCase().includes(r.role.split(' ')[0].toLowerCase());
      }).length;
      const externalFills = Math.max(0, r.headcount - internalFills);
      const internalCostPerHead = internalFills > 0 ? Math.round((SALARY_BAND_WEEKLY['E3'] || 1200) * 4) : 0;
      const externalCostPerHead = SALARY_BAND_MIDPOINTS['E3'] || 65000;
      const totalCost = internalFills * internalCostPerHead + externalFills * externalCostPerHead;
      return { ...r, internalFills, externalFills, internalCostPerHead, externalCostPerHead, totalCost, cheaper: internalCostPerHead < externalCostPerHead ? 'Internal' : 'External' };
    });
  }, [scenario, roster, employees]);

  if (!scenario) {
    return (
      <div>
        <PageHeader title="Internal & External Costs" />
        <div className="card-surface p-12 text-center"><p className="text-muted-foreground">Select a scenario first.</p></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Internal & External Costs" subtitle="Comprehensive cost breakdown" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Cost" value={`€${(totalCost / 1000000).toFixed(2)}M`} />
        <MetricCard label="Internal Total" value={`€${(internalCosts.total / 1000).toFixed(0)}k`} subtitle="Upskilling + reallocation" />
        <MetricCard label="External Total" value={`€${(externalCosts.total / 1000000).toFixed(2)}M`} subtitle="Recruiting + salaries" />
        <MetricCard label="Cost Per Head" value={`€${(costPerHead / 1000).toFixed(1)}k`} subtitle="Average" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Internal */}
        <div className="card-surface p-5">
          <h3 className="font-semibold text-foreground mb-4">Internal Costs</h3>

          {internalCosts.upskillCosts.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Upskilling</p>
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-xs text-muted-foreground">Name</th>
                  <th className="text-left p-2 text-xs text-muted-foreground">Path</th>
                  <th className="text-right p-2 text-xs text-muted-foreground">Total</th>
                </tr></thead>
                <tbody>
                  {internalCosts.upskillCosts.map(r => (
                    <tr key={r.name} className="border-b border-border">
                      <td className="p-2 text-foreground">{r.name}</td>
                      <td className="p-2 text-muted-foreground text-xs">{r.from} → {r.to}</td>
                      <td className="p-2 text-right font-medium text-foreground">€{r.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {internalCosts.reallocationCosts.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Reallocation</p>
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-xs text-muted-foreground">Name</th>
                  <th className="text-left p-2 text-xs text-muted-foreground">From Project</th>
                  <th className="text-right p-2 text-xs text-muted-foreground">Loss</th>
                </tr></thead>
                <tbody>
                  {internalCosts.reallocationCosts.slice(0, 8).map(r => (
                    <tr key={r.name} className="border-b border-border">
                      <td className="p-2 text-foreground">{r.name}</td>
                      <td className="p-2 text-muted-foreground text-xs">{r.currentProject} ({r.weeks}w)</td>
                      <td className="p-2 text-right text-foreground">€{r.productivityLoss.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {internalCosts.retentionCosts.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Retention</p>
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-2 text-xs text-muted-foreground">Name</th>
                  <th className="text-left p-2 text-xs text-muted-foreground">Action</th>
                  <th className="text-right p-2 text-xs text-muted-foreground">Cost</th>
                </tr></thead>
                <tbody>
                  {internalCosts.retentionCosts.map(r => (
                    <tr key={r.name} className="border-b border-border">
                      <td className="p-2 text-foreground">{r.name}</td>
                      <td className="p-2 text-muted-foreground text-xs">{r.action}</td>
                      <td className="p-2 text-right text-foreground">€{r.cost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
            <span className="text-muted-foreground">Internal Subtotal</span>
            <span className="text-foreground">€{internalCosts.total.toLocaleString()}</span>
          </div>
        </div>

        {/* External */}
        <div className="card-surface p-5">
          <h3 className="font-semibold text-foreground mb-4">External Costs</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Recruiting & First-Year</p>
          <table className="w-full text-sm mb-4">
            <thead><tr className="border-b border-border">
              <th className="text-left p-2 text-xs text-muted-foreground">Role</th>
              <th className="text-right p-2 text-xs text-muted-foreground">#</th>
              <th className="text-right p-2 text-xs text-muted-foreground">Fee</th>
              <th className="text-right p-2 text-xs text-muted-foreground">Salary</th>
              <th className="text-right p-2 text-xs text-muted-foreground">Onboard</th>
            </tr></thead>
            <tbody>
              {externalCosts.roles.map(r => (
                <tr key={r.role} className="border-b border-border">
                  <td className="p-2 text-foreground">{r.role}</td>
                  <td className="p-2 text-right text-muted-foreground">{r.count}</td>
                  <td className="p-2 text-right text-foreground">€{r.recruitingFee.toLocaleString()}</td>
                  <td className="p-2 text-right text-foreground">€{r.salaryTotal.toLocaleString()}</td>
                  <td className="p-2 text-right text-foreground">€{r.onboarding.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between text-sm font-medium border-t border-border pt-2">
            <span className="text-muted-foreground">External Subtotal</span>
            <span className="text-foreground">€{externalCosts.total.toLocaleString()}</span>
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
                <div className="flex justify-between"><span className="text-muted-foreground">Est. Cost</span><span className="text-foreground font-medium">{s.costEstimate}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Headcount</span><span className="text-foreground">{s.totalHeadcount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Timeline</span><span className="text-foreground">{s.timeline}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-role cost table */}
      <div className="card-surface p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">Per-Role Cost Breakdown</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">
            <th className="text-left p-2 text-xs text-muted-foreground">Role</th>
            <th className="text-right p-2 text-xs text-muted-foreground">Needed</th>
            <th className="text-right p-2 text-xs text-muted-foreground">Internal</th>
            <th className="text-right p-2 text-xs text-muted-foreground">External</th>
            <th className="text-right p-2 text-xs text-muted-foreground">Int. Cost/Head</th>
            <th className="text-right p-2 text-xs text-muted-foreground">Ext. Cost/Head</th>
            <th className="text-right p-2 text-xs text-muted-foreground">Total</th>
            <th className="text-right p-2 text-xs text-muted-foreground">Cheaper</th>
          </tr></thead>
          <tbody>
            {perRoleCosts.map(r => (
              <tr key={r.role} className="border-b border-border">
                <td className="p-2 text-foreground">{r.role}</td>
                <td className="p-2 text-right text-muted-foreground">{r.headcount}</td>
                <td className="p-2 text-right text-foreground">{r.internalFills}</td>
                <td className="p-2 text-right text-foreground">{r.externalFills}</td>
                <td className="p-2 text-right text-muted-foreground">€{r.internalCostPerHead.toLocaleString()}</td>
                <td className="p-2 text-right text-muted-foreground">€{r.externalCostPerHead.toLocaleString()}</td>
                <td className="p-2 text-right font-medium text-foreground">€{r.totalCost.toLocaleString()}</td>
                <td className="p-2 text-right"><Badge variant={r.cheaper === 'Internal' ? 'badge-green' : 'badge-amber'}>{r.cheaper}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Insights */}
      <div className="card-surface p-5">
        <h3 className="font-semibold text-foreground mb-3">Cost Insights</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {roster.length > 0 ? (
            <>Based on current selections, the optimal approach combines upskilling {upskillCandidates.filter(u => u.approved).length} existing employees
            (saving ~€{Math.round((externalCosts.total * 0.4) / 1000)}k vs full external hiring) with targeted external recruitment
            for {externalCosts.roles.reduce((s, r) => s + r.count, 0)} roles. Internal fills at €{costPerHead > 0 ? (costPerHead / 1000).toFixed(1) : '—'}k per head
            represent {totalCost > 0 ? Math.round((internalCosts.total / totalCost) * 100) : 0}% of total cost while filling {roster.length} positions.</>
          ) : (
            <>Add employees to the roster and approve upskilling candidates to see dynamic cost analysis.</>
          )}
        </p>
      </div>
    </div>
  );
}
