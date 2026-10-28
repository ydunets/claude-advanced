export function BrandMark(): React.JSX.Element {
  return (
    <p className="flex items-center gap-2 text-base font-semibold">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <rect x="2" y="6" width="14" height="12" rx="3" />
        <path d="m16 10 6-3.5v11L16 14" />
      </svg>
      Video Meetings
    </p>
  );
}
