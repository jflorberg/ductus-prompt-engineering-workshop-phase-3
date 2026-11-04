import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileView } from "../src/ProfileView";

const profile = { id: "p1", nickname: "Curious Otter", emoji: "🦊", bot: false };

function typeNickname(text: string) {
  fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: text } });
}

describe("ProfileView", () => {
  it("shows the current nickname and emoji", () => {
    render(<ProfileView profile={profile} onSave={vi.fn()} />);

    expect(screen.getByRole("heading")).toHaveTextContent("🦊 Curious Otter");
    expect(screen.getByLabelText("Nickname")).toHaveValue("Curious Otter");
    expect(screen.getByRole("radio", { name: "🦊" })).toBeChecked();
  });

  it("saves the trimmed nickname and the picked emoji and confirms it", async () => {
    const onSave = vi.fn().mockResolvedValue({ ...profile, nickname: "Mum", emoji: "👵" });
    render(<ProfileView profile={profile} onSave={onSave} />);

    typeNickname("  Mum  ");
    fireEvent.click(screen.getByRole("radio", { name: "👵" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Other people see you as Mum");
    expect(onSave).toHaveBeenCalledWith("Mum", "👵");
    expect(screen.getByRole("heading")).toHaveTextContent("👵 Mum");
  });

  it("requires a nickname", () => {
    const onSave = vi.fn();
    render(<ProfileView profile={profile} onSave={onSave} />);

    typeNickname("   ");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Pick a nickname");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("limits the nickname to 30 characters", () => {
    render(<ProfileView profile={profile} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Nickname")).toHaveAttribute("maxLength", "30");
  });

  it("shows the error when saving fails and keeps the input", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error("Request failed (HTTP 400): emoji must be one emoji"));
    render(<ProfileView profile={profile} onSave={onSave} />);

    typeNickname("Mum");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("emoji must be one emoji");
    expect(screen.getByLabelText("Nickname")).toHaveValue("Mum");
    expect(screen.getByRole("heading")).toHaveTextContent("Curious Otter");
  });

  it("keeps an emoji that is not in the list pickable", () => {
    render(<ProfileView profile={{ ...profile, emoji: "🦩" }} onSave={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "🦩" })).toBeChecked();
  });
});
