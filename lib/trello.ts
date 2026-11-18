import axios from "axios";

const TRELLO_BASE = "https://api.trello.com/1";
<<<<<<< HEAD
const TRELLO_ID_RE = /^[a-fA-F0-9]{24}$/;
=======
>>>>>>> origin/main

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
<<<<<<< HEAD
  if (!TRELLO_ID_RE.test(config.listId)) {
    return { success: false, error: "Invalid Trello list id." };
  }
=======
>>>>>>> origin/main

  try {
    const response = await axios.post(`${TRELLO_BASE}/cards`, {
      key: config.key,
      token: config.token,
      idList: config.listId,
      name: params.name,
      desc: params.desc,
      pos: "top",
<<<<<<< HEAD
    }, { timeout: 15000, maxRedirects: 0 });
=======
    });
>>>>>>> origin/main

    const card = response.data;
    return {
      success: true,
      id: card.id,
      url: card.shortUrl,
    };
  } catch (error: any) {
<<<<<<< HEAD
    console.error("Trello API error:", error.response?.status || error.message);
=======
    console.error("Trello API error:", error.response?.data || error.message);
>>>>>>> origin/main
    return { success: false, error: error.message };
  }
}

export async function addTrelloComment(
  cardId: string,
  text: string,
  credentials?: TrelloCredentials
): Promise<boolean> {
  const config = getConfig(credentials);
<<<<<<< HEAD
  if (!config.key || !config.token || !TRELLO_ID_RE.test(cardId)) return false;
=======
  if (!config.key || !config.token) return false;
>>>>>>> origin/main

  try {
    await axios.post(`${TRELLO_BASE}/cards/${cardId}/actions/comments`, {
      key: config.key,
      token: config.token,
      text,
<<<<<<< HEAD
    }, { timeout: 10000, maxRedirects: 0 });
=======
    });
>>>>>>> origin/main
    return true;
  } catch (error: any) {
    console.error("Trello comment error:", error.message);
    return false;
  }
}
