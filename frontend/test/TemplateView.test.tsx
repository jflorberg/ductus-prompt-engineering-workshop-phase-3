import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateView } from "../src/TemplateView";

const fine = {
  id: "fine",
  name: "This is Fine",
  lines: 2,
  imageUrl: "https://memes.test/fine.png",
};
const one = { id: "one", name: "One Liner", lines: 1, imageUrl: "https://memes.test/one.png" };
const created = {
  id: "upload-1",
  caption: "Top / Bottom",
  imageUrl: "/api/memes/uploads/upload-1",
};

function setup(onPost = vi.fn().mockResolvedValue(created)) {
  const onSearch = vi.fn().mockResolvedValue([fine, one]);
  render(<TemplateView onPost={onPost} onSearch={onSearch} />);
  return { onPost, onSearch };
}

async function pickFine() {
  fireEvent.click(await screen.findByRole("button", { name: "This is Fine" }));
}

const typeLine = (n: number, text: string) =>
  fireEvent.change(screen.getByLabelText(`Line ${n}`), { target: { value: text } });

describe("TemplateView", () => {
  it("loads the first templates when it opens and shows them as thumbnails", async () => {
    const { onSearch } = setup();

    const thumbnail = await screen.findByRole("img", { name: "This is Fine" });

    expect(thumbnail).toHaveAttribute("src", fine.imageUrl);
    expect(screen.getByRole("img", { name: "One Liner" })).toBeInTheDocument();
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("searches as the user types", async () => {
    const { onSearch } = setup();
    await screen.findByRole("img", { name: "This is Fine" });
    onSearch.mockResolvedValueOnce([one]);

    fireEvent.change(screen.getByLabelText("Search templates"), { target: { value: "one" } });

    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith("one"));
    await waitFor(() =>
      expect(screen.queryByRole("img", { name: "This is Fine" })).not.toBeInTheDocument(),
    );
  });

  it("shows one text input per template line", async () => {
    setup();

    await pickFine();

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getByLabelText("Line 1")).toHaveAttribute("maxLength", "100");
    fireEvent.click(screen.getByRole("button", { name: "Change template" }));
    fireEvent.click(await screen.findByRole("button", { name: "One Liner" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("shows a live preview once a line has text", async () => {
    setup();
    await pickFine();
    expect(screen.queryByRole("img", { name: "Preview of your meme" })).not.toBeInTheDocument();

    typeLine(1, "This is fine?");

    expect(await screen.findByRole("img", { name: "Preview of your meme" })).toHaveAttribute(
      "src",
      "/api/templates/fine/preview?text=This+is+fine%3F&text=",
    );
  });

  it("enables Post only when a line has text", async () => {
    setup();
    await pickFine();
    const post = screen.getByRole("button", { name: "Post meme" });

    expect(post).toBeDisabled();
    typeLine(2, "   ");
    expect(post).toBeDisabled();
    typeLine(1, "Top");
    expect(post).toBeEnabled();
  });

  it("posts the texts, confirms and clears the form", async () => {
    const { onPost } = setup();
    await pickFine();

    typeLine(1, "Top");
    typeLine(2, "Bottom");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Top / Bottom");
    expect(onPost).toHaveBeenCalledWith("fine", ["Top", "Bottom"]);
    expect(screen.getByLabelText("Line 1")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Post meme" })).toBeDisabled();
  });

  it("disables Post while posting", async () => {
    setup(vi.fn(() => new Promise<never>(() => {})));
    await pickFine();

    typeLine(1, "Top");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(screen.getByRole("button", { name: "Posting…" })).toBeDisabled();
  });

  it("shows the API's error message and keeps the texts", async () => {
    setup(
      vi
        .fn()
        .mockRejectedValue(
          new Error("Request failed (HTTP 502): The meme template service is unavailable"),
        ),
    );
    await pickFine();

    typeLine(1, "Top");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    expect(screen.getByLabelText("Line 1")).toHaveValue("Top");
  });

  it("shows an error when the search fails", async () => {
    render(
      <TemplateView
        onPost={vi.fn()}
        onSearch={vi.fn().mockRejectedValue(new Error("Request failed (HTTP 502): unavailable"))}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
  });
});
