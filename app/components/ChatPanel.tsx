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
  FiChevronDown
} from "react-icons/fi";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import Image from "next/image";
import EmojiPicker, { Theme } from "emoji-picker-react";

import { User, Message } from "./ChatInterface";
import MessageInput from "./MessageInput";
import styles from "./ChatPanel.module.scss";
import MessageSkeleton from "./MessageSkeleton/MessageSkeleton";

// ───────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────
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
  onEditMessage?: (message: Message) => void;
  onDeleteMessage?: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
}

// ───────────────────────────────────────────────
// SUB-COMPONENT: Message Row
// (Contains the exact original rendering logic + New Hover UI)
// ───────────────────────────────────────────────
const MessageRow = ({
  m,
  isMine,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onReact,
}: {
  m: Message;
  isMine: boolean;
  onReply: (m: Message) => void;
  onCopy: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (m: Message) => void;
  onReact: (m: Message, e: string) => void;
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close popups on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─────────────────────────────────────────────
  // 1. ORIGINAL RENDERING LOGIC (Restored)
  // ─────────────────────────────────────────────
  const getCopyText = (msg: Message): string => {
    switch (msg.type) {
      case "text": return msg.content || "";
      case "image": return msg.content || msg.fileUrl || "";
      case "document": return `${msg.fileName || "Document"}\n${msg.fileUrl || ""}`;
      case "link": return msg.linkUrl || msg.content || "";
      case "offer":
        if (!msg.offer) return "";
        if (msg.offer.offerType === "PRICE") {
          return `Offer: ${msg.offer.currency} ${msg.offer.amount}\n${msg.content || ""}`;
        }
        return `Trade Offer: ${msg.offer.tradeDescription}\n${msg.content || ""}`;
      default: return msg.content || "";
    }
  };

  const renderContent = () => {
    // 🏷️ WRAPPER: Handles "Reply Quote"
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
               <img src={m.replyTo.fileUrl} alt="" className={styles.replyQuoteThumb} />
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

    // 📦 OFFER MESSAGE (Restored Original Structure)
    if (m.type === "offer" && m.offer) {
      return wrapWithReply(
        <div className={`${styles.offerCard} ${isMine ? styles.sent : styles.received}`}>
          <div className={styles.productRow}>
            {m.offer.imageUrl && (
              <img src={m.offer.imageUrl} alt="Listing" className={styles.productImage} />
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

    // 📷 IMAGE MESSAGE
    if (m.type === "image" && m.fileUrl) {
      return wrapWithReply(
        <div className={styles.mediaContainer}>
          <img src={m.fileUrl} alt={m.content} className={styles.messageImage} />
          {m.content && m.content.trim() !== "📷 Photo" && (
            <p className={styles.messageCaption}>{m.content}</p>
          )}
        </div>
      );
    }

    // 📄 DOCUMENT MESSAGE
    if (m.type === "document" && m.fileUrl) {
      return wrapWithReply(
        <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.messageDocumentLink}>
          <div className={styles.documentIcon}><FiFile size={20} /></div>
          <div className={styles.documentInfo}>
            <p className={styles.documentName}>{m.fileName || m.content || "Document"}</p>
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
            <a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.messageLinkPreview}>
              {m.linkImage && <img src={m.linkImage} alt={m.linkTitle} className={styles.linkImage} />}
              <div className={styles.linkContent}>
                <p className={styles.linkSource}>{new URL(m.linkUrl).hostname}</p>
                <p className={styles.linkTitle}>{m.linkTitle}</p>
                {m.linkDescription && <p className={styles.linkDescription}>{m.linkDescription}</p>}
              </div>
            </a>
            {m.content && m.content.trim() !== m.linkUrl.trim() && (
              <p className={styles.messageText}>{m.content}</p>
            )}
          </>
        );
      }
      return wrapWithReply(
        <a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.messageText}>
          {m.content || m.linkUrl}
        </a>
      );
    }

    // 💬 TEXT
    return wrapWithReply(<p className={styles.messageText}>{m.content}</p>);
  };

  const getStatusIcon = (status?: string) => {
    if (!status) return null;
    if (status === "sending") return <FiClock className={styles.sendingIcon} />;
    if (status === "failed") return <span>❌</span>;
    if (status === "read") return <BsCheckAll className={`${styles.tickIcon} ${styles.read}`} />;
    if (status === "delivered") return <BsCheckAll className={styles.tickIcon} />;
    return <BsCheck className={styles.tickIcon} />;
  };

  // LinkedIn Style: 5 quick emojis
  const QUICK_REACTIONS = ["👍", "👏", "😄", "🤔", "❤️"];

  return (
    <div className={`${styles.messageRow} ${isMine ? styles.myRow : styles.theirRow}`}>
      {/* AVATAR */}
      {!isMine && (
        <div className={styles.avatarCol}>
          {m.senderAvatar ? (
            <img src={m.senderAvatar} alt="avatar" className={styles.messageAvatar} />
          ) : (
            <div className={styles.defaultAvatar}>{m.senderName?.charAt(0)}</div>
          )}
        </div>
      )}

      <div className={styles.bubbleContainer}>
        {/* ───────────────────────────────────────────────
            🌟 ACTION BAR (Floating Pill on Hover)
           ─────────────────────────────────────────────── */}
        <div className={`${styles.actionBar} ${isMine ? styles.actionLeft : styles.actionRight}`}>
          
          {/* 1. Quick Reactions */}
          <div className={styles.quickReactions}>
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} className={styles.reactionBtn} onClick={() => onReact(m, emoji)}>
                {emoji}
              </button>
            ))}
          </div>

          <div className={styles.divider} />

          {/* 2. Plus Button (Picker) */}
          <div className={styles.actionBtnWrapper} ref={pickerRef}>
            <button
              className={styles.actionBtn}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add reaction"
            >
              <FiSmile /> <span className={styles.plusSign}>+</span>
            </button>
            {showEmojiPicker && (
              <div className={styles.emojiPickerPopup}>
                <EmojiPicker
                  onEmojiClick={(e) => {
                    onReact(m, e.emoji);
                    setShowEmojiPicker(false);
                  }}
                  width={280}
                  height={350}
                  theme={Theme.LIGHT}
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {/* 3. Reply Button */}
          <button className={styles.actionBtn} onClick={() => onReply(m)} title="Reply">
            <FiCornerUpLeft />
          </button>

          {/* 4. More Options */}
          <div className={styles.actionBtnWrapper} ref={menuRef}>
            <button className={styles.actionBtn} onClick={() => setShowMenu(!showMenu)}>
              <FiMoreVertical />
            </button>

            {showMenu && (
              <div className={styles.dropdownMenu}>
                <div onClick={() => { onCopy(m); setShowMenu(false); }} className={styles.dropdownItem}>
                  <FiCopy size={14} /> Copy
                </div>
                {isMine && m.type === "text" && (
                  <div onClick={() => { onEdit(m); setShowMenu(false); }} className={styles.dropdownItem}>
                    <FiEdit2 size={14} /> Edit
                  </div>
                )}
                {isMine && (
                  <div onClick={() => { onDelete(m); setShowMenu(false); }} className={`${styles.dropdownItem} ${styles.danger}`}>
                    <FiTrash size={14} /> Delete
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 📨 MESSAGE BUBBLE */}
        <div className={styles.messageBubble}>
          {renderContent()}
          
          {/* Edited Tag */}
          {(m as any).isEdited && (
            <span className={styles.editedTag}>(edited)</span>
          )}
          
          {/* Timestamp & Status */}
          <div className={styles.messageMeta}>
            <span className={styles.messageTime}>{m.timestamp}</span>
            {isMine && getStatusIcon(m.status)}
          </div>
        </div>

        {/* 😍 REACTION PILLS */}
        {m.reactions && Object.keys(m.reactions).length > 0 && (
          <div className={styles.reactionRow}>
            {Object.entries(m.reactions).map(([emoji, userIds]) => (
              userIds.length > 0 && (
                <button key={emoji} className={styles.reactionPill} onClick={() => onReact(m, emoji)}>
                  <span className={styles.reactionEmoji}>{emoji}</span>
                  <span className={styles.reactionCount}>{userIds.length}</span>
                </button>
              )
            ))}
          </div>
        )}
      </div>
    </div>
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
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const topMessageSentinelRef = useRef<HTMLDivElement>(null);

  const isFirstLoadRef = useRef(true);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

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
    if (topMessageSentinelRef.current) observer.observe(topMessageSentinelRef.current);
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
    // Basic copy logic, specific text extraction is in MessageRow
    const text = msg.content || msg.linkUrl || "";
    if (text) navigator.clipboard.writeText(text);
  };

  const handleInternalSendMessage = (
    content: string,
    type?: "text" | "image" | "document" | "link" | "audio",
    file?: any
  ) => {
    onSendMessage(content, type, file, replyingTo || undefined);
    setReplyingTo(null);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  /* Empty State */
  if (!selectedUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyCard}>
          <Image src="/Frame 238021 (1).svg" alt="Chat" width={90} height={90} />
          <h2 className={styles.title}>Let’s start chatting</h2>
          <p className={styles.subtitle}>Search for a person to start.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatPanel}>
      {/* HEADER */}
      <div className={styles.chatHeader}>
        <button className={styles.backButton} onClick={onBack}><FiArrowLeft /></button>
        <div className={styles.avatarWrapper}>
          {selectedUser.avatar ? (
            <img src={selectedUser.avatar} alt="User" className={styles.headerAvatar}   style={{ width: "36px", height: "36px", borderRadius: "50%" }}/>
          ) : (
            <div className={styles.headerInitials}>{getInitials(selectedUser.name)}</div>
          )}
          {selectedUser.online && <div className={styles.onlineIndicator} />}
        </div>
        <div className={styles.userInfo}>
          <h2 className={styles.userName}>{selectedUser.name}</h2>
          <p className={styles.userStatus}>Online</p>
        </div>
        <button className={styles.moreButton}><FiMoreVertical /></button>
      </div>

      {/* MESSAGES AREA */}
      <div className={styles.messagesArea} ref={messagesAreaRef}>
        {isLoading && (
          <div className={styles.loadingWrapper}>
            <MessageSkeleton /><MessageSkeleton /><MessageSkeleton />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className={styles.emptyConversation}>
            <div className={styles.profileRing}>
              {selectedUser.avatar ? (
                 <img src={selectedUser.avatar} className={styles.emptyAvatar} />
              ) : (
                 <div className={styles.emptyInitials}>{getInitials(selectedUser.name)}</div>
              )}
            </div>
            <h3 className={styles.emptyTitle}>You’re connected with <span>{selectedUser.name}</span></h3>
          </div>
        )}

        <div className={styles.messagesContainer}>
          {hasMoreMessages && <div ref={topMessageSentinelRef}>{isLoadingOlderRef.current && <MessageSkeleton />}</div>}

          {messages.map((m) => (
            <MessageRow
              key={m.id}
              m={m}
              isMine={m.sent}
              onReply={handleReply}
              onCopy={handleCopy}
              onEdit={onEditMessage || (() => {})}
              onDelete={onDeleteMessage || (() => {})}
              onReact={onReact}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* REPLY PREVIEW (For Input) */}
      {replyingTo && (
        <div className={styles.replyPreview}>
          <div className={styles.replyContainer}>
            <div className={styles.replyDecor} />
            <div className={styles.replyContent}>
              <span className={styles.replyAuthor}>{replyingTo.sent ? "You" : replyingTo.senderName}</span>
              <p className={styles.replyText}>
                {replyingTo.type === "image" ? "📷 Photo" : replyingTo.content}
              </p>
            </div>
            {replyingTo.type === "image" && replyingTo.fileUrl && (
              <img src={replyingTo.fileUrl} alt="" className={styles.replyThumb} />
            )}
            <button onClick={() => setReplyingTo(null)} className={styles.closeReply}><FiX /></button>
          </div>
        </div>
      )}

      {/* INPUT */}
      <MessageInput onSendMessage={handleInternalSendMessage} />
    </div>
  );
}