import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string): value is EmailOtpType {
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType);
}

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/")) {
    return "/dashboard";
  }
  return next;
}

function redirectToLogin(
  origin: string,
  next: string,
  params: Record<string, string>
) {
  const url = new URL("/login", origin);
  url.searchParams.set("next", next);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const rawError = searchParams.get("error_description") ?? searchParams.get("error");
  const next = getSafeNextPath(searchParams.get("next"));
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToLogin(origin, next, { authError: error.message });
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  if (tokenHash && type && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      return redirectToLogin(origin, next, { authError: error.message });
    }

    return redirectToLogin(origin, next, { verified: "1" });
  }

  if (rawError) {
    return redirectToLogin(origin, next, { authError: rawError });
  }

  return redirectToLogin(origin, next, {
    authError: "Verification link is invalid or expired. Request a new one.",
  });
}
