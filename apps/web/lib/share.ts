const SHARE_ID_LENGTH = 9;
const SHARE_CODE_PATTERN = /^[a-z0-9]{9}$/;
const SHARE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateShareCode(length = SHARE_ID_LENGTH): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * SHARE_ALPHABET.length);
    code += SHARE_ALPHABET[randomIndex];
  }
  return code;
}

export function normalizeShareCode(input?: string | null): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();
  return SHARE_CODE_PATTERN.test(normalized) ? normalized : null;
}
