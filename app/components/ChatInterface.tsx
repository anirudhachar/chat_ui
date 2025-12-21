"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  lastMessageStatus?: "sent" | "delivered" | "read";
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  sent: boolean;
  type: "text" | "image" | "document" | "link" | "offer" | "audio";
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  fileName?: string;
  fileUrl?: string;
  messageKey?: string;
  linkTitle?: string;
  linkUrl?: string;
  linkImage?: string;
  linkDescription?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  reactions?: Record<string, string[]>;

  offer?: {
    offerId: string;
    listingId: string;
    offerType: "PRICE" | "TRADE";
    amount?: number;
    currency?: string;
    tradeDescription?: string;
    imageUrl?: string;
  };
  replyTo?: Message;
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
  const wsRef = useRef<WebSocket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  // NEW: State for message pagination
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);

  const [parentToken, setParentToken] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const loggedInUserIdRef = useRef<string | null>(null);
  const selectedUserRef = useRef<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const extractUrl = (text: string) => {
    const match = text.match(/(https?:\/\/(?:www\.)?[^\s/$.?#].[^\s]*)/i);
    return match ? match[0] : null;
  };

  const fetchLinkPreview = async (messageId: string, url: string) => {
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const preview = await res.json();
      if (preview?.error) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                linkTitle: preview.title,
                linkDescription: preview.description,
                linkImage: preview.image,
              }
            : m
        )
      );
    } catch {
      // non-blocking
    }
  };

  const fetchUsers = useCallback(
    async (currentCursor: string | null, isInitialFetch: boolean) => {
      if (!parentToken) return;

      if (isInitialFetch) {
        setIsUsersLoading(true); // 🔥 start loading
      }

      try {
        const url =
          `${process.env.NEXT_PUBLIC_API_URL}/conversations/list?limit=10` +
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

            online: c.user?.online ?? false,
            unread: c.unreadCount ?? "",
            lastMessageStatus: c.lastMessageDeliveryStatus
              ? (c.lastMessageDeliveryStatus.toLowerCase() as User["lastMessageStatus"])
              : undefined,
          })) || [];

        // If it's the initial fetch (cursor is null), replace the list. Otherwise, append.
        setUsers((prev) =>
          isInitialFetch ? mappedUsers : [...prev, ...mappedUsers]
        );

        const nextCursor = data?.data?.cursor || null;
        setCursor(nextCursor);
        setHasMoreUsers(!!nextCursor);
      } catch (error) {
        console.error("❌ Failed to fetch users:", error);
        setHasMoreUsers(false);
      } finally {
        if (isInitialFetch) {
          setIsUsersLoading(false);
        }
      }
    },
    [parentToken]
  );

  const loadMoreUsers = () => {
    if (hasMoreUsers && searchQuery.length < 2) {
      fetchUsers(cursor, false);
    }
  };

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    loggedInUserIdRef.current = loggedInUserId;
  }, [loggedInUserId]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  const usersRef = useRef<User[]>([]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    if (!parentToken) return;

    const wsUrl = `wss://k4g7m4879h.execute-api.us-east-1.amazonaws.com/dev?token=${encodeURIComponent(
      parentToken
    )}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { event: eventType, data } = payload;

        console.log("WS event:", eventType, data);

        switch (eventType) {
          // ─────────────────────────────
          // NEW MESSAGE
          // ─────────────────────────────
          case "newMessage": {
            // 1. Parse Data
            let parsedOffer = null;
            try {
              const parsed = JSON.parse(data.content);
              if (parsed.type === "OFFER") parsedOffer = parsed;
            } catch {}

            const detectedUrl = !parsedOffer ? extractUrl(data.content) : null;
            const isMine = data.senderUserId === loggedInUserIdRef.current;

            console.log(data, "datsend");
            const backendMessageKey = data.messageKey || data.messageId;

            // 🔥 GET AVATAR FROM SIDEBAR USERS
            const senderAvatar = isMine
              ? myAvatar
              : usersRef.current.find((u) => u.id === data.senderUserId)
                  ?.avatar;

            // ─────────────────────────────────────────────────────────
            // 🛑 ACKNOWLEDGEMENT LOGIC (Fixed to prevent 500 Errors)
            // ─────────────────────────────────────────────────────────
            if (!isMine) {
              const isChatOpen =
                data.conversationId === conversationIdRef.current;

              if (isChatOpen) {
                // Case A: User is looking at the chat -> Send READ immediately.
                // (Sending 'ackRead' implies it was delivered, so we skip 'ackDelivered' to avoid race conditions)
                console.log(
                  "👀 Chat open, sending ackRead for:",
                  backendMessageKey
                );
                ws.send(
                  JSON.stringify({
                    action: "ackRead",
                    conversationId: data.conversationId,
                    messageIds: [backendMessageKey],
                  })
                );
              } else {
                // Case B: User is in another chat/menu -> Send DELIVERED.
                console.log(
                  "📨 Chat closed, sending ackDelivered for:",
                  backendMessageKey
                );
                ws.send(
                  JSON.stringify({
                    action: "ackDelivered",
                    conversationId: data.conversationId,
                    messageIds: [backendMessageKey],
                  })
                );
              }
            }
            // ─────────────────────────────────────────────────────────

            // 2. Update Chat Panel (ONLY if this conversation is open)
            if (data.conversationId === conversationIdRef.current) {
              setMessages((prev) => [
                ...prev,
                {
                  id: data.messageId, // Keep using messageId for React 'key' if that's what your UI uses
                  content: parsedOffer?.text || data.content,
                  timestamp: new Date(data.createdAt).toLocaleTimeString(
                    "en-US",
                    {
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  ),
                  sent: isMine,
                  senderAvatar,
                  type: parsedOffer ? "offer" : detectedUrl ? "link" : "text",
                  offer: parsedOffer
                    ? {
                        offerId: parsedOffer.offerId,
                        listingId: parsedOffer.listingId,
                        offerType: parsedOffer.offerType,
                        amount: parsedOffer.amount,
                        currency: parsedOffer.currency,
                        tradeDescription: parsedOffer.tradeDescription,
                        imageUrl: parsedOffer.imageUrl,
                      }
                    : undefined,
                  linkUrl: detectedUrl ?? undefined,
                  status: isMine ? "sent" : "read", // If I'm seeing it arrive, it's effectively read
                },
              ]);

              if (detectedUrl) {
                fetchLinkPreview(data.messageId, detectedUrl);
              }
            }

            // 3. Update Sidebar (move conversation to top)
            setUsers((prev) => {
              const existingIndex = prev.findIndex(
                (u) =>
                  u.id === data.senderUserId || u.id === data.recipientUserId
              );

              if (existingIndex === -1) return prev;

              const existingUser = prev[existingIndex];

              const updatedUser: User = {
                ...existingUser,
                lastMessage: parsedOffer ? "Sent an offer" : data.content,
                lastMessageTime: new Date(data.createdAt).toLocaleTimeString(
                  "en-US",
                  {
                    hour: "numeric",
                    minute: "2-digit",
                  }
                ),
                online: true,
                // If chat is NOT open, increment unread count
                unread:
                  data.conversationId === conversationIdRef.current
                    ? 0
                    : (existingUser.unread || 0) + 1,
              };

              const others = prev.filter((_, idx) => idx !== existingIndex);
              return [updatedUser, ...others];
            });

            break;
          }

          case "messageRead": {
            // The payload.data should contain messageKey/messageId
            setMessages((prev) =>
              prev.map((m) =>
                // Match against either ID type to be safe
                m.id === data.messageKey || m.id === data.messageId
                  ? { ...m, status: "read" }
                  : m
              )
            );
            break;
          }

          case "messageDelivered": {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.messageKey || m.id === data.messageId
                  ? { ...m, status: "delivered" }
                  : m
              )
            );
            break;
          }

          // Inside ws.onmessage

          case "messageEdited": {
            setMessages((prev) =>
              prev.map((m) => {
                // Check both to be safe
                const isMatch =
                  m.messageKey === data.messageKey || m.id === data.messageId;

                if (isMatch) {
                  return {
                    ...m,
                    content: data.newContent,
                    // (m as any).isEdited = true; // Optional if you added isEdited to interface
                  };
                }
                return m;
              })
            );
            break;
          }

          case "messageDeleted": {
            setMessages((prev) =>
              prev.filter(
                (m) =>
                  m.messageKey !== data.messageKey && m.id !== data.messageId
              )
            );
            break;
          }

          case "messageReactionUpdated": {
            setMessages((prev) =>
              prev.map((m) =>
                m.messageKey === data.messageKey || m.id === data.messageId
                  ? { ...m, reactions: data.reactions } // Backend should send updated map
                  : m
              )
            );
            break;
          }

          // ─────────────────────────────
          // SIDEBAR UPDATE (Conversation Updated)
          // ─────────────────────────────
          case "conversationUpdated": {
            setUsers((prev) => {
              // Find the user to update
              const targetId = data.lastMessageSenderId;

              const index = prev.findIndex((u) => u.id === targetId);

              if (index === -1) return prev;

              const updatedUser = {
                ...prev[index],
                lastMessage: data.lastMessagePreview,
                lastMessageTime: new Date(
                  data.lastMessageAt
                ).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
                unread:
                  selectedUserRef.current?.id === targetId
                    ? 0
                    : (prev[index].unread ?? 0) + (data.unreadIncrement ?? 0),
              };

              // Move to top
              const others = prev.filter((_, i) => i !== index);
              return [updatedUser, ...others];
            });
            break;
          }

          case "messageSentAck": {
            console.log("✅ Message acknowledged by server");
            break;
          }

          default:
            console.log("⚠️ Unknown WS event", payload);
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket error", err);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [parentToken]);

  useEffect(() => {
    if (!parentToken) return;

    const uid = decodeToken(parentToken);
    setLoggedInUserId(uid);

    setUsers([]);
    setCursor(null);
    setHasMoreUsers(true);
    fetchUsers(null, true);
  }, [parentToken, fetchUsers]);

  const myAvatar =
    users.find((u) => u.id === loggedInUserId)?.avatar || "/user.png";
  console.log(myAvatar, "myAvatar");

  useEffect(() => {
    if (!parentToken) return;

    const query = searchQuery.trim();

    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setHasMoreUsers(!!cursor);
      return;
    }

    const fetchSearchResults = async () => {
      setIsSearching(true); // 🔥 START skeleton

      try {
        const url = `${
          process.env.NEXT_PUBLIC_API_URL
        }/search/people?query=${encodeURIComponent(query)}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${parentToken}`,
          },
        });

        const data = await res.json();

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
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false); // 🔥 STOP skeleton
      }
    };

    fetchSearchResults();
  }, [searchQuery, parentToken, cursor]);

  // ───────────────────────────────────────────────
  // GET OR CREATE CONVERSATION
  // ───────────────────────────────────────────────
  const getConversationId = async (targetUserId: string, token: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/conversations/create`,
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

      const cid = data?.data?.conversationId;
      setConversationId(cid);
      return cid;
    } catch (err) {
      console.error("❌ Failed to create conversation:", err);
      return null;
    }
  };

  const fetchMessages = useCallback(
    async (
      cid: string,
      token: string,
      myUserId: string | null,
      currentCursor: string | null
    ) => {
      if (!myUserId || !cid) return;

      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL;

        const url =
          `${baseUrl}/message/${cid}/list?limit=10` +
          (currentCursor ? `&cursor=${encodeURIComponent(currentCursor)}` : "");

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch messages");
        }

        const data = await res.json();
        console.log("📥 Messages:", data);

        // 1. Map messages for UI
        const mappedMessages: Message[] =
          data?.data?.messages?.map((msg: any) => {
            let parsedOffer = null;

            try {
              const parsed = JSON.parse(msg.content);
              if (parsed.type === "OFFER") parsedOffer = parsed;
            } catch {}

            const detectedUrl = !parsedOffer ? extractUrl(msg.content) : null;
            const sender = msg.sender;

            return {
              id: msg.messageId,
              content: parsedOffer?.text || msg.content,
              messageKey: msg.messageKey,
              timestamp: new Date(msg.createdAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }),

              sent: msg.senderUserId === myUserId,

              senderId: sender?.userId,
              senderName:
                msg.senderUserId === myUserId
                  ? "You"
                  : `${sender?.firstName ?? ""} ${
                      sender?.lastName ?? ""
                    }`.trim(),

              senderAvatar: sender?.avatarUrl
                ? `https://d34wmjl2ccaffd.cloudfront.net${sender.avatarUrl}`
                : undefined,

              type: parsedOffer ? "offer" : detectedUrl ? "link" : "text",

              offer: parsedOffer
                ? {
                    offerId: parsedOffer.offerId,
                    listingId: parsedOffer.listingId,
                    offerType: parsedOffer.offerType,
                    amount: parsedOffer.amount,
                    currency: parsedOffer.currency,
                    tradeDescription: parsedOffer.tradeDescription,
                    imageUrl: parsedOffer.imageUrl,
                  }
                : undefined,

              linkUrl: detectedUrl ?? undefined,

              // 🔥 STATUS LOGIC:
              // If it's my message: check if backend says it's read
              // If it's their message: I am reading it now, so mark as "read" locally
              status:
                msg.senderUserId === myUserId
                  ? msg.readAt
                    ? "read"
                    : "delivered"
                  : "read",
            };
          }) ?? [];

        const ordered = mappedMessages.reverse();

        setMessages((prev) =>
          currentCursor ? [...ordered, ...prev] : ordered
        );

        const nextCursor = data?.data?.cursor ?? null;
        setMessageCursor(nextCursor);
        setHasMoreMessages(Boolean(nextCursor));

        // ─────────────────────────────────────────────────────────────
        // 🔥 NEW: Send 'ackRead' for incoming unread messages
        // ─────────────────────────────────────────────────────────────
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Find messages that are NOT mine and NOT yet marked as read by backend
          const unreadMessageIds = data?.data?.messages
            ?.filter(
              (m: any) =>
                m.senderUserId !== myUserId && // Not sent by me
                !m.readAt // Not already read
            )
            .map((m: any) => m.messageId);

          if (unreadMessageIds && unreadMessageIds.length > 0) {
            console.log("📤 Sending ackRead for:", unreadMessageIds);

            wsRef.current.send(
              JSON.stringify({
                action: "ackRead",
                conversationId: cid,
                messageIds: unreadMessageIds,
              })
            );
          }
        }
      } catch (error) {
        console.error("❌ Failed to fetch messages:", error);
        setHasMoreMessages(false);
      } finally {
        setIsMessagesLoading(false);
      }
    },
    []
  );
  // Dependencies: empty since all required dependencies are passed as arguments or are stable state/props

  // NEW: Function to load the next page of messages (older ones)
  const loadMoreMessages = () => {
    if (conversationId && hasMoreMessages && parentToken && loggedInUserId) {
      fetchMessages(conversationId, parentToken, loggedInUserId, messageCursor);
    }
  };

  // ───────────────────────────────────────────────
  // SEND MESSAGE
  // ───────────────────────────────────────────────
  const sendMessageToApi = async (
    cid: string,
    content: string,
    token: string,
    replyToMessageKey?: string
  ) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/message/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversationId: cid,
            content,
            ...(replyToMessageKey && { replyToMessageKey }),
          }),
        }
      );

      return await res.json();
    } catch (err) {
      console.error("❌ Failed to send message:", err);
      throw err;
    }
  };

  const handleUserSelect = async (user: User) => {
    if (!parentToken || !loggedInUserId) return;
    conversationIdRef.current = null;
    // 🔥 START LOADING FIRST (KEY FIX)
    setIsMessagesLoading(true);

    // 🔥 Immediately render ChatPanel in loading state
    setSelectedUser(user);
    setMessages([]);

    // reset pagination
    setMessageCursor(null);
    setHasMoreMessages(true);

    // reset unread
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, unread: 0 } : u))
    );

    try {
      // 🔁 CREATE / GET CONVERSATION
      const cid = await getConversationId(user.id, parentToken);

      if (!cid) {
        setIsMessagesLoading(false);
        return;
      }

      // 📥 FETCH MESSAGES (same loading phase)
      await fetchMessages(cid, parentToken, loggedInUserId, null);
    } catch (e) {
      console.error(e);
      setIsMessagesLoading(false);
    }

    // 📱 Mobile UX
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  // ───────────────────────────────────────────────
  // SEND MESSAGE HANDLER
  // ───────────────────────────────────────────────
  // ChatInterface.tsx

  const handleSendMessage = useCallback(
    async (
      content: string,
      type: "text" | "image" | "document" | "link" | "audio" = "text",
      file?: {
        name: string;
        url: string;
        image?: string;
        description?: string;
      },
      replyTo?: Message
    ) => {
      if (!selectedUser || !parentToken) return;

      // 1. Detect URL for Link Preview logic later
      // (Ensure you have an extractUrl helper or regex here)
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const detectedUrl = content.match(urlRegex)?.[0];

      // 2. Ensure Conversation ID exists
      let cid = conversationId;
      if (!cid) {
        cid = await getConversationId(selectedUser.id, parentToken);
        if (!cid) return;
        // If you have a ref for conversationId, update it here too
        conversationIdRef.current = cid;
        setConversationId(cid);
      }

      const tempId = `temp-${Date.now()}`;
      const timeString = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      // ─────────────────────────────────────────────
      // ⚡ 3. OPTIMISTIC UPDATE
      // ─────────────────────────────────────────────
      const optimistic: Message = {
        id: tempId,
        content,
        timestamp: timeString,
        sent: true,
        type: detectedUrl ? "link" : type,
        status: "sending",

        fileName: file?.name,
        fileUrl: file?.url,
        senderAvatar: myAvatar, // Ensure myAvatar is defined in your component
        linkUrl: file?.url || detectedUrl,
        linkTitle: file?.name,
        linkDescription: file?.description,
        linkImage: file?.image,

        replyTo: replyTo, // ✅ Pass reply object so UI shows it immediately
      };

      setMessages((prev) => [...prev, optimistic]);

      // 🔥 Clear Search & Move User to Top
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);

      setUsers((prev) => {
        const updatedUser: User = {
          ...selectedUser,
          lastMessage: content,
          lastMessageTime: timeString,
          unread: 0,
        };

        const exists = prev.find((u) => u.id === selectedUser.id);
        return exists
          ? [updatedUser, ...prev.filter((u) => u.id !== selectedUser.id)]
          : [updatedUser, ...prev];
      });

      // ─────────────────────────────────────────────
      // 📡 4. SEND TO API
      // ─────────────────────────────────────────────
      const apiContent =
        type === "text" ? content : file?.url || file?.name || content;

      try {
        // Extract the key from the message we are replying to
        const replyKey = replyTo?.messageKey;

        // Send to API (Make sure sendMessageToApi accepts the 4th argument)
        const data = await sendMessageToApi(
          cid,
          apiContent,
          parentToken,
          replyKey
        );

        const realId = data?.data?.messageId ?? data?.data?.message?.messageId;
        const realTime =
          data?.data?.createdAt ?? data?.data?.message?.createdAt;

        // 🔥 IMPORTANT: Capture the new message's key from the server
        const realKey =
          data?.data?.messageKey ?? data?.data?.message?.messageKey;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: realId ?? m.id,
                  messageKey: realKey, // ✅ Save the key so we can Edit/Reply/Delete this message later
                  status: "sent",
                  timestamp: realTime
                    ? new Date(realTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : m.timestamp,
                  senderAvatar: myAvatar,
                }
              : m
          )
        );

        // ─────────────────────────────────────────────
        // 🔗 5. FETCH LINK PREVIEW (After Send)
        // ─────────────────────────────────────────────
        if (detectedUrl && type === "text") {
          try {
            const res = await fetch("/api/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: detectedUrl }),
            });

            const preview = await res.json();

            if (!preview?.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempId || m.id === realId
                    ? {
                        ...m,
                        linkTitle: preview.title,
                        linkDescription: preview.description,
                        linkImage: preview.image,
                        linkUrl: detectedUrl,
                      }
                    : m
                )
              );
            }
          } catch (e) {
            console.warn("Link preview failed", e);
          }
        }
      } catch (error) {
        console.error("Message send failed:", error);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      }
    },
    [
      selectedUser,
      parentToken,
      conversationId,
      setSearchQuery,
      setSearchResults,
      setIsSearching,
      myAvatar, // Added as dependency
    ]
  );

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
          setIsMessagesLoading(true);
          const user: User = {
            id: incomingUser.user_id,
            name: `${incomingUser.firstName} ${
              incomingUser.lastName ?? ""
            }`.trim(),
            avatar: incomingUser.profilePhoto
              ? `https://d34wmjl2ccaffd.cloudfront.net${incomingUser.profilePhoto}`
              : "/user.png",
            lastMessage: "",
            lastMessageTime: "Now",
            online: true,
          };

          setSelectedUser(user);
          setMessages([]);

          // Reset message pagination state
          setMessageCursor(null);
          setHasMoreMessages(true);

          const cid = await getConversationId(user.id, token);
          if (cid && uid) fetchMessages(cid, token, uid, null);

          setShowSidebar(false);
        }
      }

      if (event.data.type === "SEND_MESSAGE_TO_CHAT") {
        if (!selectedUser || !parentToken) return;

        const payload = event.data.payload;

        // 🆕 OFFER MESSAGE
        if (payload.type === "OFFER") {
          const timeString = new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });

          const optimisticOffer: Message = {
            id: `offer-${payload.offerId}`,
            content: payload.text || "Sent an offer",
            timestamp: timeString,
            sent: true,
            type: "offer",
            status: "sending",
            offer: {
              offerId: payload.offerId,
              listingId: payload.listingId,
              offerType: payload.offerType,
              amount: payload.amount,
              currency: payload.currency,
              tradeDescription: payload.tradeDescription,
              imageUrl: payload.imageUrl,
            },
          };

          setMessages((prev) => [...prev, optimisticOffer]);

          // 🔥 store offer as text/json in backend
          const apiContent = JSON.stringify({
            type: "OFFER",
            ...payload,
          });

          let cid = conversationId;
          if (!cid) {
            cid = await getConversationId(selectedUser.id, parentToken);
            if (!cid) return;
          }

          try {
            const data = await sendMessageToApi(cid, apiContent, parentToken);

            const realId = data?.data?.messageId;

            setMessages((prev) =>
              prev.map((m) =>
                m.id === optimisticOffer.id
                  ? { ...m, id: realId, status: "sent" }
                  : m
              )
            );
          } catch {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === optimisticOffer.id ? { ...m, status: "failed" } : m
              )
            );
          }

          return;
        }

        // 🟢 NORMAL TEXT MESSAGE
        handleSendMessage(payload.message);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    selectedUser,
    parentToken,
    conversationId,
    handleSendMessage,
    fetchMessages,
  ]);

  // ───────────────────────────────────────────────
  // ✏️ EDIT MESSAGE API
  // ───────────────────────────────────────────────
  // ───────────────────────────────────────────────
  // ✏️ EDIT MESSAGE API
  // ───────────────────────────────────────────────
  const handleEditMessage = async (msg: Message, newContent: string) => {
    if (!parentToken || !conversationIdRef.current) return;

    // 1. ⚡ OPTIMISTIC UPDATE: Update UI immediately before API call
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? { ...m, content: newContent, isEdited: true } // Update content & add edited flag
          : m
      )
    );

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/message/edit`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${parentToken}`,
          },
          body: JSON.stringify({
            conversationId: conversationIdRef.current,
            messageKey: msg.messageKey,
            newContent: newContent,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to edit message");
      }

      // If success, WebSocket will eventually confirm it, but UI is already updated.
    } catch (error) {
      console.error("❌ Error editing message:", error);

      // Optional: Revert change if API fails
      // setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content } : m));
      alert("Could not edit message");
    }
  };

  // ───────────────────────────────────────────────
  // 🗑️ DELETE MESSAGE API
  // ───────────────────────────────────────────────
  const handleDeleteMessage = async (msg: Message) => {
    if (!parentToken || !conversationIdRef.current) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/message/delete`,
        {
          method: "DELETE", // Check if your backend wants POST or DELETE
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${parentToken}`, // 🔥 Token passed here
          },
          body: JSON.stringify({
            conversationId: conversationIdRef.current,
            messageKey: msg.messageKey, // Sends the Composite Key
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to delete message");

      // Note: We wait for the "messageDeleted" WebSocket event to remove it from UI.
    } catch (error) {
      console.error("❌ Error deleting message:", error);
      alert("Could not delete message");
    }
  };

  const handleReaction = async (msg: Message, emoji: string) => {
    if (!parentToken || !conversationIdRef.current || !msg.messageKey) return;

    // ⚡ Optimistic Update (Immediate Feedback)
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msg.id) {
          const currentReactions = m.reactions || {};
          const users = currentReactions[emoji] || [];

          // Toggle Logic: If I'm in the list, remove me. If not, add me.
          const myId = loggedInUserId!;
          const hasReacted = users.includes(myId);

          const newUsers = hasReacted
            ? users.filter((uid) => uid !== myId)
            : [...users, myId];

          // If count is 0, remove the key entirely
          const newReactions = { ...currentReactions, [emoji]: newUsers };
          if (newUsers.length === 0) delete newReactions[emoji];

          return { ...m, reactions: newReactions };
        }
        return m;
      })
    );

    try {
      // 🔥 EXACT PAYLOAD YOU REQUESTED
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/message/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${parentToken}`,
        },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          messageKey: msg.messageKey, // Timestamp#UUID
          emoji: emoji,
        }),
      });
    } catch (err) {
      console.error("Failed to react", err);
    }
  };
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
          isSearching={isSearching}
          isUsersLoading={isUsersLoading}
        />
      </div>

      <div
        className={`${styles.chatWrapper} ${!showSidebar ? styles.show : ""}`}
      >
        <ChatPanel
          selectedUser={selectedUser}
          messages={messages}
          isLoading={isMessagesLoading}
          onSendMessage={handleSendMessage}
          onBack={() => {
            setSelectedUser(null);
            setShowSidebar(true);
          }}
          onLoadMoreMessages={loadMoreMessages}
          hasMoreMessages={hasMoreMessages}
          resetKey={selectedUser?.id}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReact={handleReaction}
        />
      </div>
    </div>
  );
}
