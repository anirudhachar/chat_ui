"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import {
  FiArrowLeft,
  FiMoreVertical,
  FiClock,
  FiFile,
  FiCopy,
  FiCornerUpLeft,
  FiX,
  FiImage,
  FiEdit2,
  FiTrash,
  FiSmile,
} from "react-icons/fi";
import { BsCheck, BsCheck2All, BsCheckAll } from "react-icons/bs";
import Image from "next/image";
import EmojiPicker, { Theme } from "emoji-picker-react";

import { User, Message } from "./ChatInterface";
import MessageInput from "./MessageInput";
import styles from "./ChatPanel.module.scss";
import MessageSkeleton from "./MessageSkeleton/MessageSkeleton";
import {
  IoAlertCircle,
  IoCheckmark,
  IoCheckmarkDone,
  IoTimeOutline,
} from "react-icons/io5";
import { createPortal } from "react-dom";
import Spinner from "./SpinnerComponent";

interface ChatPanelProps {
  selectedUser: User | null;
  messages: Message[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  resetKey?: string;
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "document" | "link" | "audio",
    file?: any,
    replyTo?: Message
  ) => void;
  onBack: () => void;
  onLoadMoreMessages: () => void;
  onReply?: (message: Message) => void;
  // 🔥 UPDATE: Callback now accepts newContent string
  onEditMessage?: (message: Message, newContent: string) => void;
  onDeleteMessage?: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  isPartnerTyping: boolean;
  onTyping: () => void;
  // onInputBlur: () => void;
  onOpenProfile: (user: User) => void;
}

const isMobileDevice = () =>
  typeof window !== "undefined" &&
  (window.innerWidth < 768 || "ontouchstart" in window);

const getCopyText = (msg: Message): string => {
  switch (msg.type) {
    case "text":
      return msg.content || "";
    case "image":
      return msg.content || msg.fileUrl || "";
    case "document":
      return `${msg.fileName || "Document"}\n${msg.fileUrl || ""}`;
    case "link":
      return msg.linkUrl || msg.content || "";
    case "offer":
      if (!msg.offer) return "";
      if (msg.offer.offerType === "PRICE") {
        return `Offer: ${msg.offer.currency} ${msg.offer.amount}\n${
          msg.content || ""
        }`;
      }
      return `Trade Offer: ${msg.offer.tradeDescription}\n${msg.content || ""}`;
    default:
      return msg.content || "";
  }
};

const getDateLabel = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();

  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const startMsg = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

  const diff =
    (startToday.getTime() - startMsg.getTime()) / (1000 * 60 * 60 * 24);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";

  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const shouldShowDateSeparator = (
  current: Message,
  prev?: Message
) => {
  if (!prev) return true;

  const c = new Date(current.createdAt);
  const p = new Date(prev.createdAt);

  return (
    c.getFullYear() !== p.getFullYear() ||
    c.getMonth() !== p.getMonth() ||
    c.getDate() !== p.getDate()
  );
};



