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
  status?: "sent" | "delivered" | "read";
  fileName?: string;
  fileUrl?: string;

  linkTitle?: string;
  linkUrl?: string;
  linkImage?: string;
  linkDescription?: string;
}

// ───────────────────────────────────────────────
// GET USER ID FROM TOKEN
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
  const [showSidebar, setShowSidebar] = useState(true);

  const [parentToken, setParentToken] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  // ───────────────────────────────────────────────
  // FETCH USERS (CHAT LIST)
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
          headers: {
            Authorization: `Bearer ${parentToken}`,
          },
        });

        const data = await res.json();
        console.log("📥 Conversations List:", data);

        const mappedUsers: User[] =
          data?.data?.conversations?.map((c: any) => ({
            id: c.user_id,
            name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
            avatar: c.profilePhoto
              ? `https://d34wmjl2ccaffd.cloudfront.net${c.profilePhoto}`
              : "/user.png",
            lastMessage: c.lastMessage ?? "",
            lastMessageTime: c.lastMessageTime ?? "",
            online: c.online ?? false,
            unread: c.unreadCount ?? 0,
          })) || [];

        setUsers((prev) => [...prev, ...mappedUsers]);

        if (data?.data?.nextCursor) setCursor(data.data.nextCursor);
      } catch (error) {
        console.error("❌ Failed to fetch users:", error);
      }
    };

    fetchUsers();
  }, [parentToken]);

  // ───────────────────────────────────────────────
  // CREATE OR GET CONVERSATION ID  (FIXED)
//  → Token is now passed explicitly
  // ───────────────────────────────────────────────
  const getConversationId = async (targetUserId: string, token: string) => {
    try {
      const res = await fetch(
        `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/conversations/create`,
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
      console.log("📥 Conversation Create:", data);

      const conversationId = data?.data?.conversationId;
      setConversationId(conversationId);
      return conversationId;
    } catch (err) {
      console.error("❌ Failed to create conversation:", err);
      return null;
    }
  };

  // ───────────────────────────────────────────────
  // FETCH MESSAGES USING conversationId
  // ───────────────────────────────────────────────
  const fetchMessages = async (cid: string) => {
    if (!parentToken) return;

    try {
      const url = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/message/${cid}/list?limit=10`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${parentToken}`,
        },
      });

      const data = await res.json();
      console.log("📥 Messages:", data);

      const mappedMessages: Message[] =
        data?.data?.messages?.map((msg: any) => ({
          id: msg.messageId,
          content: msg.content,
          timestamp: new Date(msg.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
          sent: msg.senderUserId === loggedInUserId,
          type: "text",
          status: msg.senderUserId === loggedInUserId ? "sent" : undefined,
        })) || [];

      setMessages(mappedMessages);
    } catch (error) {
      console.error("❌ Failed to fetch messages:", error);
    }
  };

  // ───────────────────────────────────────────────
  // HANDLE USER CLICK (FIXED)
  // Now passes parentToken directly
  // ───────────────────────────────────────────────
  const handleUserSelect = async (user: User) => {
    if (!parentToken) return;

    setSelectedUser(user);
    setMessages([]);

    // mark unread as read
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, unread: 0 } : u))
    );

    const cid = await getConversationId(user.id, parentToken);
    if (cid) fetchMessages(cid);

    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  // ───────────────────────────────────────────────
  // SEND MESSAGE (LOCAL ONLY)
  // ───────────────────────────────────────────────
  const handleSendMessage = (content: string) => {
    if (!selectedUser) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      sent: true,
      type: "text",
      status: "sent",
    };

    setMessages((prev) => [...prev, newMessage]);
  };

  // ───────────────────────────────────────────────
  // RECEIVE TOKEN + OPEN CHAT FROM PARENT (FIXED)
  // Token passed directly to getConversationId()
  // ───────────────────────────────────────────────
  useEffect(() => {
    window.parent.postMessage({ type: "CHAT_READY" }, "*");

    const handleMessage = async (event: MessageEvent) => {
      if (!event.data?.type) return;

      if (event.data.type === "OPEN_CHAT") {
        const token = event.data.payload?.token;
        const incomingUser = event.data.payload?.user;

        setParentToken(token);

        if (incomingUser) {
          const user: User = {
            id: incomingUser.user_id,
            name: `${incomingUser.firstName} ${incomingUser.lastName ?? ""}`.trim(),
            avatar: incomingUser.profilePhoto
              ? `https://d34wmjl2ccaffd.cloudfront.net${incomingUser.profilePhoto}`
              : "/user.png",
            lastMessage: "",
            lastMessageTime: "Now",
            online: true,
          };

          setSelectedUser(user);
          setMessages([]);

          // FIX: USE TOKEN HERE DIRECTLY
          const cid = await getConversationId(user.id, token);
          if (cid) fetchMessages(cid);

          setShowSidebar(false);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // ───────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────
  return (
    <div className={styles.chatInterface}>
      <div
        className={`${styles.sidebarWrapper} ${showSidebar ? styles.show : ""}`}
      >
        <UserSidebar
          users={users.filter((u) =>
            u.name.toLowerCase().includes(searchQuery.toLowerCase())
          )}
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
