"use client";

import { useEffect, useState } from "react";

import styles from "./ChatInterface.module.scss";
import UserSidebar from "./UserSidebar";
import ChatPanel from "./ChatPanel";

export interface User {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  online: boolean;
  unread?: number;
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  sent: boolean;
  type: "text" | "image" | "document";
  status?: "sent" | "delivered" | "read";
  fileName?: string;
  fileUrl?: string;
}

// Mock users data
const mockUsers: User[] = [
  {
    id: "1",
    name: "Alice Johnson",
    lastMessage: "Hey! How are you doing?",
    lastMessageTime: "10:30 AM",
    online: true,
    unread: 2,
  },
  {
    id: "2",
    name: "Bob Smith",
    lastMessage: "Thanks for the help!",
    lastMessageTime: "Yesterday",
    online: false,
  },
  {
    id: "3",
    name: "Carol White",
    lastMessage: "See you tomorrow 👋",
    lastMessageTime: "2 days ago",
    online: true,
  },
  {
    id: "4",
    name: "David Brown",
    lastMessage: "Can you send me the files?",
    lastMessageTime: "3 days ago",
    online: false,
  },
  {
    id: "5",
    name: "Emma Davis",
    lastMessage: "Great idea! Let's do it.",
    lastMessageTime: "1 week ago",
    online: true,
  },
];

// Mock messages data
const mockMessagesMap: { [key: string]: Message[] } = {
  "1": [
    {
      id: "1",
      content: "yi there!",
      timestamp: "10:25 AM",
      sent: false,
      type: "text",
    },
    {
      id: "2",
      content: "Hello! How can I help you?",
      timestamp: "10:26 AM",
      sent: true,
      type: "text",
      status: "read",
    },
    {
      id: "3",
      content: "Hey! How are you doing?",
      timestamp: "10:30 AM",
      sent: false,
      type: "text",
    },
  ],
  "2": [
    {
      id: "1",
      content: "I need some help with the project",
      timestamp: "Yesterday",
      sent: false,
      type: "text",
    },
    {
      id: "2",
      content: "Sure! What do you need?",
      timestamp: "Yesterday",
      sent: true,
      type: "text",
      status: "read",
    },
    {
      id: "3",
      content: "Thanks for the help!",
      timestamp: "Yesterday",
      sent: false,
      type: "text",
    },
  ],
  "3": [
    {
      id: "1",
      content: "Let's meet tomorrow!",
      timestamp: "2 days ago",
      sent: true,
      type: "text",
      status: "delivered",
    },
    {
      id: "2",
      content: "See you tomorrow 👋",
      timestamp: "2 days ago",
      sent: false,
      type: "text",
    },
  ],
};

export default function ChatInterface() {
  console.log("hellos");
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setMessages(mockMessagesMap[user.id] || []);

    // Clear unread count
    setUsers(
      users.map((u) => (u.id === user.id ? { ...u, unread: undefined } : u))
    );

    // On mobile, hide sidebar when user is selected
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleSendMessage = (
    content: string,
    type: "text" | "image" | "document" = "text",
    file?: { name: string; url: string }
  ) => {
    if (!selectedUser) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      sent: true,
      type,
      status: "sent",
      fileName: file?.name,
      fileUrl: file?.url,
    };

    setMessages([...messages, newMessage]);

    // Update last message in user list
    setUsers(
      users.map((u) =>
        u.id === selectedUser.id
          ? { ...u, lastMessage: content, lastMessageTime: "Just now" }
          : u
      )
    );
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleBackToList = () => {
    setShowSidebar(true);
    setSelectedUser(null);
  };

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    // Inform parent that child is ready
    window.parent.postMessage({ type: "CHAT_READY" }, "*");

    const handleMessage = (event: MessageEvent) => {
      console.log(event,"eventMessage")
      if (!event.data?.type) return;

      // -------------------------
      // 1️⃣ OPEN CHAT
      // -------------------------
      if (event.data.type === "OPEN_CHAT") {
        const payload = event.data.payload;

        if (payload.user) {
          const incomingUser = payload.user;

          const user: User = {
            id: incomingUser.user_id,
            name: incomingUser.firstName + " " + (incomingUser.lastName ?? ""),
            avatar: incomingUser.profilePhoto,
            lastMessage: "",
            lastMessageTime: "Now",
            online: true,
          };

          setSelectedUser(user);
          setMessages(mockMessagesMap[user.id] || []);
          setShowSidebar(false);
        } else {
          setSelectedUser(null);
          setMessages([]);
          setShowSidebar(true);
        }
      }

      // -------------------------
      // 2️⃣ RECEIVE SHARE MESSAGE FROM PARENT
      // -------------------------
      if (event.data.type === "SEND_MESSAGE_TO_CHAT") {
        const { user, message, shareLink } = event.data.payload;
console.log(shareLink,"sharelink")
        // Select the user in chat
        const chatUser: User = {
          id: user.user_id,
          name: user.firstName + " " + (user.lastName ?? ""),
          avatar: user.profilePhoto,
          lastMessage: "",
          lastMessageTime: "Now",
          online: true,
        };

        setSelectedUser(chatUser);
        setShowSidebar(false);

        // Append message + link to chat
        const newMessage: Message = {
          id: Date.now().toString(),
          content: message, // includes message + shareLink
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
          sent: false, // parent sent it
          type: "text",
          status: "delivered",
        };

        setMessages((prev) => [...prev, newMessage]);

        // Update sidebar last message
        setUsers((prev) =>
          prev.map((u) =>
            u.id === chatUser.id
              ? {
                  ...u,
                  lastMessage: message,
                  lastMessageTime: "Now",
                }
              : u
          )
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className={styles.chatInterface}>
      <div
        className={`${styles.sidebarWrapper} ${showSidebar ? styles.show : ""}`}
      >
        <UserSidebar
          users={filteredUsers}
          selectedUser={selectedUser}
          onUserSelect={handleUserSelect}
          onSearch={handleSearch}
          searchQuery={searchQuery}
        />
      </div>
      <div
        className={`${styles.chatWrapper} ${!showSidebar ? styles.show : ""}`}
      >
        <ChatPanel
          selectedUser={selectedUser}
          messages={messages}
          onSendMessage={handleSendMessage}
          onBack={handleBackToList}
        />
      </div>
    </div>
  );
}
