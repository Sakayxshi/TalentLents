import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { candidates } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a BMW Group Academy learning & development specialist. Given internal employees who need upskilling to fill target roles, generate customized training paths.

For each candidate, create a training path of 2-4 courses that cover their missing skills. Use realistic BMW Group Academy and industry courses.

Each course should have:
- course: Course name (realistic training program name)
- duration: Format "X weeks"
- cost: Cost in euros (500-4000 range)
- method: "Online", "In-person", or "Hybrid"
- coversSkills: Array of skills this course addresses

Consider the employee's existing skills and target role requirements when designing paths.`;

    const userPrompt = `Generate training paths for these upskilling candidates:

${candidates.map((c: any, i: number) => `${i + 1}. ${c.name} (ID: ${c.employeeId})
   Current Role: ${c.currentRole}
   Target Role: ${c.targetRole}
   Current Skills: ${c.currentSkills}
   Missing Skills: ${c.missingSkills.join(', ')}
   Skill Overlap: ${c.overlap}%`).join('\n\n')}`;

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
              name: "generate_training_paths",
              description: "Generate training paths for upskilling candidates",
              parameters: {
                type: "object",
                properties: {
                  trainingPaths: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        employeeId: { type: "string" },
                        courses: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              course: { type: "string" },
                              duration: { type: "string" },
                              cost: { type: "number" },
                              method: { type: "string", enum: ["Online", "In-person", "Hybrid"] },
                              coversSkills: { type: "array", items: { type: "string" } },
                            },
                            required: ["course", "duration", "cost", "method", "coversSkills"],
                            additionalProperties: false,
                          },
                        },
                        totalCost: { type: "number" },
                        totalWeeks: { type: "number" },
                      },
                      required: ["employeeId", "courses", "totalCost", "totalWeeks"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["trainingPaths"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_training_paths" } },
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
    console.error("generate-upskilling error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
