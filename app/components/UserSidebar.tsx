"use client";

import { useEffect, useRef } from "react";
// Import icons for the tick marks
import { FiSearch, FiCheck } from "react-icons/fi";
// Assuming the User type now includes lastMessageStatus
import { User } from "./ChatInterface";
import styles from "./UserSidebar.module.scss";
import UserSidebarSkeleton from "./UserSidebarSkeleton/UserSidebarSkeleton";
import { IoCheckmark, IoCheckmarkDone, IoTimeOutline } from "react-icons/io5";

interface UserSidebarProps {
  users: User[];
  selectedUser: User | null;
  onUserSelect: (user: User) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  onLoadMore?: () => void;
  hasMore: boolean;
  isSearching: boolean;
  isUsersLoading: boolean;
}

// ───────────────────────────────────────────────
// STATUS ICON COMPONENT
// ───────────────────────────────────────────────
const StatusIcon = ({ status }: { status?: User["lastMessageStatus"] }) => {
  if (!status) return null;

  switch (status) {
    case "sending":
      return <IoTimeOutline className={styles.sendingIcon} />;

    case "sent":
      return <IoCheckmark className={styles.tickIcon} />;

    case "delivered":
      return <IoCheckmarkDone className={styles.tickIcon} />;

    case "read":
      return <IoCheckmarkDone className={`${styles.tickIcon} ${styles.read}`} />;

    default:
      return null;
  }
};

export default function UserSidebar({
  users,
  selectedUser,
  onUserSelect,
  onSearch,
  searchQuery,
  onLoadMore,
  hasMore,
  isSearching,
  isUsersLoading,
}: UserSidebarProps) {
  const loadingIndicatorRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);

  /* Infinite scroll (disabled during search) */
  useEffect(() => {
if (!onLoadMore || !hasMore || searchQuery.length >= 2) return;
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
        {isSearching ? (
          <UserSidebarSkeleton count={6} />
        ) : searchQuery.length >= 2 && users.length === 0 ? (
          <div className={styles.noResults}>
            <p>No search results found.</p>
          </div>
        ) : isUsersLoading ? (
          <UserSidebarSkeleton count={6} />
        ) : users.length === 0 ? (
          <div className={styles.noResults}>
            <p>No conversations yet</p>
          </div>
        ) : (
          users.map((user) => (
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
                  <h3
                    className={`${styles.userName} ${
                      Number(user.unread) > 0 ? styles.unreadUser : ""
                    }`}
                  >
                    {user.name}
                  </h3>
                  <span className={styles.timestamp}>
                    {user.lastMessageTime}
                  </span>
                </div>
                <div className={styles.lastMessageWrapper}>
                  {/* 🔥 NEW: Render Status Icon */}
                  {!user.isTyping && user.lastMessageStatus && (
                    <StatusIcon status={user.lastMessageStatus} />
                  )}

                  <p
                    className={`${styles.lastMessage} ${
                      user.isTyping ? styles.typingText : ""
                    }`}
                  >
                    {user.isTyping ? "Typing…" : user.lastMessage}
                  </p>

                  {Number(user.unread) > 0 && (
                    <span className={styles.unreadBadge}>{user.unread}</span>
                  )}
                </div>
              </div>
            </div>
          ))
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
