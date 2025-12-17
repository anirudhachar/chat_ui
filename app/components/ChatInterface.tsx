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

  linkTitle?: string;
  linkUrl?: string;
  linkImage?: string;
  linkDescription?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;

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
    console.log(payload,"payload")
    return payload.user_id;
  } catch (e) {
    return null;
  }
};

export default function ChatInterface() {
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

  useEffect(() => {
    if (!parentToken) return;

    const wsUrl = `wss://k4g7m4879h.execute-api.us-east-1.amazonaws.com/dev?token=${encodeURIComponent(
      parentToken
    )}`;

    const ws = new WebSocket(wsUrl);

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

            // 2. Update Chat Panel (ONLY if this conversation is actively open)
            if (data.conversationId === conversationIdRef.current) {
              setMessages((prev) => [
                ...prev,
                {
                  id: data.messageId,
                  content: parsedOffer?.text || data.content,
                  timestamp: new Date(data.createdAt).toLocaleTimeString(
                    "en-US",
                    {
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  ),
                  sent: data.senderUserId === loggedInUserIdRef.current,
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
                  status: "delivered",
                },
              ]);

              if (detectedUrl) {
                fetchLinkPreview(data.messageId, detectedUrl);
              }
            }

            // 3. Update Sidebar (ALWAYS runs to move user to top)
            setUsers((prev) => {
              // Determine who the "other" person is.
              // If I sent it (from another tab), target is recipient. If they sent it, target is sender.
              const targetUserId =
                data.senderUserId === loggedInUserIdRef.current
                  ? data.recipientUserId // Ensure your API sends this, or match by conversationId if possible
                  : data.senderUserId;

              // Fallback: If we can't determine ID easily, find user by iterating (less efficient but safe)
              const existingIndex = prev.findIndex(
                (u) =>
                  u.id === data.senderUserId || u.id === data.recipientUserId
              );

              if (existingIndex === -1) return prev; // User not in list, do nothing

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
                // Increment unread only if we aren't looking at the chat

                online: true,
              };

              // 🔥 THE FIX: Filter out the old user, put updatedUser at [0]
              const others = prev.filter((_, idx) => idx !== existingIndex);
              return [updatedUser, ...others];
            });

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

              // 🔥 THE FIX: Move to top
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

  console.log(users, "usersarray");

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

  // ───────────────────────────────────────────────
  // FETCH MESSAGES (Refactored for pagination)
  // ───────────────────────────────────────────────
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

              timestamp: new Date(msg.createdAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              }),

              sent: msg.senderUserId === myUserId,

              // 🔥 SENDER INFO (FROM API)
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

              status:
                msg.senderUserId === myUserId
                  ? "sent"
                  : msg.deliveryStatus?.toLowerCase(),
            };
          }) ?? [];

        const ordered = mappedMessages.reverse();

        setMessages((prev) =>
          currentCursor ? [...ordered, ...prev] : ordered
        );

        const nextCursor = data?.data?.cursor ?? null;
        setMessageCursor(nextCursor);
        setHasMoreMessages(Boolean(nextCursor));
      } catch (error) {
        console.error("❌ Failed to fetch messages:", error);
        setHasMoreMessages(false);
      } finally {
        // 🔥 END loading ONLY here
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
    token: string
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
      replyTo?: Message // 👈 ADDED: 4th argument to accept the reply object
    ) => {
      if (!selectedUser || !parentToken) return;

      const detectedUrl = extractUrl(content);

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

      // ─────────────────────────────────────────────
      // OPTIMISTIC MESSAGE
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
        senderAvatar: myAvatar,
        linkUrl: file?.url,
        linkTitle: file?.name,
        linkDescription: file?.description,
        linkImage: file?.image,

        replyTo: replyTo, // 👈 ADDED: Pass replyTo to state so UI renders it immediately
      };

      console.log(optimistic, "messageoptimistic");
      setMessages((prev) => [...prev, optimistic]);

      // 🔥 EXIT SEARCH MODE
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);

      // 🔥 MOVE CONVERSATION TO TOP
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
      // SEND TO API
      // ─────────────────────────────────────────────
      const apiContent =
        type === "text" ? content : file?.url || file?.name || content;

      try {
        const data = await sendMessageToApi(cid, apiContent, parentToken);

        const realId = data?.data?.messageId ?? data?.data?.message?.messageId;
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
                  senderAvatar: myAvatar,
                }
              : m
          )
        );

        // ─────────────────────────────────────────────
        // 🔗 FETCH LINK PREVIEW (AFTER SEND)
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
          } catch {
            // preview failure is non-blocking
          }
        }
      } catch {
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
        />
      </div>
    </div>
  );
}
