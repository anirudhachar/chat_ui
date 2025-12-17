"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import {
  FiArrowLeft,
  FiMoreVertical,
  FiClock,
  FiFile,
  FiChevronDown,
  FiCopy,
  FiCornerUpLeft,
  FiX,
  FiImage,
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
  isLoading: boolean;
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "document" | "link" | "audio",
    file?: {
      name: string;
      url: string;
      image?: string;
      description?: string;
    },
    replyTo?: Message // ✨ New Prop
  ) => void;
  onBack: () => void;
  onLoadMoreMessages: () => void;

  hasMoreMessages: boolean;
  resetKey?: string;
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
  isLoading,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const topMessageSentinelRef = useRef<HTMLDivElement>(null);

  const isFirstLoadRef = useRef(true);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  // ✨ STATE: Tracks dropdown & Reply
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  /* 🔁 reset on chat switch */
  useEffect(() => {
    isFirstLoadRef.current = true;
    setActiveMessageId(null);
    setReplyingTo(null);
  }, [resetKey]);

  /* ✨ Click Outside to Close Dropdown */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  /* ---------------- SCROLL LOGIC ---------------- */
  useEffect(() => {
    const container = messagesAreaRef.current;
    if (!container || messages.length === 0) return;

    if (isFirstLoadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      isFirstLoadRef.current = false;
      return;
    }

    if (isLoadingOlderRef.current) {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      isLoadingOlderRef.current = false;
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (isLoading || !hasMoreMessages || messages.length === 0) return;

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
      { root: messagesAreaRef.current, threshold: 0.1 }
    );

    const el = topMessageSentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMoreMessages, onLoadMoreMessages, messages.length, isLoading]);

  useEffect(() => {
    if (isLoading) {
      isFirstLoadRef.current = true;
    }
  }, [isLoading]);

  /* ---------------- HELPERS ---------------- */
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
          return `Offer: ${m.offer.currency} ${m.offer.amount}\n${
            m.content || ""
          }`;
        }
        return `Trade Offer: ${m.offer.tradeDescription}\n${m.content || ""}`;
      default:
        return m.content || "";
    }
  };

  /* ---------------- HANDLERS ---------------- */
  const handleCopy = (msg: Message) => {
    const text = getCopyText(msg);
    if (!text) return;
    navigator.clipboard.writeText(text);
    setActiveMessageId(null);
  };

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    if (onReply) onReply(msg);
    setActiveMessageId(null);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Wrapper to inject replyTo state into sending mechanism
  const handleInternalSendMessage = (
    content: string,
    type?: "text" | "image" | "document" | "link" | "audio",
    file?: any
  ) => {
    onSendMessage(content, type, file, replyingTo || undefined);
    setReplyingTo(null);
  };

  const renderMessageContent = (m: Message): ReactNode => {
    console.log(m, "messgeincoming");
    // ✨ Helper: Wraps the main content with the "Reply Quote" if it exists
    const wrapWithReply = (content: ReactNode) => {
      if (!m.replyTo) return content;
      console.log(content, "contentreply");

      return (
        <div className={styles.contentWithReply}>
          <div className={styles.replyQuote}>
            <div className={styles.replyQuoteBar} />
            <div className={styles.replyQuoteContent}>
              <span className={styles.replyQuoteUser}>
                {m.replyTo.sent ? "You" : selectedUser?.name || "User"}
              </span>
              <p className={styles.replyQuoteText}>
                {m.replyTo.type === "image" ? (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <FiImage /> Photo
                  </span>
                ) : (
                  getCopyText(m.replyTo)
                )}
              </p>
            </div>
            {/* Optional: Show mini thumbnail if replying to image */}
            {m.replyTo.type === "image" && m.replyTo.fileUrl && (
              <img
                src={m.replyTo.fileUrl}
                alt=""
                className={styles.replyQuoteThumb}
              />
            )}
          </div>
          {content}
        </div>
      );
    };

    if (m.type === "audio" && m.fileUrl) {
      return wrapWithReply(
        <div className={styles.audioMessageContainer}>
          <div className={styles.audioHeader}>
            {/* Optional: Microphone Icon */}
            <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>🎤</span>
            <span>Voice Message</span>
          </div>
          <audio controls src={m.fileUrl} className={styles.audioPlayer} />
          {/* Show duration or caption if it exists and isn't the default text */}
          {m.content && m.content !== "🎤 Voice Message" && (
            <p className={styles.messageCaption}>{m.content}</p>
          )}
        </div>
      );
    }
    // 📦 OFFER MESSAGE
    if (m.type === "offer" && m.offer) {
      return wrapWithReply(
        <div
          className={`${styles.offerCard} ${
            m.sent ? styles.sent : styles.received
          }`}
        >
          {/* PRODUCT HEADER */}
          <div className={styles.productRow}>
            {m.offer.imageUrl && (
              <img
                src={m.offer.imageUrl}
                alt="Listing"
                className={styles.productImage}
              />
            )}

            <div className={styles.productInfo}>
              <p className={styles.productTitle}>MacBook Pro 13&quot; 2021</p>
              <p className={styles.productPrice}>$967.00</p>
            </div>
          </div>

          {/* OFFER AMOUNT */}
          <div className={styles.offerAmount}>
            Offer Amount{" "}
            <strong>
              {m.offer.currency} {m.offer.amount}
            </strong>
          </div>

          {/* MESSAGE */}
          {m.content && <p className={styles.offerMessage}>{m.content}</p>}

          {/* TIME (already from message meta outside) */}
        </div>
      );
    }

    // 📷 IMAGE MESSAGE
    if (m.type === "image" && m.fileUrl) {
      return wrapWithReply(
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
      return wrapWithReply(
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
      if (m.linkTitle) {
        return wrapWithReply(
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
      return wrapWithReply(
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
    return wrapWithReply(<p className={styles.messageText}>{m.content}</p>);
  };

  /* ---------- EMPTY STATE ---------- */
  if (!selectedUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyCard}>
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
          </p>
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
          <div className={styles.avatar}>
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
          <p className={styles.userStatus}>Stanford University</p>
        </div>

        <button className={styles.moreButton}>
          <FiMoreVertical />
        </button>
      </div>

      {/* MESSAGES */}
      <div className={styles.messagesArea} ref={messagesAreaRef}>
        {/* {messages.length === 0 && (
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
              You’re now connected with <span>{selectedUser.name}</span>
            </h3>
            <p className={styles.emptySubtitle}>
              Say hello 👋 and start your conversation.
            </p>
          </div>
        )} */}

        {isLoading && (
          <div className={styles.loadingWrapper}>
            <MessageSkeleton />
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
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
              You’re now connected with <span>{selectedUser.name}</span>
            </h3>
            <p className={styles.emptySubtitle}>
              Say hello 👋 and start your conversation.
            </p>
          </div>
        )}

        <div className={styles.messagesContainer}>
          {hasMoreMessages && (
            <div ref={topMessageSentinelRef}>
              {isLoadingOlderRef.current && <MessageSkeleton />}
            </div>
          )}

          {messages.map((m) => {
            const isDropdownOpen = activeMessageId === m.id;

            return (
              <div
                key={m.id}
                className={`${styles.messageWrapper} ${
                  m.sent ? styles.sent : styles.received
                }`}
              >
                <div className={styles.messageBubble}>
                  {/* ✨ DROPDOWN TRIGGER */}
                  <button
                    className={`${styles.optionsTrigger} ${
                      isDropdownOpen ? styles.active : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMessageId(isDropdownOpen ? null : m.id);
                    }}
                    aria-label="Message options"
                  >
                    <FiChevronDown />
                  </button>

                  {/* ✨ DROPDOWN MENU */}
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

                  {/* CONTENT */}
                  {renderMessageContent(m)}

                  {/* META */}
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

      {replyingTo && (
        <div className={styles.replyPreview}>
          <div className={styles.replyContainer}>
            <div className={styles.replyDecor} />
            <div className={styles.replyContent}>
              <span className={styles.replyAuthor}>
                {replyingTo.sent ? "You" : selectedUser.name}
              </span>
              <p className={styles.replyText}>
                {replyingTo.type === "image" ? (
                  <span className={styles.flexCenter}>
                    <FiImage /> Photo
                  </span>
                ) : (
                  getCopyText(replyingTo)
                )}
              </p>
            </div>

            {replyingTo.type === "image" && replyingTo.fileUrl && (
              <img
                src={replyingTo.fileUrl}
                alt=""
                className={styles.replyThumb}
              />
            )}

            <button onClick={cancelReply} className={styles.closeReply}>
              <FiX />
            </button>
          </div>
        </div>
      )}

      {/* INPUT */}
      <MessageInput onSendMessage={handleInternalSendMessage} />
    </div>
  );
}
