import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { postings, projectName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior talent acquisition specialist at BMW Group. Generate compelling, professional job posting descriptions.

For each role provided, create a complete job posting with:
- opening: An engaging paragraph about the project and opportunity (2-3 sentences)
- roleOverview: What the role entails and its impact (2-3 sentences)
- requiredQualifications: 5 specific, measurable requirements
- preferredQualifications: 4 nice-to-have qualifications
- bmwOffers: A compelling paragraph about BMW's employee value proposition

Make each posting unique and tailored to the specific role. Use professional BMW corporate tone.`;

    const userPrompt = `Project: ${projectName}

Generate job postings for these roles:
${postings.map((p: any, i: number) => `${i + 1}. ${p.role} (${p.department}, ${p.location}, ${p.salaryBand}) - Required skills: ${p.skills?.join(', ') || 'N/A'}`).join('\n')}`;

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
              name: "generate_postings",
              description: "Generate job posting descriptions",
              parameters: {
                type: "object",
                properties: {
                  postings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        roleId: { type: "string" },
                        opening: { type: "string" },
                        roleOverview: { type: "string" },
                        requiredQualifications: { type: "array", items: { type: "string" } },
                        preferredQualifications: { type: "array", items: { type: "string" } },
                        bmwOffers: { type: "string" },
                      },
                      required: ["roleId", "opening", "roleOverview", "requiredQualifications", "preferredQualifications", "bmwOffers"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["postings"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_postings" } },
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

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-job-postings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
