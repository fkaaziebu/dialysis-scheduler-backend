import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Client } from 'pg';
import { AppModule } from './app.module';

async function createDatabase(dbName: string) {
  const client = new Client({
    user: process.env.DB_USERNAME,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  });

  try {
    await client.connect();
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database ${dbName} created successfully`);
  } catch (error) {
    if (error.code === '42P04') {
      console.log(`Database ${dbName} already exists`);
    } else {
      console.error(`Error creating database ${dbName}:`, error);
    }
  } finally {
    await client.end();
  }
}

async function bootstrap() {
  // Create main database
  await createDatabase(process.env.DB_NAME!);

  // Create test database
  await createDatabase(process.env.DB_NAME_TEST!);

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://studio.apollographql.com',
      'http://ec2-18-199-175-68.eu-central-1.compute.amazonaws.com:4000',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
