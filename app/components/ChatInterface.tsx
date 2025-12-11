"use client";

import { useEffect, useState } from "react";

import styles from "./ChatInterface.module.scss";
import UserSidebar from "./UserSidebar";
import ChatPanel from "./ChatPanel";

export interface User {
  id: string; // conversationId === user_id
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
  sent: boolean; // true = sent by me, false = received
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // -----------------------
  // Fetch conversations (requires parentToken)
  // -----------------------
  useEffect(() => {
    if (!parentToken) return;

    const fetchUsers = async () => {
      setLoadingUsers(true);
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

        // dedupe by id
        setUsers((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const merged = [...prev, ...mappedUsers.filter((m) => !existingIds.has(m.id))];
          return merged;
        });

        if (data?.data?.nextCursor) {
          setCursor(data.data.nextCursor);
        }
      } catch (error) {
        console.error("❌ Failed to fetch users:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [parentToken]);

  // -----------------------
  // fetch last 10 messages for a conversationId (user.id)
  // -----------------------
  const fetchMessages = async (conversationId: string) => {
    if (!parentToken) {
      console.warn("No token yet — cannot fetch messages");
      return;
    }

    setLoadingMessages(true);
    try {
      const url = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/message/${conversationId}/list?limit=10&cursor=`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${parentToken}`,
        },
      });

      const data = await res.json();
      console.log("📥 Messages API:", data);

      const mapped: Message[] =
        data?.data?.messages?.map((m: any) => {
          // convert createdAt (number) to human time
          const ts = typeof m.createdAt === "number" ? new Date(m.createdAt) : new Date();
          // if senderUserId equals selectedUser.id => message is received (sent=false)
          const isSentBySelectedUser = m.senderUserId === (selectedUser?.id ?? conversationId);

          return {
            id: m.messageId,
            content: m.content ?? "",
            timestamp: ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            // If message's senderUserId === conversationId (other user), it's received => sent: false
            // We treat messages as "sent" if senderUserId !== conversationId (i.e., this client)
            sent: m.senderUserId !== conversationId,
            type: "text" as const,
            status: "delivered" as const,
          } as Message;
        }) || [];

      // API returns messages in chronological or reverse order — preserve order as returned.
      setMessages(mapped);
    } catch (err) {
      console.error("❌ Error fetching messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // -----------------------
  // handle user selection (click from sidebar)
  // -----------------------
  const handleUserSelect = async (user: User) => {
    setSelectedUser(user);
    setMessages([]);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, unread: 0 } : u)));

    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }

    // fetch last 10 messages for this conversation (conversationId = user.id)
    await fetchMessages(user.id);
  };

  // -----------------------
  // sending a message locally (you can extend this to POST to server)
  // -----------------------
  const handleSendMessage = (
    content: string,
    type: "text" | "image" | "document" | "link" = "text",
    fileOrLink?: {
      name?: string;
      url?: string;
      image?: string;
      description?: string;
    }
  ) => {
    if (!selectedUser) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      sent: true,
      type,
      status: "sent",
    };

    if (type === "image" || type === "document") {
      newMessage.fileName = fileOrLink?.name;
      newMessage.fileUrl = fileOrLink?.url;
    }

    if (type === "link") {
      newMessage.linkTitle = fileOrLink?.name;
      newMessage.linkUrl = fileOrLink?.url;
      newMessage.linkImage = fileOrLink?.image;
      newMessage.linkDescription = fileOrLink?.description;
    }

    setMessages((prev) => [...prev, newMessage]);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? { ...u, lastMessage: newMessage.content, lastMessageTime: "Just now" }
          : u
      )
    );

    // TODO: POST message to server if required
  };

  // -----------------------
  // filtered users
  // -----------------------
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // -----------------------
  // Parent messages: receive token + OPEN_CHAT + SEND_MESSAGE_TO_CHAT
  // -----------------------
  useEffect(() => {
    // let parent know iframe is up
    window.parent.postMessage({ type: "CHAT_READY" }, "*");

    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.type) return;

      console.log("📨 iframe received:", event.data);

      if (event.data.type === "OPEN_CHAT") {
        // token and user in payload
        const token = event.data.payload?.token || null;
        setParentToken(token);

        const incomingUser = event.data.payload?.user;
        if (incomingUser) {
          const user: User = {
            id: incomingUser.user_id,
            name: `${incomingUser.firstName ?? ""} ${incomingUser.lastName ?? ""}`.trim(),
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

          // fetch last 10 messages for this conversation
          // (conversationId === user.id)
          fetchMessages(user.id).catch(console.error);
        }
      }

      if (event.data.type === "SEND_MESSAGE_TO_CHAT") {
        const { user, message } = event.data.payload;

        // ensure selectedUser updates to the user the parent references
        const chatUser: User = {
          id: user.user_id,
          name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
          avatar: user.profilePhoto
            ? `https://d34wmjl2ccaffd.cloudfront.net${user.profilePhoto}`
            : "/user.png",
          lastMessage: "",
          lastMessageTime: "Now",
          online: true,
        };

        setSelectedUser(chatUser);
        setShowSidebar(false);

        // incoming message object (received)
        const incoming: Message = {
          id: Date.now().toString(),
          content: message,
          timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          sent: false, // received
          type: "text",
          status: "delivered",
        };

        setMessages((prev) => [...prev, incoming]);

        setUsers((prev) =>
          prev.map((u) =>
            u.id === chatUser.id ? { ...u, lastMessage: message, lastMessageTime: "Now" } : u
          )
        );

        // Optionally auto-send a local "read/ack" or reply — keep it small
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className={styles.chatInterface}>
      <div className={`${styles.sidebarWrapper} ${showSidebar ? styles.show : ""}`}>
        <UserSidebar
          users={filteredUsers}
          selectedUser={selectedUser}
          onUserSelect={handleUserSelect}
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
          // loading={loadingUsers}
        />
      </div>

      <div className={`${styles.chatWrapper} ${!showSidebar ? styles.show : ""}`}>
        <ChatPanel
          selectedUser={selectedUser}
          messages={messages}
          onSendMessage={handleSendMessage}
          onBack={() => {
            setSelectedUser(null);
            setShowSidebar(true);
          }}
          loadingMessages={loadingMessages}
        />
      </div>
    </div>
  );
}
