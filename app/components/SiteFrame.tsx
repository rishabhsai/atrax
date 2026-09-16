'use client';

import {usePathname} from 'next/navigation';
import {SiteHeader} from './SiteHeader';
import {SiteFooter} from './SiteFooter';

export function SiteFrame({children}: {children: React.ReactNode}) {
  const path = usePathname();
  const consolePage = ['/account','/workspace','/sign-in','/auth'].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  if (consolePage) return <>{children}</>;
  return <><SiteHeader key={path} />{children}<SiteFooter /></>;
}
