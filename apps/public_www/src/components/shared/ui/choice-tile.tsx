interface ChoiceTileProps {
  readonly label: string;
  readonly iconSrc: string;
  readonly isSelected: boolean;
  readonly onClick: () => void;
  readonly iconShape?: 'illustration' | 'flag';
}

export function ChoiceTile({
  label,
  iconSrc,
  isSelected,
  onClick,
  iconShape = 'illustration',
}: ChoiceTileProps) {
  const selectedClassName = isSelected
    ? 'border-accent-500 bg-brand-50 ' +
      'shadow-[0_10px_30px_rgba(29,64,59,0.12)]'
    : 'border-brand-100 bg-white hover:border-brand-200 ' +
      'hover:shadow-[0_10px_30px_rgba(29,64,59,0.1)]';
  const iconClassName =
    iconShape === 'flag'
      ? 'h-20 w-20 rounded-full object-cover ring-1 ring-ink-900/15 ' +
        'sm:h-24 sm:w-24'
      : 'h-20 w-20 object-contain sm:h-24 sm:w-24';

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={
        'choice-tile group flex flex-col items-center gap-3 ' +
        `rounded-2xl border px-4 pb-5 pt-6 transition ${selectedClassName}`
      }
    >
      <img
        src={iconSrc}
        alt=""
        width={96}
        height={96}
        decoding="async"
        aria-hidden="true"
        className={`choice-tile__icon ${iconClassName}`}
      />
      <span
        className={`text-sm font-semibold ${
          isSelected ? 'text-brand-700' : 'text-ink-900'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
