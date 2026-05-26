export function preloadActivityImage(imageUrl: string): () => void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = imageUrl;
  link.setAttribute('fetchpriority', 'high');
  document.head.appendChild(link);

  return () => {
    link.remove();
  };
}
