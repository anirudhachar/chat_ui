"use client";

import { useEffect, useRef } from "react";
import { FiSearch } from "react-icons/fi";
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
  isSearching: boolean; // 🔥 NEW
}

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
        <h1 className={styles.title}>Chats</h1>
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
        {/* 🔥 SEARCH LOADING */}
        {isSearching ? (
          <UserSidebarSkeleton count={6} />
        ) : users.length === 0 && searchQuery.length >= 2 ? (
          <div className={styles.noResults}>
            <p>No search results found.</p>
          </div>
        ) : users.length === 0 ? (
          <UserSidebarSkeleton count={6} />
        ) : (
          users.map((user) => (
            console.log(user,"usermania"),
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
                  <p className={styles.lastMessage}>{user.lastMessage}</p>
                  {user.unread && user.unread > 0 && (
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
