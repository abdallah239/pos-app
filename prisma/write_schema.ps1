generator client {
  provider =  prisma-client-js
}

datasource db {
  provider = sqlite
  url      = file:./dev.db
}

model User {
  id        String    @id @default(uuid())
  username  String    @unique
  passwordHash String
  role      String
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime @updatedAt
  
  products Product[]
  sessions Session[]
}

model Product {
  id          String    @id @default(uuid())
  name        String
  price       Int       // stored in minor currency units (cents)
  sku         String    @unique
  category    String
  createdById String
  createdBy   User      @relation(fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Session {
  id        String    @id @default(uuid())
  tokenHash String
  userId    String
  expiresAt DateTime
  createdAt DateTime  @default(now())
  
  user User @relation(fields: [userId], references: [id])
}

