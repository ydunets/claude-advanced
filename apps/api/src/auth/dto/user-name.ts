import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MAX_NAME_LENGTH = 100;

function trimIfString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

// Trims before validating, so a spaces-only name counts as empty. The trimmed
// value reaches the controller because the global ValidationPipe returns the
// transformed object.
export function IsUserName(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => trimIfString(value), { toClassOnly: true }),
    IsString(),
    IsNotEmpty(),
    MaxLength(MAX_NAME_LENGTH),
  );
}
