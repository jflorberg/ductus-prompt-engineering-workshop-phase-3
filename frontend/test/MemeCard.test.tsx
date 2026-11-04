import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_DURATION_MS, SWIPE_THRESHOLD, MemeCard } from "../src/MemeCard";

const meme = { id: "m1", caption: "It works on my machine", imageUrl: "/api/memes/images/m1.svg" };

function setup(disabled = false) {
  const onSwipe = vi.fn();
  render(<MemeCard meme={meme} onSwipe={onSwipe} disabled={disabled} />);
  return { onSwipe, card: screen.getByRole("img", { name: meme.caption }).closest("figure")! };
}

function drag(card: HTMLElement, distance: number) {
  fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
  fireEvent.pointerMove(card, { clientX: 200 + distance, pointerId: 1 });
  fireEvent.pointerUp(card, { clientX: 200 + distance, pointerId: 1 });
}

/** jsdom has no matchMedia, which the card treats as reduced motion. This turns animations on. */
function allowMotion() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: false } as Partial<MediaQueryList>),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MemeCard", () => {
  it("shows the meme image with the caption as alt text", () => {
    setup();

    expect(screen.getByRole("img", { name: meme.caption })).toHaveAttribute("src", meme.imageUrl);
  });

  it.each([
    ["Like", "like"],
    ["Nope", "nope"],
  ])("calls onSwipe with %s when its button is clicked", (label, direction) => {
    const { onSwipe } = setup();

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it.each([
    ["ArrowRight", "like"],
    ["ArrowLeft", "nope"],
  ])("calls onSwipe when %s is pressed", (key, direction) => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key });

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("ignores other keys", () => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key: "ArrowUp" });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it.each([
    [SWIPE_THRESHOLD, "like"],
    [-SWIPE_THRESHOLD, "nope"],
  ])("calls onSwipe when dragged %ipx", (distance, direction) => {
    const { onSwipe, card } = setup();

    drag(card, distance);

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("follows the pointer while dragging and snaps back when released before the threshold", () => {
    const { onSwipe, card } = setup();

    fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 250, pointerId: 1 });
    expect(card.style.transform).toContain("translateX(50px)");
    fireEvent.pointerUp(card, { clientX: 250, pointerId: 1 });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(card.style.transform).toContain("translateX(0px)");
  });

  it("does nothing when disabled", () => {
    const { onSwipe, card } = setup(true);

    drag(card, SWIPE_THRESHOLD * 2);
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });

  it.each([
    [60, "LIKE", "NOPE"],
    [-60, "NOPE", "LIKE"],
  ])("fades in a stamp while dragging %ipx", (distance, shown, hidden) => {
    const { card } = setup();

    fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 200 + distance, pointerId: 1 });

    expect(screen.getByText(shown)).toHaveStyle({ opacity: "0.6" });
    expect(screen.queryByText(hidden)).not.toBeInTheDocument();
  });

  it("shows no stamp before dragging", () => {
    setup();

    expect(screen.queryByText("LIKE")).not.toBeInTheDocument();
    expect(screen.queryByText("NOPE")).not.toBeInTheDocument();
  });

  it.each([
    ["Like", "LIKE", "like"],
    ["Nope", "NOPE", "nope"],
  ])("stamps %s and flies the card out before calling onSwipe", (label, stampText, direction) => {
    vi.useFakeTimers();
    allowMotion();
    const { onSwipe, card } = setup();

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(screen.getByText(stampText)).toHaveStyle({ opacity: "1" });
    expect(card).toHaveClass("leaving");
    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    expect(onSwipe).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(EXIT_DURATION_MS));

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("swipes only once while the card is flying out", () => {
    vi.useFakeTimers();
    allowMotion();
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    act(() => vi.advanceTimersByTime(EXIT_DURATION_MS));

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith("like");
  });
});
