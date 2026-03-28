import { Employee } from '@/store/useStore';
import { ScoreBreakdown, getScoreColor, getAppraisalVariant, getRiskVariant, getMatchedSkills, getMissingSkills } from '@/lib/scoring';
import { Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface EmployeePanelProps {
  employee: Employee;
  scoreData: ScoreBreakdown;
  requiredSkills?: string[];
  isRostered?: boolean;
  onAddToRoster?: () => void;
  onRemoveFromRoster?: () => void;
  onClose: () => void;
}

export function EmployeePanel({
  employee, scoreData, requiredSkills = [], isRostered, onAddToRoster, onRemoveFromRoster, onClose
}: EmployeePanelProps) {
  const empSkills = (employee.technical_skills || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const matched = getMatchedSkills(empSkills, requiredSkills);
  const missing = getMissingSkills(empSkills, requiredSkills);
  const matchedLower = matched.map(s => s.toLowerCase());

  return (
    <div className="w-[400px] shrink-0 card-surface p-5 overflow-y-auto max-h-[calc(100vh-140px)] animate-fade-in-up">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">{employee.name}</h2>
          <p className="text-sm text-muted-foreground">{employee.role} · {employee.department}</p>
          <p className="text-xs text-muted-foreground mt-1">{employee.location} · {employee.years_at_company} years · {employee.salary_band}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
      </div>

      <div className="text-center my-4">
        <p className={`text-4xl font-bold ${getScoreColor(scoreData.total)}`}>{scoreData.total}</p>
        <p className="text-xs text-muted-foreground mt-1">Composite Score</p>
      </div>

      {/* Score breakdown */}
      <div className="space-y-2 mb-4">
        {Object.entries(scoreData.breakdown).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">{key}</span>
              <span className={`font-medium ${key === 'Flight Risk' ? (value < 0 ? 'text-destructive' : 'text-foreground') : value >= 80 ? 'score-green' : value >= 60 ? 'score-amber' : 'score-red'}`}>{key === 'Flight Risk' ? value : `${value}%`}</span>
            </div>
            {key !== 'Flight Risk' && (
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${value >= 80 ? 'bg-success' : value >= 60 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${Math.max(0, value)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3 text-sm mb-4">
        <div className="flex justify-between"><span className="text-muted-foreground">Performance</span><span>{employee.performance_rating}/5</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Products Deployed</span><span>{employee.products_deployed}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Success Rate</span><span>{employee.products_deployed > 0 ? Math.round((employee.successful_products_deployed / employee.products_deployed) * 100) : 0}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Peer Feedback</span><span>{employee.peer_feedback_score}/5</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Appraisal</span><Badge variant={getAppraisalVariant(employee.appraisal)}>{employee.appraisal}</Badge></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Flight Risk</span><Badge variant={getRiskVariant(employee.flight_risk)}>{employee.flight_risk}</Badge></div>
      </div>

      {empSkills.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Skills</p>
          <div className="flex flex-wrap gap-1">
            {empSkills.map(s => {
              const isMatch = matchedLower.includes(s.toLowerCase()) || requiredSkills.some(rs => s.toLowerCase().includes(rs.toLowerCase()) || rs.toLowerCase().includes(s.toLowerCase()));
              return (
                <span key={s} className={`px-2 py-0.5 text-xs rounded-md ${isMatch ? 'badge-green' : 'bg-secondary text-secondary-foreground'}`}>{s}</span>
              );
            })}
          </div>
          {missing.length > 0 && requiredSkills.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-muted-foreground mb-1">Missing:</p>
              <div className="flex flex-wrap gap-1">
                {missing.map(s => <span key={s} className="px-2 py-0.5 text-xs rounded-md badge-red">{s}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {employee.certifications && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Certifications</p>
          <div className="flex flex-wrap gap-1">
            {employee.certifications.split(/[,;]/).map(c => c.trim()).filter(Boolean).map(c => (
              <span key={c} className="px-2 py-0.5 text-xs rounded-md badge-blue">{c}</span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 mb-4">
        <p><strong>Education:</strong> {employee.education}</p>
        <p><strong>Languages:</strong> {employee.languages}</p>
        <p><strong>Current Project:</strong> {employee.current_project} ({employee.project_position})</p>
      </div>

      {(onAddToRoster || onRemoveFromRoster) && (
        <Button
          className="w-full"
          variant={isRostered ? 'destructive' : 'default'}
          onClick={() => isRostered ? onRemoveFromRoster?.() : onAddToRoster?.()}
        >
          {isRostered ? 'Remove from Roster' : 'Add to Roster'}
        </Button>
      )}
    </div>
  );
}
