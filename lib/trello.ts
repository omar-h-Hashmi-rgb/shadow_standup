import axios from "axios";

const TRELLO_BASE = "https://api.trello.com/1";
const TRELLO_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID;

function getAuthParams() {
  return { key: TRELLO_KEY, token: TRELLO_TOKEN };
}

export async function createTrelloCard(params: {
  name: string;
  desc: string;
  labels?: string[];
}): Promise<{ success: boolean; id?: string; url?: string; error?: string }> {
  if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_LIST_ID) {
    return { success: false, error: "Trello not configured." };
  }

  try {
    const response = await axios.post(`${TRELLO_BASE}/cards`, {
      ...getAuthParams(),
      idList: TRELLO_LIST_ID,
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
  text: string
): Promise<boolean> {
  if (!TRELLO_KEY || !TRELLO_TOKEN) return false;

  try {
    await axios.post(`${TRELLO_BASE}/cards/${cardId}/actions/comments`, {
      ...getAuthParams(),
      text,
    });
    return true;
  } catch (error: any) {
    console.error("Trello comment error:", error.message);
    return false;
  }
}
