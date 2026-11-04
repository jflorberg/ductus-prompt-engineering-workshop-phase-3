import { describe, expect, it } from "vitest";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import {
  InvalidProfileError,
  createProfileService,
  isSingleEmoji,
} from "../src/profiles/service.js";

function setup() {
  let next = 0;
  const repository = createInMemoryProfileRepository();
  const service = createProfileService(repository, {
    random: () => 0,
    newId: () => `p${++next}`,
  });
  return { repository, service };
}

describe("profile service", () => {
  it("creates a profile with a random nickname and emoji on the first call", () => {
    const { service } = setup();

    expect(service.getOrCreate("u1")).toEqual({
      id: "p1",
      nickname: "Curious Otter",
      emoji: "😎",
      bot: false,
    });
  });

  it("returns the same profile on later calls", () => {
    const { service } = setup();
    const first = service.getOrCreate("u1");

    expect(service.getOrCreate("u1")).toEqual(first);
    expect(service.getOrCreate("u2").id).not.toBe(first.id);
  });

  it("never exposes the secret user id", () => {
    const { service } = setup();

    expect(JSON.stringify(service.getOrCreate("secret-user-id"))).not.toContain("secret-user-id");
  });

  it("changes the nickname and emoji, trimmed, and keeps the public id", () => {
    const { service, repository } = setup();
    const { id } = service.getOrCreate("u1");

    const updated = service.update("u1", { nickname: "  Mum  ", emoji: " 🦄 " });

    expect(updated).toEqual({ id, nickname: "Mum", emoji: "🦄", bot: false });
    expect(repository.findByUserId("u1")).toMatchObject({ nickname: "Mum", emoji: "🦄" });
  });

  it("creates the profile when updating a user without one", () => {
    const { service } = setup();

    expect(service.update("u1", { nickname: "Sara", emoji: "🐸" })).toMatchObject({
      id: "p1",
      nickname: "Sara",
    });
  });

  it.each([
    ["an empty nickname", { nickname: "   ", emoji: "🐸" }, "nickname is required"],
    ["a nickname over 30 characters", { nickname: "x".repeat(31), emoji: "🐸" }, "30 characters"],
    ["text instead of an emoji", { nickname: "Sara", emoji: "a" }, "one emoji"],
    ["two emojis", { nickname: "Sara", emoji: "🐸🐸" }, "one emoji"],
    ["an empty emoji", { nickname: "Sara", emoji: "" }, "one emoji"],
  ])("rejects %s", (_name, changes, message) => {
    const { service } = setup();

    expect(() => service.update("u1", changes)).toThrow(InvalidProfileError);
    expect(() => service.update("u1", changes)).toThrow(message);
  });

  it("allows a nickname of exactly 30 characters, counting emoji as one", () => {
    const { service } = setup();

    expect(service.update("u1", { nickname: "x".repeat(30), emoji: "🐸" }).nickname).toHaveLength(
      30,
    );
  });
});

describe("isSingleEmoji", () => {
  it.each(["😎", "👍🏽", "👩‍💻", "🇸🇪", "❤️"])("accepts %s", (emoji) => {
    expect(isSingleEmoji(emoji)).toBe(true);
  });

  it.each(["", "a", "1", "😎😎", "😎 "])("rejects %j", (value) => {
    expect(isSingleEmoji(value)).toBe(false);
  });
});
