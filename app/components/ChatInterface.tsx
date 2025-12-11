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

export default function ChatInterface() {
  const [users, setUsers] = useState<User[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);

  const [parentToken, setParentToken] = useState<string | null>(null);

  // ───────────────────────────────────────────────
  // 1️⃣ FETCH USERS FROM API
  // ───────────────────────────────────────────────
  useEffect(() => {
    const fetchUsers = async () => {
      if (!parentToken) return; // wait until token received

      try {
        const url = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/conversations/list?limit=20${
          cursor ? `&cursor=${cursor}` : ""
        }`;

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

        if (data?.data?.nextCursor) {
          setCursor(data.data.nextCursor);
        }
      } catch (error) {
        console.error("❌ Failed to fetch users:", error);
      }
    };

    fetchUsers();
  }, [parentToken]);

  // ───────────────────────────────────────────────
  // 2️⃣ SELECT USER
  // ───────────────────────────────────────────────
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setMessages([]);

    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, unread: 0 } : u))
    );

    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  // ───────────────────────────────────────────────
  // 3️⃣ SEND MESSAGE
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

    if (type === "image" || type === "document") {
      newMessage.fileName = fileOrLink?.name;
      newMessage.fileUrl = fileOrLink?.url;
    }

    if (type === "link") {
      newMessage.linkTitle = fileOrLink?.title;
      newMessage.linkUrl = fileOrLink?.url;
      newMessage.linkImage = fileOrLink?.image;
      newMessage.linkDescription = fileOrLink?.description;
    }

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

  // ───────────────────────────────────────────────
  // 4️⃣ FILTER USERS
  // ───────────────────────────────────────────────
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ───────────────────────────────────────────────
  // 5️⃣ RECEIVE TOKEN + OPEN_CHAT + MESSAGE from parent
  // ───────────────────────────────────────────────
  useEffect(() => {
    window.parent.postMessage({ type: "CHAT_READY" }, "*");

    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.type) return;

      console.log("📨 iframe received:", event.data);

      // token comes inside OPEN_CHAT payload
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
        }
      }

      // MESSAGE SEND FROM PARENT
      if (event.data.type === "SEND_MESSAGE_TO_CHAT") {
        const { user, message } = event.data.payload;

        const chatUser: User = {
          id: user.user_id,
          name: `${user.firstName} ${user.lastName ?? ""}`.trim(),
          avatar: user.profilePhoto
            ? `https://d34wmjl2ccaffd.cloudfront.net${user.profilePhoto}`
            : "/user.png",
          lastMessage: "",
          lastMessageTime: "Now",
          online: true,
        };

        setSelectedUser(chatUser);
        setShowSidebar(false);

        const incoming: Message = {
          id: Date.now().toString(),
          content: message,
          timestamp: new Date().toLocaleTimeString(),
          sent: true,
          type: "text",
          status: "delivered",
        };

        setMessages((prev) => [...prev, incoming]);

        setUsers((prev) =>
          prev.map((u) =>
            u.id === chatUser.id
              ? { ...u, lastMessage: message, lastMessageTime: "Now" }
              : u
          )
        );

        setTimeout(() => {
          handleSendMessage(message, "text");
        }, 150);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // ───────────────────────────────────────────────
  // 6️⃣ UI
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
