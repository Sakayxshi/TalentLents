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
    const { projectConfig, scenarioLabel, teamComposition, costs, readiness, risks: existingRisks } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a BMW Group C-suite strategic advisor. Generate executive-level insights and recommendations for workforce planning decisions.

Provide:
- 3 key strategic risks with severity levels (High, Medium, Low)
- 3 prioritized action items  
- An executive narrative paragraph (3-4 sentences) summarizing the workforce readiness situation
- A confidence assessment of the plan

Be specific, data-driven, and actionable. Reference actual numbers from the data provided. Use only ASCII characters.`;

    const userPrompt = `Project: ${projectConfig.name}
Priority: ${projectConfig.priority}
Budget: €${(projectConfig.budgetMin / 1e6).toFixed(0)}M - €${(projectConfig.budgetMax / 1e6).toFixed(0)}M
Deadline: ${projectConfig.targetDeadline}
Scenario: ${scenarioLabel}

Team Composition:
- Total: ${teamComposition.total}
- Internal: ${teamComposition.internal}
- Upskilled: ${teamComposition.upskilled}
- External: ${teamComposition.external}

Costs:
- Total: €${(costs.total / 1e6).toFixed(2)}M
- Internal: €${(costs.internal / 1000).toFixed(0)}k
- External: €${(costs.external / 1e6).toFixed(2)}M
- Per Head: €${(costs.perHead / 1000).toFixed(1)}k

Team Readiness Score: ${readiness}%

Existing Risk Signals:
${existingRisks.join('\n')}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_insights",
              description: "Generate executive insights and recommendations",
              parameters: {
                type: "object",
                properties: {
                  risks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["High", "Medium", "Low"] },
                        description: { type: "string" },
                      },
                      required: ["severity", "description"],
                      additionalProperties: false,
                    },
                  },
                  actions: {
                    type: "array",
                    items: { type: "string" },
                  },
                  narrative: { type: "string" },
                  confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                },
                required: ["risks", "actions", "narrative", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
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
    console.error("executive-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
