import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { computeCompositeScore, getScoreColor, getAppraisalVariant, getRiskVariant } from '@/lib/scoring';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function WorkforcePage() {
  const { employees, roster, addToRoster, removeFromRoster, markPageComplete } = useStore();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const perPage = 25;

  const departments = useMemo(() => [...new Set(employees.map(e => e.department))].filter(Boolean).sort(), [employees]);
  const roles = useMemo(() => [...new Set(employees.map(e => e.role))].filter(Boolean).sort(), [employees]);

  const scored = useMemo(() =>
    employees.map(e => ({ ...e, compositeScore: computeCompositeScore(e) }))
      .sort((a, b) => b.compositeScore - a.compositeScore),
    [employees]
  );

  const filtered = useMemo(() => {
    let result = scored;
    if (deptFilter) result = result.filter(e => e.department === deptFilter);
    if (roleFilter) result = result.filter(e => e.role === roleFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(s) || e.technical_skills?.toLowerCase().includes(s));
    }
    return result;
  }, [scored, deptFilter, roleFilter, search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageData = filtered.slice(page * perPage, (page + 1) * perPage);
  const selected = selectedId ? scored.find(e => e.employee_id === selectedId) : null;
  const matchedCount = scored.filter(e => e.compositeScore >= 50).length;

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
        <Input placeholder="Search skills or names..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-64" />
        <Button variant="ghost" size="sm" onClick={() => { setDeptFilter(''); setRoleFilter(''); setSearch(''); setPage(0); }}>Reset</Button>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} results</span>
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1">
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">#</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Department</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Role</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Score</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Perf.</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Appraisal</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Risk</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((e, i) => {
                  const isRostered = roster.includes(e.employee_id);
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
                      <td className="p-3"><span className={`font-bold ${getScoreColor(e.compositeScore)}`}>{e.compositeScore}</span></td>
                      <td className="p-3 text-muted-foreground">{e.performance_rating}/5</td>
                      <td className="p-3"><Badge variant={getAppraisalVariant(e.appraisal)}>{e.appraisal}</Badge></td>
                      <td className="p-3"><Badge variant={getRiskVariant(e.flight_risk)}>{e.flight_risk}</Badge></td>
                      <td className="p-3">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); isRostered ? removeFromRoster(e.employee_id) : addToRoster(e.employee_id); }}
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
          <div className="w-[400px] shrink-0 card-surface p-5 overflow-y-auto max-h-[calc(100vh-140px)] animate-fade-in-up">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.role} · {selected.department}</p>
                <p className="text-xs text-muted-foreground mt-1">{selected.location} · {selected.years_at_company} years</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="text-center my-4">
              <p className={`text-4xl font-bold ${getScoreColor(selected.compositeScore)}`}>{selected.compositeScore}</p>
              <p className="text-xs text-muted-foreground mt-1">Composite Score</p>
            </div>

            <div className="space-y-3 text-sm mb-4">
              <div className="flex justify-between"><span className="text-muted-foreground">Performance</span><span>{selected.performance_rating}/5</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Products Deployed</span><span>{selected.products_deployed}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Success Rate</span><span>{selected.products_deployed > 0 ? Math.round((selected.successful_products_deployed / selected.products_deployed) * 100) : 0}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Peer Feedback</span><span>{selected.peer_feedback_score}/5</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Appraisal</span><Badge variant={getAppraisalVariant(selected.appraisal)}>{selected.appraisal}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Flight Risk</span><Badge variant={getRiskVariant(selected.flight_risk)}>{selected.flight_risk}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Salary Band</span><span>{selected.salary_band}</span></div>
            </div>

            {selected.technical_skills && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {selected.technical_skills.split(',').map(s => (
                    <span key={s.trim()} className="px-2 py-0.5 text-xs rounded-md bg-secondary text-secondary-foreground">{s.trim()}</span>
                  ))}
                </div>
              </div>
            )}

            {selected.certifications && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Certifications</p>
                <div className="flex flex-wrap gap-1">
                  {selected.certifications.split(',').map(c => (
                    <span key={c.trim()} className="px-2 py-0.5 text-xs rounded-md badge-blue">{c.trim()}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1 mb-4">
              <p><strong>Education:</strong> {selected.education}</p>
              <p><strong>Languages:</strong> {selected.languages}</p>
              <p><strong>Current Project:</strong> {selected.current_project}</p>
            </div>

            <Button
              className="w-full"
              variant={roster.includes(selected.employee_id) ? 'destructive' : 'default'}
              onClick={() => {
                roster.includes(selected.employee_id) ? removeFromRoster(selected.employee_id) : addToRoster(selected.employee_id);
                markPageComplete(3);
              }}
            >
              {roster.includes(selected.employee_id) ? 'Remove from Roster' : 'Add to Roster'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
