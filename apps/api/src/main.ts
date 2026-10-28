import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const DEFAULT_API_PORT = 4000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? DEFAULT_API_PORT);
}
await bootstrap();
