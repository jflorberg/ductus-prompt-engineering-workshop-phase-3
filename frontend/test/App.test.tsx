import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const first = { id: "m1", caption: "It works on my machine", imageUrl: "/api/memes/images/m1.svg" };
const second = { id: "m2", caption: "Friday deploy", imageUrl: "/api/memes/images/m2.svg" };

const ok = (body: unknown) => ({ ok: true, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("shows the meme returned by the backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ meme: first })));

    render(<App />);

    const image = await screen.findByRole("img", { name: first.caption });
    expect(image).toHaveAttribute("src", first.imageUrl);
  });

  it.each([
    ["Like", "like"],
    ["Nope", "nope"],
  ])("sends a %s swipe and shows the next meme", async (label, direction) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce(ok({ memeId: first.id, direction }))
      .mockResolvedValueOnce(ok({ meme: second }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(await screen.findByRole("img", { name: second.caption })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/swipes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ memeId: first.id, direction });
    expect(init.headers["X-User-Id"]).toEqual(expect.any(String));
  });

  it("swipes with the arrow keys in the swipe view but not in the likes view", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce(ok({ memeId: first.id, direction: "like" }))
      .mockResolvedValueOnce(ok({ meme: second }))
      .mockResolvedValueOnce(ok({ memes: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await screen.findByRole("img", { name: second.caption });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      memeId: first.id,
      direction: "like",
    });

    fireEvent.click(screen.getByRole("button", { name: "Likes" }));
    await screen.findByText("You have not liked any memes yet.");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("sends only one swipe while a swipe request is in flight", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
      .mockResolvedValueOnce(ok({ meme: second }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    finish(ok({ memeId: first.id, direction: "like" }));

    await screen.findByRole("img", { name: second.caption });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shows the empty state with a Reset button when there are no more memes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ meme: null })));

    render(<App />);

    expect(await screen.findByText("You have seen all memes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
  });

  it("resets the swipe history and shows a meme again when Reset is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: null }))
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce(ok({ meme: first }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));

    expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
    expect(screen.queryByText("You have seen all memes")).not.toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/swipes");
    expect(init.method).toBe("DELETE");
    expect(init.headers["X-User-Id"]).toEqual(expect.any(String));
  });

  it("shows an error message when the reset fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: null }))
        .mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("shows an error message when the backend fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("shows an error message when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
  });

  it("shows an error message when recording a swipe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: first }))
        .mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Like" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  describe("likes view", () => {
    it("lists the liked memes when the Likes button is clicked", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: first }))
        .mockResolvedValueOnce(ok({ memes: [first, second] }));
      vi.stubGlobal("fetch", fetchMock);
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByRole("heading", { name: "Your likes" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: first.caption })).toHaveAttribute(
        "src",
        first.imageUrl,
      );
      expect(screen.getByRole("img", { name: second.caption })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
      expect(fetchMock.mock.calls[1][0]).toBe("/api/likes");
      expect(fetchMock.mock.calls[1][1].headers["X-User-Id"]).toEqual(expect.any(String));
    });

    it("shows an empty message when nothing is liked", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(ok({ meme: first }))
          .mockResolvedValueOnce(ok({ memes: [] })),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByText("You have not liked any memes yet.")).toBeInTheDocument();
    });

    it("navigates back to the swipe view", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(ok({ meme: first }))
          .mockResolvedValueOnce(ok({ memes: [] }))
          .mockResolvedValueOnce(ok({ meme: first })),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });
      fireEvent.click(screen.getByRole("button", { name: "Likes" }));
      await screen.findByText("You have not liked any memes yet.");

      fireEvent.click(screen.getByRole("button", { name: "Swipe" }));

      expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Like" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Your likes" })).not.toBeInTheDocument();
    });

    it("shows an error message when loading likes fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(ok({ meme: first }))
          .mockResolvedValueOnce({ ok: false, status: 500 }),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
      expect(screen.queryByText("You have not liked any memes yet.")).not.toBeInTheDocument();
    });
  });
});

describe("post view", () => {
  it("posts a meme as a base64 data URL from the Post tab", async () => {
    const created = { id: "upload-1", caption: "My meme", imageUrl: "/api/memes/uploads/upload-1" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => created });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], "m.svg", {
      type: "image/svg+xml",
    });
    fireEvent.change(screen.getByLabelText("Image"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "My meme" } });
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(await screen.findByRole("status")).toHaveTextContent("My meme");
    expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/memes");
    expect(init.method).toBe("POST");
    expect(init.headers["X-User-Id"]).toEqual(expect.any(String));
    const body = JSON.parse(init.body);
    expect(body.caption).toBe("My meme");
    expect(body.image).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("shows the backend's error message when posting fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: first }))
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: "image content is not a valid image/png" }),
        }),
    );
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    fireEvent.change(screen.getByLabelText("Image"), {
      target: { files: [new File(["x"], "m.png", { type: "image/png" })] },
    });
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "My meme" } });
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not a valid image/png");
  });
});

describe("me view", () => {
  const profile = { id: "p1", nickname: "Curious Otter", emoji: "🦊", bot: false };

  it("shows the profile from the Me tab and saves changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce(ok({ profile }))
      .mockResolvedValueOnce(ok({ profile: { ...profile, nickname: "Mum", emoji: "🦄" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Me" }));
    expect(await screen.findByRole("heading", { name: /Curious Otter/ })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/me");
    expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Mum" } });
    fireEvent.click(screen.getByRole("radio", { name: "🦄" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Mum");
    const [url, init] = fetchMock.mock.calls[2];
    expect(url).toBe("/api/me");
    expect(init.method).toBe("PUT");
    expect(init.headers["X-User-Id"]).toEqual(expect.any(String));
    expect(JSON.parse(init.body)).toEqual({ nickname: "Mum", emoji: "🦄" });
  });

  it("shows an error when the profile cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: first }))
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }),
    );
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Me" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 500");
  });
});

describe("App celebrations", () => {
  const memes = Array.from({ length: 7 }, (_, i) => ({
    id: `m${i}`,
    caption: `Meme ${i}`,
    imageUrl: `/api/memes/images/m${i}.svg`,
  }));

  /** A backend that serves the memes in order and accepts every swipe. */
  function stubBackend() {
    let next = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/swipes" ? ok({}) : ok({ meme: memes[next++] ?? null }),
      ),
    );
  }

  async function swipeAll(directions: string[]) {
    for (const [i, direction] of directions.entries()) {
      await screen.findByRole("img", { name: memes[i].caption });
      fireEvent.click(screen.getByRole("button", { name: direction }));
    }
    await screen.findByRole("img", { name: memes[directions.length].caption });
  }

  // A fresh storage per test, so the swipe count never leaks between tests.
  let storage: Map<string, string>;
  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });

  it("celebrates 3 likes in a row", async () => {
    stubBackend();
    render(<App />);

    await swipeAll(["Like", "Like"]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Like" }));

    expect(await screen.findByRole("status")).toHaveTextContent("3 likes in a row!");
  });

  it("starts the streak over after a nope", async () => {
    stubBackend();
    render(<App />);

    await swipeAll(["Like", "Like", "Nope", "Like", "Like"]);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("celebrates the 100th swipe in this browser", async () => {
    storage.set("meme-tinder-swipe-count", "99");
    stubBackend();
    render(<App />);

    await swipeAll(["Nope"]);

    expect(screen.getByRole("status")).toHaveTextContent("100 memes swiped!");
  });
});
