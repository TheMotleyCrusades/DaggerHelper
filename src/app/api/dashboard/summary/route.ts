import { NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard-summary";

export async function GET() {
  try {
    const { appUser } = await requireAppUser();
    const summary = await getDashboardSummary(appUser.id);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch dashboard summary" },
      { status: 500 }
    );
  }
}
