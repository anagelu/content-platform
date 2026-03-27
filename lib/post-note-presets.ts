export const POST_NOTE_PRESETS = [
  {
    id: "operator",
    label: "Operator / Technical",
    notes: `Open with the concrete action taken and the result, if there is one.

Use active voice throughout. Write like a developer explaining what actually happened.

Make the key insight specific. Explain why the change worked, not just what changed.

If the source supports it, include a short BEFORE vs AFTER comparison with numbers.

Keep the ending short and direct. End with a takeaway or recommendation, not a corporate wrap-up.

Remove generic AI filler. Prefer shorter, sharper sentences and concrete wording.`,
  },
  {
    id: "point_of_view",
    label: "Point of View",
    notes: `Make my real opinion clear early.

Emphasize the main argument, what I agree with, what I disagree with, and what should be challenged.

Avoid bland summary language. Keep the writing direct, specific, and human.

If there is a recommendation, state it plainly.`,
  },
  {
    id: "explain_clearly",
    label: "Explain Clearly",
    notes: `Turn this into a clear teaching-style post.

Prioritize clarity over cleverness. Break down the idea simply, define unfamiliar terms, and use short examples where they help.

Keep the tone practical and readable.`,
  },
] as const;
