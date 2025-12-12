"use client";

import { useEffect, useState, useRef } from "react";
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
  timestamp: string; // human friendly time string
  sent: boolean;
  type: "text" | "image" | "document" | "link";
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  fileName?: string;
  fileUrl?: string;

  // raw createdAt number (used for sorting/pagination)
  createdAtNum?: number;

  linkTitle?: string;
  linkUrl?: string;
  linkImage?: string;
  linkDescription?: string;
}

// ───────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────
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
  const d =
    typeof ms === "number" ? new Date(ms) : new Date(Number(ms) || ms);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

// ───────────────────────────────────────────────
// COMPONENT
// ───────────────────────────────────────────────
export default function ChatInterface() {
  // Conversations (pagination)
  const [users, setUsers] = useState<User[]>([]);
  const [convCursor, setConvCursor] = useState<string | null>(null);
  const [convHasMore, setConvHasMore] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Selected user & conversation
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Messages (pagination) — UI will store oldest-first (index 0 = oldest)
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgCursor, setMsgCursor] = useState<string | null>(null);
  const [msgHasMore, setMsgHasMore] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

  // UI
  const [showSidebar, setShowSidebar] = useState(true);

  // Auth
  const [parentToken, setParentToken] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  // refs for scroll handlers (attached to wrapper divs)
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const chatWrapperRef = useRef<HTMLDivElement | null>(null);

  // Prevent double fetch on very fast scrolls
  const loadingMoreRef = useRef(false);

  // ───────────────────────────────────────────────
  // SEARCH API (unchanged)
  // ───────────────────────────────────────────────
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
        const url = `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/search/people?query=${encodeURIComponent(
          q
        )}`;

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

  // ───────────────────────────────────────────────
  // FETCH CONVERSATIONS (cursor pagination)
  // backend returns: data.conversations[] and data.cursor
  // ───────────────────────────────────────────────
  const fetchConversations = async (cursor?: string | null) => {
    if (!parentToken) return;
    if (loadingConversations) return;

    try {
      setLoadingConversations(true);
      const base =
        "https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/conversations/list?limit=20";
      const url = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${parentToken}` },
      });
      const json = await res.json();
      // expected: json.data.conversations, json.data.cursor
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

  // initial fetch of conversations when token is set
  useEffect(() => {
    if (!parentToken) return;
    // reset and load first page
    setUsers([]);
    setConvCursor(null);
    setConvHasMore(true);
    fetchConversations(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentToken]);

  // ───────────────────────────────────────────────
  // FETCH MESSAGES (cursor pagination)
  //
  // Backend returns newest-first (latest at index 0).
  // We convert to oldest-first for the UI (index 0 = oldest).
  // - Initial load (no cursor): reverse and set, then scroll to bottom.
  // - Pagination (cursor provided): API returns older messages; these should be
  //   prepended at the top (older), preserving scroll position.
  // ───────────────────────────────────────────────
  const fetchMessages = async (cid: string, cursor?: string | null) => {
    if (!parentToken) return;
    if (loadingMessages) return;

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

      // Map messages to our Message type, track createdAtNum
      const mapped: Message[] = msgs.map((m: any) => {
        const created = m.createdAt;
        return {
          id: m.messageId,
          content: m.content,
          timestamp: fmtTime(created),
          sent: m.senderUserId === loggedInUserId,
          type: "text",
          status: m.senderUserId === loggedInUserId ? "sent" : undefined,
          createdAtNum: created,
        };
      });

      if (!cursor) {
        // INITIAL LOAD: API gives newest-first; we want oldest-first
        const oldestFirst = mapped
          .slice()
          .sort((a, b) => (a.createdAtNum ?? 0) - (b.createdAtNum ?? 0));
        setMessages(oldestFirst);

        // small delay to let DOM render then scroll to bottom
        requestAnimationFrame(() => {
          const el = chatWrapperRef.current;
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        });
      } else {
        // PAGINATION LOAD (older messages). API returns older messages (still newest-first
        // relative to that page), so convert that page to oldest-first, then PREPEND.
        const oldestFirstPage = mapped
          .slice()
          .sort((a, b) => (a.createdAtNum ?? 0) - (b.createdAtNum ?? 0));

        // preserve scroll position:
        const el = chatWrapperRef.current;
        let prevScrollHeight = 0;
        let prevScrollTop = 0;
        if (el) {
          prevScrollHeight = el.scrollHeight;
          prevScrollTop = el.scrollTop;
        }

        setMessages((prev) => {
          // avoid duplicates
          const existingIds = new Set(prev.map((p) => p.id));
          const filtered = oldestFirstPage.filter((m) => !existingIds.has(m.id));
          return [...filtered, ...prev];
        });

        // After DOM update, restore scroll position so the view stays stable
        requestAnimationFrame(() => {
          const el2 = chatWrapperRef.current;
          if (el2) {
            const newScrollHeight = el2.scrollHeight;
            const delta = newScrollHeight - prevScrollHeight;
            // maintain same visible messages (push down by the delta)
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

  // ───────────────────────────────────────────────
  // GET OR CREATE CONVERSATION ID (unchanged)
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
      const cid = data?.data?.conversationId ?? null;
      setConversationId(cid);
      return cid;
    } catch (err) {
      console.error("❌ Failed to create conversation:", err);
      return null;
    }
  };

  // ───────────────────────────────────────────────
  // SEND MESSAGE
  // - optimistic append at BOTTOM
  // - after send success replace temp item and scroll to bottom
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
          body: JSON.stringify({
            conversationId: cid,
            content,
          }),
        }
      );

      return await res.json();
    } catch (err) {
      console.error("❌ Failed to send message:", err);
      throw err;
    }
  };

  const scrollToBottom = () => {
    const el = chatWrapperRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
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
    const timeString = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const optimisticMessage: Message = {
      id: tempId,
      content,
      timestamp: timeString,
      sent: true,
      type: "text",
      status: "sending",
      createdAtNum: Date.now(),
    };

    // append to bottom (oldest-first array)
    setMessages((prev) => [...prev, optimisticMessage]);

    // update conversation preview
    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? { ...u, lastMessage: content, lastMessageTime: timeString }
          : u
      )
    );

    // scroll to bottom so user sees their message
    requestAnimationFrame(scrollToBottom);

    try {
      const data = await sendMessageToApi(cid, content, parentToken);

      const returnedMessageId =
        data?.data?.messageId ?? data?.data?.message?.messageId;
      const returnedCreatedAt =
        data?.data?.createdAt ?? data?.data?.message?.createdAt;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: returnedMessageId ?? m.id,
                status: "sent",
                timestamp: returnedCreatedAt
                  ? new Date(returnedCreatedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : m.timestamp,
                createdAtNum: returnedCreatedAt ?? m.createdAtNum,
              }
            : m
        )
      );

      // ensure final message visible
      requestAnimationFrame(scrollToBottom);
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
      );
    }
  };

  // ───────────────────────────────────────────────
  // HANDLE USER SELECT (open conversation)
  // Reset message pagination and fetch initial page (convert to oldest-first)
  // ───────────────────────────────────────────────
  const handleUserSelect = async (user: User) => {
    if (!parentToken || !loggedInUserId) return;

    setSelectedUser(user);
    setMessages([]);
    setMsgCursor(null);
    setMsgHasMore(true);

    const cid = await getConversationId(user.id, parentToken);
    if (cid) {
      // set conversationId already done in getConversationId
      fetchMessages(cid, null);
    }

    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  // ───────────────────────────────────────────────
  // PARENT WINDOW EVENTS (OPEN_CHAT etc)
  // ───────────────────────────────────────────────
  useEffect(() => {
    window.parent.postMessage({ type: "CHAT_READY" }, "*");

    const handleMessage = async (event: MessageEvent) => {
      if (!event.data?.type) return;

      // OPEN_CHAT from parent
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

      // SEND_MESSAGE_TO_CHAT from parent (share)
      if (event.data.type === "SEND_MESSAGE_TO_CHAT") {
        const payload = event.data.payload;
        if (!payload?.message) return;

        if (selectedUser && parentToken) {
          handleSendMessage(payload.message);
        } else {
          console.warn("⚠️ Chat not ready to send share message yet.");
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, parentToken]);

  // ───────────────────────────────────────────────
  // SCROLL HANDLERS (attached to wrapper divs)
  // Conversations: load more when user scrolled to bottom
  // Messages: load older messages when user scrolls to TOP
  // ───────────────────────────────────────────────
  const handleConversationScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const bottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    if (bottom && convHasMore && !loadingConversations) {
      fetchConversations(convCursor);
    }
  };

  const handleMessageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // if user is near top, load older messages
    if (el.scrollTop <= 50 && msgHasMore && !loadingMessages && conversationId && !loadingMoreRef.current) {
      // fetch older messages using current cursor
      // Note: msgCursor is the cursor returned by last API call (points to older page)
      fetchMessages(conversationId, msgCursor);
    }
  };

  // Final list to show in sidebar (search takes precedence)
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
        {/* optional loader indicator */}
        {loadingConversations && (
          <div style={{ textAlign: "center", padding: 8 }}>Loading...</div>
        )}
        {!convHasMore && users.length > 0 && (
          <div style={{ textAlign: "center", padding: 8, color: "#888" }}>
            No more conversations
          </div>
        )}
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
        {loadingMessages && (
          <div style={{ textAlign: "center", padding: 8 }}>Loading messages...</div>
        )}
        {!msgHasMore && messages.length > 0 && (
          <div style={{ textAlign: "center", padding: 8, color: "#888" }}>
            No older messages
          </div>
        )}
      </div>
    </div>
  );
}
