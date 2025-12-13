import styles from "./UserSidebarSkeleton.module.scss";

export default function UserSidebarSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.skeletonUserCard}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonInfo}>
            <div className={styles.skeletonLineShort} />
            <div className={styles.skeletonLineLong} />
          </div>
        </div>
      ))}
    </>
  );
}
