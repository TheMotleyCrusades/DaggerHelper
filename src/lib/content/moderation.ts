import {
  mapModerationActionRow,
  mapReportRow,
} from "@/lib/content/mappers";
import type {
  ContentReportRecord,
  ModerationActionRecord,
} from "@/lib/content/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function createContentReport(params: {
  reporterUserId: number;
  productId?: string | null;
  entityKind?: string | null;
  entityId?: string | null;
  reason: string;
  details?: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("content_reports")
    .insert({
      reporter_user_id: params.reporterUserId,
      product_id: params.productId ?? null,
      entity_kind: params.entityKind ?? null,
      entity_id: params.entityId ?? null,
      reason: params.reason.trim(),
      details: params.details?.trim() ?? "",
      status: "open",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create report");
  }

  return mapReportRow(data);
}

export async function listContentReports(filters?: {
  status?: "open" | "resolved" | "dismissed";
}) {
  let query = supabaseAdmin
    .from("content_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => mapReportRow(row));
}

export async function moderateContentReport(params: {
  reportId: string;
  actedByUserId: number;
  status: "resolved" | "dismissed";
  action: "dismiss" | "warn" | "delist" | "restrict";
  note?: string;
}) {
  const now = new Date().toISOString();
  const { data: currentReport, error: currentError } = await supabaseAdmin
    .from("content_reports")
    .select("*")
    .eq("id", params.reportId)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!currentReport) return null;

  const { data: updatedReport, error: reportError } = await supabaseAdmin
    .from("content_reports")
    .update({
      status: params.status,
      updated_at: now,
    })
    .eq("id", params.reportId)
    .select("*")
    .single();
  if (reportError || !updatedReport) {
    throw new Error(reportError?.message ?? "Failed to update report");
  }

  const { data: actionData, error: actionError } = await supabaseAdmin
    .from("moderation_actions")
    .insert({
      report_id: params.reportId,
      target_product_id: currentReport.product_id ?? null,
      target_entity_kind: currentReport.entity_kind ?? null,
      target_entity_id: currentReport.entity_id ?? null,
      action: params.action,
      note: params.note?.trim() ?? "",
      acted_by_user_id: params.actedByUserId,
      created_at: now,
    })
    .select("*")
    .single();
  if (actionError || !actionData) {
    throw new Error(actionError?.message ?? "Failed to record moderation action");
  }

  if (currentReport.product_id && params.action === "delist") {
    const { error } = await supabaseAdmin
      .from("content_products")
      .update({
        visibility: "delisted",
        updated_at: now,
      })
      .eq("id", currentReport.product_id);
    if (error) throw new Error(error.message);
  }

  if (currentReport.product_id && params.action === "restrict") {
    const { error } = await supabaseAdmin
      .from("content_products")
      .update({
        is_hidden: true,
        updated_at: now,
      })
      .eq("id", currentReport.product_id);
    if (error) throw new Error(error.message);
  }

  return {
    report: mapReportRow(updatedReport) as ContentReportRecord,
    action: mapModerationActionRow(actionData) as ModerationActionRecord,
  };
}
