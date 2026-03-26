import { generateSummary } from "./post-summary";

type Message = {
  speaker: "user" | "assistant" | "system" | "unknown";
  text: string;
};

function parseSourceChat(sourceChat: string): Message[] {
  const lines = sourceChat.split("\n");
  const messages: Message[] = [];
  let current: Message | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const match = line.match(/^(user|assistant|system)\s*:\s*(.*)$/i);

    if (match) {
      if (current?.text.trim()) {
        messages.push({
          speaker: current.speaker,
          text: current.text.trim(),
        });
      }

      current = {
        speaker: match[1].toLowerCase() as Message["speaker"],
        text: match[2].trim(),
      };

      continue;
    }

    if (!current) {
      current = {
        speaker: "unknown",
        text: line,
      };
      continue;
    }

    current.text = `${current.text} ${line}`.trim();
  }

  if (current?.text.trim()) {
    messages.push({
      speaker: current.speaker,
      text: current.text.trim(),
    });
  }

  return messages;
}

function formatSpeakerLabel(speaker: Message["speaker"]) {
  if (speaker === "assistant") {
    return "Assistant replied";
  }

  if (speaker === "system") {
    return "System noted";
  }

  if (speaker === "user") {
    return "User said";
  }

  return "Message";
}

function formatQuotedTranscript(messages: Message[]) {
  return messages
    .map((message) => `${formatSpeakerLabel(message.speaker)}: "${message.text}"`)
    .join("\n\n");
}

function inferTitle(title: string, paragraphs: string[]) {
  if (title.trim()) {
    return title.trim();
  }

  const firstSentence = paragraphs
    .join(" ")
    .replace(/[*#>`_-]/g, " ")
    .match(/[^.!?]+/)?.[0]
    ?.trim();

  if (!firstSentence) {
    return "Untitled idea";
  }

  return firstSentence.slice(0, 80).trim();
}

export function generateQuickDraftFromSourceChat({
  title,
  sourceChat,
}: {
  title: string;
  sourceChat: string;
}) {
  const messages = parseSourceChat(sourceChat);
  const paragraphs = messages.map((message) => message.text);

  if (paragraphs.length === 0) {
    return {
      title: title.trim() || "Untitled idea",
      summary: "",
      article: "",
    };
  }

  const articleTitle = inferTitle(title, paragraphs);
  const articleSections = [
    `## ${articleTitle}`,
    "",
    "## Conversation transcript",
    "",
    formatQuotedTranscript(messages),
  ];

  const article = articleSections.join("\n").trim();

  return {
    title: articleTitle,
    summary: generateSummary(paragraphs.join(" ")),
    article,
  };
}
