import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export interface DependencyProbe {
  probe(): Promise<boolean>;
}

export interface Database extends DependencyProbe {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export function createDatabase(connectionString: string): Database {
  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 });
  const prisma = new PrismaClient({ adapter });

  return {
    async connect() {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
    },
    async probe() {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
    async disconnect() {
      await prisma.$disconnect();
    },
  };
}
