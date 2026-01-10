import { Message } from "./components/ChatInterface";

export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const DELETE_WINDOW_MS = 15 * 60 * 1000;

export const canEditMessage = (m: Message) => {
  if (!m.sent) return false;
  if (m.type !== "text") return false;
  if ((m as any).isDeleted) return false;

  return Date.now() - m.createdAt <= EDIT_WINDOW_MS;
};

export const canDeleteForEveryone = (m: Message) => {
  if (!m.sent) return false;
  if ((m as any).isDeleted) return false;

  return Date.now() - m.createdAt <= DELETE_WINDOW_MS;
};
