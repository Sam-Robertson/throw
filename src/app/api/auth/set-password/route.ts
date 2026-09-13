import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resolvePasswordToken } from "@/lib/email/passwordSetup";

// Public. Sets a password from an emailed setup/reset link. The token is
// consumed (deleted) in the same transaction that writes the password, so a
// link can only be used once even if submitted twice at the same moment.

// Same rules and bcrypt cost as /api/auth/register. The upper bound only guards
// against absurdly large inputs (bcrypt ignores bytes past 72 anyway).
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
const BCRYPT_COST = 12;

class TokenAlreadyUsedError extends Error {}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "INVALID_TOKEN", message: "This link isn't valid." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "WEAK_PASSWORD", message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "WEAK_PASSWORD", message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  const resolved = await resolvePasswordToken(token);
  if (resolved.status === "expired") {
    return NextResponse.json(
      { error: "TOKEN_EXPIRED", message: "This link has expired. Request a new one." },
      { status: 400 },
    );
  }
  if (resolved.status === "invalid") {
    return NextResponse.json(
      { error: "INVALID_TOKEN", message: "This link isn't valid or has already been used." },
      { status: 400 },
    );
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.verificationToken.deleteMany({ where: { token: resolved.tokenHash } });
      if (count === 0) throw new TokenAlreadyUsedError();

      await tx.user.update({
        where: { id: resolved.user.id },
        data: {
          hashedPassword,
          // They proved they control the inbox by opening the link.
          ...(resolved.user.emailVerified ? {} : { emailVerified: new Date() }),
        },
      });
    });
  } catch (err) {
    if (err instanceof TokenAlreadyUsedError) {
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "This link has already been used." },
        { status: 400 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, email: resolved.user.email });
}
