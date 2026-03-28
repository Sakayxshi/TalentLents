import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { PageHeader } from '@/components/ui/MetricCard';
import { Upload, CheckCircle2, Database } from 'lucide-react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { generateDemoEmployees } from '@/lib/demoData';
import { useToast } from '@/hooks/use-toast';

const expectedColumns = [
  'employee_id', 'name', 'department', 'role', 'location', 'hire_date',
  'years_at_company', 'manager_id', 'salary_band', 'employment_type',
  'performance_rating', 'products_deployed', 'successful_products_deployed',
  'feedback_score', 'appraisal', 'certifications', 'technical_skills',
  'education', 'languages', 'flight_risk', 'internal_moves',
  'current_project', 'project_position', 'peer_feedback_score'
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { setEmployees, uploadStats, markPageComplete } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback((file: File) => {
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        let skipped = results.errors.length;
        const valid = data.filter(row => row.employee_id && row.name);
        skipped += data.length - valid.length;

        const employees = valid.map(row => ({
          employee_id: row.employee_id || '',
          name: row.name || '',
          department: row.department || '',
          role: row.role || '',
          location: row.location || '',
          hire_date: row.hire_date || '',
          years_at_company: Number(row.years_at_company) || 0,
          manager_id: row.manager_id || '',
          salary_band: row.salary_band || '',
          employment_type: row.employment_type || '',
          performance_rating: Number(row.performance_rating) || 3,
          products_deployed: Number(row.products_deployed) || 0,
          successful_products_deployed: Number(row.successful_products_deployed) || 0,
          feedback_score: Number(row.feedback_score) || 3,
          appraisal: row.appraisal || 'Meets Expectations',
          certifications: row.certifications || '',
          technical_skills: row.technical_skills || '',
          education: row.education || '',
          languages: row.languages || '',
          flight_risk: row.flight_risk || 'Low',
          internal_moves: Number(row.internal_moves) || 0,
          current_project: row.current_project || '',
          project_position: row.project_position || '',
          peer_feedback_score: Number(row.peer_feedback_score) || 3,
        }));

        const departments = new Set(employees.map(e => e.department)).size;
        const locations = new Set(employees.map(e => e.location)).size;

        setEmployees(employees, { total: employees.length, departments, locations, skipped });
        markPageComplete(1);
        toast({ title: 'Upload Successful', description: `Parsed ${employees.length} employees` });
      },
      error: () => setError('Failed to parse CSV file. Please check the format.')
    });
  }, [setEmployees, markPageComplete, toast]);

  const handleLoadDemo = () => {
    const demo = generateDemoEmployees(100);
    const departments = new Set(demo.map(e => e.department)).size;
    const locations = new Set(demo.map(e => e.location)).size;
    setEmployees(demo, { total: demo.length, departments, locations, skipped: 0 });
    markPageComplete(1);
    toast({ title: 'Demo Data Loaded', description: '100 sample BMW employees loaded' });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  return (
    <div>
      <PageHeader title="Upload Database" subtitle="Import your employee data to get started" />

      <div className="max-w-2xl mx-auto mt-12">
        <div
          onClick={handleClick}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`card-surface border-2 border-dashed p-16 text-center cursor-pointer transition-all ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <Upload className="mx-auto text-muted-foreground mb-4" size={48} />
          <p className="text-foreground font-medium">Drop your employee CSV here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-2">Supports .csv files</p>
        </div>

        {/* Demo button */}
        {!uploadStats && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={handleLoadDemo}>
              <Database size={16} className="mr-2" />
              Load Demo Data (100 Employees)
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 badge-red rounded-lg text-sm">{error}</div>
        )}

        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">Expected Columns</p>
          <div className="flex flex-wrap gap-1.5">
            {expectedColumns.map(col => (
              <span key={col} className="px-2 py-1 text-xs rounded-md bg-secondary text-secondary-foreground font-mono">
                {col}
              </span>
            ))}
          </div>
        </div>

        {uploadStats && (
          <div className="mt-8 card-surface p-6 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-success" size={20} />
              <h3 className="font-semibold text-foreground">Upload Successful</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Parsed <span className="text-foreground font-medium">{uploadStats.total}</span> employees across{' '}
              <span className="text-foreground font-medium">{uploadStats.departments}</span> departments,{' '}
              <span className="text-foreground font-medium">{uploadStats.locations}</span> locations.{' '}
              <span className="text-muted-foreground">{uploadStats.skipped} rows skipped.</span>
            </p>
            <Button
              onClick={() => { navigate('/dashboard'); }}
              className="mt-4 w-full"
            >
              Proceed to Project Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
