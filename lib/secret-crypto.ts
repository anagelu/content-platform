import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getEncryptionSecret() {
  const secret =
    process.env.ALPACA_TOKEN_ENCRYPTION_SECRET?.trim() || process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "Missing token encryption secret. Set ALPACA_TOKEN_ENCRYPTION_SECRET or AUTH_SECRET.",
    );
  }

  return scryptSync(secret, "pattern-foundry-alpaca-token", KEY_LENGTH);
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), encrypted.toString("base64"), authTag.toString("base64")].join(
    ".",
  );
}

export function decryptSecret(payload: string) {
  const [ivBase64, encryptedBase64, authTagBase64] = payload.split(".");

  if (!ivBase64 || !encryptedBase64 || !authTagBase64) {
    throw new Error("Encrypted secret payload is invalid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionSecret(),
    Buffer.from(ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
