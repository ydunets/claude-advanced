import { Avatar } from '@heroui/react';
import { getAvatarImageRoute } from '@/lib/routes';

const INITIALS_WORD_COUNT = 2;

type UserAvatarProps = {
  name: string;
  avatarId: string | null;
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

// Decorative: the name is always rendered next to it. A plain image, not
// next/image, whose loader would drop the session cookie the owner-only
// Route Handler needs; the initials stay until the image has loaded.
export function UserAvatar({
  name,
  avatarId,
  size = 'md',
}: UserAvatarProps): React.JSX.Element {
  return (
    <Avatar size={size} color="accent" variant="soft" aria-hidden="true">
      {avatarId && <Avatar.Image src={getAvatarImageRoute(avatarId)} alt="" />}
      <Avatar.Fallback>{getInitials(name)}</Avatar.Fallback>
    </Avatar>
  );
}
