interface EmptyStateProps {
  onReset: () => void;
}

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <h2>You have seen all memes</h2>
      <p>
        <span className="emoji" aria-hidden="true">
          🎉
        </span>
        Reset your swipe history to go through them again.
      </p>
      <button type="button" onClick={onReset}>
        <span className="emoji" aria-hidden="true">
          🔄
        </span>
        Reset
      </button>
    </section>
  );
}
