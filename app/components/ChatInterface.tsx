"use client";

import { useEffect, useState, useCallback } from "react";
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
  // Sidebar (User/Conversation) States
  const [users, setUsers] = useState<User[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(true); 
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);

  // Chat Panel (Message) States
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Message Pagination and Scroll Anchoring States
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [prevScrollHeight, setPrevScrollHeight] = useState<number | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false); // NEW: To prevent infinite loop

  // Global Context States
  const [parentToken, setParentToken] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  // ───────────────────────────────────────────────
  // FETCH USERS LIST
  // ───────────────────────────────────────────────
  const fetchUsers = useCallback(async (currentCursor: string | null, isInitialFetch: boolean) => {
    if (!parentToken) return;

    try {
      const url =
        `https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev/chat/conversations/list?limit=10` +
        (currentCursor ? `&cursor=${encodeURIComponent(currentCursor)}` : "");

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${parentToken}`,
        },
      });

      const data = await res.json();
      console.log("📥 Conversations List:", data);

      const mappedUsers: User[] =
        data?.data?.conversations?.map((c: any) => ({
          id: c.user?.userId,
          name: `${c.user?.firstName ?? ""} ${
            c.user?.lastName ?? ""
          }`.trim(),
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

          online: c.user?.online ?? false,
          unread: c.unreadCount ?? 0,
        })) || [];

      setUsers((prev) => (isInitialFetch ? mappedUsers : [...prev, ...mappedUsers]));

      const nextCursor = data?.data?.cursor || null;
      setCursor(nextCursor);
      setHasMoreUsers(!!nextCursor); 

    } catch (error) {
      console.error("❌ Failed to fetch users:", error);
      setHasMoreUsers(false); 
    }
  }, [parentToken]);

  const loadMoreUsers = () => {
    if (hasMoreUsers && searchQuery.length < 2) {
      fetchUsers(cursor, false);
    }
  };

  // ───────────────────────────────────────────────
  // INITIAL FETCH USERS LIST EFFECT
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!parentToken) return;

    const uid = decodeToken(parentToken);
    setLoggedInUserId(uid);

    setUsers([]); 
    setCursor(null);
    setHasMoreUsers(true); 
    fetchUsers(null, true);
  }, [parentToken, fetchUsers]);

  // ───────────────────────────────────────────────
  // GET OR CREATE CONVERSATION
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
      const cid = data?.data?.conversationId;
      setConversationId(cid);
      return cid;
    } catch (err) {
      console.error("❌ Failed to create conversation:", err);
      return null;
    }
  };

  // ───────────────────────────────────────────────
  // FETCH MESSAGES (Updated for isLoadingMessages)
  // ───────────────────────────────────────────────
  const fetchMessages = useCallback(async (
    cid: string,
    token: string,
    myUserId: string | null,
    currentCursor: string | null
  ) => {
    if (!myUserId || !cid) return;

    setIsLoadingMessages(true); // START loading

    try {
      const baseUrl = "https://0ly7d5434b.execute-api.us-east-1.amazonaws.com/dev";
      
      const url = 
        `${baseUrl}/chat/message/${cid}/list?limit=10` +
        (currentCursor ? `&cursor=${encodeURIComponent(currentCursor)}` : "");

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
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
          sent: msg.senderUserId === myUserId,
          type: "text",
          status: msg.senderUserId === myUserId ? "sent" : undefined,
        })) || [];

      // If fetching with a cursor, prepend (load older messages). 
      // If cursor is null (initial fetch), replace and reverse (show newest at bottom).
      setMessages((prev) => {
        const newMessages = mappedMessages.reverse();
        return currentCursor ? [...newMessages, ...prev] : newMessages;
      });

      const nextCursor = data?.data?.cursor || null;
      setMessageCursor(nextCursor);
      setHasMoreMessages(!!nextCursor); 

    } catch (error) {
      console.error("❌ Failed to fetch messages:", error);
      setHasMoreMessages(false);
    } finally {
        setIsLoadingMessages(false); // END loading
    }
  }, []); 

  // NEW: Function to load the next page of messages (older ones)
  const loadMoreMessages = (currentScrollHeight: number) => {
    // Only load if not already loading, more messages exist, and all context is present
    if (isLoadingMessages) return; 

    if (conversationId && hasMoreMessages && parentToken && loggedInUserId) {
        setPrevScrollHeight(currentScrollHeight); // Save scroll height before fetch
        fetchMessages(conversationId, parentToken, loggedInUserId, messageCursor);
    }
  };

  // ───────────────────────────────────────────────
  // CHAT SELECTION HANDLER
  // ───────────────────────────────────────────────
  const handleUserSelect = async (user: User) => {
    if (!parentToken || !loggedInUserId) return;

    setSelectedUser(user);
    setMessages([]);
    
    // Reset message pagination and scroll states
    setMessageCursor(null); 
    setHasMoreMessages(true);
    setPrevScrollHeight(null);
    setIsLoadingMessages(false); // Ensure reset

    // reset unread count
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, unread: 0 } : u))
    );

    const cid = await getConversationId(user.id, parentToken);
    if (cid) fetchMessages(cid, parentToken, loggedInUserId, null);

    if (window.innerWidth < 768) setShowSidebar(false);
  };

  // ───────────────────────────────────────────────
  // SEND MESSAGE HANDLER (Logic remains the same)
  // ───────────────────────────────────────────────
  const sendMessageToApi = async (cid: string, content: string, token: string) => {
    // ... (unchanged API call logic) ...
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

  const handleSendMessage = useCallback(async (content: string) => {
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

    const optimistic: Message = {
      id: tempId,
      content,
      timestamp: timeString,
      sent: true,
      type: "text",
      status: "sending",
    };

    setMessages((p) => [...p, optimistic]);

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
                id: realId ?? m.id,
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
  }, [selectedUser, parentToken, conversationId]);

  // ───────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────
  const listToShow = searchQuery.length >= 2 ? searchResults : users;
  const isSearchActive = searchQuery.length >= 2;

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
          onLoadMore={loadMoreUsers} 
          hasMore={hasMoreUsers && !isSearchActive} 
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
          // PROPS for message pagination and scroll anchoring
          onLoadMoreMessages={loadMoreMessages} 
          hasMoreMessages={hasMoreMessages}
          prevScrollHeight={prevScrollHeight} 
          setPrevScrollHeight={setPrevScrollHeight}
          isLoadingMessages={isLoadingMessages} // NEW: Pass loading state
        />
      </div>
    </div>
  );
}