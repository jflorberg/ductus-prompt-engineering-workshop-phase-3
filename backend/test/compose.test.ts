import { describe, expect, it } from "vitest";
import { composeFullCardSvg, composeMemeSvg } from "../src/memes/compose.js";

const image = { contentType: "image/png", data: Buffer.from([1, 2, 3]) };
const captionLines = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe("composeMemeSvg", () => {
  it("embeds the image and puts the caption in capitals in the bottom band", () => {
    const svg = composeMemeSvg(image, "It works on my machine");

    expect(svg).toContain('href="data:image/png;base64,AQID"');
    expect(svg).toContain('<rect y="270" width="400" height="130"');
    expect(captionLines(svg)).toEqual(["IT WORKS ON MY MACHINE"]);
    expect(svg).toContain('<title id="t">It works on my machine</title>');
  });

  it("escapes the caption so it cannot inject markup", () => {
    const svg = composeMemeSvg(image, '<script>alert("x")</script> & co');

    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;SCRIPT&gt;");
  });

  it("wraps a long caption over several lines that all fit in the band", () => {
    const caption =
      "Nothing is as permanent as a temporary fix, especially the one from 2016 that nobody dares to touch any more at all";

    const lines = captionLines(composeMemeSvg(image, caption));
    const ys = [...composeMemeSvg(image, caption).matchAll(/<text x="200" y="(\d+)"/g)].map((m) =>
      Number(m[1]),
    );

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(caption.toUpperCase());
    expect(Math.min(...ys)).toBeGreaterThan(270);
    expect(Math.max(...ys)).toBeLessThanOrEqual(400);
  });

  it("breaks a word that is longer than a line", () => {
    const lines = captionLines(composeMemeSvg(image, "x".repeat(60)));

    expect(lines.join("")).toBe("X".repeat(60));
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe("composeFullCardSvg", () => {
  it("fills the 400x400 card with the image, with no caption band or text", () => {
    const svg = composeFullCardSvg(image, "Prod is down / This is fine");

    expect(svg).toContain('viewBox="0 0 400 400"');
    expect(svg).toContain(
      '<image href="data:image/png;base64,AQID" x="0" y="0" width="400" height="400" preserveAspectRatio="xMidYMid meet"/>',
    );
    expect(svg).toContain('<rect width="400" height="400" fill="#1e1e2e"/>');
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain('y="270"');
    expect(svg).toContain('<title id="t">Prod is down / This is fine</title>');
  });

  it("escapes the caption in the title", () => {
    const svg = composeFullCardSvg(image, '</title><script>alert("x")</script>');

    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;/title&gt;&lt;script&gt;");
  });
});
