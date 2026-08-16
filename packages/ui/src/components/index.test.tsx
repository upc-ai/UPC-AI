import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { Spinner, Skeleton } from "./misc";
import { Dialog } from "./Dialog";
import { LogoMark } from "./brand";

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
  it("is decorative (aria-hidden) and carries the U geometry", () => {
    const { container } = render(<LogoMark size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "24");
    // three constructed strokes: pillar, floating arm, base
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(3);
  });
});
