import axios from "axios";
<<<<<<< HEAD
import { validateJiraDomain } from "./url-safety";

const PROJECT_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{1,19}$/;
const ISSUE_KEY_RE = /^[A-Za-z][A-Za-z0-9_]+-\d+$/;
=======
>>>>>>> origin/main

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

<<<<<<< HEAD
  const domain = validateJiraDomain(config.base);
  if (!domain.ok) return { success: false, error: `Invalid Jira domain: ${domain.reason}` };
  if (!PROJECT_KEY_RE.test(config.project)) return { success: false, error: "Invalid Jira project key." };
  config.base = domain.url;

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
        maxRedirects: 0,
=======
>>>>>>> origin/main
      }
    );

    const key = response.data.key;
    return {
      success: true,
      key,
      url: `${config.base}/browse/${key}`,
    };
  } catch (error: any) {
<<<<<<< HEAD
    console.error("Jira API error:", error.response?.status || error.message);
=======
    console.error("Jira API error:", error.response?.data || error.message);
>>>>>>> origin/main
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

<<<<<<< HEAD
  const domain = validateJiraDomain(config.base);
  if (!domain.ok || !ISSUE_KEY_RE.test(issueKey)) return false;
  config.base = domain.url;

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
        maxRedirects: 0,
=======
>>>>>>> origin/main
      }
    );
    return true;
  } catch (error: any) {
    console.error("Jira comment error:", error.message);
    return false;
  }
}
