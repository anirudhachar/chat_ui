"use client";

import { useEffect, useState, useRef } from "react";
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
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  fileName?: string;
  fileUrl?: string;
  createdAtNum?: number;
  linkTitle?: string;
  linkUrl?: string;
  linkImage?: string;
  linkDescription?: string;
}

const decodeToken = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.user_id;
  } catch (e) {
    return null;
  }
};

const fmtTime = (ms: number | string | undefined) => {
  if (!ms) return "";
  const d = typeof ms === "number" ? new Date(ms) : new Date(Number(ms) || ms);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export default function ChatInterface() {
  const [users, setUsers] = useState<User[]>([]);
  const [convCursor, setConvCursor] = useState<string | null>(null);
  const [convHasMore, setConvHasMore] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [msgCursor, setMsgCursor] = useState<string | null>(null);
  const [msgHasMore, setMsgHasMore] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const [showSidebar, setShowSidebar] = useState(true);
  const [parentToken, setParentToken] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const chatWrapperRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  // ------------------- SEARCH -------------------
  useEffect(() => {
    if (!parentToken) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let abort = false;
    const fetchSearch = async () => {
      try {
        const url = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/search/people?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${parentToken}` },
        });
        const data = await res.json();
        if (abort) return;

        const mapped: User[] =
          data?.data?.users?.map((u: any) => ({
            id: u.user_id,
            name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
            avatar: u.profile_photo_url
              ? `https://d34wmjl2ccaffd.cloudfront.net${u.profile_photo_url}`
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
    return () => {
      abort = true;
    };
  }, [searchQuery, parentToken]);

  // ------------------- FETCH CONVERSATIONS -------------------
  const fetchConversations = async (cursor?: string | null) => {
    if (!parentToken || loadingConversations) return;
    try {
      setLoadingConversations(true);
      const base = "https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/conversations/list?limit=20";
      const url = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${parentToken}` },
      });
      const json = await res.json();
      const convs = json?.data?.conversations || [];
      const next = json?.data?.cursor ?? null;

      const mapped: User[] = convs.map((c: any) => ({
        id: c.user?.userId,
        name: `${c.user?.firstName ?? ""} ${c.user?.lastName ?? ""}`.trim(),
        avatar: c.user?.avatarUrl
          ? `https://d34wmjl2ccaffd.cloudfront.net${c.user.avatarUrl}`
          : "/user.png",
        lastMessage: c.lastMessagePreview ?? "",
        lastMessageTime: c.lastMessageAt ? fmtTime(c.lastMessageAt) : "",
        online: false,
        unread: c.unreadCount ?? 0,
      }));

      setUsers((prev) => (cursor ? [...prev, ...mapped] : mapped));
      setConvCursor(next);
      setConvHasMore(Boolean(next));
    } catch (err) {
      console.error("❌ Fetch conversations failed:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (!parentToken) return;
    setUsers([]);
    setConvCursor(null);
    setConvHasMore(true);
    fetchConversations(null);
  }, [parentToken]);

  // ------------------- FETCH MESSAGES -------------------
  const fetchMessages = async (cid: string, cursor?: string | null) => {
    if (!parentToken || loadingMessages) return;
    try {
      setLoadingMessages(true);
      loadingMoreRef.current = true;

      const base = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/message/${cid}/list?limit=20`;
      const url = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${parentToken}` },
      });
      const json = await res.json();
      const msgs = json?.data?.messages || [];
      const next = json?.data?.cursor ?? null;

      const mapped: Message[] = msgs.map((m: any) => ({
        id: m.messageId,
        content: m.content,
        timestamp: fmtTime(m.createdAt),
        sent: m.senderUserId === loggedInUserId,
        type: "text",
        status: m.senderUserId === loggedInUserId ? "sent" : undefined,
        createdAtNum: m.createdAt,
      }));

      if (!cursor) {
        const oldestFirst = mapped.slice().sort((a, b) => (a.createdAtNum ?? 0) - (b.createdAtNum ?? 0));
        setMessages(oldestFirst);
        requestAnimationFrame(() => {
          const el = chatWrapperRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      } else {
        const oldestFirstPage = mapped.slice().sort((a, b) => (a.createdAtNum ?? 0) - (b.createdAtNum ?? 0));
        const el = chatWrapperRef.current;
        let prevScrollHeight = el?.scrollHeight ?? 0;
        let prevScrollTop = el?.scrollTop ?? 0;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const filtered = oldestFirstPage.filter((m) => !existingIds.has(m.id));
          return [...filtered, ...prev];
        });

        requestAnimationFrame(() => {
          const el2 = chatWrapperRef.current;
          if (el2) {
            const delta = el2.scrollHeight - prevScrollHeight;
            el2.scrollTop = prevScrollTop + delta;
          }
        });
      }

      setMsgCursor(next);
      setMsgHasMore(Boolean(next));
    } catch (err) {
      console.error("❌ Fetch messages failed:", err);
    } finally {
      setLoadingMessages(false);
      loadingMoreRef.current = false;
    }
  };

  // ------------------- GET OR CREATE CONVERSATION -------------------
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
      const cid = data?.data?.conversationId ?? null;
      setConversationId(cid);
      return cid;
    } catch (err) {
      console.error("❌ Failed to create conversation:", err);
      return null;
    }
  };

  // ------------------- SEND MESSAGE -------------------
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
    } catch (err) {
      console.error("❌ Failed to send message:", err);
      throw err;
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedUser || !parentToken) return;

    let cid = conversationId;
    if (!cid) {
      cid = await getConversationId(selectedUser.id, parentToken);
      if (!cid) return;
    }

    const tempId = `temp-${Date.now()}`;
    const timeString = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const optimisticMessage: Message = {
      id: tempId,
      content,
      timestamp: timeString,
      sent: true,
      type: "text",
      status: "sending",
      createdAtNum: Date.now(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setUsers((prev) =>
      prev.map((u) => (u.id === selectedUser.id ? { ...u, lastMessage: content, lastMessageTime: timeString } : u))
    );

    requestAnimationFrame(() => {
      const el = chatWrapperRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });

    try {
      const data = await sendMessageToApi(cid, content, parentToken);
      const returnedMessageId = data?.data?.messageId ?? data?.data?.message?.messageId;
      const returnedCreatedAt = data?.data?.createdAt ?? data?.data?.message?.createdAt;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: returnedMessageId ?? m.id,
                status: "sent",
                timestamp: returnedCreatedAt
                  ? new Date(returnedCreatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  : m.timestamp,
                createdAtNum: returnedCreatedAt ?? m.createdAtNum,
              }
            : m
        )
      );

      requestAnimationFrame(() => {
        const el = chatWrapperRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
      );
    }
  };

  const handleUserSelect = async (user: User) => {
    if (!parentToken || !loggedInUserId) return;

    setSelectedUser(user);
    setMessages([]);
    setMsgCursor(null);
    setMsgHasMore(true);

    const cid = await getConversationId(user.id, parentToken);
    if (cid) fetchMessages(cid, null);

    if (window.innerWidth < 768) setShowSidebar(false);
  };

  // ------------------- PARENT MESSAGES -------------------
  useEffect(() => {
    window.parent.postMessage({ type: "CHAT_READY" }, "*");

    const handleMessage = async (event: MessageEvent) => {
      if (!event.data?.type) return;

      if (event.data.type === "OPEN_CHAT") {
        const token = event.data.payload?.token;
        const incomingUser = event.data.payload?.user;

        setParentToken(token);
        const uid = token ? decodeToken(token) : null;
        setLoggedInUserId(uid);

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
          setMsgCursor(null);
          setMsgHasMore(true);

          const cid = await getConversationId(user.id, token);
          if (cid && uid) fetchMessages(cid, null);

          setShowSidebar(false);
        }
      }

      if (event.data.type === "SEND_MESSAGE_TO_CHAT") {
        const payload = event.data.payload;
        if (!payload?.message) return;
        if (selectedUser && parentToken) handleSendMessage(payload.message);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedUser, parentToken]);

  // ------------------- SCROLL -------------------
  const handleConversationScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const bottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    if (bottom && convHasMore && !loadingConversations) fetchConversations(convCursor);
  };

  const handleMessageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 50 && msgHasMore && !loadingMessages && conversationId && !loadingMoreRef.current) {
      fetchMessages(conversationId, msgCursor);
    }
  };

  const listToShow = searchQuery.length >= 2 ? searchResults : users;

  return (
    <div className={styles.chatInterface}>
      <div
        ref={sidebarRef}
        onScroll={handleConversationScroll}
        className={`${styles.sidebarWrapper} ${showSidebar ? styles.show : ""}`}
      >
        <UserSidebar
          users={listToShow}
          selectedUser={selectedUser}
          onUserSelect={handleUserSelect}
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
        />
        {loadingConversations && <div style={{ textAlign: "center", padding: 8 }}>Loading...</div>}
        {!convHasMore && users.length > 0 && <div style={{ textAlign: "center", padding: 8, color: "#888" }}>No more conversations</div>}
      </div>

      <div
        ref={chatWrapperRef}
        onScroll={handleMessageScroll}
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
        {loadingMessages && <div style={{ textAlign: "center", padding: 8 }}>Loading messages...</div>}
        {!msgHasMore && messages.length > 0 && <div style={{ textAlign: "center", padding: 8, color: "#888" }}>No older messages</div>}
      </div>
    </div>
  );
}
