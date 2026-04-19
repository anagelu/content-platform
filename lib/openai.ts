import { parseOpenAIUsage } from "@/lib/ai-usage";
import { parseGeminiUsage } from "@/lib/ai-usage";
import { getAiCapacityTier, getAiProvider, getModelForTier } from "@/lib/ai-admin";
import {
  buildTradingSetupAiContext,
  getTradingSetupDefinition,
} from "@/lib/trading-setups";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_ARTICLE_MODEL = "gpt-5-mini";
const DEFAULT_POST_DRAFT_MODEL = "gemini-2.5-flash-lite";
const OPENAI_TIMEOUT_MS = 20000;
const MAX_POST_SOURCE_CHARS = 6000;

type GenerateArticleInput = {
  title: string;
  sourceChat: string;
};

type GenerateArticleOutput = {
  title: string;
  summary: string;
  article: string;
  usage: OpenAIUsageStats;
};

type GeneratePostDraftInput = {
  title: string;
  sourceChat: string;
  authorNotes?: string;
};

type GeneratePostDraftOutput = {
  title: string;
  summary: string;
  article: string;
  presentationOutline: string;
  model: string;
  usage: OpenAIUsageStats;
};

type RefinePostDraftIntent =
  | "regenerate"
  | "improve"
  | "shorter"
  | "detailed"
  | "simplify"
  | "persuasive"
  | "tone";

type RefinePostDraftTone = "professional" | "casual" | "persuasive" | "technical";
type RefinePostDraftLength = "shorter" | "same" | "longer";
type RefinePostDraftFocus = "clarity" | "detail" | "emotion" | "argument";

type RefinePostDraftInput = {
  title: string;
  sourceChat?: string;
  authorNotes?: string;
  currentSummary?: string;
  currentArticle: string;
  intent: RefinePostDraftIntent;
  tone?: RefinePostDraftTone;
  length?: RefinePostDraftLength;
  focus?: RefinePostDraftFocus;
  instruction?: string;
  advancedPrompt?: string;
};

type RefinePostDraftOutput = {
  summary: string;
  article: string;
  model: string;
  usage: OpenAIUsageStats;
};

type GenerateBookDraftInput = {
  title: string;
  bookType: string;
  targetLength?: string;
  audience?: string;
  tone?: string;
  sourceDraft: string;
  authorNotes?: string;
  storySynopsis?: string;
  storyChapterCount?: number | null;
  storyStructureNotes?: string;
  characterProfilesJson?: string;
  settingProfilesJson?: string;
};

type GenerateBookDraftOutput = {
  title: string;
  summary: string;
  outline: string;
  sections: Array<{
    kind: string;
    title: string;
    summary: string;
    content: string;
  }>;
  model: string;
  usage: OpenAIUsageStats;
};

type GenerateBookSectionRefineInput = {
  bookTitle: string;
  bookType: string;
  targetLength?: string;
  audience?: string;
  tone?: string;
  bookSummary?: string;
  outline?: string;
  authorNotes?: string;
  storySynopsis?: string;
  storyChapterCount?: number | null;
  storyStructureNotes?: string;
  characterProfilesJson?: string;
  settingProfilesJson?: string;
  selectedCharacterProfilesJson?: string;
  selectedSettingProfilesJson?: string;
  sceneGoal?: string;
  sceneConflict?: string;
  povCharacterName?: string;
  sectionKind: string;
  sectionTitle: string;
  sectionSummary?: string;
  sectionContent: string;
};

type GenerateBookSectionRefineOutput = {
  kind: string;
  title: string;
  summary: string;
  content: string;
  model: string;
  usage: OpenAIUsageStats;
};

type GenerateStoryCharacterProfileInput = {
  bookTitle: string;
  storySynopsis?: string;
  storyChapterCount?: number | null;
  storyStructureNotes?: string;
  settingProfilesJson?: string;
  characterName?: string;
  characterRole?: string;
  characterSeedNotes?: string;
};

type GenerateStoryCharacterProfileOutput = {
  name: string;
  role: string;
  goal: string;
  conflict: string;
  arc: string;
  voice: string;
  notes: string;
  model: string;
  usage: OpenAIUsageStats;
};

type GenerateStorySettingProfileInput = {
  bookTitle: string;
  storySynopsis?: string;
  storyChapterCount?: number | null;
  storyStructureNotes?: string;
  characterProfilesJson?: string;
  settingName?: string;
  settingPurpose?: string;
  settingSeedNotes?: string;
};

type GenerateStorySettingProfileOutput = {
  name: string;
  purpose: string;
  description: string;
  sensoryNotes: string;
  rules: string;
  model: string;
  usage: OpenAIUsageStats;
};

type GenerateTradingJournalAssistInput = {
  title: string;
  market: string;
  timeframe: string;
  direction: string;
  executionNotes: string;
  mistakeReview: string;
  lessonLearned: string;
};

type GenerateTradingJournalAssistOutput = {
  title: string;
  summary: string;
  lessonLearned: string;
  model: string;
  usage: OpenAIUsageStats;
};

type GenerateTradingSessionAssistInput = {
  title: string;
  market: string;
  timeframe: string;
  setupType: string;
  direction: string;
  sourceChat: string;
  setupContextText?: string;
  chartTimeframe?: string;
  chartScreenshotUrl?: string;
  chartNotes?: string;
  livePrice?: number | null;
  liveChange?: number | null;
  liveChangePercent?: number | null;
  liveFetchedAt?: string;
};

type GenerateTradingSessionAssistOutput = {
  title: string;
  thesis: string;
  workflowNotes: string;
  model: string;
  usage: OpenAIUsageStats;
};

type GenerateAlgoControllerV2CopilotInput = {
  userMessage: string;
  contextText: string;
  conversationText?: string;
};

