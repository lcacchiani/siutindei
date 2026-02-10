'use client';

interface StarRatingProps {
  value: number;
  max?: number;
  onChange: (value: number) => void;
  sizeClassName?: string;
}

export function StarRating({
  value,
  max = 5,
  onChange,
  sizeClassName = 'h-5 w-5',
}: StarRatingProps) {
  const clampedValue = Math.max(0, Math.min(value, max));
  const stars = Array.from({ length: max }, (_, index) => index + 1);

  return (
    <div className='flex items-center gap-1'>
      {stars.map((starValue) => {
        const isSelected = starValue <= clampedValue;
        return (
          <button
            key={starValue}
            type='button'
            onClick={() => onChange(starValue)}
            className='rounded-sm p-0.5'
            aria-label={`Set rating to ${starValue} ${
              starValue === 1 ? 'star' : 'stars'
            }`}
          >
            <StarIcon
              className={`${sizeClassName} ${
                isSelected ? 'text-yellow-400' : 'text-slate-300'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 20 20'
      fill='currentColor'
      aria-hidden='true'
    >
      <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z' />
    </svg>
  );
}
