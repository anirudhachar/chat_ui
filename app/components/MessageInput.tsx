"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import { FiSmile, FiPaperclip, FiSend, FiX } from "react-icons/fi";
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

  console.log(onSendMessage,"onSendMessage")

  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);

  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    type: "image" | "document";
    previewUrl?: string;
  } | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // ───────────────────────────────────────────────
  // LINK PREVIEW (DEBOUNCED)
  // ───────────────────────────────────────────────
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPreviewDebounced = (url: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(url), 500);
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
    } catch {
      setLinkPreview(null);
    }
  };

  useEffect(() => {
    const url = extractURL(message);
    if (url) fetchPreviewDebounced(url);
    else setLinkPreview(null);
  }, [message]);

  // ───────────────────────────────────────────────
  // FILE PICK HANDLER
  // ───────────────────────────────────────────────
  const handleFilePick = (
    e: ChangeEvent<HTMLInputElement>,
    type: "image" | "document"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile({
      file,
      type,
      previewUrl: type === "image" ? URL.createObjectURL(file) : undefined,
    });

    e.target.value = "";
  };

  // ───────────────────────────────────────────────
  // SEND MESSAGE
  // ───────────────────────────────────────────────
 // MessageInput.tsx - INSIDE handleSend (FIXED logic)
  const handleSend = () => {
    if (!message.trim() && !linkPreview && !selectedFile) return;

    if (selectedFile) {
     
      const displayContent =
        message.trim() ||
        (selectedFile.type === "image" ? "📷 Photo" : selectedFile.file.name);

      const fileData = {
        name: selectedFile.file.name,
      
        url: selectedFile.previewUrl || "placeholder-url", 
        image: selectedFile.type === "image" ? selectedFile.previewUrl : undefined,
        description: message.trim() || selectedFile.file.name,
      };

     
      onSendMessage(displayContent, selectedFile.type, fileData); 

      setSelectedFile(null);
      setMessage("");
      return;
    }

    // 🔗 LINK SEND (existing logic)
    if (linkPreview) {
      onSendMessage(message.trim(), "link", {
        name: linkPreview.title,
        url: linkPreview.url,
        image: linkPreview.image,
        description: linkPreview.description,
      });
    } else {
      onSendMessage(message.trim(), "text");
    }

    setMessage("");
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

  return (
    <div className={styles.messageInputWrapper}>
      {/* FILE PREVIEW */}
      {selectedFile && (
        <div className={styles.filePreview}>
          {selectedFile.type === "image" ? (
            <img
              src={selectedFile.previewUrl}
              className={styles.imagePreview}
              alt="preview"
            />
          ) : (
            <div className={styles.docPreview}>📄 {selectedFile.file.name}</div>
          )}

          <button
            className={styles.removePreview}
            onClick={() => setSelectedFile(null)}
          >
            <FiX />
          </button>
        </div>
      )}

      {/* LINK PREVIEW */}
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
        {/* EMOJI PICKER */}
        {showEmojiPicker && (
          <>
            <div
              className={styles.emojiPickerBackdrop}
              onClick={() => setShowEmojiPicker(false)}
            />
            <div className={styles.emojiPickerWrapper}>
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          </>
        )}

        <div className={styles.inputContainer}>
          {/* EMOJI */}
          <button
            className={styles.iconButton}
            onClick={() => setShowEmojiPicker((p) => !p)}
            type="button"
          >
            <FiSmile />
          </button>

          {/* ATTACH */}
          <div className={styles.attachWrapper}>
            <button
              className={styles.iconButton}
              onClick={() => setShowAttachMenu((p) => !p)}
              type="button"
            >
              <FiPaperclip />
            </button>

            {showAttachMenu && (
              <>
                <div
                  className={styles.attachBackdrop}
                  onClick={() => setShowAttachMenu(false)}
                />
                <div className={styles.attachMenu}>
                  <button
                    onClick={() => {
                      imageInputRef.current?.click();
                      setShowAttachMenu(false);
                    }}
                  >
                    📷 Photos
                  </button>
                  <button
                    onClick={() => {
                      docInputRef.current?.click();
                      setShowAttachMenu(false);
                    }}
                  >
                    📄 Documents
                  </button>
                </div>
              </>
            )}
          </div>

          {/* HIDDEN INPUTS */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleFilePick(e, "image")}
          />
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            hidden
            onChange={(e) => handleFilePick(e, "document")}
          />

          {/* TEXT */}
          <input
            type="text"
            className={styles.textInput}
            placeholder="Type a message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />

        
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!message.trim() && !selectedFile}
            type="button"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
}
