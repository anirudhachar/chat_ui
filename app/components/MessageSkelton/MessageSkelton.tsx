// MessageSkeleton.tsx
import styles from "./MessageSkeleton.module.scss";

export default function MessageSkeleton() {
  return (
    <div className={styles.skeletonWrapper}>
      <div className={`${styles.skeletonBubble} ${styles.left}`} />
      <div className={`${styles.skeletonBubble} ${styles.right}`} />
      <div className={`${styles.skeletonBubble} ${styles.left}`} />
    </div>
  );
}
