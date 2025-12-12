"use client";

import { FiSearch } from "react-icons/fi";
import { User } from "./ChatInterface";
import styles from "./UserSidebar.module.scss";

interface UserSidebarProps {
  users: User[];
  selectedUser: User | null;
  onUserSelect: (user: User) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
}

export default function UserSidebar({
  users,
  selectedUser,
  onUserSelect,
  onSearch,
  searchQuery,
}: UserSidebarProps) {
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
    const index = parseInt(id, 10) % colors.length;
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
      <div className={styles.userList}>
        {users.length === 0 ? (
          <div className={styles.noResults}>
            <p>No users found</p>
          </div>
        ) : (
          users.map((user) => (
            console.log(user,"usersmania"),
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
      </div>
    </div>
  );
}
