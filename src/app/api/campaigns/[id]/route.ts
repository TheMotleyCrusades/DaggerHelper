import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAppUser } from "@/lib/auth";
import {
  parseCampaignDescription,
  serializeCampaignDescription,
} from "@/lib/campaign-metadata";
import { campaignUpdateSchema, mapCampaignRow } from "@/lib/campaigns";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid campaign id");
  }
  return id;
}

async function getCampaign(campaignId: number) {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as Record<string, unknown> | null;
}

async function canAccessCampaign(campaignId: number, userId: number) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return { campaign: null, isOwner: false };

  if (Number(campaign.user_id) === userId) {
    return { campaign, isOwner: true };
  }

  const { data: membership } = await supabaseAdmin
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  return { campaign, isOwner: false, isMember: Boolean(membership) };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = parseId((await params).id);
    const access = await canAccessCampaign(id, appUser.id);
    if (!access.campaign || (!access.isOwner && !access.isMember)) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...mapCampaignRow(access.campaign),
      isOwner: access.isOwner,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = parseId((await params).id);
    const access = await canAccessCampaign(id, appUser.id);
    if (!access.campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (!access.isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = campaignUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const parsedDescription = parseCampaignDescription(access.campaign.description);
    const notes =
      payload.description !== undefined
        ? payload.description.trim()
        : parsedDescription.notes;
    const mergedDescription = serializeCampaignDescription(
      notes,
      parsedDescription.metadata
    );

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .update({
        name: payload.name?.trim(),
        description: mergedDescription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", appUser.id)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to update campaign" }, { status: 500 });
    }

    return NextResponse.json(mapCampaignRow(data as Record<string, unknown>));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const id = parseId((await params).id);
    const access = await canAccessCampaign(id, appUser.id);
    if (!access.campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (!access.isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("campaigns")
      .delete()
      .eq("id", id)
      .eq("user_id", appUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
