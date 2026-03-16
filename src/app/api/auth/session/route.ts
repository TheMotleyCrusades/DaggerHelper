import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateAppUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null, appUser: null });
  }

  const appUser = await getOrCreateAppUser(user);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
    appUser,
  });
}

