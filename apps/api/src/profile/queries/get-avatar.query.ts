import type { Readable } from 'node:stream';
import { Query } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../../auth/auth-token.service.js';

export type AvatarContent = {
  mimeType: string;
  size: number;
  content: Readable;
};

export class GetAvatarQuery extends Query<AvatarContent> {
  constructor(readonly user: AuthenticatedUser) {
    super();
  }
}
