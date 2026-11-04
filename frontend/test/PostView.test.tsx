import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PostView } from "../src/PostView";

const posted = { id: "upload-1", caption: "My meme", imageUrl: "/api/memes/uploads/upload-1" };
const image = (type = "image/png", size = 10) => new File([new Uint8Array(size)], "meme.png", { type });

function pick(file: File) {
  fireEvent.change(screen.getByLabelText("Image"), { target: { files: [file] } });
}

function typeCaption(text: string) {
  fireEvent.change(screen.getByLabelText("Caption"), { target: { value: text } });
}

describe("PostView", () => {
  it("posts the picked image with the trimmed caption and confirms it", async () => {
    const onPost = vi.fn().mockResolvedValue(posted);
    render(<PostView onPost={onPost} />);
    const file = image();

    pick(file);
    typeCaption("  My meme  ");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(await screen.findByRole("status")).toHaveTextContent("My meme");
    expect(onPost).toHaveBeenCalledWith("My meme", file);
    expect(screen.getByLabelText("Caption")).toHaveValue("");
  });

  it("previews the picked image with the caption in a band, like the posted meme", () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
    render(<PostView onPost={vi.fn()} />);

    pick(image());
    typeCaption("It works on my machine");

    expect(screen.getByRole("img", { name: "Preview of your meme" })).toHaveAttribute("src", "blob:preview");
    expect(screen.getByText("IT WORKS ON MY MACHINE")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("requires a caption", () => {
    const onPost = vi.fn();
    render(<PostView onPost={onPost} />);

    pick(image());
    typeCaption("   ");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Write a caption");
    expect(onPost).not.toHaveBeenCalled();
  });

  it("requires an image", () => {
    const onPost = vi.fn();
    render(<PostView onPost={onPost} />);

    typeCaption("My meme");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Pick an image");
    expect(onPost).not.toHaveBeenCalled();
  });

  it.each([
    ["a file that is not an image", image("text/plain"), "PNG, JPEG, GIF, WebP or SVG"],
    ["an image over 1 MB", image("image/png", 1024 * 1024 + 1), "1 MB"],
  ])("rejects %s", (_name, file, message) => {
    const onPost = vi.fn();
    render(<PostView onPost={onPost} />);

    pick(file);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    typeCaption("My meme");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(onPost).not.toHaveBeenCalled();
  });

  it("accepts an SVG image", async () => {
    const onPost = vi.fn().mockResolvedValue(posted);
    render(<PostView onPost={onPost} />);

    pick(image("image/svg+xml"));
    typeCaption("My meme");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("shows the error when posting fails and keeps the caption", async () => {
    render(<PostView onPost={vi.fn().mockRejectedValue(new Error("Request failed (HTTP 400): caption is required"))} />);

    pick(image());
    typeCaption("My meme");
    fireEvent.click(screen.getByRole("button", { name: "Post meme" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("caption is required");
    expect(screen.getByLabelText("Caption")).toHaveValue("My meme");
  });
});
