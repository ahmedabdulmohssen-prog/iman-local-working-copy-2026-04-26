import OpenAI from "openai";

// Allow OpenAI to be optional - use mock client if not configured
const hasOpenAI =
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export const openai = hasOpenAI
  ? new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!,
    })
  : // Mock client that will fail gracefully - the API has fallback handlers
    (new Proxy({}, {
      get: () => ({
        create: async () => {
          throw new Error("OpenAI not configured");
        },
      }),
    }) as any);
