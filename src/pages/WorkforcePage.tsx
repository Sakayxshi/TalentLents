import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { calculateCompositeScore, getScoreColor, getAppraisalVariant, getRiskVariant } from '@/lib/scoring';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmployeePanel } from '@/components/EmployeePanel';
import { useToast } from '@/hooks/use-toast';

export default function WorkforcePage() {
  const { employees, roster, addToRoster, removeFromRoster, markPageComplete, scenarios, selectedScenarioId } = useStore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [rankedMode, setRankedMode] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const perPage = 25;

  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  const allReqSkills = useMemo(() => scenario?.roles.flatMap(r => r.requiredSkills) || [], [scenario]);
  const allReqCerts = useMemo(() => scenario?.roles.flatMap(r => r.requiredCerts) || [], [scenario]);

  const departments = useMemo(() => [...new Set(employees.map(e => e.department))].filter(Boolean).sort(), [employees]);
  const roles = useMemo(() => [...new Set(employees.map(e => e.role))].filter(Boolean).sort(), [employees]);

  const scored = useMemo(() =>
    employees.map(e => {
      const scoreData = calculateCompositeScore(e, allReqSkills, allReqCerts, scenario?.risk === 'Low' ? 'High' : 'Critical');
      return { ...e, compositeScore: scoreData.total, scoreData, skillMatchPct: scoreData.skillMatchPct };
    }).sort((a, b) => b.compositeScore - a.compositeScore),
    [employees, allReqSkills, allReqCerts, scenario]
  );

  const filtered = useMemo(() => {
    let result = scored;
    if (rankedMode && allReqSkills.length > 0) {
      result = result.filter(e => e.skillMatchPct > 0);
    }
    if (deptFilter) result = result.filter(e => e.department === deptFilter);
    if (roleFilter) result = result.filter(e => e.role === roleFilter);
    if (riskFilter) result = result.filter(e => e.flight_risk?.toLowerCase() === riskFilter.toLowerCase());
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(s) || e.technical_skills?.toLowerCase().includes(s) || e.certifications?.toLowerCase().includes(s));
    }
    // Sort
    result = [...result].sort((a, b) => {
      let valA: number | string, valB: number | string;
      switch (sortCol) {
        case 'name': valA = a.name; valB = b.name; break;
        case 'dept': valA = a.department; valB = b.department; break;
        case 'role': valA = a.role; valB = b.role; break;
        case 'perf': valA = a.performance_rating; valB = b.performance_rating; break;
        case 'risk': valA = a.flight_risk; valB = b.flight_risk; break;
        default: valA = a.compositeScore; valB = b.compositeScore;
      }
      if (typeof valA === 'string') return sortDir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return result;
  }, [scored, deptFilter, roleFilter, riskFilter, search, rankedMode, allReqSkills, sortCol, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice(page * perPage, (page + 1) * perPage);
  const selected = selectedId ? scored.find(e => e.employee_id === selectedId) : null;
  const matchedCount = scored.filter(e => e.compositeScore >= 50).length;

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  if (employees.length === 0) {
    return (
      <div>
        <PageHeader title="Workforce Overview" />
        <div className="card-surface p-12 text-center">
          <p className="text-muted-foreground">Please upload employee data first.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Workforce Overview" subtitle="Explore and rank your workforce" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Employees" value={employees.length} />
        <MetricCard label="Matched to Project" value={matchedCount} subtitle=">50% score" />
        <MetricCard label="Added to Roster" value={roster.length} />
        <MetricCard label="Average Score" value={scored.length ? Math.round(scored.reduce((a, e) => a + e.compositeScore, 0) / scored.length) : 0} />
      </div>

      {/* Filters */}
      <div className="card-surface p-4 mb-4 flex gap-3 flex-wrap items-center">
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(0); }} className="h-9 rounded-lg bg-input border border-border px-3 text-sm text-foreground">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(0); }} className="h-9 rounded-lg bg-input border border-border px-3 text-sm text-foreground">
          <option value="">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex gap-1">
          {['', 'Low', 'Medium', 'High'].map(r => (
            <button key={r} onClick={() => { setRiskFilter(r); setPage(0); }} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${riskFilter === r ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {r || 'All Risk'}
            </button>
          ))}
        </div>
        <Input placeholder="Search skills, names, certs..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-64" />
        <Button variant="ghost" size="sm" onClick={() => { setDeptFilter(''); setRoleFilter(''); setRiskFilter(''); setSearch(''); setPage(0); }}>Reset</Button>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={rankedMode} onChange={e => setRankedMode(e.target.checked)} className="accent-primary" />
            Ranked for Project
          </label>
          <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1">
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">#</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('name')}>Name {sortCol === 'name' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('dept')}>Department</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('role')}>Role</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('score')}>Score {sortCol === 'score' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('perf')}>Perf.</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Appraisal</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Products</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Success%</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('risk')}>Risk</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((e, i) => {
                  const isRostered = roster.includes(e.employee_id);
                  const successRate = e.products_deployed > 0 ? Math.round((e.successful_products_deployed / e.products_deployed) * 100) : 0;
                  return (
                    <tr
                      key={e.employee_id}
                      className={`border-b border-border cursor-pointer transition-colors ${
                        selectedId === e.employee_id ? 'bg-primary/5' : i % 2 === 0 ? 'bg-transparent' : 'bg-secondary/30'
                      } hover:bg-primary/5`}
                      onClick={() => setSelectedId(e.employee_id)}
                    >
                      <td className="p-3 text-muted-foreground">{page * perPage + i + 1}</td>
                      <td className="p-3 text-foreground font-medium">{e.name}</td>
                      <td className="p-3 text-muted-foreground">{e.department}</td>
                      <td className="p-3 text-muted-foreground">{e.role}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(e.compositeScore)}`}>{e.compositeScore}</span>
                          <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${e.compositeScore >= 80 ? 'bg-success' : e.compositeScore >= 60 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${e.compositeScore}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{e.performance_rating}/5</td>
                      <td className="p-3"><Badge variant={getAppraisalVariant(e.appraisal)}>{e.appraisal}</Badge></td>
                      <td className="p-3 text-muted-foreground">{e.products_deployed}</td>
                      <td className="p-3 text-muted-foreground">{successRate}%</td>
                      <td className="p-3"><Badge variant={getRiskVariant(e.flight_risk)}>{e.flight_risk}</Badge></td>
                      <td className="p-3">
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (isRostered) { removeFromRoster(e.employee_id); toast({ title: 'Removed', description: `${e.name} removed from roster` }); }
                            else { addToRoster(e.employee_id); toast({ title: 'Added', description: `${e.name} added to roster` }); }
                          }}
                          className={`p-1 rounded transition-colors ${isRostered ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'}`}
                        >
                          {isRostered ? <X size={16} /> : <Plus size={16} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></Button>
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></Button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <EmployeePanel
            employee={selected}
            scoreData={selected.scoreData}
            requiredSkills={allReqSkills}
            isRostered={roster.includes(selected.employee_id)}
            onAddToRoster={() => { addToRoster(selected.employee_id); markPageComplete(3); toast({ title: 'Added to Roster', description: selected.name }); }}
            onRemoveFromRoster={() => { removeFromRoster(selected.employee_id); toast({ title: 'Removed', description: selected.name }); }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
