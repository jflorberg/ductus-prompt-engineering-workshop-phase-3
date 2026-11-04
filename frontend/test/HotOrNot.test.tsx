import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { LoveMeter } from "../src/LoveMeter";
import { MemeCard } from "../src/MemeCard";
import { PULSE_INTERVAL_MS, PulseCounter } from "../src/PulseCounter";
import { TrendingView } from "../src/TrendingView";

const first = { id: "m1", caption: "It works on my machine", imageUrl: "/api/memes/images/m1.svg" };
const second = { id: "m2", caption: "Friday deploy", imageUrl: "/api/memes/images/m2.svg" };

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) });

/** A fetch mock that answers by URL, so the order of requests does not matter. */
function routes(handlers: Record<string, () => unknown>) {
  return vi.fn(async (url: string) => {
    const handler = handlers[url];
    if (!handler) throw new Error(`Unexpected request: ${url}`);
    return handler();
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LoveMeter", () => {
  it("shows how many people loved the meme", () => {
    render(<LoveMeter stats={{ likes: 87, nopes: 13, lovePercent: 87 }} />);

    expect(screen.getByText(/of people loved this/).textContent).toContain("87% of people loved");
    expect(screen.getByText(/100 swipes/)).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Love" })).toHaveAttribute("aria-valuenow", "87");
  });

  it("invites the first swipe when nobody has rated the meme", () => {
    render(<LoveMeter stats={{ likes: 0, nopes: 0, lovePercent: null }} />);

    expect(screen.getByText("Be the first to rate this meme!")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});

describe("MemeCard stats", () => {
  it("shows the love meter when stats are given", () => {
    render(
      <MemeCard meme={first} onSwipe={() => {}} stats={{ likes: 1, nopes: 1, lovePercent: 50 }} />,
    );

    expect(screen.getByRole("meter", { name: "Love" })).toHaveAttribute("aria-valuenow", "50");
  });

  it("shows no love meter without stats", () => {
    render(<MemeCard meme={first} onSwipe={() => {}} />);

    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText(/Be the first/)).not.toBeInTheDocument();
  });
});

describe("TrendingView", () => {
  it("ranks memes with medals and their stats", () => {
    render(
      <TrendingView
        trending={{
          window: "hour",
          memes: [
            { meme: first, likes: 3, nopes: 1, lovePercent: 75 },
            { meme: second, likes: 1, nopes: 0, lovePercent: 100 },
          ],
        }}
      />,
    );

    expect(screen.getByText("Hottest memes of the last hour")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("img", { name: first.caption })).toBeInTheDocument();
    expect(within(items[0]).getByText(/3 likes · 75% loved it/)).toBeInTheDocument();
    expect(within(items[0]).getByText("🥇")).toBeInTheDocument();
    expect(within(items[1]).getByText(/1 like · 100% loved it/)).toBeInTheDocument();
  });

  it("says when it shows all-time favourites", () => {
    render(<TrendingView trending={{ window: "all", memes: [] }} />);

    expect(screen.getByText("All-time favourites")).toBeInTheDocument();
    expect(screen.getByText(/Nobody has loved a meme yet/)).toBeInTheDocument();
  });
});

describe("PulseCounter", () => {
  it("shows memes per minute and refreshes it", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ swipesPerMinute: 4 }))
      .mockResolvedValueOnce(ok({ swipesPerMinute: 9 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<PulseCounter />);
    await act(async () => {});
    expect(screen.getByText("4")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS);
    });
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/pulse", expect.anything());
  });

  it("keeps the last number when a refresh fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(ok({ swipesPerMinute: 4 }))
        .mockResolvedValueOnce(fail()),
    );

    render(<PulseCounter />);
    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS);
    });

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops polling when it is removed", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(ok({ swipesPerMinute: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<PulseCounter />);
    await act(async () => {});
    unmount();
    await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS * 3);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("App: hot or not", () => {
  it("shows how loved the current meme is", async () => {
    vi.stubGlobal(
      "fetch",
      routes({
        "/api/memes/next": () =>
          ok({ meme: first, stats: { likes: 2, nopes: 1, lovePercent: 67 } }),
      }),
    );

    render(<App />);

    expect(await screen.findByRole("meter", { name: "Love" })).toHaveAttribute(
      "aria-valuenow",
      "67",
    );
  });

  it("opens the Trending tab with the ranking and memes per minute", async () => {
    vi.stubGlobal(
      "fetch",
      routes({
        "/api/memes/next": () => ok({ meme: first, stats: null }),
        "/api/trending": () =>
          ok({ window: "hour", memes: [{ meme: second, likes: 5, nopes: 0, lovePercent: 100 }] }),
        "/api/pulse": () => ok({ swipesPerMinute: 12 }),
      }),
    );

    render(<App />);
    await screen.findByRole("img", { name: first.caption });
    fireEvent.click(screen.getByRole("button", { name: "Trending" }));

    expect(await screen.findByRole("heading", { name: "Trending" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: second.caption })).toBeInTheDocument();
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trending" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an error when trending cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      routes({
        "/api/memes/next": () => ok({ meme: first, stats: null }),
        "/api/trending": () => fail(),
        "/api/pulse": () => ok({ swipesPerMinute: 0 }),
      }),
    );

    render(<App />);
    await screen.findByRole("img", { name: first.caption });
    fireEvent.click(screen.getByRole("button", { name: "Trending" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
