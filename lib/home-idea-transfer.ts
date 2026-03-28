export const HOME_IDEA_TRANSFER_KEY = "pattern-foundry:home-idea-transfer";

export function storeHomeIdeaTransfer(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    window.sessionStorage.removeItem(HOME_IDEA_TRANSFER_KEY);
    return;
  }

  window.sessionStorage.setItem(HOME_IDEA_TRANSFER_KEY, trimmed);
}

export function readHomeIdeaTransfer() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(HOME_IDEA_TRANSFER_KEY)?.trim() || "";
}

export function consumeHomeIdeaTransfer() {
  if (typeof window === "undefined") {
    return "";
  }

  const value = readHomeIdeaTransfer();

  if (value) {
    window.sessionStorage.removeItem(HOME_IDEA_TRANSFER_KEY);
  }

  return value;
}
