import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'test@studybuddy.com' },
    update: {},
    create: {
      email: 'test@studybuddy.com',
      passwordHash,
      name: 'Test User',
      tier: 'FREE',
    },
  });

  console.log(`✅ Test user created: ${user.email}`);

  // Create a streak record for the test user
  await prisma.streak.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      current: 0,
      longest: 0,
      graceDaysUsed: 0,
    },
  });

  console.log('✅ Streak record created');
  console.log('\n🎉 Seed complete!');
  console.log('   Email:    test@studybuddy.com');
  console.log('   Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
