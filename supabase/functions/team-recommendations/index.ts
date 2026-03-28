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
    const { projectName, dimensions, overallScore, warnings, rosterSize, scenarioLabel, roleBreakdown } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a BMW Group organizational effectiveness advisor. Analyze team composition and readiness dimensions to provide strategic recommendations.

Provide:
- 3 specific improvement actions to boost team readiness score
- Team composition assessment narrative
- Identification of the weakest dimension and how to fix it
- An overall team grade (A, B, C, D, F) with justification

Be data-driven and actionable. Use only ASCII characters.`;

    const userPrompt = `Project: ${projectName}
Scenario: ${scenarioLabel}
Roster Size: ${rosterSize}
Overall Readiness: ${overallScore}%

Dimension Scores:
${dimensions.map((d: any) => `- ${d.name}: ${d.score}/100 — ${d.explanation}`).join('\n')}

Active Warnings:
${warnings.map((w: any) => `- [${w.type}] ${w.text}`).join('\n')}

Role Breakdown:
${roleBreakdown.map((r: any) => `- ${r.role}: ${r.filled}/${r.headcount} filled`).join('\n')}`;

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
            name: "recommend_improvements",
            description: "Generate team improvement recommendations",
            parameters: {
              type: "object",
              properties: {
                improvements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      action: { type: "string" },
                      impact: { type: "string" },
                      effort: { type: "string", enum: ["Low", "Medium", "High"] },
                      expectedScoreGain: { type: "number" },
                    },
                    required: ["action", "impact", "effort", "expectedScoreGain"],
                    additionalProperties: false,
                  },
                },
                compositionAssessment: { type: "string" },
                weakestDimension: { type: "string" },
                weakestFix: { type: "string" },
                teamGrade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
                gradeJustification: { type: "string" },
              },
              required: ["improvements", "compositionAssessment", "weakestDimension", "weakestFix", "teamGrade", "gradeJustification"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "recommend_improvements" } },
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
    console.error("team-recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
