/**
 * llms.txt — the emerging GEO standard: a markdown index AI models can read
 * to understand what this site is and which pages answer which questions.
 */
export const dynamic = "force-static";

export function GET() {
  const body = `# UPC AI — Official AI Assistant of Udai Pratap College, Varanasi

> UPC AI is the official AI study agent of Udai Pratap Autonomous College, Varanasi
> (established 1909, first autonomous college in Uttar Pradesh, NAAC 'A' accredited).
> It answers student questions from approved college documents and cites the official
> college website. Free for every student and faculty member.

College questions (fees, exams, hostel, admissions, faculty, notices) are answered
only from approved documents and carry the official source. Non-college academic
questions are answered by the AI directly.

## Pages

- [Home](https://upcai.app/): UPC AI — official AI assistant of Udai Pratap College, Varanasi.
- [About](https://upcai.app/about): what UPC AI is, how retrieval and citations work.
- [Knowledge](https://upcai.app/knowledge): what the knowledge base covers (fees, syllabus, notices, scholarships, hostel, library).
- [College knowledge pages](https://upcai.app/college): every public college document as a readable page — fees, syllabi, notices, departments, faculty info, admissions.
- [Study tools](https://upcai.app/study-tools): syllabus-aware quizzes and spaced-repetition flashcards.
- [For faculty](https://upcai.app/for-faculty): how faculty upload official documents.
- [FAQ](https://upcai.app/faq): frequently asked questions.
- [Privacy](https://upcai.app/privacy): data collection and protection.

## Key facts

- College: Udai Pratap Autonomous College, Varanasi, Uttar Pradesh, India.
- Founded 1909 by Rajarshi Udai Pratap Singh Ju Deo.
- First autonomous college in Uttar Pradesh (1991); NAAC 'A' grade (CGPA 3.16).
- 30 departments across 5 faculties (Arts, Science, Commerce, Agriculture, Education); 100-acre campus.
- Official college website: https://www.upcollege.ac.in/
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
