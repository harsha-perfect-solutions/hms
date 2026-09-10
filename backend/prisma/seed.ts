import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding HMS database with real test accounts and dashboard state...');

  const studentPasswordHash = await bcrypt.hash('Password@123', 10);
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Primary Student (from reference screenshots): MANI MANASVI GAVARA
  const student1 = await prisma.student.upsert({
    where: { jntuNo: '25331A05H7' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'STUDENT',
      name: 'MANI MANASVI GAVARA',
      email: 'vemalivardhan@gmail.com',
      allocationStatus: 'ALLOCATED',
      blockName: 'Girls-Block-B',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-1',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
      monthlyOutingMax: 5,
    },
    create: {
      jntuNo: '25331A05H7',
      passwordHash: studentPasswordHash,
      name: 'MANI MANASVI GAVARA',
      email: 'vemalivardhan@gmail.com',
      role: 'STUDENT',
      allocationStatus: 'ALLOCATED',
      blockName: 'Girls-Block-B',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-1',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
      monthlyOutingMax: 5,
      isActive: true,
    },
  });

  // Clean existing child records for clean deterministic seed
  await prisma.complaint.deleteMany({ where: { studentId: student1.id } });
  await prisma.messToken.deleteMany({ where: { studentId: student1.id } });
  await prisma.outingRequest.deleteMany({ where: { studentId: student1.id } });
  await prisma.leaveRequest.deleteMany({ where: { studentId: student1.id } });
  await prisma.notification.deleteMany({ where: { studentId: student1.id } });
  await prisma.activityLog.deleteMany({ where: { studentId: student1.id } });

  // 4 Mess tokens booked for today (Breakfast, Lunch, Snacks, Dinner)
  const dateTag = todayStr.replace(/-/g, '');
  await prisma.messToken.createMany({
    data: [
      {
        studentId: student1.id,
        tokenNumber: `MT-${dateTag}-BRK-101`,
        date: todayStr,
        mealType: 'BREAKFAST',
        status: 'BOOKED',
      },
      {
        studentId: student1.id,
        tokenNumber: `MT-${dateTag}-LUN-102`,
        date: todayStr,
        mealType: 'LUNCH',
        status: 'BOOKED',
      },
      {
        studentId: student1.id,
        tokenNumber: `MT-${dateTag}-SNK-103`,
        date: todayStr,
        mealType: 'SNACKS',
        status: 'BOOKED',
      },
      {
        studentId: student1.id,
        tokenNumber: `MT-${dateTag}-DIN-104`,
        date: todayStr,
        mealType: 'DINNER',
        status: 'BOOKED',
      },
    ],
  });

  // Real Notifications
  await prisma.notification.createMany({
    data: [
      {
        studentId: student1.id,
        title: 'Room Allocation Confirmed',
        message: 'You have been officially allocated Bed-1 in Girls-Block-B, Room 119.',
        type: 'SUCCESS',
        isRead: false,
      },
      {
        studentId: student1.id,
        title: 'Mess Menu Updated',
        message: 'Weekly residential hostel menu has been refreshed for the upcoming cycle.',
        type: 'INFO',
        isRead: true,
      },
    ],
  });

  // Real Activity Logs
  await prisma.activityLog.createMany({
    data: [
      {
        studentId: student1.id,
        actionType: 'MESS',
        description: 'Booked 2 meal tokens for today (Breakfast, Lunch)',
      },
      {
        studentId: student1.id,
        actionType: 'ROOM',
        description: 'Room Girls-Block-B - 119 verified and allocated',
      },
      {
        studentId: student1.id,
        actionType: 'LOGIN',
        description: 'Successful authenticated portal session established',
      },
    ],
  });

  // 2. Roommate: NAKKULLA RITHIKA (Allocated, but 0 mess tokens today to verify independent data)
  const student2 = await prisma.student.upsert({
    where: { jntuNo: '25331A05H8' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'STUDENT',
      name: 'NAKKULLA RITHIKA',
      email: 'rithika.n@college.edu',
      allocationStatus: 'ALLOCATED',
      blockName: 'Girls-Block-B',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-2',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
      monthlyOutingMax: 5,
    },
    create: {
      jntuNo: '25331A05H8',
      passwordHash: studentPasswordHash,
      name: 'NAKKULLA RITHIKA',
      email: 'rithika.n@college.edu',
      role: 'STUDENT',
      allocationStatus: 'ALLOCATED',
      blockName: 'Girls-Block-B',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-2',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
      monthlyOutingMax: 5,
      isActive: true,
    },
  });

  // Clean existing child records for student2
  await prisma.complaint.deleteMany({ where: { studentId: student2.id } });
  await prisma.messToken.deleteMany({ where: { studentId: student2.id } });
  await prisma.outingRequest.deleteMany({ where: { studentId: student2.id } });
  await prisma.leaveRequest.deleteMany({ where: { studentId: student2.id } });

  // 11 Baseline OPEN complaints for management dashboard and complaints tracking
  const initialComplaints = [
    { category: 'ELECTRICAL', title: 'Ceiling fan regulator sparking', description: 'The ceiling fan regulator sparks when turned up.', location: 'Girls-Block-B, Room 119', priority: 'HIGH' },
    { category: 'PLUMBING', title: 'Water tap leaking heavily', description: 'Bathroom sink tap continues dripping heavily.', location: 'Girls-Block-B, Room 119', priority: 'MEDIUM' },
    { category: 'CARPENTRY', title: 'Wardrobe hinge loose', description: 'The main door hinge of wardrobe 2 is detached.', location: 'Girls-Block-B, Room 119', priority: 'LOW' },
    { category: 'CLEANLINESS', title: 'Floor cleaning requested', description: 'Balcony area requires floor scrub and wash.', location: 'Girls-Block-B, Floor 1', priority: 'LOW' },
    { category: 'INTERNET', title: 'Wi-Fi repeater unstable signal', description: 'Wi-Fi disconnects frequently during evening study hours.', location: 'Girls-Block-B, Wing 1', priority: 'HIGH' },
    { category: 'ELECTRICAL', title: 'Tube light flickering in study room', description: 'Overhead tube light flickers continuously.', location: 'Girls-Block-B, Room 120', priority: 'MEDIUM' },
    { category: 'PLUMBING', title: 'Shower mixer valve stuck', description: 'Water temperature control valve cannot be adjusted.', location: 'Girls-Block-B, Room 120', priority: 'HIGH' },
    { category: 'CARPENTRY', title: 'Study chair armrest cracked', description: 'Wooden study chair has a cracked left armrest.', location: 'Girls-Block-B, Room 119', priority: 'LOW' },
    { category: 'INTERNET', title: 'LAN port not responding', description: 'Ethernet RJ45 socket in desk 1 has no link light.', location: 'Girls-Block-B, Room 119', priority: 'MEDIUM' },
    { category: 'OTHER', title: 'Window mesh screen torn', description: 'Mosquito screen on north window is torn at bottom.', location: 'Girls-Block-B, Room 119', priority: 'LOW' },
    { category: 'ELECTRICAL', title: 'Geyser heating element trip', description: 'Water heater trips circuit breaker when powered on.', location: 'Girls-Block-B, Room 119', priority: 'URGENT' },
  ];

  for (let i = 0; i < initialComplaints.length; i++) {
    const c = initialComplaints[i];
    await prisma.complaint.create({
      data: {
        studentId: i % 2 === 0 ? student1.id : student2.id,
        ticketNumber: `CMP-${dateTag}-${String(i + 101).padStart(3, '0')}`,
        category: c.category,
        title: c.title,
        description: c.description,
        location: c.location,
        priority: c.priority,
        status: 'OPEN',
      },
    });
  }

  // 3. Unallocated Student (to verify empty state for room allocation)
  const studentUnallocated = await prisma.student.upsert({
    where: { jntuNo: '21A91A0501' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'STUDENT',
      name: 'Rahul Varma',
      email: 'rahul.v@college.edu',
      allocationStatus: 'NOT_ALLOCATED',
      blockName: null,
      floorName: null,
      roomNumber: null,
      bedNumber: null,
      roomType: null,
      monthlyOutingMax: 5,
    },
    create: {
      jntuNo: '21A91A0501',
      passwordHash: studentPasswordHash,
      name: 'Rahul Varma',
      email: 'rahul.v@college.edu',
      role: 'STUDENT',
      allocationStatus: 'NOT_ALLOCATED',
      isActive: true,
    },
  });

  // 4. Deactivated Student
  await prisma.student.upsert({
    where: { jntuNo: '21A91A0502' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: false,
      role: 'STUDENT',
    },
    create: {
      jntuNo: '21A91A0502',
      passwordHash: studentPasswordHash,
      name: 'Inactive Student',
      email: 'inactive.student@college.edu',
      role: 'STUDENT',
      isActive: false,
    },
  });

  // 5. Warden account
  await prisma.student.upsert({
    where: { jntuNo: 'WARDEN01' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'WARDEN',
    },
    create: {
      jntuNo: 'WARDEN01',
      passwordHash: studentPasswordHash,
      name: 'Hostel Warden',
      email: 'warden@college.edu',
      role: 'WARDEN',
      isActive: true,
    },
  });

  // 5b. Maintenance Staff account (Step 16)
  await prisma.student.upsert({
    where: { jntuNo: 'MAINT01' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'MAINTENANCE_STAFF',
    },
    create: {
      jntuNo: 'MAINT01',
      passwordHash: studentPasswordHash,
      name: 'Maintenance Technician',
      email: 'maintenance@college.edu',
      role: 'MAINTENANCE_STAFF',
      isActive: true,
    },
  });


  // 6. Authoritative Hostel Blocks
  const initialBlocks = [
    {
      name: 'Girls-Block-B',
      code: 'GB-B',
      description: 'Main residential block B for female students (Rooms 101-220).',
      status: 'ACTIVE',
    },
    {
      name: 'Boys-Block-A',
      code: 'BB-A',
      description: 'North residential wing for male engineering undergraduates.',
      status: 'ACTIVE',
    },
    {
      name: 'West-Wing-C',
      code: 'WW-C',
      description: 'West Wing residential facility undergoing summer renovation.',
      status: 'INACTIVE',
    },
  ];

  for (const b of initialBlocks) {
    await prisma.block.upsert({
      where: { code: b.code },
      update: {},
      create: b,
    });
  }

  // 7. Authoritative Rooms & Allocations
  const gbBlock = await prisma.block.findUnique({ where: { code: 'GB-B' } });
  const bbBlock = await prisma.block.findUnique({ where: { code: 'BB-A' } });

  if (gbBlock) {
    const room119 = await prisma.room.upsert({
      where: { blockId_roomNumber: { blockId: gbBlock.id, roomNumber: '119' } },
      update: {},
      create: {
        blockId: gbBlock.id,
        roomNumber: '119',
        floor: 1,
        roomType: 'Non-AC Room (2 Sharing)',
        capacity: 2,
        status: 'ACTIVE',
      },
    });

    await prisma.room.upsert({
      where: { blockId_roomNumber: { blockId: gbBlock.id, roomNumber: '120' } },
      update: {},
      create: {
        blockId: gbBlock.id,
        roomNumber: '120',
        floor: 1,
        roomType: 'Non-AC Room (2 Sharing)',
        capacity: 2,
        status: 'ACTIVE',
      },
    });

    // Allocations for student1 and student2
    const existingAlloc1 = await prisma.roomAllocation.findFirst({
      where: { studentId: student1.id, status: 'ACTIVE' },
    });
    if (!existingAlloc1) {
      await prisma.roomAllocation.create({
        data: {
          roomId: room119.id,
          studentId: student1.id,
          bedNumber: 'Bed-1',
          status: 'ACTIVE',
          allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
        },
      });
    }

    const existingAlloc2 = await prisma.roomAllocation.findFirst({
      where: { studentId: student2.id, status: 'ACTIVE' },
    });
    if (!existingAlloc2) {
      await prisma.roomAllocation.create({
        data: {
          roomId: room119.id,
          studentId: student2.id,
          bedNumber: 'Bed-2',
          status: 'ACTIVE',
          allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
        },
      });
    }
  }

  if (bbBlock) {
    await prisma.room.upsert({
      where: { blockId_roomNumber: { blockId: bbBlock.id, roomNumber: '201' } },
      update: {},
      create: {
        blockId: bbBlock.id,
        roomNumber: '201',
        floor: 2,
        roomType: 'Non-AC Room (3 Sharing)',
        capacity: 3,
        status: 'ACTIVE',
      },
    });
  }

  console.log('Database seeded successfully:');
  console.log(`- Student 1: ${student1.name} (${student1.jntuNo}) - Allocated (Girls-Block-B - 119) with 2 mess tokens today`);
  console.log(`- Student 2: ${student2.name} (${student2.jntuNo}) - Allocated (Girls-Block-B - 119) with 0 mess tokens`);
  console.log(`- Student 3: ${studentUnallocated.name} (${studentUnallocated.jntuNo}) - NOT_ALLOCATED (Empty State)`);
  console.log(`- Blocks: Seeded ${initialBlocks.length} authoritative baseline blocks (GB-B, BB-A, WW-C)`);
  console.log(`- Rooms: Seeded authoritative rooms (119, 120 in GB-B; 201 in BB-A)`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
