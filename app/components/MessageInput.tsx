"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import {
  FiSmile,
  FiPaperclip,
  FiSend,
  FiX,
  FiMic,
  FiTrash2,
  FiSquare, // Icon for stop
} from "react-icons/fi";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import styles from "./MessageInput.module.scss";

interface MessageInputProps {
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "document" | "link" | "audio",
    file?: { name: string; url: string; image?: string; description?: string }
  ) => void;
}

const extractURL = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

// Helper: Format seconds to MM:SS
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
  const [recordedAudio, setRecordedAudio] = useState<{
    blob: Blob;
    url: string;
    duration: string;
  } | null>(null);

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

  // Link Preview Logic
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
  // 🎤 RECORDING HANDLERS
  // ───────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        const durationStr = formatTime(recordingDuration);

        // Save to state to show preview
        setRecordedAudio({
          blob: audioBlob,
          url: audioUrl,
          duration: durationStr,
        });

        stream.getTracks().forEach((track) => track.stop()); // Release mic
        setIsRecording(false);
        setRecordingDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
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
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop(); // Triggers onstop above
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setRecordedAudio(null); // Clear any saved audio immediately
  };

  const deleteRecordedAudio = () => {
    setRecordedAudio(null);
  };

  const sendRecordedAudio = () => {
    if (!recordedAudio) return;

    // ⚠️ IMPORTANT: In a real app, upload `recordedAudio.blob` to S3/Cloudinary first.
    // Currently, this sends a blob URL which only works on YOUR computer.
    // To make it work for others, you need a backend upload endpoint.

    onSendMessage("🎤 Voice Message", "audio", {
      name: "Voice Message",
      url: recordedAudio.url, // Replaced with S3 URL in production
      description: recordedAudio.duration,
    });

    setRecordedAudio(null);
  };

  // ───────────────────────────────────────────────
  // FILE & TEXT SEND HANDLERS
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
    if (recordedAudio) {
      sendRecordedAudio();
      return;
    }

    if (!message.trim() && !linkPreview && !selectedFile) return;

    if (selectedFile) {
      const displayContent =
        message.trim() ||
        (selectedFile.type === "image" ? "📷 Photo" : selectedFile.file.name);
      const fileData = {
        name: selectedFile.file.name,
        url: selectedFile.previewUrl || "placeholder-url",
        image:
          selectedFile.type === "image" ? selectedFile.previewUrl : undefined,
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

  const showSendButton =
    message.trim().length > 0 || selectedFile || linkPreview || recordedAudio;

  return (
    <div className={styles.messageInputWrapper}>
      {/* PREVIEWS (File / Link) */}
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
      {linkPreview && (
        <div className={styles.linkPreview}>
          {linkPreview.image && (
            <img
              src={linkPreview.image}
              alt=""
              className={styles.previewImage}
            />
          )}
          <div className={styles.previewContent}>
            <p className={styles.previewTitle}>{linkPreview.title}</p>
          </div>
        </div>
      )}

      <div className={styles.messageInput}>
        {isRecording ? (
          <div className={styles.recordingContainer}>
            <div className={styles.recordingIndicator}>
              <div className={styles.redDot} />
              <span className={styles.timer}>
                {formatTime(recordingDuration)}
              </span>
              <span className={styles.recordingText}>Recording...</span>
            </div>
            <div className={styles.recordingActions}>
              <button
                className={styles.cancelRecordButton}
                onClick={cancelRecording}
              >
                Cancel
              </button>
              {/* Stop Button */}
              <button className={styles.stopButton} onClick={stopRecording}>
                <FiSquare fill="currentColor" />
              </button>
            </div>
          </div>
        ) : recordedAudio ? (
          /* 2. PREVIEW AUDIO STATE */
          <div className={styles.audioPreviewContainer}>
            <button className={styles.iconButton} onClick={deleteRecordedAudio}>
              <FiTrash2 className={styles.trashIcon} />
            </button>

            {/* Native Audio Player for Preview */}
            <audio
              src={recordedAudio.url}
              controls
              className={styles.audioPlayer}
            />

            <button className={styles.sendButton} onClick={handleSend}>
              <FiSend />
            </button>
          </div>
        ) : (
          /* 3. DEFAULT TEXT INPUT STATE */
          <div className={styles.inputContainer}>
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
              onClick={showSendButton ? handleSend : startRecording}
              disabled={false}
            >
              {showSendButton ? <FiSend /> : <FiMic />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
