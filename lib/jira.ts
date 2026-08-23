import axios from "axios";

const JIRA_BASE = process.env.JIRA_DOMAIN;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_TOKEN;
const JIRA_PROJECT = process.env.JIRA_PROJECT_KEY;

function getAuth() {
  return {
    username: JIRA_EMAIL!,
    password: JIRA_TOKEN!,
  };
}

export async function createJiraIssue(params: {
  title: string;
  description: string;
  issueType?: string;
}): Promise<{ success: boolean; key?: string; url?: string; error?: string }> {
  if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_TOKEN || !JIRA_PROJECT) {
    return { success: false, error: "Jira not configured." };
  }

  try {
    const response = await axios.post(
      `${JIRA_BASE}/rest/api/3/issue`,
      {
        fields: {
          project: { key: JIRA_PROJECT },
          summary: params.title,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: params.description }],
              },
            ],
          },
          issuetype: { name: params.issueType || "Task" },
        },
      },
      {
        auth: getAuth(),
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );

    const key = response.data.key;
    return {
      success: true,
      key,
      url: `${JIRA_BASE}/browse/${key}`,
    };
  } catch (error: any) {
    console.error("Jira API error:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

export async function addJiraComment(
  issueKey: string,
  body: string
): Promise<boolean> {
  if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_TOKEN) return false;

  try {
    await axios.post(
      `${JIRA_BASE}/rest/api/3/issue/${issueKey}/comment`,
      {
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: body }],
            },
          ],
        },
      },
      {
        auth: getAuth(),
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    return true;
  } catch (error: any) {
    console.error("Jira comment error:", error.message);
    return false;
  }
}
