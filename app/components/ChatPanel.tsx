"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import {
  FiArrowLeft,
  FiMoreVertical,
  FiClock,
  FiFile,
  // ✨ Added these icons for the menu
  FiChevronDown,
  FiCopy,
  FiCornerUpLeft,
} from "react-icons/fi";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import Image from "next/image";

import { User, Message } from "./ChatInterface";
import MessageInput from "./MessageInput";
import styles from "./ChatPanel.module.scss";
import MessageSkeleton from "./MessageSkeleton/MessageSkeleton";

interface ChatPanelProps {
  selectedUser: User | null;
  messages: Message[];
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "document" | "link",
    file?: {
      name: string;
      url: string;
      image?: string;
      description?: string;
    }
  ) => void;
  onBack: () => void;
  onLoadMoreMessages: () => void;
  hasMoreMessages: boolean;
  resetKey?: string;
  // ✨ Added onReply prop
  onReply?: (message: Message) => void;
}

export default function ChatPanel({
  selectedUser,
  messages,
  onSendMessage,
  onBack,
  onLoadMoreMessages,
  hasMoreMessages,
  resetKey,
  onReply,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const topMessageSentinelRef = useRef<HTMLDivElement>(null);

  const isFirstLoadRef = useRef(true);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  // ✨ STATE: Tracks which message dropdown is open
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  /* 🔁 reset on chat switch */
  useEffect(() => {
    isFirstLoadRef.current = true;
    setActiveMessageId(null); // Close menus on switch
  }, [resetKey]);

  /* ✨ EFFECT: Close dropdown when clicking outside */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If clicking outside the options menu, close it
      if (
        activeMessageId &&
        !(event.target as Element).closest(`.${styles.messageOptions}`)
      ) {
        setActiveMessageId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMessageId]);

  useEffect(() => {
    const container = messagesAreaRef.current;
    if (!container || messages.length === 0) return;

    // 1️⃣ Initial chat open → jump instantly
    if (isFirstLoadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      isFirstLoadRef.current = false;
      return;
    }

    // 2️⃣ Loading older messages → preserve scroll
    if (isLoadingOlderRef.current) {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      isLoadingOlderRef.current = false;
      return;
    }

    // 3️⃣ New outgoing/incoming message → smooth scroll
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!hasMoreMessages || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const container = messagesAreaRef.current;
          if (!container) return;

          isLoadingOlderRef.current = true;
          prevScrollHeightRef.current = container.scrollHeight;

          onLoadMoreMessages();
        }
      },
      {
        root: messagesAreaRef.current,
        threshold: 0.1,
      }
    );

    const el = topMessageSentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMoreMessages, onLoadMoreMessages, messages.length]);

  /* ---------- HELPERS ---------- */

  // ✨ Restored this function
  const getAvatarColor = (id: string) => {
    const colors = [
      "#00a884",
      "#667781",
      "#0088cc",
      "#e9a944",
      "#9b72cb",
      "#00897b",
      "#ff6b6b",
      "#4fb3d4",
    ];
    return colors[parseInt(id.replace(/\D/g, "") || "0", 10) % colors.length];
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const getStatusIcon = (
    status?: "sending" | "sent" | "delivered" | "read" | "failed"
  ) => {
    if (!status) return null;
    if (status === "sending") return <FiClock className={styles.sendingIcon} />;
    if (status === "failed") return <span>❌</span>;
    if (status === "read")
      return <BsCheckAll className={`${styles.tickIcon} ${styles.read}`} />;
    if (status === "delivered")
      return <BsCheckAll className={styles.tickIcon} />;
    return <BsCheck className={styles.tickIcon} />;
  };


  const getCopyText = (m: Message): string => {
  switch (m.type) {
    case "text":
      return m.content || "";

    case "image":
      return m.content || m.fileUrl || "";

    case "document":
      return `${m.fileName || "Document"}\n${m.fileUrl || ""}`;

    case "link":
      return m.linkUrl || m.content || "";

    case "offer":
      if (!m.offer) return "";
      if (m.offer.offerType === "PRICE") {
        return `Offer: ${m.offer.currency} ${m.offer.amount}\n${m.content || ""}`;
      }
      return `Trade Offer: ${m.offer.tradeDescription}\n${m.content || ""}`;

    default:
      return m.content || "";
  }
};

const handleCopy = (msg: Message) => {
  const text = getCopyText(msg);
  if (!text) return;

  navigator.clipboard.writeText(text);
  setActiveMessageId(null);
};


  const handleReply = (msg: Message) => {
    if (onReply) onReply(msg);
    setActiveMessageId(null);
  };

  /* ---------- NEW: MESSAGE CONTENT RENDERER ---------- */
  const renderMessageContent = (m: Message): ReactNode => {
    // 📷 IMAGE MESSAGE

    // 📦 OFFER MESSAGE
    console.log(m, "messagemarket"); // ✨ Restored your log
    if (m.type === "offer" && m.offer) {
      return (
        <div
          className={`${styles.offerCard} ${
            m.sent ? styles.sent : styles.received
          }`}
        >
          {/* Header */}
          <div className={styles.offerHeader}>
            <span className={styles.offerBadge}>📦 Offer</span>
            <span className={styles.offerType}>
              {m.offer.offerType === "PRICE" ? "Price Offer" : "Trade Offer"}
            </span>
          </div>

          {/* Image */}
          {m.offer.imageUrl && (
            <div className={styles.offerImageWrapper}>
              <img
                src={m.offer.imageUrl}
                alt="Listing"
                className={styles.offerImage}
              />
            </div>
          )}

          {/* Offer Details */}
          <div className={styles.offerDetails}>
            {m.offer.offerType === "PRICE" && (
              <div className={styles.offerRow}>
                <span>Offered Price</span>
                <strong>
                  {m.offer.currency} {m.offer.amount}
                </strong>
              </div>
            )}

            {m.offer.offerType === "TRADE" && (
              <div className={styles.offerRow}>
                <span>Trade Item</span>
                <strong>{m.offer.tradeDescription}</strong>
              </div>
            )}
          </div>

          {/* Message */}
          {m.content && <p className={styles.offerMessage}>{m.content}</p>}
        </div>
      );
    }

    if (m.type === "image" && m.fileUrl) {
      return (
        <div className={styles.mediaContainer}>
          <img
            src={m.fileUrl}
            alt={m.content}
            className={styles.messageImage}
          />
          {m.content && m.content.trim() !== "📷 Photo" && (
            <p className={styles.messageCaption}>{m.content}</p>
          )}
        </div>
      );
    }

    // 📄 DOCUMENT MESSAGE
    if (m.type === "document" && m.fileUrl) {
      return (
        <a
          href={m.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.messageDocumentLink}
        >
          <div className={styles.documentIcon}>
            <FiFile size={20} />
          </div>
          <div className={styles.documentInfo}>
            <p className={styles.documentName}>
              {m.fileName || m.content || "Document"}
            </p>
            {m.content && m.content.trim() !== m.fileName?.trim() && (
              <p className={styles.documentSize}>{m.content}</p>
            )}
          </div>
        </a>
      );
    }

    // 🔗 LINK MESSAGE
    if (m.type === "link" && m.linkUrl) {
      // ✅ PREVIEW AVAILABLE
      if (m.linkTitle) {
        return (
          <>
            <a
              href={m.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.messageLinkPreview}
            >
              {m.linkImage && (
                <img
                  src={m.linkImage}
                  alt={m.linkTitle}
                  className={styles.linkImage}
                />
              )}
              <div className={styles.linkContent}>
                <p className={styles.linkSource}>
                  {new URL(m.linkUrl).hostname}
                </p>
                <p className={styles.linkTitle}>{m.linkTitle}</p>
                {m.linkDescription && (
                  <p className={styles.linkDescription}>{m.linkDescription}</p>
                )}
              </div>
            </a>

            {m.content && m.content.trim() !== m.linkUrl.trim() && (
              <p className={styles.messageText}>{m.content}</p>
            )}
          </>
        );
      }

      // ⏳ PREVIEW NOT READY → SHOW URL
      return (
        <a
          href={m.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.messageText}
        >
          {m.content || m.linkUrl}
        </a>
      );
    }

    // 💬 DEFAULT: TEXT MESSAGE
    return <p className={styles.messageText}>{m.content}</p>;
  };
  /* ---------------------------------------------------- */

  /* ---------- EMPTY STATE ---------- */
  if (!selectedUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyCard}>
          {/* Logo / Illustration */}
          <div className={styles.imageWrapper}>
            <Image
              src="/Frame 238021 (1).svg"
              alt="Chat illustration"
              width={90}
              height={90}
              priority
            />
          </div>

          <h2 className={styles.title}>Let’s start chatting</h2>

          <p className={styles.subtitle}>
            Search for a person from the left sidebar to start a conversation.
            <br />
            Connect with students, professors, and peers instantly.
          </p>

          <ul className={styles.features}>
            <li className={styles.realtime}>
              <span className={styles.icon}>✨</span>
              <span>Real-time messaging</span>
            </li>

            <li className={styles.secure}>
              <span className={styles.icon}>🔒</span>
              <span>Secure conversations</span>
            </li>

            <li className={styles.files}>
              <span className={styles.icon}>📁</span>
              <span>Easy file sharing</span>
            </li>
          </ul>

          <div className={styles.hint}>Search a user • Start typing</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatPanel}>
      {/* HEADER */}
      <div className={styles.chatHeader}>
        <button className={styles.backButton} onClick={onBack}>
          <FiArrowLeft />
        </button>

        <div className={styles.avatarWrapper}>
          <div
            className={styles.avatar}
            // ✨ Restored your commented out style
            // style={{ backgroundColor: getAvatarColor(selectedUser.id) }}
          >
            {selectedUser.avatar ? (
              <img
                src={selectedUser.avatar}
                alt={selectedUser.name}
                className={styles.avatarImage}
                style={{ width: "36px", height: "36px", borderRadius: "50%" }}
              />
            ) : (
              getInitials(selectedUser.name)
            )}
          </div>
          {selectedUser.online && <div className={styles.onlineIndicator} />}
        </div>

        <div className={styles.userInfo}>
          <h2 className={styles.userName}>{selectedUser.name}</h2>
          <p className={styles.userStatus}>Standford University</p>
        </div>

        <button className={styles.moreButton}>
          <FiMoreVertical />
        </button>
      </div>

      {/* MESSAGES */}
      <div className={styles.messagesArea} ref={messagesAreaRef}>
        {messages.length === 0 && (
          <div className={styles.emptyConversation}>
            <div className={styles.profileRing}>
              {selectedUser.avatar ? (
                <img src={selectedUser.avatar} className={styles.emptyAvatar} />
              ) : (
                <div className={styles.emptyInitials}>
                  {getInitials(selectedUser.name)}
                </div>
              )}
            </div>

            <h3 className={styles.emptyTitle}>
              You’re now connected with
              <br />
              <span>{selectedUser.name}</span>
            </h3>

            <p className={styles.emptySubtitle}>
              Say hello 👋 and start your conversation.
            </p>

            <div className={styles.emptyCta}>
              💬 Type your first message below
            </div>
          </div>
        )}
        <div className={styles.messagesContainer}>
          {hasMoreMessages && (
            <div ref={topMessageSentinelRef}>
              {isLoadingOlderRef.current && <MessageSkeleton />}
            </div>
          )}

          {messages.map((m) => {
            // ✨ Check if this specific message is active
            const isDropdownOpen = activeMessageId === m.id;

            return (
              <div
                key={m.id}
                className={`${styles.messageWrapper} ${
                  m.sent ? styles.sent : styles.received
                }`}
              >
                <div className={styles.messageBubble}>
                  {/* ✨ 1. DROPDOWN TRIGGER (Visible on Hover) */}
                  <button
                    className={`${styles.optionsTrigger} ${
                      isDropdownOpen ? styles.active : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation(); // Stop bubble click
                      setActiveMessageId(isDropdownOpen ? null : m.id);
                    }}
                    aria-label="Message options"
                  >
                    <FiChevronDown />
                  </button>

                  {/* ✨ 2. DROPDOWN MENU */}
                  {isDropdownOpen && (
                    <div className={styles.messageOptions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReply(m);
                        }}
                      >
                        <FiCornerUpLeft /> Reply
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                         handleCopy(m);
                        }}
                      >
                        <FiCopy /> Copy
                      </button>
                    </div>
                  )}

                  {/* 🚀 FIXED RENDERING */}
                  {renderMessageContent(m)}

                  <div className={styles.messageMeta}>
                    <span className={styles.messageTime}>{m.timestamp}</span>
                    {m.sent && getStatusIcon(m.status)}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* INPUT */}
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
}
