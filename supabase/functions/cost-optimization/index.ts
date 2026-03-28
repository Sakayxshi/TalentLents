import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { projectName, budget, costs, teamSize, scenarioLabel, roles } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a BMW Group financial planning advisor specializing in workforce cost optimization.

Analyze the cost breakdown and provide:
- 3 specific cost optimization recommendations with estimated savings
- A budget health assessment (Healthy, Tight, Over Budget)
- ROI analysis narrative
- Risk-adjusted total cost estimate

Be specific with numbers and percentages. Reference actual data provided. Use only ASCII characters.`;

    const userPrompt = `Project: ${projectName}
Scenario: ${scenarioLabel}
Budget: EUR${(budget.min / 1e6).toFixed(1)}M - EUR${(budget.max / 1e6).toFixed(1)}M
Team Size: ${teamSize}

Cost Breakdown:
- Internal Total: EUR${(costs.internal / 1000).toFixed(0)}k
- External Total: EUR${(costs.external / 1e6).toFixed(2)}M
- Grand Total: EUR${(costs.total / 1e6).toFixed(2)}M
- Cost Per Head: EUR${(costs.perHead / 1000).toFixed(1)}k

Roles:
${roles.map((r: any) => `- ${r.role}: ${r.count} needed, EUR${r.totalCost.toLocaleString()} total`).join('\n')}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "optimize_costs",
            description: "Generate cost optimization recommendations",
            parameters: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      estimatedSavings: { type: "string" },
                      priority: { type: "string", enum: ["High", "Medium", "Low"] },
                    },
                    required: ["title", "description", "estimatedSavings", "priority"],
                    additionalProperties: false,
                  },
                },
                budgetHealth: { type: "string", enum: ["Healthy", "Tight", "Over Budget"] },
                roiNarrative: { type: "string" },
                riskAdjustedCost: { type: "string" },
              },
              required: ["recommendations", "budgetHealth", "roiNarrative", "riskAdjustedCost"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "optimize_costs" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const raw = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(sanitize(raw)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cost-optimization error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
