import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chunkText } from "./rag.service";

test("kısa metin tek chunk döner", () => {
  const chunks = chunkText("Dış çekim paketi 2 saat sürer.");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], "Dış çekim paketi 2 saat sürer.");
});

test("boş metin boş dizi döner", () => {
  assert.deepEqual(chunkText("   "), []);
});

test("uzun metin birden fazla chunk'a bölünür ve içerik kaybolmaz", () => {
  const sentence = "Redmedia düğün hikayesi çekimi profesyonel ekiple yapılır. ";
  const longText = sentence.repeat(50); // ~2900 karakter
  const chunks = chunkText(longText);

  assert.ok(chunks.length > 1, "birden fazla chunk beklenir");
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 800, "chunk boyutu sınırı aşılmamalı");
    assert.ok(chunk.length > 0);
  }
  // Örtüşme payı ile ilk ve son cümle parçaları korunmalı.
  assert.ok(chunks[0].startsWith("Redmedia düğün hikayesi"));
  assert.ok(chunks[chunks.length - 1].includes("yapılır."));
});

test("chunk'lar kelime ortasından kesilmez", () => {
  const word = "fotoğrafçılık ";
  const longText = word.repeat(100);
  const chunks = chunkText(longText);
  for (const chunk of chunks) {
    assert.ok(
      chunk.endsWith("fotoğrafçılık") || chunk.endsWith("fotoğrafçılık."),
      `kelime bütünlüğü bozulmamalı: "...${chunk.slice(-20)}"`
    );
  }
});
