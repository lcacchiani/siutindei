interface SearchChoiceButtonProps {
  readonly label: string;
  readonly iconSrc: string;
  readonly isSelected: boolean;
  readonly onClick: () => void;
  readonly className?: string;
  readonly iconShape?: 'illustration' | 'flag';
}

export function SearchChoiceButton({
  label,
  iconSrc,
  isSelected,
  onClick,
  className = '',
  iconShape = 'illustration',
}: SearchChoiceButtonProps) {
  const selectedClassName = isSelected
    ? 'border-ink-900 bg-ink-900 text-white ' +
      'md:border-accent-500 md:bg-brand-50 md:text-brand-700'
    : 'border-ink-900/15 bg-white text-ink-700 ' +
      'hover:border-ink-900/30 md:hover:border-brand-200';

  const iconClassName =
    iconShape === 'flag'
      ? 'h-7 w-7 rounded-full object-cover ring-1 ring-ink-900/15'
      : 'h-12 w-12 object-contain';

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={
        'search-choice inline-flex shrink-0 items-center gap-2 ' +
        'rounded-full border px-4 py-2 text-sm font-medium transition ' +
        'md:min-w-[7.5rem] md:flex-col md:rounded-2xl md:px-3 md:py-3 ' +
        `${selectedClassName} ${className}`
      }
    >
      <img
        src={iconSrc}
        alt=""
        width={iconShape === 'flag' ? 28 : 48}
        height={iconShape === 'flag' ? 28 : 48}
        decoding="async"
        aria-hidden="true"
        className={`hidden md:block ${iconClassName}`}
      />
      <span>{label}</span>
    </button>
  );
}
