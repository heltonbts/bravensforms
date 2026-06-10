import { NextRequest, NextResponse } from "next/server";

// Protege o /dashboard com HTTP Basic Auth (credenciais no .env.local).
export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};

export function middleware(request: NextRequest) {
  const expectedUser = process.env.DASHBOARD_USER || "admin";
  const expectedPass = process.env.DASHBOARD_PASSWORD || "";

  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);

    if (expectedPass && user === expectedUser && pass === expectedPass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Dashboard", charset="UTF-8"',
    },
  });
}
