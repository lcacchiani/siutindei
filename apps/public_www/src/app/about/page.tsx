import { redirect } from 'next/navigation';

import { DEFAULT_LOCALE } from '@/content';
import { localizePath } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';

export default function AboutRedirectPage() {
  redirect(localizePath(ROUTES.about, DEFAULT_LOCALE));
}
