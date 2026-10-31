import { Avatar } from '@heroui/react';

const INITIALS_WORD_COUNT = 2;

type UserAvatarProps = {
  name: string;
  size?: 'sm' | 'md' | 'lg';
};

// The uppercase first letters of the first two words of the name.
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, INITIALS_WORD_COUNT)
    .map((word) => word[0].toUpperCase())
    .join('');
}

// Decorative: the name is always rendered next to it.
export function UserAvatar({
  name,
  size = 'md',
}: UserAvatarProps): React.JSX.Element {
  return (
    <Avatar size={size} color="accent" variant="soft" aria-hidden="true">
      <Avatar.Fallback>{getInitials(name)}</Avatar.Fallback>
    </Avatar>
  );
}
