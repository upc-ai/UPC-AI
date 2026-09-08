/**
 * Seed: default knowledge categories for the admin upload page.
 * Idempotent — existing slugs are skipped. Usage: pnpm seed:categories
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { eq } from "drizzle-orm";
import { createDb, knowledgeCategories } from "@upc/db";

const DEFAULT_CATEGORIES: { slug: string; name: string; icon: string }[] = [
  { slug: "admissions", name: "Admissions", icon: "📄" },
  { slug: "fees", name: "Fees & Payments", icon: "💰" },
  { slug: "exams", name: "Examinations", icon: "📝" },
  { slug: "attendance", name: "Attendance", icon: "✅" },
  { slug: "hostel", name: "Hostel", icon: "🏠" },
  { slug: "syllabus", name: "Syllabus", icon: "📚" },
  { slug: "notices", name: "Notices & Circulars", icon: "📢" },
  { slug: "scholarships", name: "Scholarships", icon: "🎓" },
  { slug: "library", name: "Library", icon: "📖" },
  { slug: "faculty-info", name: "Faculty Info", icon: "👥" },
  // RAG organization (harvest curation, 2026-09-05)
  { slug: "about-college", name: "About the College", icon: "🏛️" },
  { slug: "courses", name: "Courses & Programs", icon: "🎓" },
  { slug: "facilities", name: "Facilities", icon: "🏏" },
  { slug: "study-material", name: "Old Papers & E-Content", icon: "🗂️" },
  { slug: "forms", name: "Forms & Certificates", icon: "🧾" },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createDb(process.env.DATABASE_URL);

  for (const cat of DEFAULT_CATEGORIES) {
    const [existing] = await db
      .select()
      .from(knowledgeCategories)
      .where(eq(knowledgeCategories.slug, cat.slug))
      .limit(1);
    if (!existing) {
      await db.insert(knowledgeCategories).values(cat);
      console.log(`[seed] created ${cat.slug}`);
    } else {
      console.log(`[seed] exists  ${cat.slug}`);
    }
  }
  console.log("[seed] categories ready");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
