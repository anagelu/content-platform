"use client";

import type { KeyboardEvent } from "react";
import { useRef } from "react";

function updateSelectedLines(
  textarea: HTMLTextAreaElement,
  transform: (lines: string[]) => string[],
) {
  const value = textarea.value;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;

  const blockStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextLineBreak = value.indexOf("\n", selectionEnd);
  const blockEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const selectedBlock = value.slice(blockStart, blockEnd);
  const updatedBlock = transform(selectedBlock.split("\n")).join("\n");
  const nextValue =
    value.slice(0, blockStart) + updatedBlock + value.slice(blockEnd);

  textarea.value = nextValue;
  textarea.focus();
  textarea.setSelectionRange(blockStart, blockStart + updatedBlock.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export function NotesFormattedTextarea({
  id,
  name,
  rows,
  required,
  defaultValue,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  name: string;
  rows: number;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyFormatting(transform: (lines: string[]) => string[]) {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    updateSelectedLines(textarea, transform);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const value = textarea.value;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;

    if (selectionStart !== selectionEnd) {
      return;
    }

    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lineEnd =
      value.indexOf("\n", selectionStart) === -1
        ? value.length
        : value.indexOf("\n", selectionStart);
    const currentLine = value.slice(lineStart, lineEnd);

    const bulletMatch = currentLine.match(/^(\s*)-\s(.*)$/);
    const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
    const indentMatch = !bulletMatch && !numberedMatch
      ? currentLine.match(/^(\s{2,})(.*)$/)
      : null;

    let insertion = "";

    if (bulletMatch) {
      insertion = `\n${bulletMatch[1]}- `;
    } else if (numberedMatch) {
      insertion = `\n${numberedMatch[1]}${Number(numberedMatch[2]) + 1}. `;
    } else if (indentMatch) {
      insertion = `\n${indentMatch[1]}`;
    } else {
      return;
    }

    event.preventDefault();

    const nextValue =
      value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);
    const nextCursor = selectionStart + insertion.length;

    textarea.value = nextValue;
    textarea.focus();
    textarea.setSelectionRange(nextCursor, nextCursor);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <>
      <div className="format-toolbar">
        <button
          type="button"
          className="mini-button"
          onClick={() =>
            applyFormatting((lines) =>
              lines.map((line) => `${line.startsWith("- ") ? "" : "- "}${line}`),
            )
          }
        >
          Bullet
        </button>
        <button
          type="button"
          className="mini-button"
          onClick={() =>
            applyFormatting((lines) =>
              lines.map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s/, "")}`),
            )
          }
        >
          Number
        </button>
        <button
          type="button"
          className="mini-button"
          onClick={() =>
            applyFormatting((lines) => lines.map((line) => `  ${line}`))
          }
        >
          Indent
        </button>
        <button
          type="button"
          className="mini-button"
          onClick={() =>
            applyFormatting((lines) =>
              lines.map((line) => line.replace(/^ {1,2}/, "")),
            )
          }
        >
          Outdent
        </button>
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        value={value}
        className="form-textarea"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </>
  );
}
