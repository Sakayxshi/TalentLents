import { useState, useCallback, useMemo } from 'react';
import { useStore, Scenario, RoleRequirement } from '@/store/useStore';
import { PageHeader, MetricCard, Badge } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Sparkles, AlertTriangle, TrendingUp, Users, CheckCircle2, XCircle, ChevronDown, ChevronUp, Pencil, Brain, Search, Plus, Minus, UserPlus, Save, Database, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateCompositeScore } from '@/lib/scoring';
import { invokeAI, GeneratedScenarios } from '@/lib/aiService';
import { ScrollArea } from '@/components/ui/scroll-area';
import { loadBmwDatabase, generateDemoEmployees, loadProjectHistory } from '@/lib/demoData';
import Papa from 'papaparse';
import { Employee } from '@/store/useStore';

const PROJECT_PRESETS = [
  {
    id: 'gigafactory',
    label: 'EV Battery Gigafactory',
    tag: 'Munich · Critical',
    color: 'border-l-destructive',
    form: {
      name: 'EV Battery Gigafactory — Munich',
      description: 'Strategic initiative to establish a dedicated in-house battery cell production facility at our Munich campus, reducing dependency on third-party cell suppliers (CATL, Samsung SDI) and securing long-term cost competitiveness for our Neue Klasse platform. Scope includes greenfield facility buildout, production line commissioning, pilot cell validation, and integration with existing drivetrain assembly. Must align with EU Battery Regulation compliance timelines and our 2028 volume targets of 600,000+ BEV units annually.',
      targetDeadline: 'Q3 2026',
      budgetMin: 15000000,
      budgetMax: 25000000,
      priority: 'Critical' as const,
      staffEstimate: '80–120 people, heavy engineering — need electrochemistry specialists, battery cell R&D engineers, production line automation engineers, quality assurance leads with gigafactory experience, supply chain managers for raw materials (lithium, nickel, cobalt sourcing), HSE compliance officers, and a small embedded software team for battery management system integration. Senior hires should have prior experience at CATL, Northvolt, or Tesla Grünheide.',
    },
  },
  {
    id: 'ai-copilot',
    label: 'Connected Drive AI Copilot',
    tag: 'Global · High',
    color: 'border-l-primary',
    form: {
      name: 'Connected Drive AI Copilot — Global Rollout',
      description: 'Launch of a next-generation in-vehicle AI assistant across the full BMW lineup, replacing the current voice command system with a multimodal copilot capable of natural conversation, proactive route optimization, real-time vehicle diagnostics, and personalized driver behavior coaching. The system must integrate with BMW\'s existing ConnectedDrive backend, iDrive 9 infotainment platform, and third-party services (Spotify, Google Maps, Microsoft 365). Phase 1 covers European and North American markets. Must meet UNECE R155 cybersecurity and GDPR data residency requirements. Target: OTA deployment to 2.4M vehicles within 6 months of launch.',
      targetDeadline: 'Q2 2027',
      budgetMin: 8000000,
      budgetMax: 18000000,
      priority: 'High' as const,
      staffEstimate: '60–90 people, heavy software — need ML/NLP engineers with automotive LLM experience, cloud infrastructure architects (AWS/Azure), embedded systems developers for in-vehicle edge compute, UX designers specialized in voice and multimodal interaction, product managers with connected car domain expertise, data engineers for telemetry pipelines, QA engineers with automotive SPICE and ISO 26262 familiarity, and DevOps leads experienced with OTA update infrastructure at scale. Key hires should have background at Cerence, Qualcomm Ride, or comparable automotive AI vendors.',
    },
  },
  {
    id: 'autobahn-pilot',
    label: 'Autonomous Driving L3',
    tag: 'Autobahn · Critical',
    color: 'border-l-warning',
    form: {
      name: 'Autonomous Driving Level 3 — Autobahn Pilot',
      description: 'Development and homologation of a SAE Level 3 conditional automation system for highway driving across the BMW 5 Series, 7 Series, and iX platforms. The system must enable fully hands-off, eyes-off driving at speeds up to 130 km/h on approved Autobahn segments, with reliable handover protocols and redundant fail-safe architecture. Scope covers sensor fusion stack (LiDAR, radar, camera), decision-making AI, HD mapping integration, V2X communication, and regulatory approval across Germany, Austria, and France under UNECE R157. Must pass 12M+ validated simulation kilometers and 500,000 km of real-world fleet testing before type approval submission.',
      targetDeadline: 'Q1 2028',
      budgetMin: 35000000,
      budgetMax: 60000000,
      priority: 'Critical' as const,
      staffEstimate: '150–200 people, cross-disciplinary — need perception engineers (computer vision, LiDAR point cloud processing), sensor fusion architects, motion planning and controls engineers, functional safety leads with ISO 26262 ASIL-D certification experience, systems engineers for redundant braking and steering architecture, simulation engineers (CARLA, dSPACE), HD mapping specialists, V2X communication engineers, homologation and regulatory affairs managers with UNECE working party contacts, fleet test operations coordinators, and a dedicated cybersecurity team for attack surface analysis. Senior leadership hires should come from Mobileye, Waymo, Argo AI alumni, or BMW\'s existing ADAS division in Unterschleißheim.',
    },
  },
] as const;

// ─── Local scenario generator (fallback when AI is unavailable) ───────────────

