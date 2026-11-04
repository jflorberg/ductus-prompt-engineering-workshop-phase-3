import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CELEBRATION_DURATION_MS, Celebration } from "../src/Celebration";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: reduce }));
}

describe("Celebration", () => {
  it("shows the message and calls onDone after a while", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Celebration message="3 likes in a row!" onDone={onDone} />);

    expect(screen.getByRole("status")).toHaveTextContent("3 likes in a row!");
    act(() => vi.advanceTimersByTime(CELEBRATION_DURATION_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(onDone).toHaveBeenCalledOnce();
  });

  it("sets off fireworks when motion is allowed", () => {
    stubReducedMotion(false);

    const { container } = render(<Celebration message="Yay" onDone={() => {}} />);

    expect(container.querySelectorAll(".firework span").length).toBeGreaterThan(0);
  });

  it("shows only the message when the user prefers reduced motion", () => {
    stubReducedMotion(true);

    const { container } = render(<Celebration message="Yay" onDone={() => {}} />);

    expect(container.querySelector(".fireworks")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Yay");
  });
});
