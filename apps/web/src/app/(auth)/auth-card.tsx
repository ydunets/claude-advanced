import { Card } from '@heroui/react';
import { cardVariants, linkVariants } from '@heroui/styles';
import Link from 'next/link';

type AuthCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkLabel: string;
  footerHref: string;
};

export function AuthCard({
  title,
  description,
  children,
  footerText,
  footerLinkLabel,
  footerHref,
}: AuthCardProps): React.JSX.Element {
  return (
    <Card className="w-full max-w-md p-8 shadow-none">
      <Card.Header className="gap-2">
        {/* Card.Title renders an h3; its render prop cannot cross the server boundary. */}
        <h1
          className={cardVariants().title({
            className: 'text-2xl font-semibold',
          })}
        >
          {title}
        </h1>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <Card.Content className="mt-4">{children}</Card.Content>
      <Card.Footer className="mt-6 justify-center gap-1 text-sm text-muted">
        {footerText}
        <Link
          href={footerHref}
          className={linkVariants().base({
            className: 'underline underline-offset-4',
          })}
        >
          {footerLinkLabel}
        </Link>
      </Card.Footer>
    </Card>
  );
}
