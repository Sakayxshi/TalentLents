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
    const { projectName, roles, missingCerts, totalEmployees, rosterSize } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a BMW Group workforce planning strategist. Analyze staffing gaps and provide a comprehensive gap resolution strategy.

Provide:
- A prioritized action plan for each gap role (hire vs upskill vs contract recommendation)
- Overall staffing health assessment
- Critical path identification (which gaps to fill first)
- Market availability insight for each role

Be specific and actionable. Use only ASCII characters.`;

    const userPrompt = `Project: ${projectName}
Total Workforce: ${totalEmployees}
Current Roster: ${rosterSize}

Staffing Gaps by Role:
${roles.map((r: any) => `- ${r.role}: ${r.filled}/${r.headcount} filled (gap: ${r.gap}), ${r.upskillable} upskill candidates, ${r.externalNeeded} external needed
  Missing Skills: ${r.missingSkills?.join(', ') || 'None'}
  Missing Certs: ${r.missingCerts?.join(', ') || 'None'}`).join('\n')}

Missing Qualifications Across Team:
${missingCerts.map((c: any) => `- ${c.cert}: needed by ${c.count} roles`).join('\n')}`;

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
            name: "create_gap_strategy",
            description: "Create a gap resolution strategy",
            parameters: {
              type: "object",
              properties: {
                roleStrategies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      role: { type: "string" },
                      approach: { type: "string", enum: ["Hire Externally", "Upskill Internal", "Contract/Temp", "Mixed Approach"] },
                      rationale: { type: "string" },
                      marketAvailability: { type: "string", enum: ["High", "Medium", "Low", "Scarce"] },
                      timeToFill: { type: "string" },
                      priority: { type: "number" },
                    },
                    required: ["role", "approach", "rationale", "marketAvailability", "timeToFill", "priority"],
                    additionalProperties: false,
                  },
                },
                staffingHealth: { type: "string", enum: ["Strong", "Adequate", "Concerning", "Critical"] },
                criticalPath: { type: "string" },
                narrative: { type: "string" },
              },
              required: ["roleStrategies", "staffingHealth", "criticalPath", "narrative"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_gap_strategy" } },
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
    console.error("gap-strategy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
