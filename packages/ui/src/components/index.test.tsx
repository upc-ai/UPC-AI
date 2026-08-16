import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { Spinner, Skeleton } from "./misc";
import { Dialog } from "./Dialog";
import { LogoMark, Wordmark } from "./brand";

describe("Button", () => {
  it("renders label and handles clicks", async () => {
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>Try UPC AI</Button>);
    const btn = screen.getByRole("button", { name: "Try UPC AI" });
    await userEvent.click(btn);
    expect(clicked).toBe(true);
  });

  it("is disabled with aria-disabled when loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("applies variant classes", () => {
    render(<Button variant="secondary-on-dark">Dark</Button>);
    expect(screen.getByRole("button").className).toContain("secondary-on-dark");
  });
});

describe("Spinner / Skeleton", () => {
  it("spinner announces status", () => {
    render(<Spinner label="Loading chat" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading chat");
  });

  it("skeleton is hidden from a11y tree", () => {
    const { container } = render(<Skeleton variant="text" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe("Dialog", () => {
  it("closes on Escape and has modal attributes", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Confirm">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveAttribute("aria-modal", "true");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        <p>None</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("LogoMark", () => {
  it("is decorative, tight-viewboxed, and correctly proportioned", () => {
    const { container } = render(<LogoMark size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // height = size, width = 0.8×size (mark's 4:5 aspect — no dead padding)
    expect(svg).toHaveAttribute("height", "24");
    expect(svg).toHaveAttribute("width", "19");
    expect(svg).toHaveAttribute("viewBox", "272 212 480 600");
    // three constructed strokes: pillar, floating arm, base
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(3);
  });

  it("Wordmark sizes the mark at 1.25× the text size", () => {
    const { container } = render(<Wordmark size={18} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("height", "23"); // round(18 × 1.25)
  });
});
