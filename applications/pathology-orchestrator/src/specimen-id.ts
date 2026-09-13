export function generateSpecimenId(): string {
  const now = new Date();

  const date =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");

  const random =
    Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");

  return `SP-${date}-${random}`;
}