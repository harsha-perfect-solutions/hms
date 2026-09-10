const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const student = await prisma.student.findFirst({
    where: { jntuNo: '25331A05H7' },
  });

  if (!student) {
    console.error('Student 25331A05H7 not found');
    process.exit(1);
  }

  // Check if we already have pending leaves
  const existingPending = await prisma.leaveRequest.findFirst({
    where: { studentId: student.id, status: 'PENDING' },
  });

  if (!existingPending) {
    const startDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);

    const leave = await prisma.leaveRequest.create({
      data: {
        studentId: student.id,
        requestNumber: `LEV-${Date.now().toString().slice(-4)}`,
        leaveType: 'HOME_LEAVE',
        destination: 'Plot 42, Jubilee Hills, Hyderabad',
        reason: 'Attending family anniversary and gathering',
        emergencyContact: '9876543210',
        startDate,
        endDate,
        status: 'PENDING',
        remarks: 'Bus reservation already confirmed for travel.',
      },
    });
    console.log('Created pending leave request:', leave.requestNumber);
  } else {
    console.log('Existing pending leave request already present:', existingPending.requestNumber);
  }

  await prisma.$disconnect();
}

seed().catch(console.error);
