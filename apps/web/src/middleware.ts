import { NextRequest, NextResponse } from "next/server";

const REFRESH_COOKIE = "upcai_refresh";

/**
 * Root bounce — logged-in users go straight to the chat (ChatGPT pattern).
 *
 * Runs on the edge before any render: if a refresh cookie exists, `/` 307s to
 * /chat in ~0ms; otherwise the landing renders exactly as before (static,
 * CDN-cached for anonymous visitors). Cookie PRESENCE only — no DB, no token
 * mint. A present-but-dead cookie routes root → /chat → (client bootstrap
 * fails) → /login, which is the normal sign-in path.
 *
 * Loop-safety: this middleware must NEVER match /login or /signup — those
 * pages do their own VALIDATED authenticated-redirect on the client, and a
 * presence-only bounce there would loop forever for dead cookies.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/" && req.cookies.has(REFRESH_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

/** Root only — marketing pages (/about, /faq, …) stay viewable while logged in. */
export const config = {
  matcher: ["/"],
};
