export const AVIS_STAR_ACTIVE = "#F4A623";
export const AVIS_STAR_INACTIVE = "#D8D4CC";

type StarProps = {
  filled: boolean;
  size?: number;
};

export function Star({ filled, size = 20 }: StarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? AVIS_STAR_ACTIVE : AVIS_STAR_INACTIVE}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.56l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
    </svg>
  );
}
