const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const FLOOR_PLANS = [
  {
    floor: 1,
    floorLabel: 'First Floor',
    rooms: [
      {
        roomNumber: '101',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['N. William Raju', 'C.H. Naresh', 'T. Dhanush', 'K. Arun'],
      },
      {
        roomNumber: '102',
        capacity: 3,
        roomType: 'Non-AC Room (3 Sharing)',
        students: ['G. Sajeev Yoor', 'Shaik Samad', 'O. Venkat Sai Ganesh'],
      },
      {
        roomNumber: '103',
        capacity: 3,
        roomType: 'Non-AC Room (3 Sharing)',
        students: ['T. Balla Sai Charan', 'C.H. Sanju', 'E. Hari Prasad'],
      },
      {
        roomNumber: '104',
        capacity: 3,
        roomType: 'Non-AC Room (3 Sharing)',
        students: ['A. Kishore', 'Y. Sanjoy', 'T. Nani'],
      },
      {
        roomNumber: '105',
        capacity: 3,
        roomType: 'Non-AC Room (3 Sharing)',
        students: ['P. Ramesh', 'P. Vinay', 'D. Manoj'],
      },
      {
        roomNumber: '106',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['V. Santhosh Kumar', 'O. Vikram', 'S.K. Iqbal', 'S. Manoj'],
      },
      {
        roomNumber: '107',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['D. Gopi Sai', 'B. Prasanth', 'K. Charan Sai Teja', 'T. Venkata Yadavendra'],
      },
      {
        roomNumber: '108',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['S. Pavan', 'B. Ganadeep', 'K. Murali Sai', 'V. Yodesh'],
      },
    ],
  },
  {
    floor: 2,
    floorLabel: 'Second Floor',
    rooms: [
      {
        roomNumber: '201',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['K. Abhishek', 'Durga Dhanush Kumar. P', 'Reddy, Madhava Naidu', 'T. Guruvayya'],
      },
      {
        roomNumber: '202',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['B.K. Hari Surya Teja', 'J. Duleep', 'B. Ganesh', 'A. Vishnu Vardhan'],
      },
      {
        roomNumber: '203',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['M. Harsha', 'D. Vijay', 'A. Dhanush', 'V. Surya Kiran'],
      },
      {
        roomNumber: '204',
        capacity: 2,
        roomType: 'Non-AC Room (2 Sharing)',
        students: ['D. Pradhu', 'Ch. Ganesh'],
      },
      {
        roomNumber: '205',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['N. Rahul', 'Y. Sushanth', 'G. Vicky', 'G. Siva Durga Prasad'],
      },
      {
        roomNumber: '206',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['K. Diresh', 'P. Niranjan', 'B. Jaswanth Reddy', 'G. Hemanth'],
      },
      {
        roomNumber: '207',
        capacity: 4,
        roomType: 'Non-AC Room (4 Sharing)',
        students: ['R. Rakesh', 'P. Manilesh', 'T. Akhil', 'D. Kiran'],
      },
    ],
  },
  {
    floor: 3,
    floorLabel: 'Third Floor',
    rooms: [
      {
        roomNumber: '301',
        capacity: 9,
        roomType: 'Dormitory / Special (9 Sharing)',
        students: [
          'K. Sunil',
          'D. Srinu',
          'D. Ratna Raju',
          'M. Rohith',
          'R. Varshi',
          'Duyda Vaya Prasad',
          'Ch. Guna Shekar',
          'P. Shiva Mani',
          'V. Surya',
        ],
      },
      {
        roomNumber: '303',
        capacity: 10,
        roomType: 'Dormitory / Special (10 Sharing)',
        students: [
          'Ch. Naveen Teja',
          'B. Yogi',
          'P. Vishnu Vardhan',
          'D.S.P. Manikanta',
          'K. Rupesh',
          'K. John',
          'K. Preetham',
          'R. Akash',
          'K. Vivek',
          'S. Devendra',
        ],
      },
      {
        roomNumber: '109',
        capacity: 2,
        roomType: 'Non-AC Room (2 Sharing)',
        students: ['B. Ganesh', 'Veeru Sir'],
      },
      {
        roomNumber: '208',
        capacity: 1,
        roomType: 'Single Room (1 Sharing)',
        students: ['B. Mohan'],
      },
    ],
  },
];

