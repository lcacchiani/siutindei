import { Skeleton } from '@/components/shared/ui/skeleton';

export function ListingCardSkeleton() {
  return (
    <div className="listing-card w-[280px] shrink-0 sm:w-[300px]">
      <Skeleton className="aspect-[4/3] w-full" />
      <Skeleton className="mt-3 h-4 w-4/5" />
      <Skeleton className="mt-2 h-3 w-3/5" />
      <Skeleton className="mt-2 h-3 w-2/5" />
    </div>
  );
}
