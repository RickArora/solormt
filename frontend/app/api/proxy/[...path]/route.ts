import { NextRequest, NextResponse } from "next/server";

const DJANGO_API = process.env.DJANGO_API_URL || "http://127.0.0.1:8000/api";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = `${DJANGO_API}/${path.join("/")}/${req.nextUrl.search}`;
  const headers = new Headers();
  const auth = req.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);
  const ct = req.headers.get("Content-Type");
  if (ct) headers.set("Content-Type", ct);

  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
  });

  const data = await upstream.arrayBuffer();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
