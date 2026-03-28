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
    const { candidates, targetRole, requiredSkills, projectContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a BMW Group senior talent acquisition analyst. Evaluate external candidates for specific roles and provide strategic hiring recommendations.

For each candidate, provide:
- A fit assessment (Strong Fit, Good Fit, Moderate Fit, Weak Fit)
- Key strengths (2-3 bullet points)
- Concerns (1-2 bullet points)
- A recommended action (Hire, Interview, Waitlist, Pass)

Also provide an overall hiring strategy summary.
Use only ASCII characters.`;

    const userPrompt = `Target Role: ${targetRole}
Required Skills: ${requiredSkills.join(', ')}
Project: ${projectContext}

Candidates to evaluate:
${candidates.map((c: any, i: number) => `${i + 1}. ${c.name} — ${c.currentRole} at ${c.company}, ${c.yearsExp} yrs exp, Skills: ${c.skills}, Score: ${c.score}/100, Salary: EUR${c.salary}`).join('\n')}`;

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
            name: "evaluate_candidates",
            description: "Evaluate and rank candidates",
            parameters: {
              type: "object",
              properties: {
                evaluations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      candidateId: { type: "string" },
                      fitLevel: { type: "string", enum: ["Strong Fit", "Good Fit", "Moderate Fit", "Weak Fit"] },
                      strengths: { type: "array", items: { type: "string" } },
                      concerns: { type: "array", items: { type: "string" } },
                      recommendation: { type: "string", enum: ["Hire", "Interview", "Waitlist", "Pass"] },
                    },
                    required: ["candidateId", "fitLevel", "strengths", "concerns", "recommendation"],
                    additionalProperties: false,
                  },
                },
                hiringStrategy: { type: "string" },
                topPick: { type: "string" },
              },
              required: ["evaluations", "hiringStrategy", "topPick"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "evaluate_candidates" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const raw = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(sanitize(raw)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-candidates error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