const MessageRow = ({
  m,
  isMine,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onReact,
  copiedMessageId,
}: {
  m: Message;
  isMine: boolean;
  onReply: (m: Message) => void;
  onCopy: (m: Message) => void;
  onEdit: (m: Message, newContent: string) => void;
  onDelete: (m: Message) => void;
  onReact: (m: Message, e: string) => void;
  copiedMessageId?: string | null;
}) => {
  const [pickerPosition, setPickerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // ✏️ NEW: Local Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  const isDeleted =
    m.content === "This message was deleted" || (m as any).isDeleted;

  // Close popups on click outside
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [showMobileEmojiSheet, setShowMobileEmojiSheet] = useState(false);
  const emojiSheetRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const [isDraggingEmoji, setIsDraggingEmoji] = useState(false);
  const handleEmojiTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDraggingEmoji(true);
  };

  const handleEmojiTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingEmoji || !emojiSheetRef.current) return;

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    if (diff > 0) {
      emojiSheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleEmojiTouchEnd = () => {
    if (!emojiSheetRef.current) return;

    const diff = currentYRef.current - startYRef.current;
    setIsDraggingEmoji(false);

    if (diff > 120) {
      setShowMobileEmojiSheet(false);
    } else {
      emojiSheetRef.current.style.transform = "translateY(0)";
    }
  };

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isMobile = isMobileDevice();
  const handleTouchStart = () => {
    if (!isMobile) return;

    longPressTimer.current = setTimeout(() => {
      setShowMobileSheet(true);
    }, 450); // LinkedIn-like delay
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    if (!pickerPosition) return;

    const close = () => setPickerPosition(null);
    window.addEventListener("click", close);

    return () => window.removeEventListener("click", close);
  }, [pickerPosition]);

  const closeMobileSheet = () => {
    setShowMobileSheet(false);
    setPickerPosition(null);
  };

  const handleStartEdit = () => {
    setEditContent(m.content || "");
    setIsEditing(true);
    setShowMenu(false); // Close the menu
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent("");
  };

  const handleSaveEdit = () => {
    if (editContent.trim() !== "") {
      onEdit(m, editContent); // Pass new text up to parent
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // ─────────────────────────────────────────────
  // RENDER CONTENT LOGIC
  // ─────────────────────────────────────────────

  const editInputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      const el = editInputRef.current;
      const len = el.value.length;

      // Move cursor to end
      el.setSelectionRange(len, len);
      el.focus();
    }
  }, [isEditing]);

  const renderContent = () => {
    // ✏️ 1. EDIT MODE (Only for text messages)
    if (isEditing) {
      return (
        <div className={styles.editContainer}>
          <textarea
            ref={editInputRef}
            className={styles.editInput}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
          />
          <div className={styles.editActions}>
            <button
              className={`${styles.editBtn} ${styles.cancelBtn}`}
              onClick={handleCancelEdit}
            >
              Cancel
            </button>
            <button
              className={`${styles.editBtn} ${styles.saveBtn}`}
              onClick={handleSaveEdit}
            >
              Save
            </button>
          </div>
        </div>
      );
    }
    if (isDeleted) {
      return (
        <p
          style={{
            fontStyle: "italic",
            color: "#888",
            fontSize: "0.95rem",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <FiX size={14} /> This message was deleted
        </p>
      );
    }

    // 🏷️ 2. NORMAL MODE WRAPPER: Handles "Reply Quote"
    const wrapWithReply = (content: ReactNode) => {
      if (!m.replyTo) return content;
      return (
        <div className={styles.contentWithReply}>
          <div className={styles.replyQuote}>
            <div className={styles.replyQuoteBar} />
            <div className={styles.replyQuoteContent}>
              <span className={styles.replyQuoteUser}>
                {m.replyTo.sent ? "You" : m.replyTo.senderName || "User"}
              </span>
              <p className={styles.replyQuoteText}>
                {m.replyTo.type === "image" ? (
                  <span className={styles.flexCenter}>
                    <FiImage /> Photo
                  </span>
                ) : (
                  getCopyText(m.replyTo)
                )}
              </p>
            </div>
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

    // 🎤 AUDIO
    if (m.type === "audio" && m.fileUrl) {
      return wrapWithReply(
        <div className={styles.audioMessageContainer}>
          <div className={styles.audioHeader}>
            <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>🎤</span>
            <span>Voice Message</span>
          </div>
          <audio controls src={m.fileUrl} className={styles.audioPlayer} />
          {m.content && m.content !== "🎤 Voice Message" && (
            <p className={styles.messageCaption}>{m.content}</p>
          )}
        </div>
      );
    }

    // 📦 OFFER
    if (m.type === "offer" && m.offer) {
      return wrapWithReply(
        <div
          className={`${styles.offerCard} ${
            isMine ? styles.sent : styles.received
          }`}
        >
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
          <div className={styles.offerAmount}>
            Offer Amount{" "}
            <strong>
              {m.offer.currency} {m.offer.amount}
            </strong>
          </div>
          {m.content && <p className={styles.offerMessage}>{m.content}</p>}
        </div>
      );
    }

    // 📷 IMAGE
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

    // 📄 DOCUMENT
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

    // 🔗 LINK
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

    // 💬 TEXT
    return wrapWithReply(<p className={styles.messageText}>{m.content}</p>);
  };

  const getStatusIcon = (status?: string) => {
    console.log("Message status:", status);

    if (!status) return null;

    switch (status) {
      case "sending":
        return <IoTimeOutline className={styles.sendingIcon} />;

      case "failed":
        // Using an icon instead of an emoji for a more professional look
        return <IoAlertCircle className={styles.failedIcon} />;

      case "read":
        // io5 icons don't "intersect" as much as Bootstrap ones
        return (
          <IoCheckmarkDone className={`${styles.tickIcon} ${styles.read}`} />
        );

      case "delivered":
        return <IoCheckmarkDone className={styles.tickIcon} />;

      case "sent":
      default:
        return <IoCheckmark className={styles.tickIcon} />;
    }
  };

  // LinkedIn Style: 5 quick emojis
  const QUICK_REACTIONS = ["👍", "👏", "😄", "🤔", "❤️"];

  return (
    <>
      <div
        id={`msg-${m.id}`} // ✅ ADD THIS
        className={`${styles.messageRow} ${
          isMine ? styles.myRow : styles.theirRow
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* AVATAR */}
        {!isMine && (
          <div className={styles.avatarCol}>
            {m.senderAvatar ? (
              <img
                src={m.senderAvatar}
                alt="avatar"
                className={styles.messageAvatar}
              />
            ) : (
              <div className={styles.defaultAvatar}>
                {m.senderName?.charAt(0)}
              </div>
            )}
          </div>
        )}

        <div className={styles.bubbleContainer}>
          {!isEditing && !isDeleted && !isMobile && (
            <div
              className={`${styles.actionBar} ${
                isMine ? styles.actionLeft : styles.actionRight
              }`}
            >
              {/* 1. Quick Reactions */}
              <div className={styles.quickReactions}>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    className={styles.reactionBtn}
                    onClick={() => onReact(m, emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className={styles.divider} />

              {/* 2. Plus Button (Picker) */}

              <button
                className={styles.actionBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const PICKER_WIDTH = 280;
                  const VIEWPORT_PADDING = 12;

                  let left = rect.left;

                  // 🧠 If message is mine (right side), open picker to LEFT
                  if (isMine) {
                    left = rect.right - PICKER_WIDTH;
                  }

                  // 🛡️ Clamp inside viewport
                  left = Math.max(
                    VIEWPORT_PADDING,
                    Math.min(
                      left,
                      window.innerWidth - PICKER_WIDTH - VIEWPORT_PADDING
                    )
                  );

                  setPickerPosition({
                    top: Math.max(16, rect.top - 360),
                    left,
                  });
                }}
              >
                <FiSmile /> <span className={styles.plusSign}>+</span>
              </button>

              <div className={styles.divider} />

              {/* 3. Reply Button */}
              <button
                className={styles.actionBtn}
                onClick={() => onReply(m)}
                title="Reply"
              >
                <FiCornerUpLeft />
              </button>

              {/* 4. More Options */}
              <div className={styles.actionBtnWrapper} ref={menuRef}>
                <button
                  className={styles.actionBtn}
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <FiMoreVertical />
                </button>

                {showMenu && (
                  <div className={styles.dropdownMenu}>
                    <div
                      onClick={() => {
                        onCopy(m);
                        setShowMenu(false);
                      }}
                      className={styles.dropdownItem}
                    >
                      <FiCopy size={14} /> Copy
                    </div>

                    {/* 🔥 INLINE EDIT TRIGGER */}
                    {isMine && m.type === "text" && (
                      <div
                        onClick={handleStartEdit}
                        className={styles.dropdownItem}
                      >
                        <FiEdit2 size={14} /> Edit
                      </div>
                    )}

                    {isMine && (
                      <div
                        onClick={() => {
                          onDelete(m);
                          setShowMenu(false);
                        }}
                        className={`${styles.dropdownItem} ${styles.danger}`}
                      >
                        <FiTrash size={14} /> Delete
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 📨 MESSAGE BUBBLE */}
          <div className={`${styles.messageBubble}`}>
            {/* <svg
              viewBox="0 0 8 13"
              width="8"
              height="13"
              preserveAspectRatio="xMidYMid meet"
              className={`${styles.tail} ${
                isMine ? styles.tailMine : styles.tailTheirs
              }`}
            >
              <path
                opacity="0.13"
                d="M5.188,1H0v11.193l6.467-8.625
         C7.526,2.156,6.958,1,5.188,1z"
              />
              <path
               fill="#ffffff"
                d="M5.188,0H0v11.193l6.467-8.625
         C7.526,1.156,6.958,0,5.188,0z"
              />
            </svg> */}
            <div
              className={`${styles.senderNameLabel} ${
                isMine ? styles.textRight : styles.textLeft
              }`}
            >
              {isMine ? "You" : m.senderName || "User"}
            </div>
            {renderContent()}

            {!isEditing && (
              <div className={styles.messageMeta}>
                {(m as any).isEdited && (
                  <span className={styles.editedTag}>(edited)</span>
                )}
                <span className={styles.messageTime}>{m.timestamp}</span>
                {isMine && getStatusIcon(m.status)}
              </div>
            )}

            {!isMobile && copiedMessageId === m.id && (
              <div className={styles.copiedToast}>Copied</div>
            )}
          </div>

          {/* 😍 REACTION PILLS */}
          {!isDeleted && m.reactions && Object.keys(m.reactions).length > 0 && (
            <div className={styles.reactionRow}>
              {Object.entries(m.reactions).map(
                ([emoji, userIds]) =>
                  userIds.length > 0 && (
                    <button
                      key={emoji}
                      className={styles.reactionPill}
                      onClick={() => onReact(m, emoji)}
                    >
                      <span className={styles.reactionEmoji}>{emoji}</span>
                      <span className={styles.reactionCount}>
                        {userIds.length}
                      </span>
                    </button>
                  )
              )}
            </div>
          )}
        </div>
      </div>
      {pickerPosition &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className={styles.emojiPickerPortal}
            style={{
              top: pickerPosition.top,
              left: pickerPosition.left,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(e) => {
                onReact(m, e.emoji);
                setPickerPosition(null);
              }}
              width={280}
              height={350}
              theme={Theme.LIGHT}
              previewConfig={{ showPreview: false }}
            />
          </div>,
          document.body
        )}

      {showMobileSheet &&
        createPortal(
          <div
            className={styles.mobileSheetOverlay}
            onClick={() => setShowMobileSheet(false)}
          >
            <div
              className={styles.mobileSheet}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Reactions */}
              <div className={styles.mobileReactions}>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(m, emoji);
                      closeMobileSheet();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => {
                    closeMobileSheet();
                    setShowMobileEmojiSheet(true);
                  }}
                >
                  <FiSmile />
                </button>
              </div>

              <div className={styles.mobileActions}>
                <button
                  onClick={() => {
                    onReply(m);
                    closeMobileSheet();
                  }}
                >
                  <FiCornerUpLeft /> Reply
                </button>

                <button
                  onClick={() => {
                    onCopy(m);
                    closeMobileSheet();
                  }}
                >
                  <FiCopy /> Copy
                </button>

                {isMine && m.type === "text" && (
                  <button
                    onClick={() => {
                      handleStartEdit();
                      closeMobileSheet();
                    }}
                  >
                    <FiEdit2 /> Edit
                  </button>
                )}

                <button
                  className={styles.danger}
                  onClick={() => {
                    onDelete(m);
                    closeMobileSheet();
                  }}
                >
                  <FiTrash /> Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showMobileEmojiSheet &&
        createPortal(
          <div
            className={styles.mobileSheetOverlay}
            onClick={() => setShowMobileEmojiSheet(false)}
          >
            <div
              ref={emojiSheetRef}
              className={styles.mobileEmojiSheet}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleEmojiTouchStart}
              onTouchMove={handleEmojiTouchMove}
              onTouchEnd={handleEmojiTouchEnd}
            >
              <div className={styles.sheetHandle} />

              <EmojiPicker
                height={360}
                width="100%"
                previewConfig={{ showPreview: false }}
                onEmojiClick={(e) => {
                  onReact(m, e.emoji);
                  setShowMobileEmojiSheet(false);
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

// ───────────────────────────────────────────────
// MAIN CHAT PANEL
// ───────────────────────────────────────────────
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
  onEditMessage,
  onDeleteMessage,
  onReact,
  isPartnerTyping,
  onTyping,
  onOpenProfile,
}: // onInputBlur,
ChatPanelProps) {
  console.log(messages, "messagesbeingsent");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const topMessageSentinelRef = useRef<HTMLDivElement>(null);

  const isFirstLoadRef = useRef(true);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showGlobalCopyToast, setShowGlobalCopyToast] = useState(false);

  useEffect(() => {
    isFirstLoadRef.current = true;
    setReplyingTo(null);
  }, [resetKey]);

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
    if (topMessageSentinelRef.current)
      observer.observe(topMessageSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreMessages, onLoadMoreMessages, messages.length, isLoading]);

  useEffect(() => {
    if (isLoading) isFirstLoadRef.current = true;
  }, [isLoading]);

  /* Handlers */
  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    if (onReply) onReply(msg);
  };

  const handleCopy = (msg: Message) => {
    const text = getCopyText(msg);
    if (!text.trim()) return;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedMessageId(msg.id);

      if (isMobileDevice()) {
        setShowGlobalCopyToast(true);
        setTimeout(() => setShowGlobalCopyToast(false), 1200);
      } else {
        setTimeout(() => setCopiedMessageId(null), 1200);
      }
    });
  };

  const handleInternalSendMessage = (
    content: string,
    type?: "text" | "image" | "document" | "link" | "audio",
    file?: any
  ) => {
    onSendMessage(content, type, file, replyingTo || undefined);
    setReplyingTo(null);
  };

  const getInitials = (name = "") => {
    const parts = name.trim().split(" ").filter(Boolean);

    if (parts.length === 0) return "?";

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  /* Empty State */
  if (!selectedUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconAnimated}>
            <Image
              src="/Frame 238021 (1).svg"
              alt="Chat"
              width={90}
              height={90}
            />
          </div>

          {/* TEXT */}
          <h2 className={styles.title}>Let's start chatting</h2>

          <p className={styles.subtitle}>
            Search a person from the left sidebar to start a conversation.
            Connect with students, professors, and peers instantly.
          </p>

          {/* FEATURES */}
          <ul className={styles.features}>
            <li className={styles.realtime}>
              <span className={styles.icon}>✨</span>
              Real-time
            </li>

            <li className={styles.secure}>
              <span className={styles.icon}>🔒</span>
              Secure
            </li>

            <li className={styles.files}>
              <span className={styles.icon}>📁</span>
              File Sharing
            </li>
          </ul>

          {/* FOOTER HINT */}
          <div className={styles.hint}>Search a user • Start Typing</div>
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
        <div
          className={styles.avatarWrapper}
          onClick={() => selectedUser && onOpenProfile(selectedUser)}
          style={{ cursor: "pointer" }}
        >
          {selectedUser.avatar ? (
            <img
              src={selectedUser.avatar}
              alt="User"
              className={styles.headerAvatar}
              style={{ width: "36px", height: "36px", borderRadius: "50%" }}
            />
          ) : (
            <div className={styles.headerInitials}>
              {getInitials(selectedUser.name)}
            </div>
          )}
          {selectedUser.online && <div className={styles.onlineIndicator} />}
        </div>
        <div className={styles.userInfo}>
          <h2 className={styles.userName}>{selectedUser.name}</h2>
          <p className={styles.userStatus}>{selectedUser.instituteName}</p>
        </div>
        {/* <button className={styles.moreButton}>
          <FiMoreVertical />
        </button> */}
      </div>

      {/* MESSAGES AREA */}
      <div className={styles.messagesArea} ref={messagesAreaRef}>
        {isLoading && (
          // <div className={styles.loadingContainer}>
          //   <div className={styles.spinner} />
          // </div>
          <Spinner />
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
              You’re connected with <span>{selectedUser.name}</span>
            </h3>
          </div>
        )}

        <div className={styles.messagesContainer}>
          {hasMoreMessages && (
            <div ref={topMessageSentinelRef}>
              {isLoadingOlderRef.current && <MessageSkeleton />}
            </div>
          )}
          {messages.map((m, index) => {
            const prevMsg = messages[index - 1];
            const showDate = shouldShowDateSeparator(m, prevMsg);

            return (
              <div key={m.id}>
                {showDate && (
                  <div className={styles.dateSeparator}>
                    <span>{getDateLabel(m.createdAt)}</span>
                  </div>
                )}

                <MessageRow
                  m={m}
                  isMine={m.sent}
                  onReply={handleReply}
                  onCopy={handleCopy}
                  onEdit={onEditMessage || (() => {})}
                  onDelete={onDeleteMessage || (() => {})}
                  onReact={onReact}
                  copiedMessageId={copiedMessageId}
                />
              </div>
            );
          })}

          {isPartnerTyping && (
            <div className={`${styles.messageRow} ${styles.theirRow}`}>
              <div className={styles.avatarCol}>
                {selectedUser.avatar ? (
                  <img
                    src={selectedUser.avatar}
                    alt="typing..."
                    className={styles.messageAvatar}
                  />
                ) : (
                  <div className={styles.defaultAvatar}>
                    {selectedUser.name?.charAt(0)}
                  </div>
                )}
              </div>
              <div className={styles.bubbleContainer}>
                <div
                  className={styles.messageBubble}
                  style={{ width: "fit-content" }}
                >
                  <div className={styles.typingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* REPLY PREVIEW (For Input) */}
      {replyingTo && (
        <div className={styles.replyPreview}>
          <div className={styles.replyContainer}>
            <div className={styles.replyDecor} />
            <div className={styles.replyContent}>
              <span className={styles.replyAuthor}>
                {replyingTo.sent ? "You" : replyingTo.senderName}
              </span>
              <p className={styles.replyText}>
                {replyingTo.type === "image" ? "📷 Photo" : replyingTo.content}
              </p>
            </div>
            {replyingTo.type === "image" && replyingTo.fileUrl && (
              <img
                src={replyingTo.fileUrl}
                alt=""
                className={styles.replyThumb}
              />
            )}
            <button
              onClick={() => setReplyingTo(null)}
              className={styles.closeReply}
            >
              <FiX />
            </button>
          </div>
        </div>
      )}

      {/* INPUT */}
      <MessageInput
        onSendMessage={handleInternalSendMessage}
        onTyping={onTyping}
      />

      {showGlobalCopyToast && (
        <div className={styles.mobileCopiedToast}>Copied</div>
      )}
    </div>
  );
}
