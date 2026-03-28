"use client";

import { useEffect, useState } from "react";
import { NotesFormattedTextarea } from "@/app/trading/notes-formatted-textarea";
import { consumeHomeIdeaTransfer } from "@/lib/home-idea-transfer";

export function PatentProblemField({
  initialValue = "",
}: {
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (initialValue.trim()) {
      return;
    }

    const transferredIdea = consumeHomeIdeaTransfer();

    if (transferredIdea) {
      setValue(transferredIdea);
    }
  }, [initialValue]);

  return (
    <NotesFormattedTextarea
      id="problem"
      name="problem"
      rows={7}
      required
      placeholder="What problem does this invention solve and why does it matter?"
      value={value}
      onChange={setValue}
    />
  );
}
