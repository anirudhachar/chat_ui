'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { FiSmile, FiPaperclip, FiSend } from 'react-icons/fi';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import styles from './MessageInput.module.scss';

interface MessageInputProps {
  onSendMessage: (
    content: string,
    type?: 'text' | 'image' | 'document',
    file?: { name: string; url: string }
  ) => void;
}

// Extract first URL from text
const extractURL = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

// Simple debounce hook
const useDebounce = (fn: (...args: any[]) => void, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounced = (...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fn(...args), delay);
  };
  return debounced;
};

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!message.trim()) return;

    onSendMessage(message.trim(), 'text');
    setMessage('');
    setLinkPreview(null);
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
    const isImage = file.type.startsWith('image/');

    onSendMessage(
      isImage ? '' : file.name,
      isImage ? 'image' : 'document',
      { name: file.name, url: fileUrl }
    );

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fetchPreview = async (url: string) => {
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data.error) setLinkPreview(data);
    } catch (err) {
      console.error('Preview failed', err);
      setLinkPreview(null);
    }
  };

  const fetchPreviewDebounced = useDebounce(fetchPreview, 500);

 
  useEffect(() => {
    const url = extractURL(message);
    if (url) {
      fetchPreviewDebounced(url);
    } else {
      setLinkPreview(null);
    }
  }, [message, fetchPreviewDebounced]);

  return (
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
        {/* Link Preview */}
        {linkPreview && (
          <div className="p-3 border rounded-lg mb-2 bg-gray-50 flex gap-3">
            {linkPreview.image && (
              <img
                src={linkPreview.image}
                alt={linkPreview.title}
                className="w-20 h-20 object-cover rounded-md"
              />
            )}
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold text-sm truncate">{linkPreview.title}</p>
              <p className="text-xs text-gray-600 line-clamp-2">
                {linkPreview.description}
              </p>
              <p className="text-xs text-blue-600 mt-1 truncate">{linkPreview.url}</p>
            </div>
          </div>
        )}

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
  );
}
