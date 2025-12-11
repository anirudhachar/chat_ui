"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import { FiSmile, FiPaperclip, FiSend } from "react-icons/fi";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import styles from "./MessageInput.module.scss";

interface MessageInputProps {
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "document" | "link",
    file?: { name: string; url: string; image?: string; description?: string }
  ) => void;
}


const extractURL = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stable debounced function
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const fetchPreviewDebounced = (url: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(url), 500);
  };

const handleSend = () => {
  if (!message.trim() && !linkPreview) return;

  // If link preview exists, send it as a special message
  if (linkPreview) {
    onSendMessage(message.trim(), 'link', {
      name: linkPreview.title,
      url: linkPreview.url,
      image: linkPreview.image,
      description: linkPreview.description,
    });
  } else {
    onSendMessage(message.trim(), 'text');
  }

  setMessage('');
  setLinkPreview(null);
  setShowEmojiPicker(false);
};


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");

    onSendMessage(isImage ? "" : file.name, isImage ? "image" : "document", {
      name: file.name,
      url: fileUrl,
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fetchPreview = async (url: string) => {
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data.error) setLinkPreview(data);
    } catch (err) {
      console.error("Preview failed", err);
      setLinkPreview(null);
    }
  };

  useEffect(() => {
    const url = extractURL(message);
    if (url) {
      fetchPreviewDebounced(url);
    } else {
      setLinkPreview(null);
    }
  }, [message]);

  return (
    <div className={styles.messageInputWrapper}>
      {/* Link Preview Above Input */}
      {linkPreview && (
        <div className={styles.linkPreview}>
          {linkPreview.image && (
            <img
              src={linkPreview.image}
              alt={linkPreview.title}
              className={styles.previewImage}
            />
          )}
          <div className={styles.previewContent}>
            <p className={styles.previewTitle}>{linkPreview.title}</p>
            <p className={styles.previewDescription}>
              {linkPreview.description}
            </p>
            <p className={styles.previewUrl}>{linkPreview.url}</p>
          </div>
        </div>
      )}

      <div className={styles.messageInput}>
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <>
            <div
              className={styles.emojiPickerBackdrop}
              onClick={() => setShowEmojiPicker(false)}
            />
            <div className={styles.emojiPickerWrapper}>
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width="100%"
                height="350px"
              />
            </div>
          </>
        )}

        <div className={styles.inputContainer}>
          {/* Emoji Button */}
          <button
            className={styles.iconButton}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            type="button"
          >
            <FiSmile />
          </button>

          {/* File Attachment Button */}
          <button
            className={styles.iconButton}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <FiPaperclip />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className={styles.fileInput}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />

          {/* Text Input */}
          <input
            type="text"
            className={styles.textInput}
            placeholder="Type a message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* Send Button */}
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!message.trim()}
            type="button"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
}
