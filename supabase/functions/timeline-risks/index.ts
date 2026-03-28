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
    const { projectName, deadline, teamSize, phases, bottleneck, readyByMonth, dayOneCount, rosterDetails, externalDetails, upskillDetails } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a BMW Group program management advisor specializing in workforce timeline planning.

Analyze the project timeline and provide:
- 3 timeline risks with severity, affected phase, and mitigation strategy
- A timeline health assessment (On Track, At Risk, Critical Delay)
- 2-3 acceleration opportunities to speed up readiness
- A narrative summary of the timeline situation

Be specific about months and quarters. Use only ASCII characters.`;

    const userPrompt = `Project: ${projectName}
Deadline: ${deadline}
Team Size: ${teamSize}
Ready By Month: ${readyByMonth}
Day-One Capacity: ${dayOneCount}
Bottleneck: ${bottleneck}

Phases:
${phases.map((p: any) => `- ${p.label} (${p.title}): ${p.desc}`).join('\n')}

Team Details:
- Internal roster: ${rosterDetails.count} people (${rosterDetails.leadCount} leads, ${rosterDetails.handoverCount} needing handover)
- External hires: ${externalDetails.count} candidates (avg ${externalDetails.avgNotice} weeks notice)
- Upskilling: ${upskillDetails.count} candidates (avg ${upskillDetails.avgWeeks} weeks training)`;

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
            name: "assess_timeline",
            description: "Assess timeline risks and opportunities",
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
                      affectedPhase: { type: "string" },
                      mitigation: { type: "string" },
                    },
                    required: ["severity", "description", "affectedPhase", "mitigation"],
                    additionalProperties: false,
                  },
                },
                timelineHealth: { type: "string", enum: ["On Track", "At Risk", "Critical Delay"] },
                accelerationOpportunities: { type: "array", items: { type: "string" } },
                narrative: { type: "string" },
              },
              required: ["risks", "timelineHealth", "accelerationOpportunities", "narrative"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "assess_timeline" } },
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
    console.error("timeline-risks error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
