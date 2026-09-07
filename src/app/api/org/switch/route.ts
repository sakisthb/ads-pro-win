import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { activeOrgCookieOptions } from "@/lib/active-org";

const schema = z.object({ organizationId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.userId,
        organizationId: parsed.data.organizationId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { success: false, error: "Not a member of this organization" },
      { status: 403 },
    );
  }

  // Set the cookie
  const cookieOpts = activeOrgCookieOptions(parsed.data.organizationId);
  const response = NextResponse.json({
    success: true,
    organizationId: parsed.data.organizationId,
  });
  response.cookies.set(cookieOpts.name, cookieOpts.value, {
    httpOnly: cookieOpts.httpOnly,
    secure: cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    path: cookieOpts.path,
    maxAge: cookieOpts.maxAge,
  });

  return response;
}
