import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isJunkInboundMessageContent } from "./inbound-message-content";

describe("isJunkInboundMessageContent", () => {
  it("StoppedStatusLabel junk", () => {
    assert.equal(isJunkInboundMessageContent("StoppedStatusLabel"), true);
  });

  it("gerçek müşteri mesajı geçer", () => {
    assert.equal(
      isJunkInboundMessageContent("Fotoğraf ve klip bride albüm seti ücreti nedir"),
      false
    );
  });

  it("çözülmemiş şablon junk", () => {
    assert.equal(isJunkInboundMessageContent("{{ lastMessage }}"), true);
  });
});
