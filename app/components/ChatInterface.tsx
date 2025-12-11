"use client";

import { useEffect, useState } from "react";
import styles from "./ChatInterface.module.scss";
import UserSidebar from "./UserSidebar";
import ChatPanel from "./ChatPanel";

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

// dummy logged-in user ID
const MY_USER_ID = "dummy-user-123";

// fixed conversation ID for now
const FIXED_CONVERSATION_ID = "0c634a5d-216c-43e4-bb87-fa8a34cb22b2";

export default function ChatInterface() {
  const [users, setUsers] = useState<User[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);

  const [parentToken, setParentToken] = useState<string | null>(null);

  // ───────────────────────────────────────────────
  // FETCH USERS
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!parentToken) return;

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
        console.log("📥 Conversations API:", data);

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
  // FETCH MESSAGES
// ───────────────────────────────────────────────
// FETCH MESSAGES
// ───────────────────────────────────────────────
const fetchMessages = async (conversationId: string) => {
  if (!parentToken) return;

  try {
    const url = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/message/${conversationId}/list?limit=10`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${parentToken}`,
      },
    });

    const data = await res.json();
    console.log("📥 Messages API:", data);

    const mappedMessages: Message[] =
      data?.data?.messages?.map((msg: any) => ({
        id: msg.messageId,
        content: msg.content,
        timestamp: new Date(msg.createdAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        sent: msg.senderUserId === MY_USER_ID,
        type: "text",
        status: msg.senderUserId === MY_USER_ID ? "sent" : undefined,
      })) || [];

    setMessages(mappedMessages);
  } catch (error) {
    console.error("❌ Failed to fetch messages:", error);
  }
};

// ───────────────────────────────────────────────
// FETCH MESSAGES WHEN SELECTED USER CHANGES
// ───────────────────────────────────────────────
useEffect(() => {
  if (!selectedUser) return;

  // Use fixed conversation ID for now
  fetchMessages(FIXED_CONVERSATION_ID);
}, [selectedUser]);


  // ───────────────────────────────────────────────
  // SELECT USER
  // ───────────────────────────────────────────────
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setMessages([]);

    // mark user as read
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, unread: 0 } : u))
    );

    // use your fixed conversation ID for now
    fetchMessages(FIXED_CONVERSATION_ID);

    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  // ───────────────────────────────────────────────
  // SEND MESSAGE
  // ───────────────────────────────────────────────
  const handleSendMessage = (
    content: string,
    type: "text" | "image" | "document" | "link" = "text",
    fileOrLink?: any
  ) => {
    if (!selectedUser) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      sent: true,
      type,
      status: "sent",
    };

    setMessages((prev) => [...prev, newMessage]);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              lastMessage: newMessage.content,
              lastMessageTime: "Just now",
            }
          : u
      )
    );
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ───────────────────────────────────────────────
  // RECEIVE TOKEN + OPEN_CHAT
  // ───────────────────────────────────────────────
  useEffect(() => {
    window.parent.postMessage({ type: "CHAT_READY" }, "*");

    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.type) return;

      console.log("📨 iframe received:", event.data);

      if (event.data.type === "OPEN_CHAT") {
        setParentToken(event.data.payload?.token || null);

        const incomingUser = event.data.payload?.user;
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
          setShowSidebar(false);

          fetchMessages(FIXED_CONVERSATION_ID);
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
          users={filteredUsers}
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
