import assert from "node:assert/strict";
import test from "node:test";
import {
  isbnFromDetectedBarcode,
  isValidIsbn13,
  normaliseIsbn,
} from "./isbn-validation.ts";

test("normalises printed ISBN punctuation", () => {
  assert.equal(normaliseIsbn("ISBN-13: 978-1-5290-7721-6"), "9781529077216");
});

test("validates the reported book ISBN checksum", () => {
  assert.equal(isValidIsbn13("9781529077216"), true);
  assert.equal(isValidIsbn13("9781529077215"), false);
});

test("extracts an ISBN returned with a five-digit price add-on", () => {
  assert.equal(
    isbnFromDetectedBarcode("978152907721690100"),
    "9781529077216",
  );
});

test("extracts an ISBN from decorated detector output", () => {
  assert.equal(
    isbnFromDetectedBarcode("EAN-13 978-1-5290-7721-6 + 90100"),
    "9781529077216",
  );
});

test("rejects non-book and checksum-invalid barcodes", () => {
  assert.equal(isbnFromDetectedBarcode("4006381333931"), null);
  assert.equal(isbnFromDetectedBarcode("9781529077215"), null);
});
