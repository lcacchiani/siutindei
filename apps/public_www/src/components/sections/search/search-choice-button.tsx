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
      ? 'h-10 w-10 rounded-full object-cover ring-1 ring-ink-900/15'
      : 'h-12 w-12 object-contain';

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={
        'search-choice inline-flex shrink-0 items-center gap-2 ' +
        'rounded-full border px-4 py-2 text-sm font-medium leading-5 ' +
        'transition md:min-w-0 md:w-full md:flex-1 md:flex-col ' +
        'md:items-center md:justify-start md:gap-2 md:self-stretch ' +
        'md:rounded-2xl md:px-2 md:py-3 ' +
        `${selectedClassName} ${className}`
      }
    >
      <span
        className={
          'search-choice-icon hidden h-12 w-12 shrink-0 items-center ' +
          'justify-center md:flex'
        }
      >
        <img
          src={iconSrc}
          alt=""
          width={iconShape === 'flag' ? 40 : 48}
          height={iconShape === 'flag' ? 40 : 48}
          decoding="async"
          aria-hidden="true"
          className={iconClassName}
        />
      </span>
      <span className="md:text-center">{label}</span>
    </button>
  );
}