type GenerateAlgoControllerV2CopilotOutput = {
  reply: string;
  suggestedActions: string[];
  warnings: string[];
  recommendedMode: "standard" | "turbo" | "hold";
  model: string;
  usage: OpenAIUsageStats;
};

type GenerateSpatialAgentInsightInput = {
  systemInstruction: string;
  userText: string;
};

type GenerateSpatialAgentInsightOutput = {
  reply: string;
  model: string;
  usage: OpenAIUsageStats;
};

type OpenAIUsageStats = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

function isStoryBookType(value: string) {
  return /novel|story|fiction|novella|fantasy|romance|thriller/i.test(value);
}

type StoryCharacterContext = {
  id?: string;
  name?: string;
  role?: string;
  goal?: string;
  conflict?: string;
  arc?: string;
  voice?: string;
  notes?: string;
};

type StorySettingContext = {
  id?: string;
  name?: string;
  purpose?: string;
  description?: string;
  sensoryNotes?: string;
  rules?: string;
};

function parseJsonArray<T>(value: string) {
  if (!value.trim()) {
    return [] as T[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function formatStoryCharacters(value: string) {
  const characters = parseJsonArray<StoryCharacterContext>(value)
    .filter((character) =>
      [
        character.name,
        character.role,
        character.goal,
        character.conflict,
        character.arc,
        character.voice,
        character.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
    )
    .map((character) => {
      const lines = [
        `- ${character.name?.trim() || "Untitled character"}`,
        `  Role: ${character.role?.trim() || "(not specified)"}`,
        `  Goal: ${character.goal?.trim() || "(not specified)"}`,
        `  Conflict: ${character.conflict?.trim() || "(not specified)"}`,
        `  Arc: ${character.arc?.trim() || "(not specified)"}`,
        `  Voice: ${character.voice?.trim() || "(not specified)"}`,
        `  Notes: ${character.notes?.trim() || "(none)"}`,
      ];

      return lines.join("\n");
    });

  return characters.length > 0 ? characters.join("\n\n") : "(none)";
}

function formatStorySettings(value: string) {
  const settings = parseJsonArray<StorySettingContext>(value)
    .filter((setting) =>
      [
        setting.name,
        setting.purpose,
        setting.description,
        setting.sensoryNotes,
        setting.rules,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
    )
    .map((setting) => {
      const lines = [
        `- ${setting.name?.trim() || "Untitled setting"}`,
        `  Purpose: ${setting.purpose?.trim() || "(not specified)"}`,
        `  Description: ${setting.description?.trim() || "(not specified)"}`,
        `  Sensory notes: ${setting.sensoryNotes?.trim() || "(not specified)"}`,
        `  Rules: ${setting.rules?.trim() || "(none)"}`,
      ];

      return lines.join("\n");
    });

  return settings.length > 0 ? settings.join("\n\n") : "(none)";
}

function formatPovCharacterContext(
  povCharacterName: string,
  selectedCharacterProfilesJson: string,
  characterProfilesJson: string,
) {
  const allCharacters = [
    ...parseJsonArray<StoryCharacterContext>(selectedCharacterProfilesJson),
    ...parseJsonArray<StoryCharacterContext>(characterProfilesJson),
  ];
  const normalizedPovName = povCharacterName.trim().toLowerCase();
  const povCharacter = normalizedPovName
    ? allCharacters.find(
        (character) => character.name?.trim().toLowerCase() === normalizedPovName,
      )
    : null;

  if (!povCharacterName.trim() && !povCharacter) {
    return "(not specified)";
  }

  if (!povCharacter) {
    return `Name: ${povCharacterName.trim()}`;
  }

  return [
    `Name: ${povCharacter.name?.trim() || povCharacterName.trim() || "Unknown POV"}`,
    `Role: ${povCharacter.role?.trim() || "(not specified)"}`,
    `Goal: ${povCharacter.goal?.trim() || "(not specified)"}`,
    `Conflict: ${povCharacter.conflict?.trim() || "(not specified)"}`,
    `Arc: ${povCharacter.arc?.trim() || "(not specified)"}`,
    `Voice: ${povCharacter.voice?.trim() || "(not specified)"}`,
    `Notes: ${povCharacter.notes?.trim() || "(none)"}`,
  ].join("\n");
}

function getResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim();
  }

  const content = record.output
    ?.flatMap((item) => item.content ?? [])
    .filter(
      (item): item is { type: "output_text"; text: string } =>
        item.type === "output_text" && typeof item.text === "string",
    )
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n");

  return content ?? "";
}

function extractJson(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);

  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

function parseModelJson<T>(text: string): T {
  const candidates = [text, extractJson(text)].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;

      if (typeof parsed === "string") {
        return JSON.parse(extractJson(parsed)) as T;
      }

      return parsed as T;
    } catch {
      continue;
    }
  }

  throw new Error("The model returned unreadable JSON.");
}

export function getArticleGenerationModel() {
  return process.env.OPENAI_ARTICLE_MODEL || DEFAULT_ARTICLE_MODEL;
}

export async function getPostDraftGenerationModel() {
  const provider = await getAiProvider();

  if (provider === "openai" && process.env.OPENAI_POST_DRAFT_MODEL?.trim()) {
    return process.env.OPENAI_POST_DRAFT_MODEL;
  }

  if (provider === "gemini" && process.env.GEMINI_MODEL?.trim()) {
    return process.env.GEMINI_MODEL;
  }

  const tier = await getAiCapacityTier();
  return getModelForTier(tier, provider) || DEFAULT_POST_DRAFT_MODEL;
}

async function createOpenAIResponse(body: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        store: false,
        ...body,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI request failed (${response.status}): ${errorText || "Unknown error"}`,
      );
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI request timed out. Try again with a shorter transcript.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getGeminiResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates =
    "candidates" in payload
      ? (payload as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                text?: string;
              }>;
            };
          }>;
        }).candidates
      : undefined;

  return (
    candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim() || "")
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

async function createGeminiResponse({
  model,
  systemInstruction,
  userText,
  maxOutputTokens,
  responseSchema,
  tools,
}: {
  model: string;
  systemInstruction: string;
  userText: string;
  maxOutputTokens: number;
  responseSchema?: Record<string, unknown>;
  tools?: Array<Record<string, unknown>>;
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userText }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens,
            responseMimeType: "application/json",
            ...(responseSchema ? { responseSchema } : {}),
          },
          ...(tools && tools.length > 0 ? { tools } : {}),
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini request failed (${response.status}): ${errorText || "Unknown error"}`,
      );
    }

    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Gemini request timed out. Try again with a shorter transcript.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateArticleFromSourceChat({
  title,
  sourceChat,
}: GenerateArticleInput): Promise<GenerateArticleOutput> {
  const payload = await createOpenAIResponse({
      model: getArticleGenerationModel(),
      max_output_tokens: 1800,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You turn pasted AI chat sessions into polished writing. Return JSON only with keys title, summary, and article. The article should read like a clean essay or article in Markdown. The summary should be 1 to 3 sentences. Keep the author's original idea, remove chat noise, and do not mention that the text came from an AI chat unless the source itself is explicitly about that.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Working title: ${title || "Untitled idea"}

Source conversation:
${sourceChat}

Return a JSON object with this exact shape:
{
  "title": "improved title",
  "summary": "short summary",
  "article": "markdown article"
}`,
            },
          ],
        },
      ],
  });
  const responseText = getResponseText(payload);
  const jsonText = extractJson(responseText);

  let parsed: Partial<GenerateArticleOutput & { presentationOutline: string }>;

  try {
    parsed = JSON.parse(jsonText) as Partial<GenerateArticleOutput>;
  } catch {
    throw new Error("The model returned an unreadable draft response.");
  }

  if (
    !parsed ||
    typeof parsed.title !== "string" ||
    typeof parsed.summary !== "string" ||
    typeof parsed.article !== "string"
  ) {
    throw new Error("The model returned an incomplete draft response.");
  }

  return {
    title: parsed.title.trim() || title || "Untitled idea",
    summary: parsed.summary.trim(),
    article: parsed.article.trim(),
    usage: parseOpenAIUsage(payload),
  };
}

export async function generatePostDraftFromSourceChat({
  title,
  sourceChat,
  authorNotes = "",
}: GeneratePostDraftInput): Promise<GeneratePostDraftOutput> {
  const trimmedSourceChat = sourceChat.trim();

  if (!trimmedSourceChat) {
    throw new Error("Add some source chat before generating with AI.");
  }

  if (trimmedSourceChat.length > MAX_POST_SOURCE_CHARS) {
    throw new Error(
      `Source chat is too long for this low-cost draft flow. Keep it under ${MAX_POST_SOURCE_CHARS} characters. If the original session is longer, condense it first or ask the source AI to summarize the main idea, key turns, and final takeaways.`,
    );
  }

  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const systemInstruction =
    "You are a cost-conscious writing assistant for a content platform. Convert the source chat into a concise post package. Return JSON only with keys title, summary, presentationOutline, and article. Keep the summary to 1 to 3 sentences. Keep the presentationOutline concise and useful for speaking or presenting. Keep the article under 500 words, use Markdown headings sparingly, and preserve the author's core ideas without filler or meta commentary about AI.";
  const userText = `Working title: ${title || "Untitled idea"}

Source conversation:
${trimmedSourceChat}

Author notes:
${authorNotes.trim() || "(none)"}

Return a JSON object with this exact shape:
{
  "title": "improved title",
  "summary": "short summary",
  "presentationOutline": "short presentation outline",
  "article": "markdown article"
}`;
  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 900,
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 900,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);

  let parsed: Partial<GenerateArticleOutput & { presentationOutline: string }>;

  try {
    parsed = JSON.parse(jsonText) as Partial<
      GenerateArticleOutput & { presentationOutline: string }
    >;
  } catch {
    throw new Error("The model returned an unreadable draft response.");
  }

  if (
    !parsed ||
    typeof parsed.title !== "string" ||
    typeof parsed.summary !== "string" ||
    typeof parsed.presentationOutline !== "string" ||
    typeof parsed.article !== "string"
  ) {
    throw new Error("The model returned an incomplete draft response.");
  }

  return {
    title: parsed.title.trim() || title || "Untitled idea",
    summary: parsed.summary.trim(),
    presentationOutline: parsed.presentationOutline.trim(),
    article: parsed.article.trim(),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function refinePostDraftWithAi({
  title,
  sourceChat = "",
  authorNotes = "",
  currentSummary = "",
  currentArticle,
  intent,
  tone = "professional",
  length = "same",
  focus = "clarity",
  instruction = "",
  advancedPrompt = "",
}: RefinePostDraftInput): Promise<RefinePostDraftOutput> {
  const trimmedArticle = currentArticle.trim();
  const trimmedSourceChat = sourceChat.trim();

  if (!trimmedArticle) {
    throw new Error("Add some draft content before refining it.");
  }

  if (trimmedArticle.length > MAX_POST_SOURCE_CHARS) {
    throw new Error(
      `Draft content is too long for this low-cost refine flow. Keep it under ${MAX_POST_SOURCE_CHARS} characters, or trim it down to the sections you want refined next.`,
    );
  }

  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const intentInstruction =
    intent === "regenerate"
      ? "Produce a stronger fresh version while preserving the same core idea."
      : intent === "improve"
        ? "Improve clarity, rhythm, and sentence quality without changing the main point."
        : intent === "shorter"
          ? "Make the draft shorter, tighter, and faster to read while preserving the main idea."
          : intent === "simplify"
            ? "Simplify the draft so it is easier to follow, easier to read, and less cognitively dense."
            : intent === "persuasive"
              ? "Make the draft more persuasive with clearer argument, stronger framing, and more convincing reasoning."
              : intent === "tone"
                ? "Adjust the tone while preserving the same core substance and direction."
                : "Make the draft more detailed with clearer explanation, examples, and support while keeping the same direction.";
  const systemInstruction =
    "You are a cost-conscious writing assistant refining an AI-assisted post draft. Return JSON only with keys summary and article. Keep the author's viewpoint intact, preserve the strongest original idea, and avoid generic filler or meta commentary about AI.";
  const userText = `Working title: ${title || "Untitled idea"}
Refinement request: ${intentInstruction}

Source conversation:
${trimmedSourceChat || "(not provided)"}

Author notes:
${authorNotes.trim() || "(none)"}

Requested tone: ${tone}
Requested length: ${length}
Requested focus: ${focus}
Specific instruction:
${instruction.trim() || "(none)"}

Advanced refinement prompt:
${advancedPrompt.trim() || "(none)"}

Current summary:
${currentSummary.trim() || "(none)"}

Current article:
${trimmedArticle}

Return a JSON object with this exact shape:
{
  "summary": "updated summary",
  "article": "updated markdown article"
}`;
  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 900,
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 900,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);

  let parsed: Partial<Pick<RefinePostDraftOutput, "summary" | "article">>;

  try {
    parsed = JSON.parse(jsonText) as Partial<
      Pick<RefinePostDraftOutput, "summary" | "article">
    >;
  } catch {
    throw new Error("The model returned an unreadable refine response.");
  }

  if (
    !parsed ||
    typeof parsed.summary !== "string" ||
    typeof parsed.article !== "string"
  ) {
    throw new Error("The model returned an incomplete refine response.");
  }

  return {
    summary: parsed.summary.trim(),
    article: parsed.article.trim(),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function generateBookDraftFromSourceMaterial({
  title,
  bookType,
  targetLength = "",
  audience = "",
  tone = "",
  sourceDraft,
  authorNotes = "",
  storySynopsis = "",
  storyChapterCount = null,
  storyStructureNotes = "",
  characterProfilesJson = "",
  settingProfilesJson = "",
}: GenerateBookDraftInput): Promise<GenerateBookDraftOutput> {
  const trimmedSourceDraft = sourceDraft.trim();

  if (!trimmedSourceDraft) {
    throw new Error("Add a rough draft or concept before using AI generation.");
  }

  if (trimmedSourceDraft.length > MAX_POST_SOURCE_CHARS) {
    throw new Error(
      `Source draft is too long for this low-cost book flow. Keep it under ${MAX_POST_SOURCE_CHARS} characters. If the original session is longer, condense it first or ask the source AI to summarize the main idea, structure, and strongest takeaways.`,
    );
  }

  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const systemInstruction =
    "You are a cost-conscious book structuring assistant. Turn rough writing into an editable book package. Return JSON only with keys title, summary, outline, and sections. The summary should be 2 to 4 sentences. The outline should be a readable multi-line outline. The sections array should contain 3 to 5 items with kind, title, summary, and content. Keep section content concise but useful, aim for short section drafts rather than long chapter text, preserve the author's core ideas, and avoid filler or meta commentary about AI.";
  const userText = `Working title: ${title || "Untitled book"}
Book type: ${bookType || "General nonfiction"}
Target length: ${targetLength || "(not specified)"}
Audience: ${audience || "(not specified)"}
Tone: ${tone || "(not specified)"}

Source draft:
${trimmedSourceDraft}

Author notes:
${authorNotes.trim() || "(none)"}

Story synopsis:
${storySynopsis.trim() || "(none)"}

Planned chapters:
${storyChapterCount ?? "(not specified)"}

Story structure notes:
${storyStructureNotes.trim() || "(none)"}

Character profiles:
${characterProfilesJson.trim() || "(none)"}

Setting profiles:
${settingProfilesJson.trim() || "(none)"}

Return a JSON object with this exact shape:
{
  "title": "improved title",
  "summary": "short book summary",
  "outline": "1. Introduction ...",
  "sections": [
    {
      "kind": "Introduction",
      "title": "Section title",
      "summary": "What this section does",
      "content": "Markdown section draft"
    }
  ]
}`;

  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 2200,
          responseSchema: {
            type: "OBJECT",
            required: ["title", "summary", "outline", "sections"],
            properties: {
              title: { type: "STRING" },
              summary: { type: "STRING" },
              outline: { type: "STRING" },
              sections: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  required: ["kind", "title", "summary", "content"],
                  properties: {
                    kind: { type: "STRING" },
                    title: { type: "STRING" },
                    summary: { type: "STRING" },
                    content: { type: "STRING" },
                  },
                },
              },
            },
          },
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 2200,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  let parsed: Partial<GenerateBookDraftOutput>;

  try {
    parsed = parseModelJson<Partial<GenerateBookDraftOutput>>(
      provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload),
    );
  } catch {
    throw new Error("The model returned an unreadable book draft response.");
  }

  const sections = Array.isArray(parsed.sections)
    ? parsed.sections.filter(
        (
          section,
        ): section is {
          kind: string;
          title: string;
          summary: string;
          content: string;
        } =>
          Boolean(section) &&
          typeof section === "object" &&
          typeof section.kind === "string" &&
          typeof section.title === "string" &&
          typeof section.summary === "string" &&
          typeof section.content === "string",
      )
    : [];

  if (
    !parsed ||
    typeof parsed.title !== "string" ||
    typeof parsed.summary !== "string" ||
    typeof parsed.outline !== "string" ||
    sections.length === 0
  ) {
    throw new Error("The model returned an incomplete book draft response.");
  }

  return {
    title: parsed.title.trim() || title || "Untitled book",
    summary: parsed.summary.trim(),
    outline: parsed.outline.trim(),
    sections: sections.map((section) => ({
      kind: section.kind.trim() || "Chapter",
      title: section.title.trim() || "Untitled Section",
      summary: section.summary.trim(),
      content: section.content.trim(),
    })),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function refineBookSectionWithAi({
  bookTitle,
  bookType,
  targetLength = "",
  audience = "",
  tone = "",
  bookSummary = "",
  outline = "",
  authorNotes = "",
  storySynopsis = "",
  storyChapterCount = null,
  storyStructureNotes = "",
  characterProfilesJson = "",
  settingProfilesJson = "",
  selectedCharacterProfilesJson = "",
  selectedSettingProfilesJson = "",
  sceneGoal = "",
  sceneConflict = "",
  povCharacterName = "",
  sectionKind,
  sectionTitle,
  sectionSummary = "",
  sectionContent,
}: GenerateBookSectionRefineInput): Promise<GenerateBookSectionRefineOutput> {
  const combinedSectionText = [sectionSummary, sectionContent].filter(Boolean).join("\n\n").trim();
  const hasLocalDraft = Boolean(combinedSectionText);
  const storyMode = Boolean(
    isStoryBookType(bookType) ||
      [
        storySynopsis,
        storyStructureNotes,
        characterProfilesJson,
        settingProfilesJson,
        selectedCharacterProfilesJson,
        selectedSettingProfilesJson,
        sceneGoal,
        sceneConflict,
        povCharacterName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
  );
  const formattedCharacterProfiles = formatStoryCharacters(characterProfilesJson);
  const formattedSettingProfiles = formatStorySettings(settingProfilesJson);
  const formattedSelectedCharacters = formatStoryCharacters(selectedCharacterProfilesJson);
  const formattedSelectedSettings = formatStorySettings(selectedSettingProfilesJson);
  const formattedPovCharacter = formatPovCharacterContext(
    povCharacterName,
    selectedCharacterProfilesJson,
    characterProfilesJson,
  );

  if (
    !combinedSectionText &&
    ![
      sectionTitle,
      sceneGoal,
      sceneConflict,
      povCharacterName,
      selectedCharacterProfilesJson,
      selectedSettingProfilesJson,
      storySynopsis,
      authorNotes,
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
  ) {
    throw new Error(
      storyMode
        ? "Add at least a section title, scene goal, or story context before generating this section."
        : "Add some notes or draft content to the section before refining it.",
    );
  }

  if (combinedSectionText.length > MAX_POST_SOURCE_CHARS) {
    throw new Error(
      `This section is too long for the low-cost refine flow. Keep it under ${MAX_POST_SOURCE_CHARS} characters.`,
    );
  }

  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const systemInstruction = storyMode
    ? hasLocalDraft
      ? "You are a fiction editor and scene writer helping refine one chapter or subsection of a novel. Return JSON only with keys kind, title, summary, and content. Write actual narrative prose for the selected section only. Preserve the current section's role, POV, tone, and story direction while improving voice, scene flow, specificity, and immersion. Treat the selected characters, selected settings, POV profile, scene goal, and scene conflict as primary constraints, and use the wider book context only as background. Do not rewrite other chapters, do not return outlining notes, and do not add meta commentary about AI."
      : "You are a fiction writer helping draft one chapter or subsection of a novel from planning context. Return JSON only with keys kind, title, summary, and content. Write actual narrative prose for the selected section only, not an outline, prompt, or editorial note. Treat the selected characters, selected settings, POV profile, scene goal, and scene conflict as the main context for what happens on the page, and use the wider story bible only as supporting continuity. Keep the scope local to this section, do not rewrite other chapters, and do not add meta commentary about AI."
    : "You are a cost-conscious book editor. Refine only the requested section while preserving its role in the larger book. Return JSON only with keys kind, title, summary, and content. Keep the same section scope, improve clarity and flow, and avoid changing unrelated chapters or introducing meta commentary about AI.";
  const actionLabel = storyMode
    ? hasLocalDraft
      ? "Refine the selected story section."
      : "Draft the selected story section from the available context."
    : "Refine the selected section.";
  const userText = `Book title: ${bookTitle || "Untitled book"}
Book type: ${bookType || "General nonfiction"}
Target length: ${targetLength || "(not specified)"}
Audience: ${audience || "(not specified)"}
Tone: ${tone || "(not specified)"}
Action: ${actionLabel}
Book summary:
${bookSummary || "(not provided)"}

Outline:
${outline || "(not provided)"}

Author notes:
${authorNotes || "(none)"}

Story synopsis:
${storySynopsis || "(none)"}

Planned chapters:
${storyChapterCount ?? "(not specified)"}

Story structure notes:
${storyStructureNotes || "(none)"}

Character profiles:
${formattedCharacterProfiles}

Setting profiles:
${formattedSettingProfiles}

Characters selected for this section:
${formattedSelectedCharacters}

Settings selected for this section:
${formattedSelectedSettings}

Primary POV character:
${formattedPovCharacter}

Scene goal:
${sceneGoal || "(none)"}

Scene conflict:
${sceneConflict || "(none)"}

Section kind: ${sectionKind || "Chapter"}
Current section title: ${sectionTitle || "Untitled section"}
Current section summary:
${sectionSummary || "(none)"}

Current section draft:
${sectionContent || "(none)"}

Section-specific guidance:
${storyMode
  ? hasLocalDraft
    ? "Keep this update local to the selected section. Preserve continuity with the story bible, but focus on compelling prose, concrete detail, and scene-level momentum."
    : "Use the context above to create a self-contained draft for this section. Write narrative prose, ground the reader in the chosen POV, and turn the scene goal/conflict into the actual moment on the page."
  : "Keep this update local to the selected section and preserve its purpose in the larger book."}

Return a JSON object with this exact shape:
{
  "kind": "Chapter",
  "title": "Refined section title",
  "summary": "Short summary for this section",
  "content": "Refined markdown section content"
}`;

  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 900,
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 900,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);

  let parsed: Partial<{
    kind: string;
    title: string;
    summary: string;
    content: string;
  }>;

  try {
    parsed = JSON.parse(jsonText) as Partial<{
      kind: string;
      title: string;
      summary: string;
      content: string;
    }>;
  } catch {
    throw new Error("The model returned an unreadable section refine response.");
  }

  if (
    !parsed ||
    typeof parsed.kind !== "string" ||
    typeof parsed.title !== "string" ||
    typeof parsed.summary !== "string" ||
    typeof parsed.content !== "string"
  ) {
    throw new Error("The model returned an incomplete section refine response.");
  }

  return {
    kind: parsed.kind.trim() || sectionKind || "Chapter",
    title: parsed.title.trim() || sectionTitle || "Untitled section",
    summary: parsed.summary.trim(),
    content: parsed.content.trim(),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function generateStoryCharacterProfileWithAi({
  bookTitle,
  storySynopsis = "",
  storyChapterCount = null,
  storyStructureNotes = "",
  settingProfilesJson = "",
  characterName = "",
  characterRole = "",
  characterSeedNotes = "",
}: GenerateStoryCharacterProfileInput): Promise<GenerateStoryCharacterProfileOutput> {
  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const systemInstruction =
    "You are a cost-conscious fiction development assistant. Build a concise but useful character profile for a story project. Return JSON only with keys name, role, goal, conflict, arc, voice, and notes. Keep the profile grounded, specific, and useful for later scene writing.";
  const userText = `Book title: ${bookTitle || "Untitled story"}
Story synopsis:
${storySynopsis || "(not provided)"}

Planned chapters:
${storyChapterCount ?? "(not specified)"}

Story structure notes:
${storyStructureNotes || "(none)"}

Setting profiles:
${settingProfilesJson || "(none)"}

Character name:
${characterName || "(not provided)"}

Character role:
${characterRole || "(not provided)"}

Character seed notes:
${characterSeedNotes || "(none)"}

Return a JSON object with this exact shape:
{
  "name": "Character name",
  "role": "Story role",
  "goal": "What they want",
  "conflict": "What stands in the way",
  "arc": "How they may change",
  "voice": "How they sound or carry themselves",
  "notes": "Extra details to preserve"
}`;
  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 700,
          tools: [{ google_search: {} }],
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 700,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);
  let parsed: Partial<Omit<GenerateStoryCharacterProfileOutput, "model" | "usage">>;

  try {
    parsed = JSON.parse(jsonText) as Partial<
      Omit<GenerateStoryCharacterProfileOutput, "model" | "usage">
    >;
  } catch {
    throw new Error("The model returned an unreadable character profile response.");
  }

  if (
    !parsed ||
    typeof parsed.name !== "string" ||
    typeof parsed.role !== "string" ||
    typeof parsed.goal !== "string" ||
    typeof parsed.conflict !== "string" ||
    typeof parsed.arc !== "string" ||
    typeof parsed.voice !== "string" ||
    typeof parsed.notes !== "string"
  ) {
    throw new Error("The model returned an incomplete character profile response.");
  }

  return {
    name: parsed.name.trim(),
    role: parsed.role.trim(),
    goal: parsed.goal.trim(),
    conflict: parsed.conflict.trim(),
    arc: parsed.arc.trim(),
    voice: parsed.voice.trim(),
    notes: parsed.notes.trim(),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function generateStorySettingProfileWithAi({
  bookTitle,
  storySynopsis = "",
  storyChapterCount = null,
  storyStructureNotes = "",
  characterProfilesJson = "",
  settingName = "",
  settingPurpose = "",
  settingSeedNotes = "",
}: GenerateStorySettingProfileInput): Promise<GenerateStorySettingProfileOutput> {
  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const systemInstruction =
    "You are a cost-conscious fiction development assistant. Build a concise but useful setting profile for a story project. Return JSON only with keys name, purpose, description, sensoryNotes, and rules. Make the setting vivid enough to support scene writing without becoming bloated.";
  const userText = `Book title: ${bookTitle || "Untitled story"}
Story synopsis:
${storySynopsis || "(not provided)"}

Planned chapters:
${storyChapterCount ?? "(not specified)"}

Story structure notes:
${storyStructureNotes || "(none)"}

Character profiles:
${characterProfilesJson || "(none)"}

Setting name:
${settingName || "(not provided)"}

Setting purpose:
${settingPurpose || "(not provided)"}

Setting seed notes:
${settingSeedNotes || "(none)"}

Return a JSON object with this exact shape:
{
  "name": "Setting name",
  "purpose": "What role the setting plays",
  "description": "Core description",
  "sensoryNotes": "What it feels, sounds, or smells like",
  "rules": "Constraints, world rules, or recurring details"
}`;
  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 700,
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 700,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);
  let parsed: Partial<Omit<GenerateStorySettingProfileOutput, "model" | "usage">>;

  try {
    parsed = JSON.parse(jsonText) as Partial<
      Omit<GenerateStorySettingProfileOutput, "model" | "usage">
    >;
  } catch {
    throw new Error("The model returned an unreadable setting profile response.");
  }

  if (
    !parsed ||
    typeof parsed.name !== "string" ||
    typeof parsed.purpose !== "string" ||
    typeof parsed.description !== "string" ||
    typeof parsed.sensoryNotes !== "string" ||
    typeof parsed.rules !== "string"
  ) {
    throw new Error("The model returned an incomplete setting profile response.");
  }

  return {
    name: parsed.name.trim(),
    purpose: parsed.purpose.trim(),
    description: parsed.description.trim(),
    sensoryNotes: parsed.sensoryNotes.trim(),
    rules: parsed.rules.trim(),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function generateTradingJournalAssist({
  title,
  market,
  timeframe,
  direction,
  executionNotes,
  mistakeReview,
  lessonLearned,
}: GenerateTradingJournalAssistInput): Promise<GenerateTradingJournalAssistOutput> {
  const combinedNotes = [executionNotes, mistakeReview, lessonLearned]
    .filter(Boolean)
    .join("\n\n");

  if (!combinedNotes.trim()) {
    throw new Error("Add execution notes, mistake review, or a lesson before using AI assist.");
  }

  if (combinedNotes.length > MAX_POST_SOURCE_CHARS) {
    throw new Error(
      `Journal notes are too long for the low-cost assist flow. Keep them under ${MAX_POST_SOURCE_CHARS} characters.`,
    );
  }

  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const systemInstruction =
    "You are a cost-conscious trading journal assistant. Return JSON only with keys title, summary, and lessonLearned. The title should be specific and concise. The summary should be 1 to 2 sentences for a journal preview. The lessonLearned should be a practical paragraph or short bullet list the trader can reuse next time. Preserve the actual trading notes and avoid hype.";
  const userText = `Existing title: ${title || "Untitled trade"}
Market: ${market || "Unknown"}
Timeframe: ${timeframe || "Unknown"}
Direction: ${direction || "Unknown"}

Execution notes:
${executionNotes || "(none)"}

Mistake review:
${mistakeReview || "(none)"}

Current lesson:
${lessonLearned || "(none)"}

Return a JSON object with this exact shape:
{
  "title": "improved journal title",
  "summary": "1 to 2 sentence summary",
  "lessonLearned": "practical lesson text"
}`;
  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 500,
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 500,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);

  let parsed: Partial<{
    title: string;
    summary: string;
    lessonLearned: string;
  }>;

  try {
    parsed = JSON.parse(jsonText) as Partial<{
      title: string;
      summary: string;
      lessonLearned: string;
    }>;
  } catch {
    throw new Error("The model returned an unreadable journal assist response.");
  }

  if (
    !parsed ||
    typeof parsed.title !== "string" ||
    typeof parsed.summary !== "string" ||
    typeof parsed.lessonLearned !== "string"
  ) {
    throw new Error("The model returned an incomplete journal assist response.");
  }

  return {
    title: parsed.title.trim() || title || "Untitled trade",
    summary: parsed.summary.trim(),
    lessonLearned: parsed.lessonLearned.trim(),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function generateTradingSessionAssist({
  title,
  market,
  timeframe,
  setupType,
  direction,
  sourceChat,
  setupContextText = "",
  chartTimeframe = "",
  chartScreenshotUrl = "",
  chartNotes = "",
  livePrice = null,
  liveChange = null,
  liveChangePercent = null,
  liveFetchedAt = "",
}: GenerateTradingSessionAssistInput): Promise<GenerateTradingSessionAssistOutput> {
  const trimmedSourceChat = sourceChat.trim();

  if (!trimmedSourceChat) {
    throw new Error("Add a source session before using AI assist.");
  }

  if (trimmedSourceChat.length > MAX_POST_SOURCE_CHARS) {
    throw new Error(
      `Source session is too long for this low-cost assist flow. Keep it under ${MAX_POST_SOURCE_CHARS} characters. If the original session is longer, condense it first or ask the source AI to summarize the setup, key confirmations, and final takeaways.`,
    );
  }

  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const setupDefinition = getTradingSetupDefinition(setupType);
  const setupAiContext = buildTradingSetupAiContext(setupType, null);
  const systemInstruction =
    "You are a cost-conscious trading session assistant. Return JSON only with keys title, thesis, and workflowNotes. The title should be concise and specific. The thesis should summarize the trade idea, confirmations, invalidation, and chart structure in clear trader language. The workflowNotes should be a short actionable checklist or execution plan. Use the source session as the main source of truth, incorporate the selected setup framework and chart notes when provided, and treat screenshot URLs as references rather than evidence you can visually inspect. Preserve the user's actual market logic, explain the setup clearly enough that a less experienced trader could follow the reasoning, and avoid hype.";
  const userText = `Existing title: ${title || "Untitled setup"}
Market: ${market || "Unknown"}
Timeframe: ${timeframe || "Unknown"}
Setup type: ${setupDefinition?.label || setupType || "Unknown"}
Direction: ${direction || "Unknown"}
Chart timeframe: ${chartTimeframe || "(same as decision timeframe)"}
Chart screenshot URL: ${chartScreenshotUrl || "(none provided)"}
Live price: ${livePrice ?? "(unavailable)"}
Live change: ${liveChange ?? "(unavailable)"}
Live change percent: ${liveChangePercent ?? "(unavailable)"}
Live market timestamp: ${liveFetchedAt || "(unavailable)"}

Setup framework:
${setupAiContext || "(none)"}

Setup details entered by the trader:
${setupContextText || "(none)"}

Chart notes:
${chartNotes || "(none)"}

Source session:
${trimmedSourceChat}

Return a JSON object with this exact shape:
{
  "title": "improved session title",
  "thesis": "trade thesis text",
  "workflowNotes": "execution checklist or workflow notes"
}`;

  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 700,
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 700,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);

  let parsed: Partial<{
    title: string;
    thesis: string;
    workflowNotes: string;
  }>;

  try {
    parsed = JSON.parse(jsonText) as Partial<{
      title: string;
      thesis: string;
      workflowNotes: string;
    }>;
  } catch {
    throw new Error("The model returned an unreadable trading session assist response.");
  }

  if (
    !parsed ||
    typeof parsed.title !== "string" ||
    typeof parsed.thesis !== "string" ||
    typeof parsed.workflowNotes !== "string"
  ) {
    throw new Error("The model returned an incomplete trading session assist response.");
  }

  return {
    title: parsed.title.trim() || title || "Untitled setup",
    thesis: parsed.thesis.trim(),
    workflowNotes: parsed.workflowNotes.trim(),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function generateAlgoControllerV2Copilot({
  userMessage,
  contextText,
  conversationText = "",
}: GenerateAlgoControllerV2CopilotInput): Promise<GenerateAlgoControllerV2CopilotOutput> {
  const trimmedMessage = userMessage.trim();
  const trimmedContext = contextText.trim();
  const trimmedConversation = conversationText.trim();

  if (!trimmedMessage) {
    throw new Error("Add a copilot message before requesting guidance.");
  }

  if (!trimmedContext) {
    throw new Error("Algo Controller V2 context is missing for the copilot request.");
  }

  if (trimmedMessage.length > 2500) {
    throw new Error("Keep the copilot message under 2500 characters.");
  }

  if (trimmedContext.length > 16000) {
    throw new Error("The cockpit context is too large for this assist flow.");
  }

  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const systemInstruction =
    "You are the Pattern Foundry Algo Controller V2 copilot. You help the user interpret the cockpit, explain why a setup is or is not ready, and suggest next steps. You are grounded only in the provided context and must never pretend to see live market data beyond it. Do not claim you executed trades or changed controls. Be conservative, instrument-like, and concise. If the context is mixed, say so clearly. Answer the user's actual question directly instead of repeating a generic safety summary. Always anchor the reply to the selected ticker and analysis timeframe when they are available. If the user asks about whether a ticker looks good, start by naming the ticker, timeframe, and current directional read before discussing warnings. Prefer the most specific live cockpit signals first: selected market, timeframe, overall confluence, trend, execution, top candle signal, and mode recommendation. Only mention safety locks when they are relevant to the user's question. Return JSON only with keys reply, suggestedActions, warnings, and recommendedMode. Keep reply to 2 short paragraphs max. suggestedActions and warnings should be short strings. recommendedMode must be one of standard, turbo, or hold.";
  const userText = `User message:
${trimmedMessage}

Recent copilot conversation:
${trimmedConversation || "(no prior conversation)"}

Algo Controller V2 context:
${trimmedContext}

Return a JSON object with this exact shape:
{
  "reply": "short grounded explanation that names the selected ticker and timeframe when available",
  "suggestedActions": ["short action", "short action"],
  "warnings": ["short warning"],
  "recommendedMode": "standard"
}`;

  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction,
          userText,
          maxOutputTokens: 700,
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 700,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userText }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);

  let parsed: Partial<GenerateAlgoControllerV2CopilotOutput>;

  try {
    parsed = JSON.parse(jsonText) as Partial<GenerateAlgoControllerV2CopilotOutput>;
  } catch {
    throw new Error("The model returned an unreadable Algo Controller V2 copilot response.");
  }

  if (
    !parsed ||
    typeof parsed.reply !== "string" ||
    !Array.isArray(parsed.suggestedActions) ||
    !Array.isArray(parsed.warnings) ||
    (parsed.recommendedMode !== "standard" &&
      parsed.recommendedMode !== "turbo" &&
      parsed.recommendedMode !== "hold")
  ) {
    throw new Error("The model returned an incomplete Algo Controller V2 copilot response.");
  }

  return {
    reply: parsed.reply.trim(),
    suggestedActions: parsed.suggestedActions
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4),
    warnings: parsed.warnings
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4),
    recommendedMode: parsed.recommendedMode,
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}

export async function generateSpatialAgentInsight({
  systemInstruction,
  userText,
}: GenerateSpatialAgentInsightInput): Promise<GenerateSpatialAgentInsightOutput> {
  const trimmedSystemInstruction = systemInstruction.trim();
  const trimmedUserText = userText.trim();

  if (!trimmedSystemInstruction || !trimmedUserText) {
    throw new Error("Spatial agent prompt content is incomplete.");
  }

  const model = await getPostDraftGenerationModel();
  const provider = await getAiProvider();
  const replyInstruction =
    `${trimmedSystemInstruction} Return JSON only with a single key, reply. Keep the reply compact and grounded in the hovered UI target.`;

  const payload =
    provider === "gemini"
      ? await createGeminiResponse({
          model,
          systemInstruction: replyInstruction,
          userText: `${trimmedUserText}

Return a JSON object with this exact shape:
{
  "reply": "short spatial explanation"
}`,
          maxOutputTokens: 400,
        })
      : await createOpenAIResponse({
          model,
          max_output_tokens: 400,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: replyInstruction }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: `${trimmedUserText}

Return a JSON object with this exact shape:
{
  "reply": "short spatial explanation"
}` }],
            },
          ],
        });

  const responseText =
    provider === "gemini" ? getGeminiResponseText(payload) : getResponseText(payload);
  const jsonText = extractJson(responseText);

  let parsed: Partial<{ reply: string }>;

  try {
    parsed = JSON.parse(jsonText) as Partial<{ reply: string }>;
  } catch {
    throw new Error("The model returned an unreadable spatial agent response.");
  }

  if (!parsed || typeof parsed.reply !== "string") {
    throw new Error("The model returned an incomplete spatial agent response.");
  }

  return {
    reply: parsed.reply.trim(),
    model,
    usage: provider === "gemini" ? parseGeminiUsage(payload) : parseOpenAIUsage(payload),
  };
}
