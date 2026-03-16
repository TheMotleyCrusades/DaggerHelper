import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import { mapAdversaryRow } from "@/lib/adversaries";
import {
  buildHudFieldDefinitions,
  parseCampaignId,
  requireHudOwnerContext,
} from "@/lib/hud";
import { supabaseAdmin } from "@/lib/supabase/admin";

function normalizeSearch(value: string | null) {
  return (value ?? "").trim();
}

function toLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.max(1, Math.min(40, Math.round(parsed)));
}

function sortByRelevance(
  left: { source: "campaign" | "owned" | "public"; name: unknown },
  right: { source: "campaign" | "owned" | "public"; name: unknown }
) {
  const rank = { campaign: 3, owned: 2, public: 1 } as const;
  const delta = rank[right.source] - rank[left.source];
  if (delta !== 0) return delta;
  const leftName = typeof left.name === "string" ? left.name : String(left.name ?? "");
  const rightName = typeof right.name === "string" ? right.name : String(right.name ?? "");
  return leftName.localeCompare(rightName);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseCampaignId((await params).id);
    const context = await requireHudOwnerContext(campaignId, appUser.id);
    if (!context) {
      return NextResponse.json(
        { error: "Only the campaign owner can search adversaries in GM HUD." },
        { status: 403 }
      );
    }

    const search = normalizeSearch(request.nextUrl.searchParams.get("q"));
    const limit = toLimit(request.nextUrl.searchParams.get("limit"));
    const fieldDefinitions = buildHudFieldDefinitions(context.settings);
    const settingsQuery = request.nextUrl.searchParams.get("allowPublic");
    const allowPublic =
      settingsQuery === "true"
        ? true
        : settingsQuery === "false"
          ? false
          : true;

    const queryParts = search.length
      ? `name.ilike.%${search}%,description.ilike.%${search}%`
      : "";

    const campaignQuery = supabaseAdmin
      .from("adversaries")
      .select("*")
      .eq("campaign_id", campaignId)
      .limit(limit);
    const ownerQuery = supabaseAdmin
      .from("adversaries")
      .select("*")
      .eq("user_id", appUser.id)
      .limit(limit);
    const publicQuery = supabaseAdmin
      .from("adversaries")
      .select("*")
      .eq("is_public", true)
      .limit(limit);

    const [campaignResponse, ownerResponse, publicResponse] = await Promise.all([
      search.length ? campaignQuery.or(queryParts) : campaignQuery,
      search.length ? ownerQuery.or(queryParts) : ownerQuery,
      allowPublic ? (search.length ? publicQuery.or(queryParts) : publicQuery) : Promise.resolve({ data: [] as never[], error: null }),
    ]);

    if (campaignResponse.error) {
      return NextResponse.json({ error: campaignResponse.error.message }, { status: 500 });
    }
    if (ownerResponse.error) {
      return NextResponse.json({ error: ownerResponse.error.message }, { status: 500 });
    }
    if (publicResponse.error) {
      return NextResponse.json({ error: publicResponse.error.message }, { status: 500 });
    }

    const byId = new Map<
      number,
      ReturnType<typeof mapAdversaryRow> & { source: "campaign" | "owned" | "public" }
    >();

    for (const row of (campaignResponse.data ?? []) as Array<Record<string, unknown>>) {
      const mapped = mapAdversaryRow(row);
      byId.set(Number(mapped.id), { ...mapped, source: "campaign" });
    }
    for (const row of (ownerResponse.data ?? []) as Array<Record<string, unknown>>) {
      const mapped = mapAdversaryRow(row);
      if (!byId.has(Number(mapped.id))) {
        byId.set(Number(mapped.id), { ...mapped, source: "owned" });
      }
    }
    for (const row of (publicResponse.data ?? []) as Array<Record<string, unknown>>) {
      const mapped = mapAdversaryRow(row);
      if (!byId.has(Number(mapped.id))) {
        byId.set(Number(mapped.id), { ...mapped, source: "public" });
      }
    }

    const items = [...byId.values()]
      .sort((left, right) => sortByRelevance(left, right))
      .slice(0, limit)
      .map((item) => ({
        ...item,
        sourceLabel:
          item.source === "campaign"
            ? "Campaign"
            : item.source === "owned"
              ? "Personal"
              : "Public",
      }));

    return NextResponse.json({
      items,
      search,
      limit,
      fields: fieldDefinitions.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search adversaries" },
      { status: 500 }
    );
  }
}
