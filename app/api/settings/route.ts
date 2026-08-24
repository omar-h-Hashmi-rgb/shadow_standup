import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    return NextResponse.json({
      success: true,
      settings: data || {
        discord_webhook_url: "",
        slack_webhook_url: "",
        jira_domain: "",
        jira_email: "",
        jira_api_token: "",
        jira_project_key: "",
        trello_api_key: "",
        trello_token: "",
        trello_list_id: "",
      },
    });
  } catch (error: any) {
    console.error("Get settings error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, settings } = await request.json();
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("user_settings").upsert(
      {
        user_id: userId,
        discord_webhook_url: settings.discord_webhook_url || "",
        slack_webhook_url: settings.slack_webhook_url || "",
        jira_domain: settings.jira_domain || "",
        jira_email: settings.jira_email || "",
        jira_api_token: settings.jira_api_token || "",
        jira_project_key: settings.jira_project_key || "",
        trello_api_key: settings.trello_api_key || "",
        trello_token: settings.trello_token || "",
        trello_list_id: settings.trello_list_id || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Save settings error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
