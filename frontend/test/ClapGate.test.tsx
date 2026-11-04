import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClapGate } from "../src/ClapGate";
import { isLoggedIn, logIn } from "../src/identity";
import { listenToMicrophone, type MicrophoneListener } from "../src/microphone";

vi.mock("../src/microphone", () => ({ listenToMicrophone: vi.fn() }));

type OnLevel = (level: number, timeMs: number) => void;

/** Makes the fake microphone resolve, and returns a way to "hear" sound plus the listener. */
function grantMicrophone(suspended = false) {
  let hear: OnLevel = () => {};
  const mic: MicrophoneListener = { suspended, resume: vi.fn(), stop: vi.fn() };
  vi.mocked(listenToMicrophone).mockImplementation(async (onLevel) => {
    hear = onLevel;
    return mic;
  });
  return { mic, hear: (level: number, timeMs: number) => act(() => hear(level, timeMs)) };
}

function denyMicrophone() {
  vi.mocked(listenToMicrophone).mockRejectedValue(new Error("Permission denied"));
}

const renderGate = () =>
  render(
    <ClapGate>
      <p>The app</p>
    </ClapGate>,
  );

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(listenToMicrophone).mockReset();
});

afterEach(() => vi.useRealTimers());

describe("ClapGate", () => {
  it("shows the clap login instead of the app when the site opens", async () => {
    grantMicrophone();
    renderGate();

    expect(screen.getByRole("heading", { name: "Clap three times to log in" })).toBeVisible();
    expect(screen.queryByText("The app")).not.toBeInTheDocument();
    expect(await screen.findByText("Listening… clap, clap, clap!")).toBeInTheDocument();
    expect(listenToMicrophone).toHaveBeenCalledTimes(1);
  });

  it("logs in after three claps heard by the microphone", async () => {
    const { mic, hear } = grantMicrophone();
    renderGate();
    await screen.findByText("Listening… clap, clap, clap!");

    for (const time of [0, 400, 800]) {
      hear(0.9, time);
      hear(0.01, time + 100);
    }

    expect(screen.getByRole("img", { name: "3 of 3 claps" })).toBeInTheDocument();
    expect(screen.getByText("Welcome in! 💖")).toBeInTheDocument();
    expect(mic.stop).toHaveBeenCalled();
    expect(await screen.findByText("The app")).toBeInTheDocument();
    expect(isLoggedIn()).toBe(true);
  });

  it("does not log in on two claps", async () => {
    const { hear } = grantMicrophone();
    renderGate();
    await screen.findByText("Listening… clap, clap, clap!");

    hear(0.9, 0);
    hear(0.01, 100);
    hear(0.9, 400);

    expect(screen.getByRole("img", { name: "2 of 3 claps" })).toBeInTheDocument();
    expect(screen.queryByText("The app")).not.toBeInTheDocument();
  });

  it("lets people without a microphone tap the Clap button three times", async () => {
    denyMicrophone();
    renderGate();

    expect(
      await screen.findByText("No microphone? Tap the Clap button three times instead."),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Clap" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByText("The app")).toBeInTheDocument();
  });

  it("asks for a tap when the browser holds the audio back, and resumes it on tap", async () => {
    const { mic } = grantMicrophone(true);
    renderGate();

    expect(await screen.findByText(/Tap the screen once/)).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("main"));

    expect(mic.resume).toHaveBeenCalled();
    expect(screen.getByText("Listening… clap, clap, clap!")).toBeInTheDocument();
  });

  it("turns the hands off again after a long pause", async () => {
    vi.useFakeTimers();
    denyMicrophone();
    renderGate();
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Clap" }));
    expect(screen.getByRole("img", { name: "1 of 3 claps" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("img", { name: "0 of 3 claps" })).toBeInTheDocument();
  });

  it("opens the app straight away when already logged in this session", () => {
    logIn();
    renderGate();

    expect(screen.getByText("The app")).toBeInTheDocument();
    expect(listenToMicrophone).not.toHaveBeenCalled();
  });

  it("goes back to the clap login on Log out", () => {
    logIn();
    grantMicrophone();
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(screen.getByRole("heading", { name: "Clap three times to log in" })).toBeVisible();
    expect(screen.queryByText("The app")).not.toBeInTheDocument();
    expect(isLoggedIn()).toBe(false);
  });

  it("turns the microphone off when the login screen goes away", async () => {
    const { mic } = grantMicrophone();
    const { unmount } = renderGate();
    await screen.findByText("Listening… clap, clap, clap!");

    unmount();

    expect(mic.stop).toHaveBeenCalled();
  });
});
