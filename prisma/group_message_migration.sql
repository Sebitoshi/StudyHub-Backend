-- Add GroupMessage to schema.prisma
-- Run: npx prisma migrate dev --name add-group-messages

model GroupMessage {
  id        Int      @id @default(autoincrement())
  groupId   Int
  userId    Int
  content   String?
  imageUrl  String?
  createdAt DateTime @default(now())

  group     StudyGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([groupId])
  @@map("group_messages")
}
