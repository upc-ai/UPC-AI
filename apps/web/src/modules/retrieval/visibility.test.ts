import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { VISIBLE_DOC_FILTER } from "./visibility";

/**
 * Safety tripwire: the SQL that decides what students can see must always
 * require published + active-version + unexpired documents and active chunks.
 * If someone weakens these clauses, this test fails before students ever see
 * unpublished content.
 */
describe("VISIBLE_DOC_FILTER (student visibility safety invariant)", () => {
  const rendered = new PgDialect().sqlToQuery(VISIBLE_DOC_FILTER).sql;

  it("requires the document to be published", () => {
    expect(rendered).toContain(`d.status = 'published'`);
  });

  it("requires the document to be the active version", () => {
    expect(rendered).toContain("d.is_active_version = true");
  });

  it("excludes expired documents", () => {
    expect(rendered).toContain("expiry_date IS NULL OR d.expiry_date > CURRENT_DATE");
  });

  it("only reads active chunks", () => {
    expect(rendered).toContain(`c.status = 'active'`);
  });
});
