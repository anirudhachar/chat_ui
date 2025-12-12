"use client";

import { useEffect, useState } from "react";
import styles from "./ChatInterface.module.scss";
import UserSidebar from "./UserSidebar";
import ChatPanel from "./ChatPanel";

// ───────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  online: boolean;
  unread?: number;
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  sent: boolean;
  type: "text" | "image" | "document" | "link";
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  fileName?: string;
  fileUrl?: string;

  linkTitle?: string;
  linkUrl?: string;
  linkImage?: string;
  linkDescription?: string;
}

// ───────────────────────────────────────────────
// DECODE TOKEN
// ───────────────────────────────────────────────
const decodeToken = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.user_id;
  } catch (e) {
    return null;
  }
};

export default function ChatInterface() {
  const [users, setUsers] = useState<User[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]); // FIXED SEARCH RESULT STRUCTURE
  const [showSidebar, setShowSidebar] = useState(true);

  const [parentToken, setParentToken] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  // ───────────────────────────────────────────────
  // SEARCH API
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!parentToken) return;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const fetchSearch = async () => {
      try {
        const url = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/search/people?query=${encodeURIComponent(
          query
        )}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${parentToken}` },
        });

        const data = await res.json();
        console.log("🔍 SEARCH RESULT:", data);

        const mapped: User[] =
          data?.data?.users?.map((u: any) => ({
            id: u.user_id, // FIXED
            name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(), // FIXED
            avatar: u.profile_photo_url
              ? `https://d34wmjl2ccaffd.cloudfront.net${u.profile_photo_url}` // FIXED
              : "/user.png",
            lastMessage: "",
            lastMessageTime: "",
            online: false,
            unread: 0,
          })) || [];

        setSearchResults(mapped);
      } catch (err) {
        console.error("❌ Search failed:", err);
      }
    };

    fetchSearch();
  }, [searchQuery, parentToken]);

  // ───────────────────────────────────────────────
  // FETCH USERS LIST
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!parentToken) return;

    const uid = decodeToken(parentToken);
    setLoggedInUserId(uid);

    const fetchUsers = async () => {
      try {
        const url =
          `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/conversations/list?limit=20` +
          (cursor ? `&cursor=${cursor}` : "");

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${parentToken}` },
        });

        const data = await res.json();
        console.log("📥 Conversations:", data);

        const mappedUsers: User[] =
          data?.data?.conversations?.map((c: any) => ({
            id: c.user?.userId,
            name: `${c.user?.firstName ?? ""} ${c.user?.lastName ?? ""}`.trim(),
            avatar: c.user?.avatarUrl
              ? `https://d34wmjl2ccaffd.cloudfront.net${c.user.avatarUrl}`
              : "/user.png",

            lastMessage: c.lastMessagePreview ?? "",
            lastMessageTime: c.lastMessageAt
              ? new Date(c.lastMessageAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "",

            online: false,
            unread: c.unreadCount ?? 0,
          })) || [];

        setUsers((prev) => [...prev, ...mappedUsers]);

        if (data?.data?.cursor) setCursor(data.data.cursor);
      } catch (err) {
        console.error("❌ Fetch users failed:", err);
      }
    };

    fetchUsers();
  }, [parentToken]);

  // ───────────────────────────────────────────────
  // GET OR CREATE CONVERSATION
  // ───────────────────────────────────────────────
  const getConversationId = async (targetUserId: string, token: string) => {
    try {
      const res = await fetch(
        "https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/conversations/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUserId }),
        }
      );

      const data = await res.json();
      return data?.data?.conversationId || null;
    } catch {
      return null;
    }
  };

  // ───────────────────────────────────────────────
  // FETCH MESSAGES
  // ───────────────────────────────────────────────
  const fetchMessages = async (
    cid: string,
    token: string,
    myUserId: string | null
  ) => {
    if (!myUserId) return;

    try {
      const url = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/message/${cid}/list?limit=10`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      console.log("📥 Messages:", data);

      const mapped: Message[] =
        data?.data?.messages?.map((msg: any) => ({
          id: msg.messageId,
          content: msg.content,
          timestamp: new Date(msg.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
          sent: msg.senderUserId === myUserId,
          type: "text",
          status: msg.senderUserId === myUserId ? "sent" : undefined,
        })) || [];

      setMessages(mapped);
    } catch (err) {
      console.error("❌ Fetch messages failed:", err);
    }
  };

  // ───────────────────────────────────────────────
  // SEND MESSAGE
  // ───────────────────────────────────────────────
  const sendMessageToApi = async (cid: string, content: string, token: string) => {
    try {
      const res = await fetch(
        "https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/message/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ conversationId: cid, content }),
        }
      );

      return await res.json();
    } catch {
      throw new Error("Failed to send");
    }
  };

  const handleUserSelect = async (user: User) => {
    if (!parentToken || !loggedInUserId) return;

    setSelectedUser(user);
    setMessages([]);

    const cid = await getConversationId(user.id, parentToken);
    if (cid) fetchMessages(cid, parentToken, loggedInUserId);

    if (window.innerWidth < 768) setShowSidebar(false);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedUser || !parentToken) return;

    let cid = conversationId;
    if (!cid) cid = await getConversationId(selectedUser.id, parentToken);
    if (!cid) return;

    const tempId = `temp-${Date.now()}`;
    const timeString = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const optimistic: Message = {
      id: tempId,
      content,
      timestamp: timeString,
      sent: true,
      type: "text",
      status: "sending",
    };

    setMessages((prev) => [...prev, optimistic]);

    try {
      const data = await sendMessageToApi(cid, content, parentToken);

      const realId =
        data?.data?.messageId ?? data?.data?.message?.messageId;
      const realTime =
        data?.data?.createdAt ?? data?.data?.message?.createdAt;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: realId,
                status: "sent",
                timestamp: realTime
                  ? new Date(realTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : m.timestamp,
              }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed" } : m
        )
      );
    }
  };

  // ───────────────────────────────────────────────
  // PARENT WINDOW EVENTS
  // ───────────────────────────────────────────────
  useEffect(() => {
    window.parent.postMessage({ type: "CHAT_READY" }, "*");

    const handleMessage = async (event: MessageEvent) => {
      if (!event.data?.type) return;

      if (event.data.type === "OPEN_CHAT") {
        const token = event.data.payload?.token;
        const incomingUser = event.data.payload?.user;

        setParentToken(token);
        const uid = decodeToken(token);
        setLoggedInUserId(uid);

        if (incomingUser) {
          const user: User = {
            id: incomingUser.user_id,
            name: `${incomingUser.firstName} ${
              incomingUser.lastName ?? ""
            }`.trim(),
            avatar: incomingUser.profilePhoto
              ? `https://d34wmjl2ccaffd.cloudfront.net${incomingUser.profilePhoto}`
              : "/user.png",
            lastMessage: "",
            lastMessageTime: "",
            online: true,
          };

          setSelectedUser(user);
          setMessages([]);

          const cid = await getConversationId(user.id, token);
          if (cid && uid) fetchMessages(cid, token, uid);

          setShowSidebar(false);
        }
      }

      if (event.data.type === "SEND_MESSAGE_TO_CHAT") {
        if (selectedUser && parentToken) {
          handleSendMessage(event.data.payload.message);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedUser, parentToken]);

  // ───────────────────────────────────────────────
  // FINAL LIST TO DISPLAY
  // ───────────────────────────────────────────────
  const listToShow =
    searchQuery.length >= 2 ? searchResults : users;

  return (
    <div className={styles.chatInterface}>
      <div
        className={`${styles.sidebarWrapper} ${showSidebar ? styles.show : ""}`}
      >
        <UserSidebar
          users={listToShow}
          selectedUser={selectedUser}
          onUserSelect={handleUserSelect}
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
        />
      </div>

      <div
        className={`${styles.chatWrapper} ${!showSidebar ? styles.show : ""}`}
      >
        <ChatPanel
          selectedUser={selectedUser}
          messages={messages}
          onSendMessage={handleSendMessage}
          onBack={() => {
            setSelectedUser(null);
            setShowSidebar(true);
          }}
        />
      </div>
    </div>
  );
}
