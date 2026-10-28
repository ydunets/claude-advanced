import { BrandMark } from '@/app/brand-mark';

export default function AuthLayout({
  children,
}: LayoutProps<'/'>): React.JSX.Element {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <BrandMark />
      {children}
    </main>
  );
}