const ROLE_PROFILES: Record<string, { skills: string[]; certs: string[]; keywords: string[] }> = {
  'Battery Engineer':        { skills: ['battery chemistry', 'cell testing', 'bms design', 'thermal management', 'electrochemistry'], certs: ['ISO 26262', 'EV Safety Level 2'], keywords: ['battery', 'cell', 'electrochemistry', 'gigafactory', 'bms', 'lithium'] },
  'Process Engineer':        { skills: ['lean manufacturing', 'value stream', 'kaizen', 'process optimization', 'sap pp'], certs: ['Lean Six Sigma Black Belt', 'IATF 16949'], keywords: ['production', 'manufacturing', 'process', 'commissioning', 'facility'] },
  'Automation Engineer':     { skills: ['plc programming', 'scada', 'robotics', 'industrial iot', 'autocad'], certs: ['PMP', 'ABB Robotics'], keywords: ['automation', 'plc', 'robotics', 'production line', 'scada'] },
  'Quality Engineer':        { skills: ['six sigma', 'iso 9001', 'spc', 'root cause analysis', 'fmea'], certs: ['Six Sigma Green Belt', 'ISO 9001 Auditor'], keywords: ['quality', 'qa', 'assurance', 'compliance', 'validation'] },
  'Materials Scientist':     { skills: ['xrd', 'sem', 'polymer science', 'nanomaterials', 'lab management'], certs: ['Materials Science Professional'], keywords: ['materials', 'chemistry', 'cell', 'cathode', 'anode', 'electrolyte'] },
  'Supply Chain Analyst':    { skills: ['sap mm', 'demand forecasting', 'logistics', 'strategic sourcing', 'power bi'], certs: ['APICS CSCP', 'SAP Certified'], keywords: ['supply chain', 'sourcing', 'procurement', 'lithium', 'nickel', 'cobalt', 'raw materials'] },
  'Safety Specialist':       { skills: ['hazop', 'risk assessment', 'iso 45001', 'emergency planning', 'hse'], certs: ['NEBOSH', 'ISO 45001 Lead Auditor'], keywords: ['safety', 'hse', 'compliance', 'regulation', 'hazard'] },
  'Software Engineer':       { skills: ['c++', 'embedded systems', 'autosar', 'linux', 'git'], certs: ['AUTOSAR Certified', 'Embedded Linux'], keywords: ['software', 'embedded', 'bms', 'firmware', 'integration', 'ota', 'backend'] },
  'Data Scientist':          { skills: ['python', 'machine learning', 'deep learning', 'sql', 'pytorch'], certs: ['AWS Certified', 'TensorFlow Certificate'], keywords: ['ai', 'ml', 'machine learning', 'data', 'nlp', 'llm', 'copilot', 'telemetry'] },
  'UX Designer':             { skills: ['figma', 'prototyping', 'user research', 'design systems', 'voice ui'], certs: ['Google UX Certificate'], keywords: ['ux', 'ui', 'design', 'voice', 'multimodal', 'infotainment', 'hmi'] },
  'Project Manager':         { skills: ['agile', 'jira', 'stakeholder management', 'budgeting', 'safe'], certs: ['PMP', 'SAFe Agilist'], keywords: ['project', 'program', 'rollout', 'launch', 'coordination'] },
  'Mechanical Engineer':     { skills: ['cad', 'fea', 'solidworks', 'catia', 'structural analysis'], certs: ['CATIA V5 Certified'], keywords: ['mechanical', 'structural', 'hardware', 'facility', 'buildout'] },
  'Perception Engineer':     { skills: ['computer vision', 'lidar', 'point cloud processing', 'pytorch', 'sensor fusion'], certs: ['ISO 26262'], keywords: ['perception', 'lidar', 'camera', 'computer vision', 'sensor fusion', 'adas', 'autonomous'] },
  'Motion Planning Engineer':{ skills: ['motion planning', 'controls', 'c++', 'ros', 'path planning'], certs: ['ISO 26262'], keywords: ['motion planning', 'controls', 'path planning', 'decision-making', 'autonomous', 'driving'] },
  'Simulation Engineer':     { skills: ['carla', 'dspace', 'matlab', 'simulink', 'hil testing'], certs: ['Certified Simulation Professional'], keywords: ['simulation', 'carla', 'dspace', 'testing', 'validation', 'kilometers'] },
  'Functional Safety Lead':  { skills: ['iso 26262', 'fmea', 'fault tree analysis', 'asil', 'functional safety'], certs: ['ISO 26262 Certified', 'TÜV Functional Safety'], keywords: ['functional safety', 'asil', 'iso 26262', 'fail-safe', 'redundant', 'homologation'] },
  'Systems Engineer':        { skills: ['systems engineering', 'requirements management', 'doors', 'v-model', 'architecture'], certs: ['INCOSE CSEP'], keywords: ['systems engineer', 'redundant', 'architecture', 'braking', 'steering', 'integration'] },
  'Cybersecurity Engineer':  { skills: ['penetration testing', 'threat modeling', 'iso 21434', 'secure boot', 'can bus security'], certs: ['ISO 21434', 'CISSP'], keywords: ['cybersecurity', 'security', 'attack surface', 'unece r155', 'penetration'] },
  'Regulatory Affairs Manager': { skills: ['type approval', 'unece', 'homologation', 'regulatory strategy', 'stakeholder management'], certs: ['Regulatory Affairs Certified'], keywords: ['regulatory', 'homologation', 'unece', 'type approval', 'r157', 'compliance'] },
};

