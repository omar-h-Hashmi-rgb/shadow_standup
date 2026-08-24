import axios from "axios";

const TRELLO_BASE = "https://api.trello.com/1";

export interface TrelloCredentials {
  apiKey?: string;
  token?: string;
  listId?: string;
}

function getConfig(creds?: TrelloCredentials) {
  return {
    key: creds?.apiKey || process.env.TRELLO_API_KEY || "",
    token: creds?.token || process.env.TRELLO_TOKEN || "",
    listId: creds?.listId || process.env.TRELLO_LIST_ID || "",
  };
}

export async function createTrelloCard(params: {
  name: string;
  desc: string;
  credentials?: TrelloCredentials;
}): Promise<{ success: boolean; id?: string; url?: string; error?: string }> {
  const config = getConfig(params.credentials);

  if (!config.key || !config.token || !config.listId) {
    return { success: false, error: "Trello not configured." };
  }

  try {
    const response = await axios.post(`${TRELLO_BASE}/cards`, {
      key: config.key,
      token: config.token,
      idList: config.listId,
      name: params.name,
      desc: params.desc,
      pos: "top",
    });

    const card = response.data;
    return {
      success: true,
      id: card.id,
      url: card.shortUrl,
    };
  } catch (error: any) {
    console.error("Trello API error:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

export async function addTrelloComment(
  cardId: string,
  text: string,
  credentials?: TrelloCredentials
): Promise<boolean> {
  const config = getConfig(credentials);
  if (!config.key || !config.token) return false;

  try {
    await axios.post(`${TRELLO_BASE}/cards/${cardId}/actions/comments`, {
      key: config.key,
      token: config.token,
      text,
    });
    return true;
  } catch (error: any) {
    console.error("Trello comment error:", error.message);
    return false;
  }
}
