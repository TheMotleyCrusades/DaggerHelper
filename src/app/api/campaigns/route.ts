import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  campaignCreateSchema,
  campaignJoinSchema,
  generateInviteCode,
  mapCampaignRow,
} from "@/lib/campaigns";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { appUser } = await requireAppUser();

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from("campaign_members")
      .select("campaign_id,role")
      .eq("user_id", appUser.id);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    const memberCampaignIds = (memberships ?? [])
      .map((row: { campaign_id: number }) => row.campaign_id)
      .filter((id: number) => Number.isInteger(id));

    const { data: ownedCampaigns, error: ownedError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("user_id", appUser.id);

    if (ownedError) {
      return NextResponse.json({ error: ownedError.message }, { status: 500 });
    }

    const ownedIds = new Set((ownedCampaigns ?? []).map((row: { id: number }) => row.id));
    const remainingIds = memberCampaignIds.filter((id: number) => !ownedIds.has(id));

    let memberCampaigns: Array<Record<string, unknown>> = [];
    if (remainingIds.length) {
      const { data, error } = await supabaseAdmin
        .from("campaigns")
        .select("*")
        .in("id", remainingIds);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      memberCampaigns = (data ?? []) as Array<Record<string, unknown>>;
    }

    const byCampaignRole = new Map<number, string>();
    for (const member of memberships ?? []) {
      byCampaignRole.set(member.campaign_id, member.role);
    }

    const allCampaigns = [
      ...((ownedCampaigns ?? []) as Array<Record<string, unknown>>),
      ...memberCampaigns,
    ]
      .map((row) => {
        const campaign = mapCampaignRow(row);
        const campaignId = Number(campaign.id);
        return {
          ...campaign,
          isOwner: campaign.userId === appUser.id,
          memberRole: byCampaignRole.get(campaignId) ?? (campaign.userId === appUser.id ? "gm" : "player"),
        };
      })
      .sort(
        (a, b) =>
          new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime() -
          new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime()
      );

    return NextResponse.json(allCampaigns);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = campaignCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    let inviteCode = generateInviteCode();
    let campaign:
      | (Record<string, unknown> & { id?: number })
      | null = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabaseAdmin
        .from("campaigns")
        .insert({
          user_id: appUser.id,
          name: parsed.data.name.trim(),
          description: parsed.data.description?.trim() || null,
          invite_code: inviteCode,
        })
        .select("*")
        .single();

      if (!error && data) {
        campaign = data as Record<string, unknown>;
        break;
      }

      lastError = error?.message ?? "Failed to create campaign";
      inviteCode = generateInviteCode();
    }

    if (!campaign || !campaign.id) {
      return NextResponse.json({ error: lastError ?? "Failed to create campaign" }, { status: 500 });
    }

    await supabaseAdmin.from("campaign_members").upsert(
      {
        campaign_id: campaign.id,
        user_id: appUser.id,
        role: "gm",
      },
      { onConflict: "campaign_id,user_id" }
    );

    return NextResponse.json(mapCampaignRow(campaign), { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { appUser } = await requireAppUser();
    const body = await request.json();
    const parsed = campaignJoinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const inviteCode = parsed.data.inviteCode.trim().toUpperCase();
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (campaignError) {
      return NextResponse.json({ error: campaignError.message }, { status: 500 });
    }
    if (!campaign) {
      return NextResponse.json({ error: "Invite code not found" }, { status: 404 });
    }

    const { error: memberError } = await supabaseAdmin.from("campaign_members").upsert(
      {
        campaign_id: campaign.id,
        user_id: appUser.id,
        role: "player",
      },
      { onConflict: "campaign_id,user_id" }
    );

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaignId: campaign.id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to join campaign" }, { status: 500 });
  }
}
