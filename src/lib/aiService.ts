import { supabase } from '@/integrations/supabase/client';

export async function invokeAI<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    console.error(`AI function ${functionName} error:`, error);
    throw new Error(error.message || `Failed to call ${functionName}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export interface GeneratedScenarios {
  scenarios: Array<{
    id: string;
    name: string;
    label: string;
    totalHeadcount: number;
    costEstimate: string;
    timeline: string;
    risk: 'Low' | 'Medium' | 'High' | 'None';
    rationale: string;
    pros: string[];
    cons: string[];
    roles: Array<{
      role: string;
      headcount: number;
      requiredSkills: string[];
      requiredCerts: string[];
    }>;
  }>;
}

export interface GeneratedPostings {
  postings: Array<{
    roleId: string;
    opening: string;
    roleOverview: string;
    requiredQualifications: string[];
    preferredQualifications: string[];
    bmwOffers: string;
  }>;
}

export interface GeneratedTrainingPaths {
  trainingPaths: Array<{
    employeeId: string;
    courses: Array<{
      course: string;
      duration: string;
      cost: number;
      method: 'Online' | 'In-person' | 'Hybrid';
      coversSkills: string[];
    }>;
    totalCost: number;
    totalWeeks: number;
  }>;
}

export interface ExecutiveInsights {
  risks: Array<{
    severity: 'High' | 'Medium' | 'Low';
    description: string;
  }>;
  actions: string[];
  narrative: string;
  confidence: 'High' | 'Medium' | 'Low';
}
