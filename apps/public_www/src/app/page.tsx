import { Features } from '@/components/sections/features';
import { Footer } from '@/components/sections/footer';
import { Hero } from '@/components/sections/hero';
import { PageLayout } from '@/components/shared/page-layout';

export default function HomePage() {
  return (
    <PageLayout>
      <Hero />
      <Features />
      <Footer />
    </PageLayout>
  );
}
