import { linkVariants } from '@heroui/styles';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';
import { BrandMark } from '../../brand-mark';

export const COMPACT_LINK_CLASS_NAME = linkVariants().base({
  className:
    'inline-flex min-h-9 items-center text-sm underline underline-offset-4',
});

type MeetingPageShellProps = {
  children: React.ReactNode;
};

export function MeetingPageShell({
  children,
}: MeetingPageShellProps): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <BrandMark />
        <Link href={ROUTES.HOME} className={COMPACT_LINK_CLASS_NAME}>
          All meetings
        </Link>
      </header>
      {children}
    </div>
  );
}
