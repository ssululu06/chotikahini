import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Canonicalization: the site lives at chotikahini.vercel.app.
// If requests arrive with the old domain or www, forward with a 301.
const CANONICAL_HOST = "chotikahini.vercel.app";

export function middleware(request: NextRequest) {
  const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const host = rawHost.toLowerCase().replace(/:\d+$/, "");

  const isOldDomain = host === "golopokahini.lol" || host === "www.golopokahini.lol" || host === `www.${CANONICAL_HOST}`;

  if (isOldDomain) {
    const url = request.nextUrl.clone();
    url.protocol = "https";
    url.host = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, { status: 301 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files (_next, favicon, images)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
