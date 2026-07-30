export function normaliseIsbn(value: string) {
  return value
    .replace(/^\s*ISBN(?:-?(?:10|13))?\s*:?\s*/i, "")
    .replace(/[^0-9X]/gi, "")
    .toUpperCase();
}

export function isValidIsbn13(value: string) {
  const isbn = normaliseIsbn(value);
  if (!/^\d{13}$/.test(isbn)) return false;
  const total = isbn
    .slice(0, 12)
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === Number(isbn[12]);
}

export function isbnFromDetectedBarcode(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");

  for (let index = 0; index <= digits.length - 13; index += 1) {
    const candidate = digits.slice(index, index + 13);
    if (
      /^(978|979)/.test(candidate) &&
      isValidIsbn13(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}
