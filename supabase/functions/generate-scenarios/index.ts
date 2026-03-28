import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Strip non-ASCII garbage characters that the model sometimes injects
function sanitize(obj: unknown): unknown {
  if (typeof obj === "string") return obj.replace(/[^\x00-\x7F\u00C0-\u024F\u1E00-\u1EFF€£¥°±×÷]/g, "").trim();
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitize(v);
    return out;
  }
  return obj;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectConfig, employeeSummary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior workforce planning strategist at BMW Group. You generate staffing scenarios for strategic initiatives.

Given a project configuration and employee data summary, generate exactly 2 staffing scenarios (Optimal and Lean) plus a Custom template.

Return a JSON object using this exact tool call structure. Each scenario must have realistic, data-driven numbers.

Rules:
- Scenario A (id: "optimal") should be full-scale with higher headcount, lower risk, shorter timeline
- Scenario B (id: "lean") should be cost-efficient with ~70% headcount, medium risk, longer timeline  
- Scenario C (id: "custom") is a blank template with 0 headcount
- Each role must have: role name, headcount, requiredSkills (array of 3-5 lowercase skills), requiredCerts (array of 1-2 certifications)
- Use roles relevant to the project domain (battery, software, manufacturing, etc.)
- Generate 6-10 roles per scenario
- Cost estimates should be in format "€X.XM"
- Timeline should be in format "X months"
- Provide 3-4 pros and cons per scenario
- Label should be a creative name based on the project (e.g., "Full-Scale Launch", "Phased Rollout")
- Rationale should be 1-2 sentences explaining the scenario
- IMPORTANT: Use only standard ASCII characters. Do not include any special Unicode characters or symbols.`;

    const userPrompt = `Project: ${projectConfig.name}
Description: ${projectConfig.description || 'Not provided'}
Budget: €${(projectConfig.budgetMin / 1e6).toFixed(0)}M - €${(projectConfig.budgetMax / 1e6).toFixed(0)}M
Deadline: ${projectConfig.targetDeadline}
Priority: ${projectConfig.priority}
Staff Estimate: ${projectConfig.staffEstimate || 'Not provided'}

Employee Data Summary:
- Total employees: ${employeeSummary.total}
- Departments: ${employeeSummary.departments.join(', ')}
- Top roles: ${employeeSummary.topRoles.join(', ')}
- Avg performance rating: ${employeeSummary.avgPerformance}
- Locations: ${employeeSummary.locations.join(', ')}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_scenarios",
              description: "Generate staffing scenarios for a project",
              parameters: {
                type: "object",
                properties: {
                  scenarios: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", enum: ["optimal", "lean", "custom"] },
                        name: { type: "string" },
                        label: { type: "string" },
                        totalHeadcount: { type: "number" },
                        costEstimate: { type: "string" },
                        timeline: { type: "string" },
                        risk: { type: "string", enum: ["Low", "Medium", "High", "None"] },
                        rationale: { type: "string" },
                        pros: { type: "array", items: { type: "string" } },
                        cons: { type: "array", items: { type: "string" } },
                        roles: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              role: { type: "string" },
                              headcount: { type: "number" },
                              requiredSkills: { type: "array", items: { type: "string" } },
                              requiredCerts: { type: "array", items: { type: "string" } },
                            },
                            required: ["role", "headcount", "requiredSkills", "requiredCerts"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["id", "name", "label", "totalHeadcount", "costEstimate", "timeline", "risk", "rationale", "pros", "cons", "roles"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["scenarios"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_scenarios" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const raw = JSON.parse(toolCall.function.arguments);
    const result = sanitize(raw);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-scenarios error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
