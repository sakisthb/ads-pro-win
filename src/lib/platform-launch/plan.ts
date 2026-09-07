import { clampAge, normalizeCountries, type LaunchObjective, type LaunchPlatform } from "./mapping";
import type { LaunchPlan } from "./types";
import { safeFetch } from "@/lib/safe-fetch";

export interface GeneratePlanInput {
  prompt: string;
  objective: LaunchObjective;
  platforms: LaunchPlatform[];
  productName?: string;
  website?: string;
  dailyBudget?: number;
  projectContext?: string;
}

function templatePlan(input: GeneratePlanInput): LaunchPlan {
  const product = input.productName?.trim() || inferName(input.prompt);
  const budget = input.dailyBudget && input.dailyBudget > 0 ? input.dailyBudget : 80;
  const offer = input.prompt.trim().slice(0, 180) || product;
  return {
    name: `${product} — ${labelFor(input.objective)}`,
    hypothesis: `Prospecting plus retargeting for ${product}: lead with the offer, then recover warm traffic.`,
    objective: input.objective,
    platforms: input.platforms.length ? input.platforms : ["meta"],
    suggestedDailyBudget: budget,
    audience: {
      countries: normalizeCountries(["GR", "DE", "AT", "CH"]),
      ...clampAge(25, 54),
      interests: ["online shopping", "the category around this product"],
    },
    creatives: [
      {
        headline: `${product} — ships fast`,
        primaryText: `${offer}\n\nFree returns. Shop the drop before it sells out.`,
        cta: "Shop Now",
        landingUrl: input.website,
      },
      {
        headline: "The one people actually keep",
        primaryText: `Most people bounce. This one converts because the offer is specific: ${offer}`,
        cta: "Learn More",
        landingUrl: input.website,
      },
      {
        headline: "Last chance on this drop",
        primaryText: `If you already looked once, this is the reminder. ${product} is still in stock.`,
        cta: "Shop Now",
        landingUrl: input.website,
      },
    ],
    funnel: {
      cold: { label: "Broad + interest prospecting", share: 0.55 },
      warm: { label: "Site visitors · 7–14 days", share: 0.28 },
      hot: { label: "Cart / checkout abandoners", share: 0.17 },
    },
  };
}

function inferName(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New campaign";
  return cleaned.split(/[.!?]/)[0]?.slice(0, 48) || "New campaign";
}

function labelFor(objective: LaunchObjective): string {
  switch (objective) {
    case "sales":
      return "Sales";
    case "traffic":
      return "Traffic";
    case "awareness":
      return "Awareness";
    case "leads":
      return "Leads";
    case "engagement":
      return "Engagement";
  }
}

export async function generateLaunchPlan(input: GeneratePlanInput): Promise<LaunchPlan> {
  const fallback = templatePlan(input);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write paid-social campaign plans. Return JSON only with keys: name, hypothesis, suggestedDailyBudget, countries (ISO-2 array), ageMin, ageMax, interests (string array), creatives (array of {headline, primaryText, cta}). Headlines <= 40 chars. Primary text <= 125 words. CTA is Shop Now, Learn More, or Sign Up.",
          },
          {
            role: "user",
            content: JSON.stringify({
              prompt: input.prompt,
              objective: input.objective,
              platforms: input.platforms,
              productName: input.productName,
              website: input.website,
              dailyBudget: input.dailyBudget,
              projectContext: input.projectContext,
            }),
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as {
      name?: string;
      hypothesis?: string;
      suggestedDailyBudget?: number;
      countries?: string[];
      ageMin?: number;
      ageMax?: number;
      interests?: string[];
      creatives?: Array<{ headline?: string; primaryText?: string; cta?: string }>;
    };
    const age = clampAge(parsed.ageMin, parsed.ageMax);
    return {
      ...fallback,
      name: parsed.name?.trim() || fallback.name,
      hypothesis: parsed.hypothesis?.trim() || fallback.hypothesis,
      suggestedDailyBudget:
        Number(parsed.suggestedDailyBudget) > 0
          ? Number(parsed.suggestedDailyBudget)
          : fallback.suggestedDailyBudget,
      audience: {
        countries: normalizeCountries(parsed.countries),
        ageMin: age.ageMin,
        ageMax: age.ageMax,
        interests:
          Array.isArray(parsed.interests) && parsed.interests.length > 0
            ? parsed.interests.map(String).slice(0, 8)
            : fallback.audience.interests,
      },
      creatives:
        Array.isArray(parsed.creatives) && parsed.creatives.length > 0
          ? parsed.creatives.slice(0, 4).map((c) => ({
              headline: (c.headline || fallback.creatives[0].headline).slice(0, 40),
              primaryText: c.primaryText || fallback.creatives[0].primaryText,
              cta: c.cta || "Shop Now",
              landingUrl: input.website,
            }))
          : fallback.creatives,
    };
  } catch (error) {
    console.error("[platform-launch] generateLaunchPlan failed", error);
    return fallback;
  }
}
