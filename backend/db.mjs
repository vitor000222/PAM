import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn'] // ajuste se quiser 'query'
});
export const sql = Prisma.sql;
