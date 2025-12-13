"use client";

import { useEffect, useRef } from "react";
import { FiSearch } from "react-icons/fi";
import { User } from "./ChatInterface";
import styles from "./UserSidebar.module.scss";

interface UserSidebarProps {
  users: User[];
  selectedUser: User | null;
  onUserSelect: (user: User) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  onLoadMore: () => void; // NEW PROP for infinite scroll callback
  hasMore: boolean; // NEW PROP to indicate if more data is available
}

export default function UserSidebar({
  users,
  selectedUser,
  onUserSelect,
  onSearch,
  searchQuery,
  onLoadMore, 
  hasMore, 
}: UserSidebarProps) {
  const loadingIndicatorRef = useRef<HTMLDivElement>(null); 
  const userListRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    if (!hasMore || searchQuery.length >= 2) return; // Stop observing if no more data or if search is active

    const observer = new IntersectionObserver(
      (entries) => {
        // If the sentinel (loading indicator) is visible and we have more users to load
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: userListRef.current, // Use the userList div as the root
        rootMargin: "0px 0px 100px 0px", // Load 100px before reaching the bottom
        threshold: 0.1,
      }
    );

    const currentRef = loadingIndicatorRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, onLoadMore, searchQuery]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
    // Simple hash-like index based on ID to ensure color stability
    const index = parseInt(id.replace(/\D/g, '').slice(-3) || '0', 10) % colors.length;
    return colors[index];
  };

  return (
    <div className={styles.userSidebar}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Chats</h1>
      </div>

      {/* Search Bar */}
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
        {users.length === 0 && searchQuery.length < 2 ? (
          <div className={styles.noResults}>
            <p>Loading chats...</p>
          </div>
        ) : users.length === 0 && searchQuery.length >= 2 ? (
            <div className={styles.noResults}>
                <p>No search results found.</p>
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
        
        {/* Loading/Sentinel Indicator for Infinite Scroll */}
        {hasMore && (
          <div ref={loadingIndicatorRef} className={styles.loadingMore}>
            <p>Loading more chats...</p>
          </div>
        )}

        {!hasMore && users.length > 0 && searchQuery.length < 2 && (
            <div className={styles.endOfList}>
                <p>You've reached the end of the chat list.</p>
            </div>
        )}

      </div>
    </div>
  );
}