async function main() {
  console.log('===============================================================');
  console.log('STARTING HMS FLOOR PLAN & STUDENT DATA ATOMIC UPDATE');
  console.log('===============================================================');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Identify existing students to remove (role: 'STUDENT')
  const existingStudents = await prisma.student.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, jntuNo: true },
  });
  console.log(`Identified ${existingStudents.length} old student/test records for removal.`);
  const studentIds = existingStudents.map((s) => s.id);

  // 2. Perform atomic operations
  await prisma.$transaction(async (tx) => {
    // A. Remove student-related dependent records
    if (studentIds.length > 0) {
      console.log('Removing student dependent records...');
      await tx.session.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.outingRequest.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.messToken.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.messIndent.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.messAttendance.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.leaveRequest.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.suspension.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.notification.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.activityLog.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.biometricEvent.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.roomAllocation.deleteMany({ where: { studentId: { in: studentIds } } });

      // Guest visits & related
      const guestVisits = await tx.guestVisit.findMany({
        where: { hostStudentId: { in: studentIds } },
        select: { id: true },
      });
      const gvIds = guestVisits.map((v) => v.id);
      if (gvIds.length > 0) {
        const guestBills = await tx.guestBill.findMany({
          where: { guestVisitId: { in: gvIds } },
          select: { id: true },
        });
        const gbIds = guestBills.map((b) => b.id);
        if (gbIds.length > 0) {
          await tx.billingItem.deleteMany({ where: { guestBillId: { in: gbIds } } });
          await tx.guestPayment.deleteMany({ where: { guestBillId: { in: gbIds } } });
          await tx.guestBill.deleteMany({ where: { id: { in: gbIds } } });
        }
        await tx.guestVisit.deleteMany({ where: { id: { in: gvIds } } });
      }

      // Fees & related
      await tx.feeRefund.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.feeReceipt.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.paymentAllocation.deleteMany({
        where: { feeItem: { studentId: { in: studentIds } } },
      });
      await tx.feePayment.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.feeItem.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.studentScholarship.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.detention.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.hostelApplication.deleteMany({ where: { studentId: { in: studentIds } } });

      // Delete the student records
      await tx.student.deleteMany({ where: { id: { in: studentIds } } });
      console.log(`Successfully removed ${studentIds.length} old student records.`);
    }

    // B. Clean up old rooms and empty blocks
    // First, delete any remaining room allocations
    await tx.roomAllocation.deleteMany({});

    // Find the single canonical Block to anchor the hostel structure
    let canonicalBlock = await tx.block.findFirst({
      where: { code: 'BH-1' },
    });
    if (!canonicalBlock) {
      canonicalBlock = await tx.block.findFirst({
        where: { status: 'ACTIVE' },
      });
    }

    if (!canonicalBlock) {
      canonicalBlock = await tx.block.create({
        data: {
          name: 'Alliance Hostel',
          code: 'HOSTEL-MAIN',
          description: 'Alliance College of Management Hostel (Ground + 3 Floors)',
          status: 'ACTIVE',
          collegeCode: 'ACM-01',
        },
      });
    } else {
      canonicalBlock = await tx.block.update({
        where: { id: canonicalBlock.id },
        data: {
          name: 'Alliance Hostel',
          description: 'Alliance College of Management Hostel (Ground + 3 Floors)',
          status: 'ACTIVE',
        },
      });
    }
    console.log(`Canonical Hostel Block selected: ${canonicalBlock.name} (${canonicalBlock.id})`);

    // Delete all existing rooms that belong to other blocks
    await tx.room.deleteMany({
      where: { blockId: { not: canonicalBlock.id } },
    });
    console.log('Cleaned up rooms from unused blocks.');

    // Delete all unused/empty blocks
    const deletedBlocks = await tx.block.deleteMany({
      where: { id: { not: canonicalBlock.id } },
    });
    console.log(`Removed ${deletedBlocks.count} unused/empty block records.`);

    // C. Upsert the 19 authoritative rooms in the canonical Hostel block
    const allExpectedRooms = [];
    for (const fg of FLOOR_PLANS) {
      for (const r of fg.rooms) {
        allExpectedRooms.push(r.roomNumber);
      }
    }

    // Delete any rooms in canonicalBlock not in the 19 expected rooms
    await tx.room.deleteMany({
      where: {
        blockId: canonicalBlock.id,
        roomNumber: { notIn: allExpectedRooms },
      },
    });

    const roomRecordMap = new Map();

    for (const fg of FLOOR_PLANS) {
      for (const r of fg.rooms) {
        const roomRecord = await tx.room.upsert({
          where: {
            blockId_roomNumber: {
              blockId: canonicalBlock.id,
              roomNumber: r.roomNumber,
            },
          },
          update: {
            floor: fg.floor,
            capacity: r.capacity,
            roomType: r.roomType,
            status: 'ACTIVE',
          },
          create: {
            blockId: canonicalBlock.id,
            roomNumber: r.roomNumber,
            floor: fg.floor,
            capacity: r.capacity,
            roomType: r.roomType,
            status: 'ACTIVE',
          },
        });
        roomRecordMap.set(r.roomNumber, roomRecord);
        console.log(`✓ Room ${r.roomNumber}: Floor ${fg.floor}, Capacity ${r.capacity}`);
      }
    }

    // D. Insert the 76 Real Students and create Room Allocations
    let totalImported = 0;
    let studentSequence = 1;

    for (const fg of FLOOR_PLANS) {
      for (const r of fg.rooms) {
        const roomRecord = roomRecordMap.get(r.roomNumber);
        let bedIndex = 1;

        for (const studentName of r.students) {
          const jntuNo = `26ACM${r.roomNumber}${String(bedIndex).padStart(2, '0')}`;
          const cleanEmailName = studentName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '.')
            .replace(/\.+/g, '.')
            .replace(/^\.|\.$/g, '');
          const email = `${cleanEmailName}.${studentSequence}@hostel.alliance.edu.in`;

          const createdStudent = await tx.student.create({
            data: {
              name: studentName,
              jntuNo,
              email,
              passwordHash,
              role: 'STUDENT',
              allocationStatus: 'ALLOCATED',
              blockName: canonicalBlock.name,
              floorName: String(fg.floor),
              roomNumber: r.roomNumber,
              bedNumber: `Bed-${bedIndex}`,
              roomType: r.roomType,
              roomCapacity: r.capacity,
              allocatedAt: new Date(),
              collegeCode: 'ACM-01',
              monthlyOutingMax: 5,
              isActive: true,
            },
          });

          await tx.roomAllocation.create({
            data: {
              roomId: roomRecord.id,
              studentId: createdStudent.id,
              bedNumber: `Bed-${bedIndex}`,
              status: 'ACTIVE',
              allocatedAt: new Date(),
            },
          });

          totalImported++;
          studentSequence++;
          bedIndex++;
        }
      }
    }

    console.log(`Successfully created and allocated ${totalImported} real students across 19 rooms.`);
  });

  console.log('===============================================================');
  console.log('TRANSACTION COMMITTED SUCCESSFULLY!');
  console.log('===============================================================');

  // 3. Verification Queries
  const finalStudentsCount = await prisma.student.count({ where: { role: 'STUDENT' } });
  const finalStaffCount = await prisma.student.count({ where: { role: { not: 'STUDENT' } } });
  const finalRooms = await prisma.room.findMany({
    include: {
      allocations: { where: { status: 'ACTIVE' }, include: { student: true } },
      block: true,
    },
    orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
  });
  const finalBlocks = await prisma.block.findMany();

  console.log('\n--- VERIFICATION AUDIT ---');
  console.log(`Active Blocks Count: ${finalBlocks.length} (${finalBlocks.map((b) => b.name).join(', ')})`);
  console.log(`Total Configured Rooms: ${finalRooms.length}`);
  console.log(`Total Real Students: ${finalStudentsCount}`);
  console.log(`Total Preserved Staff/Admin Accounts: ${finalStaffCount}`);

  for (const r of finalRooms) {
    console.log(
      `Floor ${r.floor} | Room ${r.roomNumber} | Capacity: ${r.capacity} | Occupants: ${r.allocations.length}/${r.capacity} -> [${r.allocations.map((a) => a.student.name).join(', ')}]`
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
