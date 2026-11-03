import type { ConfigService } from '@nestjs/config';

export function getPositiveIntegerConfig(
  config: ConfigService,
  name: string,
): number {
  const rawValue = config.getOrThrow<string>(name);
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${rawValue}"`);
  }
  return value;
}
