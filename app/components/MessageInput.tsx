'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { FiSmile, FiPaperclip, FiSend } from 'react-icons/fi';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import styles from './MessageInput.module.scss';

interface MessageInputProps {
  onSendMessage: (content: string, type?: 'text' | 'image' | 'document', file?: { name: string; url: string }) => void;
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      setShowEmojiPicker(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(message + emojiData.emoji);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
          onKeyPress={handleKeyPress}
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
