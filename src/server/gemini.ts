import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODELS = 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3-flash-preview';

/**
 * Resolved lazily. ESM hoists imports, so reading process.env at module load
 * would happen before server.ts calls dotenv.config() and silently ignore .env.
 */
function getModelPool(): string[] {
  const configured = (process.env.GEMINI_MODELS || DEFAULT_MODELS)
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_MODELS.split(',');
}

function getApiKey(): string | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'your-gemini-api-key') return null;
  return apiKey;
}

let lastKnownGoodModel: string | null = null;
let lastFailure: { model: string; reason: string; status?: number } | null = null;

export function getGeminiStatus() {
  return {
    configured: Boolean(getApiKey()),
    models: getModelPool(),
    activeModel: lastKnownGoodModel,
    lastFailure,
  };
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isRetryableStatus(status: unknown): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function buildPrompt(
  query: string,
  structuredContext: string,
  unstructuredContext: string,
  sourceSummary: string
): string {
  return `You are InsightAI, an elite enterprise business intelligence & decision intelligence engine.
Analyze the user's natural language question using the provided multi-source business evidence (structured tabular data + unstructured corporate documents).

USER QUESTION:
"${query}"

AVAILABLE DATA SOURCES:
${sourceSummary}

STRUCTURED DATA EXCERPTS & METRICS:
${structuredContext}

UNSTRUCTURED DOCUMENT EXCERPTS & CITATIONS:
${unstructuredContext}

TASK:
Produce an explainable, fact-grounded, executive-grade analysis with:
1. "executiveHeadline": One punchy, high-impact headline summarizing the core business finding.
2. "directAnswer": A short, easy-to-read executive summary of 2-4 sentences that answers the question clearly and cites key facts without being verbose.
3. "keyMetrics": 3-4 key numerical KPIs (e.g., Revenue Delta, Churn Loss, SLA Breach Rate, Cost Impact).
4. "chart": An optimal visualization spec to display the finding (type: 'bar' | 'line' | 'donut', title, categories, series).
5. "evidenceTrail": 3-6 explicit evidence citations directly quoting the source data with sourceFile, sourceType ('structured' | 'unstructured'), location (e.g. "Row #14" or "Page 2, Line 45"), snippet (exact verbatim quote or row data), relevanceRationale, and confidenceScore (80-99).
6. "recommendations": 2-3 high-leverage strategic decisions/interventions for human review (title, description, impactLevel: 'High'|'Medium'|'Low', urgency: 'Immediate'|'Short-Term'|'Strategic', estimatedBenefit, suggestedActionItems).
7. "reasoningSteps": 3-4 sequential thought steps explaining how you corroborated the data across structured and unstructured sources.

CRITICAL GROUNDING RULES:
- Every number in your answer MUST appear verbatim in the provided data excerpts. Never estimate or invent figures.
- Answer the user's actual question directly. Do not return generic filler.
- If the provided excerpts do not contain enough information to fully answer the question, state exactly which data is missing instead of guessing.

Respond ONLY with valid JSON conforming to this structure:
{
  "executiveHeadline": string,
  "directAnswer": string,
  "keyMetrics": [
    { "label": string, "value": string, "change": string, "isPositive": boolean, "subtext": string }
  ],
  "chart": {
    "type": "bar" | "line" | "donut",
    "title": string,
    "subtitle": string,
    "xAxisLabel": string,
    "yAxisLabel": string,
    "categories": [string],
    "series": [{ "name": string, "data": [number] }]
  },
  "evidenceTrail": [
    {
      "sourceFile": string,
      "sourceType": "structured" | "unstructured",
      "location": string,
      "snippet": string,
      "relevanceRationale": string,
      "confidenceScore": number
    }
  ],
  "recommendations": [
    {
      "title": string,
      "description": string,
      "impactLevel": "High" | "Medium" | "Low",
      "urgency": "Immediate" | "Short-Term" | "Strategic",
      "estimatedBenefit": string,
      "suggestedActionItems": [string]
    }
  ],
  "reasoningSteps": [string]
}`;
}

export async function generateAnalysisWithGemini(
  query: string,
  structuredContext: string,
  unstructuredContext: string,
  sourceSummary: string
) {
  const ai = getGeminiClient();
  if (!ai) {
    lastFailure = { model: getModelPool()[0], reason: 'GEMINI_API_KEY is missing or still set to its placeholder value' };
    console.error('Gemini client unavailable:', lastFailure.reason);
    return null;
  }

  const prompt = buildPrompt(query, structuredContext, unstructuredContext, sourceSummary);
  const modelPool = getModelPool();
  const candidates = lastKnownGoodModel
    ? [lastKnownGoodModel, ...modelPool.filter((model) => model !== lastKnownGoodModel)]
    : modelPool;

  let lastError: unknown = null;

  for (const model of candidates) {
    const callGemini = async () =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

    let response;
    try {
      response = await callGemini();
    } catch (primaryErr: any) {
      if (isRetryableStatus(primaryErr?.status) && /503/.test(primaryErr?.message || '')) {
        console.warn(`Gemini ${model} 503; retrying in 1200ms...`);
        await new Promise((res) => setTimeout(res, 1200));
      }
      try {
        response = await callGemini();
      } catch (retryErr: any) {
        lastError = retryErr;
        lastFailure = {
          model,
          status: retryErr?.status,
          reason: retryErr?.message?.split('\n')[0] || 'Gemini request failed',
        };
        console.warn(`Gemini model ${model} failed:`, retryErr?.status, lastFailure.reason);
        continue;
      }
    }

    let text = response.text?.trim() || '';
    if (!text) {
      lastFailure = { model, reason: 'Gemini returned an empty response' };
      continue;
    }

    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(text);
      lastKnownGoodModel = model;
      lastFailure = null;
      console.log(`Gemini analysis completed via model: ${model}`);
      return parsed;
    } catch (parseErr: any) {
      lastError = parseErr;
      lastFailure = { model, reason: `Gemini returned malformed JSON: ${parseErr.message}` };
      console.warn(`Gemini model ${model} returned unparseable JSON`);
      continue;
    }
  }

  console.error('All Gemini models failed:', lastError instanceof Error ? lastError.message : lastError);
  lastFailure =
    lastFailure || { model: getModelPool()[0], reason: 'All configured Gemini models failed' };
  return null;
}