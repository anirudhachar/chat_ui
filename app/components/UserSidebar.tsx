"use client";

import { useEffect, useRef } from "react";
// Import icons for the tick marks
import { FiSearch, FiCheck } from "react-icons/fi";
// Assuming the User type now includes lastMessageStatus
import { User } from "./ChatInterface";
import styles from "./UserSidebar.module.scss";
import UserSidebarSkeleton from "./UserSidebarSkeleton/UserSidebarSkeleton";

interface UserSidebarProps {
  users: User[];
  selectedUser: User | null;
  onUserSelect: (user: User) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  onLoadMore: () => void;
  hasMore: boolean;
  isSearching: boolean;
}

// ───────────────────────────────────────────────
// STATUS ICON COMPONENT
// ───────────────────────────────────────────────
const StatusIcon = ({ status }: { status?: User["lastMessageStatus"] }) => {
  if (!status) return null;

  const isRead = status === "read";

  // Renders the tick icons for sent messages (sent, delivered, read)
  return (
    <div
      className={`${styles.statusIcons} ${isRead ? styles.readStatus : ""}`}
      // Note: In a real app, 'delivered' and 'sent' might have different icon logic/color.
      // Here, we use single/double tick pattern:
      // - Sent: Single check
      // - Delivered/Read: Double check
    >
      {/* Base/First checkmark */}
      <FiCheck size={14} className={styles.firstCheck} />

      {/* Second checkmark for delivered/read */}
      {["delivered", "read"].includes(status) && (
        <FiCheck size={14} className={styles.secondCheck} />
      )}
    </div>
  );
};
// ───────────────────────────────────────────────
// USER SIDEBAR COMPONENT
// ───────────────────────────────────────────────

export default function UserSidebar({
  users,
  selectedUser,
  onUserSelect,
  onSearch,
  searchQuery,
  onLoadMore,
  hasMore,
  isSearching,
}: UserSidebarProps) {
  const loadingIndicatorRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);

  /* Infinite scroll (disabled during search) */
  useEffect(() => {
    if (!hasMore || searchQuery.length >= 2) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: userListRef.current,
        rootMargin: "0px 0px 100px 0px",
        threshold: 0.1,
      }
    );

    const el = loadingIndicatorRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, onLoadMore, searchQuery]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

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
      "#f06292",
      "#ba68c8",
    ];
    const index =
      parseInt(id.replace(/\D/g, "").slice(-3) || "0", 10) % colors.length;
    return colors[index];
  };

  return (
    <div className={styles.userSidebar}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Messaging</h1>
      </div>

      {/* Search */}
      <div className={styles.searchContainer}>
        <div className={styles.searchWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search or start new chat"
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      {/* User List */}
      <div className={styles.userList} ref={userListRef}>
        {/* SEARCH/LOADING LOGIC */}
        {isSearching ? (
          <UserSidebarSkeleton count={6} />
        ) : users.length === 0 && searchQuery.length >= 2 ? (
          <div className={styles.noResults}>
            <p>No search results found.</p>
          </div>
        ) : users.length === 0 ? (
          <UserSidebarSkeleton count={6} />
        ) : (
          users.map(
            (user) => (
              console.log(user, "usermania"),
              (
                <div
                  key={user.id}
                  className={`${styles.userCard} ${
                    selectedUser?.id === user.id ? styles.active : ""
                  }`}
                  onClick={() => onUserSelect(user)}
                >
                  <div className={styles.avatarWrapper}>
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className={styles.avatarImage}
                      />
                    ) : (
                      <div
                        className={styles.avatar}
                        style={{ backgroundColor: getAvatarColor(user.id) }}
                      >
                        {getInitials(user.name)}
                      </div>
                    )}
                    {user.online && <div className={styles.onlineIndicator} />}
                  </div>

                  <div className={styles.userInfo}>
                    <div className={styles.userHeader}>
                      <h3 className={styles.userName}>{user.name}</h3>
                      <span className={styles.timestamp}>
                        {user.lastMessageTime}
                      </span>
                    </div>
                    <div className={styles.lastMessageWrapper}>
                      {/* 🔥 NEW: Render Status Icon */}
                      {user.lastMessageStatus && (
                        <StatusIcon status={user.lastMessageStatus} />
                      )}

                      <p className={styles.lastMessage}>{user.lastMessage}</p>
                      {Number(user.unread) > 0 && (
                        <span className={styles.unreadBadge}>
                          {user.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            )
          )
        )}

        {/* Infinite scroll skeleton */}
        {hasMore && searchQuery.length < 2 && !isSearching && (
          <div ref={loadingIndicatorRef}>
            <UserSidebarSkeleton count={2} />
          </div>
        )}
      </div>
    </div>
  );
}
