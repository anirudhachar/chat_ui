"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import { 
  FiSmile, 
  FiPaperclip, 
  FiSend, 
  FiX, 
  FiMic, 
  FiTrash2, 
  FiCheck 
} from "react-icons/fi";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import styles from "./MessageInput.module.scss";

interface MessageInputProps {
  onSendMessage: (
    content: string,
    // Added "audio" to the type definition
    type?: "text" | "image" | "document" | "link" | "audio", 
    file?: { name: string; url: string; image?: string; description?: string }
  ) => void;
}

const extractURL = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

// Helper to format seconds into MM:SS
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);

  // 🎤 Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    type: "image" | "document";
    previewUrl?: string;
  } | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ───────────────────────────────────────────────
  // LINK PREVIEW
  // ───────────────────────────────────────────────
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
  // VOICE RECORDING HANDLERS
  // ───────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start Timer
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecordingAndSend = () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const audioFile = new File([audioBlob], "voice_message.webm", { type: "audio/webm" });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Send as a file
      onSendMessage("🎤 Voice Message", "audio", {
        name: "Voice Message",
        url: audioUrl,
        description: formatTime(recordingDuration), // Pass duration as description or handle in Parent
      });
      
      cleanupRecording();
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  };

  const cleanupRecording = () => {
    setIsRecording(false);
    setRecordingDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    audioChunksRef.current = [];
  };

  // ───────────────────────────────────────────────
  // FILE PICK & SEND HANDLERS
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

  // Logic to switch between Mic and Send button
  const showSendButton = message.trim().length > 0 || selectedFile || linkPreview;

  return (
    <div className={styles.messageInputWrapper}>
      {/* FILE PREVIEW */}
      {selectedFile && (
        <div className={styles.filePreview}>
          {selectedFile.type === "image" ? (
            <img src={selectedFile.previewUrl} className={styles.imagePreview} alt="preview" />
          ) : (
            <div className={styles.docPreview}>📄 {selectedFile.file.name}</div>
          )}
          <button className={styles.removePreview} onClick={() => setSelectedFile(null)}>
            <FiX />
          </button>
        </div>
      )}

      {/* LINK PREVIEW */}
      {linkPreview && (
        <div className={styles.linkPreview}>
          {linkPreview.image && (
            <img src={linkPreview.image} alt={linkPreview.title} className={styles.previewImage} />
          )}
          <div className={styles.previewContent}>
            <p className={styles.previewTitle}>{linkPreview.title}</p>
            <p className={styles.previewDescription}>{linkPreview.description}</p>
            <p className={styles.previewUrl}>{linkPreview.url}</p>
          </div>
        </div>
      )}

      <div className={styles.messageInput}>
        {/* EMOJI PICKER */}
        {showEmojiPicker && (
          <>
            <div className={styles.emojiPickerBackdrop} onClick={() => setShowEmojiPicker(false)} />
            <div className={styles.emojiPickerWrapper}>
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          </>
        )}

        <div className={styles.inputContainer}>
          
          {/* 🎤 RECORDING STATE UI */}
          {isRecording ? (
            <div className={styles.recordingContainer}>
              <div className={styles.recordingIndicator}>
                <div className={styles.redDot} />
                <span className={styles.timer}>{formatTime(recordingDuration)}</span>
              </div>
              <div className={styles.recordingActions}>
                 <button className={styles.cancelRecordButton} onClick={cancelRecording}>
                   Cancel
                 </button>
                 {/* Invisible spacer to push send button to right if needed, or just flex gap */}
              </div>
            </div>
          ) : (
            <>
              {/* NORMAL STATE UI */}
              <button
                className={styles.iconButton}
                onClick={() => setShowEmojiPicker((p) => !p)}
                type="button"
              >
                <FiSmile />
              </button>

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
                    <div className={styles.attachBackdrop} onClick={() => setShowAttachMenu(false)} />
                    <div className={styles.attachMenu}>
                      <button onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false); }}>
                        📷 Photos
                      </button>
                      <button onClick={() => { docInputRef.current?.click(); setShowAttachMenu(false); }}>
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

              {/* TEXT INPUT */}
              <input
                type="text"
                className={styles.textInput}
                placeholder="Type a message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </>
          )}

          {/* RIGHT ACTION BUTTON (Mic vs Send) */}
          {isRecording ? (
             <button className={styles.sendButton} onClick={stopRecordingAndSend}>
               <FiCheck />
             </button>
          ) : (
             <button
              className={styles.sendButton}
              onClick={showSendButton ? handleSend : startRecording}
              disabled={!showSendButton && !isRecording} // Technically never disabled now, as it becomes Mic
            >
              {showSendButton ? <FiSend /> : <FiMic />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}