function generateScenariosLocally(
  formData: { name: string; description: string; staffEstimate: string; budgetMax: number; targetDeadline: string; priority: string },
  computeAvail: (role: string, skills: string[]) => number
): Scenario[] {
  const text = `${formData.description} ${formData.staffEstimate}`.toLowerCase();

  // Score each role by keyword match
  const scored = Object.entries(ROLE_PROFILES)
    .map(([role, profile]) => {
      const hits = profile.keywords.filter(kw => text.includes(kw)).length;
      return { role, profile, hits };
    })
    .filter(r => r.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  // Pick top 8 roles (or all if fewer)
  const topRoles = scored.slice(0, 8).map(r => r.role);
  // Ensure at least 6 roles
  if (topRoles.length < 6) {
    ['Battery Engineer', 'Process Engineer', 'Quality Engineer', 'Project Manager', 'Safety Specialist', 'Supply Chain Analyst']
      .forEach(r => { if (!topRoles.includes(r)) topRoles.push(r); });
  }

  const budgetPerHead = formData.budgetMax * 0.17;
  const optimalCount = Math.round(formData.budgetMax / budgetPerHead);
  const leanCount = Math.round(optimalCount * 0.72);

  const makeRoles = (factor: number) =>
    topRoles.map(roleName => {
      const profile = ROLE_PROFILES[roleName];
      const base = Math.max(2, Math.round((scored.find(s => s.role === roleName)?.hits || 1) * factor));
      const headcount = Math.min(base, Math.round(factor * 3));
      const avail = computeAvail(roleName, profile.skills);
      const internalAvailable = Math.min(avail, headcount);
      return {
        role: roleName,
        headcount,
        requiredSkills: profile.skills,
        requiredCerts: profile.certs,
        internalAvailable,
        gap: Math.max(0, headcount - internalAvailable),
      };
    });

  const optRoles = makeRoles(3.2);
  const leanRoles = makeRoles(2.2);
  const optTotal = optRoles.reduce((s, r) => s + r.headcount, 0);
  const leanTotal = leanRoles.reduce((s, r) => s + r.headcount, 0);

  return [
    {
      id: 'optimal',
      name: 'Scenario A',
      label: 'Full-Scale Launch',
      totalHeadcount: optTotal,
      costEstimate: `€${((optTotal * 95000) / 1e6).toFixed(1)}M`,
      timeline: '12 months',
      risk: 'Low',
      rationale: 'Full staffing from day one ensures fastest time-to-market and highest delivery confidence.',
      pros: ['Maximum capacity & resilience', 'Parallel workstreams', 'Lowest execution risk', 'Meets aggressive timeline'],
      cons: ['Higher upfront cost', 'Larger coordination overhead', 'Onboarding bottleneck risk'],
      roles: optRoles,
    },
    {
      id: 'lean',
      name: 'Scenario B',
      label: 'Phased Rollout',
      totalHeadcount: leanTotal,
      costEstimate: `€${((leanTotal * 95000) / 1e6).toFixed(1)}M`,
      timeline: '18 months',
      risk: 'Medium',
      rationale: 'Phased hiring reduces initial burn rate while preserving optionality to scale up in later stages.',
      pros: ['Lower initial investment', 'Iterative risk management', 'Easier to pivot', 'Proven before full scale'],
      cons: ['Longer timeline', 'Higher delivery risk', 'Potential bottlenecks in critical phases'],
      roles: leanRoles,
    },
    {
      id: 'custom',
      name: 'Scenario C',
      label: 'Custom Build',
      totalHeadcount: 0,
      costEstimate: '—',
      timeline: 'TBD',
      risk: 'None',
      rationale: 'Define your own team composition by editing role headcounts below.',
      pros: ['Full control', 'Tailored to constraints', 'Flexible scope'],
      cons: ['Requires manual configuration'],
      roles: topRoles.map(roleName => {
        const profile = ROLE_PROFILES[roleName];
        return { role: roleName, headcount: 0, requiredSkills: profile.skills, requiredCerts: profile.certs, internalAvailable: 0, gap: 0 };
      }),
    },
  ];
}

const roleSkillsMap: Record<string, { skills: string[]; certs: string[] }> = {
  'Battery Engineer': { skills: ['battery chemistry', 'thermal management', 'bms design', 'cell testing'], certs: ['ISO 26262', 'EV Safety Level 2'] },
  'Data Scientist': { skills: ['python', 'machine learning', 'deep learning', 'sql', 'tableau'], certs: ['AWS Certified', 'TensorFlow Certificate'] },
  'Quality Engineer': { skills: ['six sigma', 'iso 9001', 'spc', 'root cause analysis', 'fmea'], certs: ['Six Sigma Green Belt', 'ISO 9001 Auditor'] },
  'Automation Engineer': { skills: ['plc programming', 'scada', 'robotics', 'industrial iot', 'autocad'], certs: ['PMP', 'ABB Robotics'] },
  'Supply Chain Analyst': { skills: ['sap mm', 'demand forecasting', 'logistics', 'power bi'], certs: ['APICS CSCP', 'SAP Certified'] },
  'Safety Specialist': { skills: ['hazop', 'risk assessment', 'iso 45001', 'emergency planning'], certs: ['NEBOSH', 'ISO 45001 Lead Auditor'] },
  'Project Manager': { skills: ['agile', 'jira', 'stakeholder management', 'budgeting', 'safe'], certs: ['PMP', 'SAFe Agilist'] },
  'UX Designer': { skills: ['figma', 'prototyping', 'user research', 'design systems', 'css'], certs: ['Google UX Certificate'] },
  'Software Engineer': { skills: ['c++', 'embedded systems', 'autosar', 'linux', 'git'], certs: ['AUTOSAR Certified'] },
  'Mechanical Engineer': { skills: ['cad', 'fea', 'solidworks', 'catia', 'structural analysis'], certs: ['CATIA V5 Certified'] },
  'Process Engineer': { skills: ['lean manufacturing', 'value stream', 'kaizen', 'process optimization'], certs: ['Lean Six Sigma Black Belt'] },
  'Materials Scientist': { skills: ['xrd', 'sem', 'polymer science', 'nanomaterials'], certs: ['Materials Science Professional'] },
};

export default function DashboardPage() {
  const { projectConfig, setProjectConfig, scenarios, setScenarios, selectScenario, selectedScenarioId, markPageComplete, employees, setEmployees, setProjectHistory, addToRoster, removeFromRoster, roster } = useStore();
  const { toast } = useToast();
  const defaultPreset = PROJECT_PRESETS[0].form;
  const [form, setForm] = useState({
    name: projectConfig?.name || defaultPreset.name,
    description: projectConfig?.description || defaultPreset.description,
    targetDeadline: projectConfig?.targetDeadline || defaultPreset.targetDeadline,
    budgetMin: projectConfig?.budgetMin || defaultPreset.budgetMin,
    budgetMax: projectConfig?.budgetMax || defaultPreset.budgetMax,
    priority: (projectConfig?.priority || defaultPreset.priority) as 'Critical' | 'High' | 'Medium' | 'Low',
    staffEstimate: projectConfig?.staffEstimate || defaultPreset.staffEstimate,
  });
  const [activePreset, setActivePreset] = useState<string>('gigafactory');
  const [generating, setGenerating] = useState(false);
  const [loadingBmw, setLoadingBmw] = useState(false);

  const handleLoadBmw = async () => {
    setLoadingBmw(true);
    try {
      const [{ employees: emps, stats }, history] = await Promise.all([
        loadBmwDatabase(),
        loadProjectHistory().catch(() => []),
      ]);
      setEmployees(emps, stats);
      if (history.length > 0) setProjectHistory(history);
      markPageComplete(1);
      toast({ title: 'BMW Database Loaded', description: `${stats.total} employees · ${history.length} project records` });
    } catch {
      toast({ title: 'Failed to load database', variant: 'destructive' });
    } finally {
      setLoadingBmw(false);
    }
  };

  const handleLoadDemo = () => {
    const demo = generateDemoEmployees(100);
    const depts = new Set(demo.map(e => e.department)).size;
    const locs = new Set(demo.map(e => e.location)).size;
    setEmployees(demo, { total: demo.length, departments: depts, locations: locs, skipped: 0 });
    markPageComplete(1);
    toast({ title: 'Demo Data Loaded', description: '100 sample employees loaded' });
  };

  const handleUploadCsv = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as Record<string, string>[];
          const valid = data.filter(r => r.employee_id && r.name);
          const emps: Employee[] = valid.map(row => ({
            employee_id: row.employee_id,
            name: row.name,
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
          const depts = new Set(emps.map(e => e.department)).size;
          const locs = new Set(emps.map(e => e.location)).size;
          setEmployees(emps, { total: emps.length, departments: depts, locations: locs, skipped: data.length - valid.length });
          markPageComplete(1);
          toast({ title: 'CSV Uploaded', description: `${emps.length} employees loaded` });
        },
      });
    };
    input.click();
  };
  const [expandedProsConsId, setExpandedProsConsId] = useState<string | null>(null);
  const [customSearch, setCustomSearch] = useState('');
  const [customRoleFilter, setCustomRoleFilter] = useState('All');

  const scenarioAssignCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    scenarios.forEach(s => {
      if (s.id === 'custom') { counts[s.id] = 0; return; }
      if (s.id === selectedScenarioId) { counts[s.id] = roster.length; return; }
      counts[s.id] = s.roles.reduce((sum, r) => sum + Math.min(r.headcount, r.internalAvailable), 0);
    });
    return counts;
  }, [scenarios, selectedScenarioId, roster]);

  const computeInternalAvailable = useCallback((role: string, requiredSkills: string[]): number => {
    if (employees.length === 0) return 0;
    return employees.filter(emp => {
      const empSkills = (emp.technical_skills || '').toLowerCase();
      const roleMatch = emp.role?.toLowerCase().includes(role.split(' ')[0].toLowerCase());
      const skillMatch = requiredSkills.some(skill => empSkills.includes(skill.toLowerCase()));
      return roleMatch || skillMatch;
    }).length;
  }, [employees]);

  const handleGenerate = async () => {
    if (!form.name) {
      toast({ title: 'Missing Info', description: 'Please enter a project name', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setProjectConfig(form);

    const applyScenarios = (scenarioData: Scenario[]) => {
      setScenarios(scenarioData);
      markPageComplete(2);
    };

    try {
      const departments = [...new Set(employees.map(e => e.department))];
      const topRoles = [...new Set(employees.map(e => e.role))].slice(0, 10);
      const locations = [...new Set(employees.map(e => e.location))];
      const avgPerformance = employees.length > 0
        ? (employees.reduce((a, e) => a + (e.performance_rating || 3), 0) / employees.length).toFixed(1)
        : '3.0';

      let scenarioData: Scenario[];

      try {
        const result = await invokeAI<GeneratedScenarios>('generate-scenarios', {
          projectConfig: form,
          employeeSummary: { total: employees.length, departments, topRoles, locations, avgPerformance },
        });

        scenarioData = result.scenarios.map(s => ({
          ...s,
          roles: s.roles.map(r => {
            const avail = computeInternalAvailable(r.role, r.requiredSkills);
            const internalAvailable = Math.min(avail, r.headcount);
            return { ...r, internalAvailable, gap: Math.max(0, r.headcount - internalAvailable) };
          }),
        }));

        applyScenarios(scenarioData);
        toast({ title: 'AI Staffing Plan Generated', description: `${scenarioData.length} scenarios created by AI` });
      } catch {
        // AI unavailable — generate locally from project data
        scenarioData = generateScenariosLocally(form, computeInternalAvailable);
        applyScenarios(scenarioData);
        toast({ title: 'Staffing Plan Generated', description: `${scenarioData.length} scenarios built from project data` });
      }
    } catch (err) {
      // Complete fallback — should never reach here
      const scenarioData = generateScenariosLocally(form, computeInternalAvailable);
      applyScenarios(scenarioData);
      toast({ title: 'Staffing Plan Ready', description: 'Generated from project configuration' });
    } finally {
      setGenerating(false);
    }
  };

  const handleRoleHeadcountChange = useCallback((scenarioId: string, roleIndex: number, newHeadcount: number) => {
    const updated = scenarios.map(s => {
      if (s.id !== scenarioId) return s;
      const newRoles = s.roles.map((r, i) => {
        if (i !== roleIndex) return r;
        const hc = Math.max(0, newHeadcount);
        const avail = computeInternalAvailable(r.role, r.requiredSkills);
        return { ...r, headcount: hc, internalAvailable: Math.min(avail, hc), gap: Math.max(0, hc - Math.min(avail, hc)) };
      });
      const totalHc = newRoles.reduce((sum, r) => sum + r.headcount, 0);
      return { ...s, roles: newRoles, totalHeadcount: totalHc, costEstimate: `€${(totalHc * 0.17).toFixed(1)}M` };
    });
    setScenarios(updated);
  }, [scenarios, setScenarios, computeInternalAvailable]);

  const handleSelectScenario = (s: Scenario) => {
    selectScenario(s.id);
    toast({ title: 'Scenario Selected', description: s.label });
  };

  const handleSelectAndAssign = (s: Scenario) => {
    selectScenario(s.id);
    if (s.id !== 'custom' && employees.length > 0) {
      const currentRoster = useStore.getState().roster;
      currentRoster.forEach(id => removeFromRoster(id));
      const assigned = new Set<string>();
      s.roles.forEach(role => {
        const scored = employees
          .filter(emp => !assigned.has(emp.employee_id))
          .map(emp => ({ emp, score: calculateCompositeScore(emp, role.requiredSkills, role.requiredCerts, form.priority) }))
          .sort((a, b) => b.score.total - a.score.total)
          .slice(0, Math.min(role.headcount, role.internalAvailable));
        scored.forEach(({ emp }) => { assigned.add(emp.employee_id); addToRoster(emp.employee_id); });
      });
      toast({ title: 'Scenario Selected & Assigned', description: `${s.label} — ${assigned.size} employees auto-assigned` });
    } else {
      toast({ title: 'Scenario Selected', description: s.label });
    }
  };

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

  const radarData = useMemo(() => {
    if (employees.length === 0 || !selectedScenario) {
      return [
        { subject: 'Technical Depth', A: 50 }, { subject: 'Leadership', A: 50 },
        { subject: 'Delivery Speed', A: 50 }, { subject: 'Innovation', A: 50 },
        { subject: 'Collaboration', A: 50 }, { subject: 'Certifications', A: 50 },
      ];
    }
    const allReqSkills = selectedScenario.roles.flatMap(r => r.requiredSkills);
    const matched = employees.filter(emp => {
      const empSkills = (emp.technical_skills || '').toLowerCase();
      return allReqSkills.some(s => empSkills.includes(s));
    });
    if (matched.length === 0) {
      return [
        { subject: 'Technical Depth', A: 30 }, { subject: 'Leadership', A: 30 },
        { subject: 'Delivery Speed', A: 30 }, { subject: 'Innovation', A: 30 },
        { subject: 'Collaboration', A: 30 }, { subject: 'Certifications', A: 30 },
      ];
    }
    const avgPerf = matched.reduce((a, e) => a + (e.performance_rating || 3), 0) / matched.length;
    const avgPeer = matched.reduce((a, e) => a + (e.peer_feedback_score || 3), 0) / matched.length;
    const avgSucc = matched.reduce((a, e) => a + (e.products_deployed > 0 ? (e.successful_products_deployed / e.products_deployed) * 100 : 50), 0) / matched.length;
    const certCount = matched.filter(e => (e.certifications || '').length > 0).length;

    return [
      { subject: 'Technical Depth', A: Math.round(avgPerf / 5 * 100) },
      { subject: 'Leadership', A: Math.round((matched.filter(e => e.project_position === 'Lead' || e.project_position === 'Core Contributor').length / matched.length) * 100) },
      { subject: 'Delivery Speed', A: Math.round(avgSucc) },
      { subject: 'Innovation', A: Math.round(matched.filter(e => e.internal_moves > 1).length / matched.length * 100) },
      { subject: 'Collaboration', A: Math.round(avgPeer / 5 * 100) },
      { subject: 'Certifications', A: Math.round((certCount / matched.length) * 100) },
    ];
  }, [employees, selectedScenario]);

  const bottomCards = useMemo(() => {
    if (!selectedScenario) return { criticalGaps: 0, criticalRoles: '', upskillCount: 0, avgSkillMatch: 0, flightRiskCount: 0, flightRiskNames: '' };
    const criticalRoles = selectedScenario.roles.filter(r => r.gap > r.headcount * 0.5);
    const highRisk = employees.filter(e => e.flight_risk?.toLowerCase() === 'high');
    const allReqSkills = selectedScenario.roles.flatMap(r => r.requiredSkills);
    const upskillPool = employees.filter(emp => {
      const empSkills = (emp.technical_skills || '').toLowerCase();
      const matchCount = allReqSkills.filter(s => empSkills.includes(s)).length;
      return matchCount > 0 && matchCount < allReqSkills.length * 0.8;
    });
    const avgMatch = upskillPool.length > 0
      ? Math.round(upskillPool.reduce((a, e) => {
          const sc = calculateCompositeScore(e, allReqSkills, []);
          return a + sc.skillMatchPct;
        }, 0) / upskillPool.length)
      : 0;

    return {
      criticalGaps: criticalRoles.length, criticalRoles: criticalRoles.map(r => r.role).join(', '),
      upskillCount: upskillPool.length, avgSkillMatch: avgMatch,
      flightRiskCount: highRisk.length, flightRiskNames: highRisk.slice(0, 3).map(e => e.name).join(', '),
    };
  }, [selectedScenario, employees]);

  const priorityOptions = [
    { value: 'Critical' as const, color: 'bg-red-900 text-red-100 border-red-800' },
    { value: 'High' as const, color: 'bg-destructive/80 text-destructive-foreground border-destructive' },
    { value: 'Medium' as const, color: 'bg-yellow-600/80 text-yellow-100 border-yellow-600' },
    { value: 'Low' as const, color: 'bg-green-600/80 text-green-100 border-green-600' },
  ];

  return (
    <div>
      <PageHeader title="Project Dashboard" subtitle="Configure your initiative and generate staffing scenarios" />

      {employees.length === 0 ? (
        <div className="card-surface p-10 mb-6 text-center">
          <Database size={40} className="mx-auto text-muted-foreground mb-4 opacity-40" />
          <h3 className="text-foreground font-semibold mb-1">No Employee Data</h3>
          <p className="text-sm text-muted-foreground mb-6">Load workforce data to enable AI scenario generation</p>
          <div className="flex flex-col gap-3 items-center max-w-sm mx-auto">
            <Button className="w-full" onClick={handleLoadBmw} disabled={loadingBmw}>
              <Database size={15} className="mr-2" />
              {loadingBmw ? 'Loading...' : 'Load BMW Database (800 Employees)'}
            </Button>
            <Button variant="outline" className="w-full" onClick={handleUploadCsv}>
              <Upload size={15} className="mr-2" />
              Upload Your CSV
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleLoadDemo}>
              Load Demo Data (100 Employees)
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between card-surface px-4 py-2.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database size={14} className="text-primary" />
            <span><span className="text-foreground font-medium">{employees.length}</span> employees loaded</span>
            <span className="text-border">·</span>
            <span>{new Set(employees.map(e => e.department)).size} departments</span>
            <span className="text-border">·</span>
            <span>{new Set(employees.map(e => e.location)).size} locations</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleUploadCsv}>
              <Upload size={12} className="mr-1" />Replace CSV
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleLoadBmw} disabled={loadingBmw}>
              <Database size={12} className="mr-1" />{loadingBmw ? '...' : 'Reload BMW DB'}
            </Button>
          </div>
        </div>
      )}

      {/* Project Presets */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {PROJECT_PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => {
              setForm({ ...preset.form });
              setActivePreset(preset.id);
              toast({ title: `Loaded: ${preset.label}`, description: preset.tag });
            }}
            className={`text-left card-surface p-4 border-l-4 transition-all hover:ring-1 hover:ring-primary/40 ${preset.color} ${activePreset === preset.id ? 'ring-2 ring-primary' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{preset.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{preset.tag}</p>
              </div>
              {activePreset === preset.id && (
                <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">Active</span>
              )}
            </div>
            <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
              <span>📅 {preset.form.targetDeadline}</span>
              <span>💰 €{(preset.form.budgetMax / 1_000_000).toFixed(0)}M max</span>
              <span>👥 {preset.form.staffEstimate.split(',')[0].split('–')[1]?.split(' ')[0] || '?'} ppl est.</span>
            </div>
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="card-surface p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Project Name</Label>
            <Input placeholder="EV Battery Gigafactory — Munich" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>Target Deadline</Label>
            <select value={form.targetDeadline} onChange={e => setForm({ ...form, targetDeadline: e.target.value })} className="mt-1.5 w-full h-10 rounded-lg bg-input border border-border px-3 text-sm text-foreground">
              {['2026','2027','2028','2029','2030'].flatMap(y => ['Q1','Q2','Q3','Q4'].map(q => `${q} ${y}`)).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <Label>Project Description</Label>
            <Textarea placeholder="Describe your initiative..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1.5" rows={3} />
          </div>
          <div>
            <Label>Budget Min (€)</Label>
            <Input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.budgetMin}
              onChange={e => { const v = parseInt(e.target.value, 10); setForm({ ...form, budgetMin: isNaN(v) ? 0 : v }); }}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Budget Max (€)</Label>
            <Input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={form.budgetMax}
              onChange={e => { const v = parseInt(e.target.value, 10); setForm({ ...form, budgetMax: isNaN(v) ? 0 : v }); }}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Priority Level</Label>
            <div className="flex flex-col gap-2 mt-2">
              {priorityOptions.map(p => (
                <label key={p.value} className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="priority" checked={form.priority === p.value} onChange={() => setForm({ ...form, priority: p.value })} className="accent-primary" />
                  <span className={`text-xs font-medium px-2.5 py-1 rounded border ${p.color}`}>{p.value}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Staff Evaluation</Label>
            <Input placeholder="e.g. 80-120 people, heavy engineering" value={form.staffEstimate} onChange={e => setForm({ ...form, staffEstimate: e.target.value })} className="mt-1.5" />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={generating || employees.length === 0} className="mt-6 w-full">
          <Sparkles size={16} className="mr-2" />
          {generating ? 'Generating Staffing Plan...' : 'Generate Staffing Plan'}
        </Button>
      </div>

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {scenarios.map(s => (
              <div key={s.id} className="space-y-0">
                <div
                  className={`card-surface p-5 transition-all cursor-pointer ${selectedScenarioId === s.id ? 'ring-2 ring-primary' : ''} ${expandedProsConsId === s.id ? 'rounded-b-none' : ''}`}
                  onClick={() => setExpandedProsConsId(expandedProsConsId === s.id ? null : s.id)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.name}</p>
                      <h3 className="text-lg font-bold text-foreground">{s.label}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.id !== 'custom' && (expandedProsConsId === s.id ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />)}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Headcount</span><span className="text-foreground font-medium">{s.totalHeadcount}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span className="text-foreground font-medium">{s.costEstimate}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Timeline</span><span className="text-foreground font-medium">{s.timeline}</span></div>
                  </div>
                  {/* Roster assignment indicator with total/assigned */}
                  {s.id !== 'custom' && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
                      <Users size={14} className="text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {s.id === selectedScenarioId ? 'Assigned' : 'Est. Internal'}
                          </span>
                          <span className="text-sm font-bold">
                            <span className="text-primary">{scenarioAssignCounts[s.id] || 0}</span>
                            <span className="text-muted-foreground"> / {s.totalHeadcount}</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${s.totalHeadcount > 0 ? Math.min(100, ((scenarioAssignCounts[s.id] || 0) / s.totalHeadcount) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant={selectedScenarioId === s.id ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); handleSelectScenario(s); }}
                    >
                      {selectedScenarioId === s.id ? 'Selected' : 'Select Scenario'}
                    </Button>
                    {s.id !== 'custom' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => { e.stopPropagation(); handleSelectAndAssign(s); }}
                      >
                        <UserPlus size={14} className="mr-1" />
                        Select & Assign
                      </Button>
                    )}
                  </div>
                </div>

                {expandedProsConsId === s.id && s.pros.length > 0 && (
                  <div className="card-surface rounded-t-none border-t-0 p-4 space-y-3 mt-3">
                    <div>
                      <p className="text-xs font-semibold text-success uppercase tracking-wider mb-2">Pros</p>
                      <ul className="space-y-1.5">
                        {s.pros.map((pro, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 size={13} className="text-success mt-0.5 shrink-0" />{pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">Cons</p>
                      <ul className="space-y-1.5">
                        {s.cons.map((con, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <XCircle size={13} className="text-destructive mt-0.5 shrink-0" />{con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {expandedProsConsId === s.id && s.id === 'custom' && (
                  <div className="card-surface rounded-t-none border-t-0 p-4 mt-3">
                    <p className="text-xs text-muted-foreground italic">Configure role headcounts below to define your custom scenario.</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Everything below only shows after selecting a scenario */}
          {selectedScenarioId && selectedScenario && (
            <>
              {/* AI Overview — only for A/B */}
              {selectedScenarioId !== 'custom' && (
                <div className="card-surface p-5 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain size={18} className="text-primary" />
                    <h3 className="font-semibold text-foreground">AI Project Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Based on the "{selectedScenario.label}" scenario for {form.name || 'this project'}, the team requires{' '}
                    <span className="text-foreground font-medium">{selectedScenario.totalHeadcount}</span> professionals across{' '}
                    <span className="text-foreground font-medium">{selectedScenario.roles.length}</span> roles. Currently,{' '}
                    <span className="text-foreground font-medium">{selectedScenario.roles.reduce((s, r) => s + r.internalAvailable, 0)}</span> positions
                    ({selectedScenario.totalHeadcount > 0 ? Math.round(selectedScenario.roles.reduce((s, r) => s + r.internalAvailable, 0) / selectedScenario.totalHeadcount * 100) : 0}%)
                    can be filled internally, leaving a gap of{' '}
                    <span className="text-foreground font-medium">{selectedScenario.roles.reduce((s, r) => s + r.gap, 0)}</span> positions.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Required Positions</p>
                    <ul className="space-y-1.5">
                      {selectedScenario.roles.map(r => (
                        <li key={r.role} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-primary mt-0.5">•</span>
                          <span><span className="text-foreground font-medium">{r.role}</span> — {r.headcount} needed, {r.internalAvailable} available internally{r.gap > 0 && <span className="text-destructive"> (gap: {r.gap})</span>}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {bottomCards.criticalGaps > 0 && (
                    <p className="text-sm text-destructive mt-3">
                      Critical shortages in: {bottomCards.criticalRoles} — these roles have over 50% unfilled capacity.
                    </p>
                  )}
                </div>
              )}

              {/* Role Breakdown with Save */}
              <div className="card-surface p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Pencil size={15} className="text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Role Breakdown</h3>
                    <span className="text-xs text-muted-foreground ml-1">— edit headcount to model different strategies</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      markPageComplete(2);
                      toast({ title: 'Distribution Saved', description: `${selectedScenario.totalHeadcount} total across ${selectedScenario.roles.length} roles` });
                    }}
                  >
                    <Save size={14} className="mr-1.5" />
                    Save Distribution
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {selectedScenario.roles.map((r, idx) => (
                    <div key={r.role} className="bg-secondary rounded-lg p-3">
                      <p className="text-sm font-medium text-foreground truncate">{r.role}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                        <span>Need:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={r.headcount}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            handleRoleHeadcountChange(selectedScenarioId, idx, isNaN(val) ? 0 : val);
                          }}
                          className="w-12 bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      {r.gap > 0 && <p className="text-xs text-destructive mt-1">Gap: {r.gap}</p>}
                      {r.requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-2">
                          {r.requiredSkills.slice(0, 3).map(s => <span key={s} className="px-1 py-0 text-[9px] rounded bg-primary/10 text-primary">{s}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-sm border-t border-border pt-3">
                  <span className="text-muted-foreground font-medium">Total</span>
                  <span className="text-foreground font-bold">{selectedScenario.totalHeadcount} people</span>
                </div>
              </div>

              {/* Manual Employee Assignment for Scenario C */}
              {selectedScenarioId === 'custom' && employees.length > 0 && (
                <div className="card-surface p-5 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <UserPlus size={16} className="text-primary" />
                    <h3 className="font-semibold text-foreground">Assign Employees to Roster</h3>
                    <span className="text-xs text-muted-foreground ml-1">— search and add team members manually</span>
                    {roster.length > 0 && (
                      <span className="ml-auto text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {roster.length} assigned
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Search by name, skills, or department..." value={customSearch} onChange={e => setCustomSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                    </div>
                    <select value={customRoleFilter} onChange={e => setCustomRoleFilter(e.target.value)} className="h-9 rounded-lg bg-secondary border border-border px-3 text-xs text-foreground">
                      <option value="All">All Roles</option>
                      {[...new Set(employees.map(e => e.role))].sort().map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-1.5 pr-3">
                      {employees
                        .filter(emp => {
                          const search = customSearch.toLowerCase();
                          const matchesSearch = !search || emp.name.toLowerCase().includes(search) || (emp.technical_skills || '').toLowerCase().includes(search) || emp.department.toLowerCase().includes(search) || emp.role.toLowerCase().includes(search);
                          const matchesRole = customRoleFilter === 'All' || emp.role === customRoleFilter;
                          return matchesSearch && matchesRole;
                        })
                        .slice(0, 50)
                        .map(emp => {
                          const isOnRoster = roster.includes(emp.employee_id);
                          const allSkills = selectedScenario?.roles.flatMap(r => r.requiredSkills) || [];
                          const score = calculateCompositeScore(emp, allSkills, [], form.priority);
                          return (
                            <div key={emp.employee_id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isOnRoster ? 'bg-primary/8 border border-primary/15' : 'bg-secondary/50 border border-transparent hover:bg-secondary'}`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground truncate">{emp.name}</span>
                                  {isOnRoster && <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Rostered</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{emp.role}</span>
                                  <span className="text-[10px] text-muted-foreground/60">•</span>
                                  <span className="text-xs text-muted-foreground">{emp.department}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 mr-2">
                                <span className={`text-sm font-bold ${score.total >= 80 ? 'text-success' : score.total >= 60 ? 'text-warning' : 'text-destructive'}`}>{score.total}</span>
                                <p className="text-[10px] text-muted-foreground">score</p>
                              </div>
                              <Button variant={isOnRoster ? 'outline' : 'default'} size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => {
                                if (isOnRoster) { removeFromRoster(emp.employee_id); toast({ title: 'Removed', description: `${emp.name} removed from roster` }); }
                                else { addToRoster(emp.employee_id); toast({ title: 'Added', description: `${emp.name} added to roster` }); }
                              }}>
                                {isOnRoster ? <Minus size={14} /> : <Plus size={14} />}
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Team Competency + Gap Analysis */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="card-surface p-5">
                  <h3 className="font-semibold text-foreground mb-4">Team Competency Estimate</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(215,12%,52%)', fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Team" dataKey="A" stroke="hsl(205,100%,45%)" fill="hsl(205,100%,35%)" fillOpacity={0.25} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card-surface p-5">
                  <h3 className="font-semibold text-foreground mb-4">Gap Analysis Preview</h3>
                  <div className="space-y-3">
                    {(selectedScenario?.roles || []).slice(0, 6).map(r => {
                      const filledPct = (r.internalAvailable / Math.max(r.headcount, 1)) * 100;
                      const externalPct = (r.gap / Math.max(r.headcount, 1)) * 100;
                      return (
                        <div key={r.role}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{r.role}</span>
                            <span className="text-muted-foreground">{r.internalAvailable}/{r.headcount}</span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                            <div className="bg-primary h-full" style={{ width: `${filledPct}%` }} />
                            {r.gap > 0 && <div className="bg-destructive h-full" style={{ width: `${externalPct}%` }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded" /> On Roster</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-destructive rounded" /> External Hire</span>
                  </div>
                </div>
              </div>

              {/* Bottom summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card-surface p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="text-destructive" size={18} />
                    <h4 className="font-semibold text-foreground text-sm">Critical Gaps</h4>
                  </div>
                  <p className="metric-value text-destructive">{bottomCards.criticalGaps}</p>
                  <p className="text-xs text-muted-foreground mt-2">{bottomCards.criticalRoles || 'No critical gaps'}</p>
                </div>
                <div className="card-surface p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="text-warning" size={18} />
                    <h4 className="font-semibold text-foreground text-sm">Upskill Candidates</h4>
                  </div>
                  <p className="metric-value text-warning">{bottomCards.upskillCount}</p>
                  <p className="text-xs text-muted-foreground mt-2">Avg skill match: {bottomCards.avgSkillMatch}%</p>
                </div>
                <div className="card-surface p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="text-score-amber" size={18} />
                    <h4 className="font-semibold text-foreground text-sm">Flight Risk Alerts</h4>
                  </div>
                  <p className="metric-value text-score-amber">{bottomCards.flightRiskCount}</p>
                  <p className="text-xs text-muted-foreground mt-2">{bottomCards.flightRiskNames || 'No high-risk employees'}</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
