import axios from "axios";

export interface JiraCredentials {
  domain?: string;
  email?: string;
  token?: string;
  projectKey?: string;
}

function getConfig(creds?: JiraCredentials) {
  return {
    base: creds?.domain || process.env.JIRA_DOMAIN || "",
    email: creds?.email || process.env.JIRA_EMAIL || "",
    token: creds?.token || process.env.JIRA_TOKEN || "",
    project: creds?.projectKey || process.env.JIRA_PROJECT_KEY || "",
  };
}

export async function createJiraIssue(params: {
  title: string;
  description: string;
  issueType?: string;
  credentials?: JiraCredentials;
}): Promise<{ success: boolean; key?: string; url?: string; error?: string }> {
  const config = getConfig(params.credentials);

  if (!config.base || !config.email || !config.token || !config.project) {
    return { success: false, error: "Jira not configured." };
  }

  try {
    const response = await axios.post(
      `${config.base}/rest/api/3/issue`,
      {
        fields: {
          project: { key: config.project },
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
        auth: { username: config.email, password: config.token },
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );

    const key = response.data.key;
    return {
      success: true,
      key,
      url: `${config.base}/browse/${key}`,
    };
  } catch (error: any) {
    console.error("Jira API error:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

export async function addJiraComment(
  issueKey: string,
  body: string,
  credentials?: JiraCredentials
): Promise<boolean> {
  const config = getConfig(credentials);
  if (!config.base || !config.email || !config.token) return false;

  try {
    await axios.post(
      `${config.base}/rest/api/3/issue/${issueKey}/comment`,
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
        auth: { username: config.email, password: config.token },
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
