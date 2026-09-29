import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma, Decimal } from '../src/lib/prisma.js';

async function main() {
  console.log('🌱 Starting database seeding for Khata Management System...\n');

  // ১. আগের ডামি ডেটা পরিষ্কার করা (সঠিক ক্রমানুসারে যাতে ফরেন কি কনস্ট্রেইন্ট ভায়োলেট না হয়)
  console.log('🧹 Cleaning existing data...');
  await prisma.paymentItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.khata.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subjectPricing.deleteMany();
  await prisma.academicClass.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.writer.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Cleaned existing data.\n');

  // ২. ইউজার তৈরি (Roles: SUPER_ADMIN, ADMIN, MANAGER)
  // সব ইউজারের ডিফল্ট পাসওয়ার্ড: "Password123!"
  const defaultPassword = await bcrypt.hash('Password123!', 10);

  console.log('👤 Seeding users...');
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Shipon Ahmed (Super Admin)',
      email: 'superadmin@khata.com',
      password: defaultPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Tanvir Hossain (System Admin)',
      email: 'admin@khata.com',
      password: defaultPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const managerDhaka = await prisma.user.create({
    data: {
      name: 'Rafiqul Islam (Manager Dhaka)',
      email: 'manager.dhaka@khata.com',
      password: defaultPassword,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const managerCtg = await prisma.user.create({
    data: {
      name: 'Nasir Uddin (Manager Chattogram)',
      email: 'manager.ctg@khata.com',
      password: defaultPassword,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const testUser = await prisma.user.create({
    data: {
      name: 'Demo Admin',
      email: 'demo@khata.com',
      password: defaultPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Users seeded successfully.\n');

  // ৩. ব্রাঞ্চ তৈরি
  console.log('🏢 Seeding branches...');
  const branchDhaka = await prisma.branch.create({
    data: {
      name: 'Dhaka Central Branch',
      address: 'House 42, Road 7, Dhanmondi, Dhaka-1205',
      phone: '01711000001',
      isActive: true,
    },
  });

  const branchMirpur = await prisma.branch.create({
    data: {
      name: 'Mirpur Branch',
      address: 'Plot 18, Section 10, Mirpur, Dhaka',
      phone: '01711000002',
      isActive: true,
    },
  });

  const branchUttara = await prisma.branch.create({
    data: {
      name: 'Uttara Branch',
      address: 'Sector 7, Road 12, Uttara, Dhaka',
      phone: '01711000003',
      isActive: true,
    },
  });

  const branchChattogram = await prisma.branch.create({
    data: {
      name: 'Chattogram Main Branch',
      address: 'GEC Circle, Nasirabad, Chattogram',
      phone: '01811000001',
      isActive: true,
    },
  });

  const branchRajshahi = await prisma.branch.create({
    data: {
      name: 'Rajshahi Branch',
      address: 'Shaheb Bazar, Rajshahi',
      phone: '01911000001',
      isActive: true,
    },
  });

  const branchKhulna = await prisma.branch.create({
    data: {
      name: 'Khulna Branch',
      address: 'Shibbari More, Khulna',
      phone: '01611000001',
      isActive: true,
    },
  });

  const branchSylhet = await prisma.branch.create({
    data: {
      name: 'Sylhet Branch',
      address: 'Zindabazar, Sylhet',
      phone: '01511000001',
      isActive: true,
    },
  });
  console.log('✅ Branches seeded successfully.\n');

  // ৪. লেখক (Writers) তৈরি
  console.log('✍️ Seeding writers...');
  const writer1 = await prisma.writer.create({
    data: {
      name: 'Md. Tanvir Hasan',
      phone: '01722000001',
      email: 'tanvir.writer@gmail.com',
      district: 'Dhaka',
      branchId: branchDhaka.id,
      ratePerKhata: new Decimal('25.00'),
      isActive: true,
    },
  });

  const writer2 = await prisma.writer.create({
    data: {
      name: 'Sadia Islam',
      phone: '01722000002',
      email: 'sadia.writer@gmail.com',
      district: 'Dhaka',
      branchId: branchMirpur.id,
      ratePerKhata: new Decimal('22.00'),
      isActive: true,
    },
  });

  const writer3 = await prisma.writer.create({
    data: {
      name: 'Rakib Hossain',
      phone: '01722000003',
      email: 'rakib.writer@gmail.com',
      district: 'Dhaka',
      branchId: branchUttara.id,
      ratePerKhata: new Decimal('20.00'),
      isActive: true,
    },
  });

  const writer4 = await prisma.writer.create({
    data: {
      name: 'Nusrat Jahan',
      phone: '01822000001',
      email: 'nusrat.writer@gmail.com',
      district: 'Chattogram',
      branchId: branchChattogram.id,
      ratePerKhata: new Decimal('24.00'),
      isActive: true,
    },
  });

  const writer5 = await prisma.writer.create({
    data: {
      name: 'Arifur Rahman',
      phone: '01922000001',
      email: 'arif.writer@gmail.com',
      district: 'Rajshahi',
      branchId: branchRajshahi.id,
      ratePerKhata: new Decimal('20.00'),
      isActive: true,
    },
  });

  const writer6 = await prisma.writer.create({
    data: {
      name: 'Khadija Akter',
      phone: '01622000001',
      email: 'khadija.writer@gmail.com',
      district: 'Khulna',
      branchId: branchKhulna.id,
      ratePerKhata: new Decimal('22.00'),
      isActive: true,
    },
  });

  const writer7 = await prisma.writer.create({
    data: {
      name: 'Mahfuz Ahmed',
      phone: '01522000001',
      email: 'mahfuz.writer@gmail.com',
      district: 'Sylhet',
      branchId: branchSylhet.id,
      ratePerKhata: new Decimal('25.00'),
      isActive: true,
    },
  });

  const writer8 = await prisma.writer.create({
    data: {
      name: 'Shamim Reza',
      phone: '01722000004',
      email: 'shamim.writer@gmail.com',
      district: 'Bogura',
      branchId: branchRajshahi.id,
      ratePerKhata: new Decimal('18.00'),
      isActive: true,
    },
  });
  console.log('✅ Writers seeded successfully.\n');

  // ৫. স্টক মুভমেন্ট তৈরি (Stock Ledger)
  console.log('📦 Seeding stocks...');
  // ঢাকা ব্রাঞ্চ: রিসিভ ২০০০, ডিস্ট্রিবিউট ৫০০, রিটার্ন ১০০ -> কারেন্ট ১৬০০
  await prisma.stock.createMany({
    data: [
      {
        branchId: branchDhaka.id,
        type: 'RECEIVED',
        quantity: 2000,
        receivedQty: 2000,
        distributedQty: 0,
        returnedQty: 0,
        currentQty: 2000,
        note: 'Central Press batch 2026-A arrival',
        recordDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        branchId: branchDhaka.id,
        type: 'DISTRIBUTED',
        quantity: 500,
        receivedQty: 2000,
        distributedQty: 500,
        returnedQty: 0,
        currentQty: 1500,
        note: 'Distributed to writers for HSC batch',
        recordDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
      {
        branchId: branchDhaka.id,
        type: 'RETURNED',
        quantity: 100,
        receivedQty: 2000,
        distributedQty: 500,
        returnedQty: 100,
        currentQty: 1600,
        note: 'Completed khatas returned to branch storage',
        recordDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      // মিরপুর ব্রাঞ্চ: রিসিভ ১২০০, ডিস্ট্রিবিউট ৩০০ -> কারেন্ট ৯০০
      {
        branchId: branchMirpur.id,
        type: 'RECEIVED',
        quantity: 1200,
        receivedQty: 1200,
        distributedQty: 0,
        returnedQty: 0,
        currentQty: 1200,
        note: 'Initial batch allocation',
        recordDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      },
      {
        branchId: branchMirpur.id,
        type: 'DISTRIBUTED',
        quantity: 300,
        receivedQty: 1200,
        distributedQty: 300,
        returnedQty: 0,
        currentQty: 900,
        note: 'Distributed to Sadia and team',
        recordDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      },
      // চট্টগ্রাম ব্রাঞ্চ: রিসিভ ১৫০০, ডিস্ট্রিবিউট ৪০০ -> কারেন্ট ১১০০
      {
        branchId: branchChattogram.id,
        type: 'RECEIVED',
        quantity: 1500,
        receivedQty: 1500,
        distributedQty: 0,
        returnedQty: 0,
        currentQty: 1500,
        note: 'Chattogram regional allocation',
        recordDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
      },
      {
        branchId: branchChattogram.id,
        type: 'DISTRIBUTED',
        quantity: 400,
        receivedQty: 1500,
        distributedQty: 400,
        returnedQty: 0,
        currentQty: 1100,
        note: 'Distributed for Chattogram college orders',
        recordDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      // রাজশাহী ব্রাঞ্চ
      {
        branchId: branchRajshahi.id,
        type: 'RECEIVED',
        quantity: 1000,
        receivedQty: 1000,
        distributedQty: 0,
        returnedQty: 0,
        currentQty: 1000,
        note: 'Stock received for Rajshahi division',
        recordDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
      // খুলনা ব্রাঞ্চ
      {
        branchId: branchKhulna.id,
        type: 'RECEIVED',
        quantity: 800,
        receivedQty: 800,
        distributedQty: 0,
        returnedQty: 0,
        currentQty: 800,
        note: 'Khulna division initial batch',
        recordDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log('✅ Stocks seeded successfully.\n');

  // ৬. ক্লাস, সাবজেক্ট ও সাবজেক্ট প্রাইসিং তৈরি
  console.log('🏫 Seeding Academic Classes...');
  const classJSC = await prisma.academicClass.create({
    data: {
      name: 'JSC',
      displayOrder: 1,
      isActive: true,
    },
  });

  const classSSC = await prisma.academicClass.create({
    data: {
      name: 'SSC',
      displayOrder: 2,
      isActive: true,
    },
  });

  const classHSC = await prisma.academicClass.create({
    data: {
      name: 'HSC',
      displayOrder: 3,
      isActive: true,
    },
  });

  console.log('📖 Seeding Subjects...');
  const subPhysics = await prisma.subject.create({
    data: { name: 'Physics', isActive: true },
  });

  const subChemistry = await prisma.subject.create({
    data: { name: 'Chemistry', isActive: true },
  });

  const subBiology = await prisma.subject.create({
    data: { name: 'Biology', isActive: true },
  });

  const subHigherMath = await prisma.subject.create({
    data: { name: 'Higher Mathematics', isActive: true },
  });

  const subScience = await prisma.subject.create({
    data: { name: 'General Science', isActive: true },
  });

  const subICT = await prisma.subject.create({
    data: { name: 'ICT', isActive: true },
  });

  console.log('📚 Seeding Subject Pricing...');
  const pricingPhysicsHSC = await prisma.subjectPricing.create({
    data: {
      classId: classHSC.id,
      subjectId: subPhysics.id,
      pricePerKhata: new Decimal('120.00'),
      isActive: true,
    },
  });

  const pricingChemistryHSC = await prisma.subjectPricing.create({
    data: {
      classId: classHSC.id,
      subjectId: subChemistry.id,
      pricePerKhata: new Decimal('120.00'),
      isActive: true,
    },
  });

  const pricingBiologyHSC = await prisma.subjectPricing.create({
    data: {
      classId: classHSC.id,
      subjectId: subBiology.id,
      pricePerKhata: new Decimal('130.00'),
      isActive: true,
    },
  });

  const pricingMathHSC = await prisma.subjectPricing.create({
    data: {
      classId: classHSC.id,
      subjectId: subHigherMath.id,
      pricePerKhata: new Decimal('110.00'),
      isActive: true,
    },
  });

  const pricingPhysicsSSC = await prisma.subjectPricing.create({
    data: {
      classId: classSSC.id,
      subjectId: subPhysics.id,
      pricePerKhata: new Decimal('90.00'),
      isActive: true,
    },
  });

  const pricingChemistrySSC = await prisma.subjectPricing.create({
    data: {
      classId: classSSC.id,
      subjectId: subChemistry.id,
      pricePerKhata: new Decimal('90.00'),
      isActive: true,
    },
  });

  const pricingBiologySSC = await prisma.subjectPricing.create({
    data: {
      classId: classSSC.id,
      subjectId: subBiology.id,
      pricePerKhata: new Decimal('95.00'),
      isActive: true,
    },
  });

  const pricingMathSSC = await prisma.subjectPricing.create({
    data: {
      classId: classSSC.id,
      subjectId: subHigherMath.id,
      pricePerKhata: new Decimal('85.00'),
      isActive: true,
    },
  });

  const pricingScienceJSC = await prisma.subjectPricing.create({
    data: {
      classId: classJSC.id,
      subjectId: subScience.id,
      pricePerKhata: new Decimal('75.00'),
      isActive: true,
    },
  });

  const pricingICTHSC = await prisma.subjectPricing.create({
    data: {
      classId: classHSC.id,
      subjectId: subICT.id,
      pricePerKhata: new Decimal('100.00'),
      isActive: true,
    },
  });
  console.log('✅ Academic Classes, Subjects & Pricing seeded successfully.\n');

  // ৭. খাতা তৈরি (Khatas - General Batches)
  console.log('📝 Seeding Khatas...');
  // ব্যাচ ১: তানভীর হাসান - ১০০ রিসিভড, ১০০ সাবমিটেড (কমপ্লিটেড)
  const khata1 = await prisma.khata.create({
    data: {
      batchNumber: 'BATCH-2026-001',
      branchId: branchDhaka.id,
      writerId: writer1.id,
      receivedQty: 100,
      submittedQty: 100,
      status: 'COMPLETED',
      distributedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
  });

  // ব্যাচ ২: তানভীর হাসান - ৮০ রিসিভড, ৪০ সাবমিটেড (আংশিক সাবমিটেড)
  const khata2 = await prisma.khata.create({
    data: {
      batchNumber: 'BATCH-2026-002',
      branchId: branchDhaka.id,
      writerId: writer1.id,
      receivedQty: 80,
      submittedQty: 40,
      status: 'PARTIALLY_SUBMITTED',
      distributedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });

  // ব্যাচ ৩: সাদিয়া ইসলাম - ১২০ রিসিভড, ১২০ সাবমিটেড (কমপ্লিটেড)
  const khata3 = await prisma.khata.create({
    data: {
      batchNumber: 'BATCH-2026-003',
      branchId: branchMirpur.id,
      writerId: writer2.id,
      receivedQty: 120,
      submittedQty: 120,
      status: 'COMPLETED',
      distributedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  // ব্যাচ ৪: রাকিব হোসেন - ৬০ রিসিভড, ০ সাবমিটেড (ডিস্ট্রিবিউটেড)
  const khata4 = await prisma.khata.create({
    data: {
      batchNumber: 'BATCH-2026-004',
      branchId: branchUttara.id,
      writerId: writer3.id,
      receivedQty: 60,
      submittedQty: 0,
      status: 'DISTRIBUTED',
      distributedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });

  // ব্যাচ ৫: নুসরাত জাহান - ১৫০ রিসিভড, ৯০ সাবমিটেড (আংশিক সাবমিটেড)
  const khata5 = await prisma.khata.create({
    data: {
      batchNumber: 'BATCH-2026-005',
      branchId: branchChattogram.id,
      writerId: writer4.id,
      receivedQty: 150,
      submittedQty: 90,
      status: 'PARTIALLY_SUBMITTED',
      distributedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    },
  });

  // ব্যাচ ৬: আরিফুর রহমান - ৭৫ রিসিভড, ৭৫ সাবমিটেড (কমপ্লিটেড)
  const khata6 = await prisma.khata.create({
    data: {
      batchNumber: 'BATCH-2026-006',
      branchId: branchRajshahi.id,
      writerId: writer5.id,
      receivedQty: 75,
      submittedQty: 75,
      status: 'COMPLETED',
      distributedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // ব্যাচ ৭: খাদিজা আক্তার - ৫০ রিসিভড, ২৫ সাবমিটেড (আংশিক সাবমিটেড)
  const khata7 = await prisma.khata.create({
    data: {
      batchNumber: 'BATCH-2026-007',
      branchId: branchKhulna.id,
      writerId: writer6.id,
      receivedQty: 50,
      submittedQty: 25,
      status: 'PARTIALLY_SUBMITTED',
      distributedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('✅ Khatas seeded successfully.\n');

  // ৮. পেমেন্ট ও পেমেন্ট আইটেম তৈরি
  console.log('💰 Seeding Payments...');
  // পেমেন্ট ১: তানভীর হাসান (BATCH-2026-001: 100 খাতা * 25 রেট = 2500 টাকা) - সম্পূর্ণ পেইড
  const payment1 = await prisma.payment.create({
    data: {
      writerId: writer1.id,
      khataId: khata1.id,
      amount: new Decimal('2500.00'),
      paidAmount: new Decimal('2500.00'),
      dueAmount: new Decimal('0.00'),
      status: 'PAID',
      paymentDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.paymentItem.create({
    data: {
      paymentId: payment1.id,
      khataId: khata1.id,
      amount: new Decimal('2500.00'),
      note: 'Full settlement for BATCH-2026-001 (100 khatas)',
    },
  });

  // পেমেন্ট ২: সাদিয়া ইসলাম (BATCH-2026-003: 120 খাতা * 22 রেট = 2640 টাকা) - সম্পূর্ণ পেইড
  const payment2 = await prisma.payment.create({
    data: {
      writerId: writer2.id,
      khataId: khata3.id,
      amount: new Decimal('2640.00'),
      paidAmount: new Decimal('2640.00'),
      dueAmount: new Decimal('0.00'),
      status: 'PAID',
      paymentDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.paymentItem.create({
    data: {
      paymentId: payment2.id,
      khataId: khata3.id,
      amount: new Decimal('2640.00'),
      note: 'Full payment for BATCH-2026-003 (120 khatas)',
    },
  });

  // পেমেন্ট ৩: তানভীর হাসান (BATCH-2026-002: 40 খাতা জমা * 25 = 1000 টাকা বিল, পেইড 600, ডিউ 400) - PARTIAL
  const payment3 = await prisma.payment.create({
    data: {
      writerId: writer1.id,
      khataId: khata2.id,
      amount: new Decimal('1000.00'),
      paidAmount: new Decimal('600.00'),
      dueAmount: new Decimal('400.00'),
      status: 'PARTIAL',
      paymentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.paymentItem.create({
    data: {
      paymentId: payment3.id,
      khataId: khata2.id,
      amount: new Decimal('600.00'),
      note: 'Partial advance against 40 submitted khatas',
    },
  });

  // পেমেন্ট ৪: নুসরাত জাহান (BATCH-2026-005: 90 জমা * 24 = 2160 টাকা) - সম্পূর্ণ ডিউ (DUE)
  await prisma.payment.create({
    data: {
      writerId: writer4.id,
      khataId: khata5.id,
      amount: new Decimal('2160.00'),
      paidAmount: new Decimal('0.00'),
      dueAmount: new Decimal('2160.00'),
      status: 'DUE',
      paymentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  // পেমেন্ট ৫: আরিফুর রহমান (BATCH-2026-006: 75 খাতা * 20 = 1500 টাকা) - সম্পূর্ণ পেইড
  const payment5 = await prisma.payment.create({
    data: {
      writerId: writer5.id,
      khataId: khata6.id,
      amount: new Decimal('1500.00'),
      paidAmount: new Decimal('1500.00'),
      dueAmount: new Decimal('0.00'),
      status: 'PAID',
      paymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.paymentItem.create({
    data: {
      paymentId: payment5.id,
      khataId: khata6.id,
      amount: new Decimal('1500.00'),
      note: 'Full settlement for BATCH-2026-006',
    },
  });
  console.log('✅ Payments seeded successfully.\n');

  // ৯. পাবলিক ও অ্যাডমিন অর্ডার (Orders - various workflows & statuses)
  console.log('🛒 Seeding Orders & Khata Assignments...');

  // অর্ডার ১: DELIVERED (১টি খাতা, ক্যাশ কালেকশন শেষ)
  const order1 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-0001',
      customerName: 'Ahsan Habib',
      customerPhone: '01712345678',
      customerAddress: 'House 14, Road 5, Dhanmondi, Dhaka',
      subjectPricingId: pricingPhysicsHSC.id,
      quantity: 1,
      unitPrice: new Decimal('120.00'),
      totalAmount: new Decimal('120.00'),
      preferredDistrict: 'Dhaka',
      preferredWriterId: writer1.id,
      status: 'DELIVERED',
      paymentStatus: 'COLLECTED',
      deliveryPersonName: 'Kamal Hossain',
      orderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // অর্ডার ১ এর জন্য অ্যাসাইনকৃত খাতা
  await prisma.khata.create({
    data: {
      batchNumber: 'ORD-2026-0001-A1',
      branchId: branchDhaka.id,
      writerId: writer1.id,
      receivedQty: 1,
      submittedQty: 1,
      status: 'COMPLETED',
      orderId: order1.id,
      distributedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
  });

  // অর্ডার ২: OUT_FOR_DELIVERY (৫টি খাতা, ডেলিভারির জন্য বের হয়েছে)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-0002',
      customerName: 'Fahmida Yeasmin',
      customerPhone: '01812345678',
      customerAddress: 'Nasirabad Housing Society, Chattogram',
      subjectPricingId: pricingChemistryHSC.id,
      quantity: 5,
      unitPrice: new Decimal('120.00'),
      totalAmount: new Decimal('600.00'),
      preferredDistrict: 'Chattogram',
      status: 'OUT_FOR_DELIVERY',
      paymentStatus: 'PENDING',
      deliveryPersonName: 'Shafiqul Islam',
      orderDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.khata.create({
    data: {
      batchNumber: 'ORD-2026-0002-A1',
      branchId: branchChattogram.id,
      writerId: writer4.id,
      receivedQty: 5,
      submittedQty: 5,
      status: 'COMPLETED',
      orderId: order2.id,
      distributedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // অর্ডার ৩: IN_PROGRESS (২টি খাতা, রাইটার লিখছেন)
  const order3 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-0003',
      customerName: 'Mahmudul Hasan',
      customerPhone: '01912345678',
      customerAddress: 'Kazihata Main Road, Rajshahi',
      subjectPricingId: pricingMathHSC.id,
      quantity: 2,
      unitPrice: new Decimal('110.00'),
      totalAmount: new Decimal('220.00'),
      preferredDistrict: 'Rajshahi',
      status: 'IN_PROGRESS',
      paymentStatus: 'PENDING',
      orderDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.khata.create({
    data: {
      batchNumber: 'ORD-2026-0003-A1',
      branchId: branchRajshahi.id,
      writerId: writer5.id,
      receivedQty: 2,
      submittedQty: 1, // ১টি লেখা শেষ
      status: 'PARTIALLY_SUBMITTED',
      orderId: order3.id,
      distributedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  // অর্ডার ৪: ASSIGNED (৪টি খাতা স্প্লিট অ্যাসাইনমেন্ট: ২টা খাদিজা, ২টা সাদিয়া)
  const order4 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-0004',
      customerName: 'Tariqul Islam',
      customerPhone: '01612345678',
      customerAddress: 'Boyra Main Road, Khulna',
      subjectPricingId: pricingBiologyHSC.id,
      quantity: 4,
      unitPrice: new Decimal('130.00'),
      totalAmount: new Decimal('520.00'),
      preferredDistrict: 'Khulna',
      status: 'ASSIGNED',
      paymentStatus: 'PENDING',
      orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      assignedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // স্প্লিট খাতা ১
  await prisma.khata.create({
    data: {
      batchNumber: 'ORD-2026-0004-A1',
      branchId: branchKhulna.id,
      writerId: writer6.id,
      receivedQty: 2,
      submittedQty: 0,
      status: 'DISTRIBUTED',
      orderId: order4.id,
      distributedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // স্প্লিট খাতা ২
  await prisma.khata.create({
    data: {
      batchNumber: 'ORD-2026-0004-A2',
      branchId: branchMirpur.id,
      writerId: writer2.id,
      receivedQty: 2,
      submittedQty: 0,
      status: 'DISTRIBUTED',
      orderId: order4.id,
      distributedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // অর্ডার ৫: CONFIRMED (১টি খাতা, অ্যাসাইনমেন্টের অপেক্ষায়)
  await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-0005',
      customerName: 'Sumaiya Akhter',
      customerPhone: '01798765432',
      customerAddress: 'Sector 11, Uttara, Dhaka',
      subjectPricingId: pricingPhysicsSSC.id,
      quantity: 1,
      unitPrice: new Decimal('90.00'),
      totalAmount: new Decimal('90.00'),
      preferredDistrict: 'Dhaka',
      status: 'CONFIRMED',
      paymentStatus: 'PENDING',
      orderDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      confirmedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  });

  // অর্ডার ৬: PENDING (নতুন অর্ডার এসেছে, কনফার্ম করা বাকি)
  await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-0006',
      customerName: 'Mehedi Hasan',
      customerPhone: '01512345678',
      customerAddress: 'Mirpur 1, Dhaka',
      subjectPricingId: pricingChemistrySSC.id,
      quantity: 3,
      unitPrice: new Decimal('90.00'),
      totalAmount: new Decimal('270.00'),
      preferredDistrict: 'Dhaka',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      orderDate: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
  });

  // অর্ডার ৭: CANCELLED (বাতিল অর্ডার)
  await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-0007',
      customerName: 'Rezaul Karim',
      customerPhone: '01755554433',
      customerAddress: 'Chawkbazar, Chattogram',
      subjectPricingId: pricingMathSSC.id,
      quantity: 2,
      unitPrice: new Decimal('85.00'),
      totalAmount: new Decimal('170.00'),
      preferredDistrict: 'Chattogram',
      status: 'CANCELLED',
      paymentStatus: 'PENDING',
      cancelReason: 'Customer requested cancellation due to exam schedule change',
      orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('✅ Orders & assignments seeded successfully.\n');

  // ১০. অডিট লগ তৈরি
  console.log('📋 Seeding Audit Logs...');
  await prisma.auditLog.createMany({
    data: [
      {
        userId: superAdmin.id,
        action: 'INITIALIZE_SYSTEM',
        entityType: 'System',
        entityId: 'SYSTEM-ROOT',
        details: { message: 'Initial system deployment and configuration' },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        userId: admin.id,
        action: 'CREATE_BRANCH',
        entityType: 'Branch',
        entityId: branchDhaka.id,
        details: { branchName: branchDhaka.name },
        createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
      },
      {
        userId: admin.id,
        action: 'CREATE_WRITER',
        entityType: 'Writer',
        entityId: writer1.id,
        details: { writerName: writer1.name, rate: 25 },
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      },
      {
        userId: admin.id,
        action: 'ASSIGN_ORDER',
        entityType: 'Order',
        entityId: order1.id,
        details: { orderNumber: order1.orderNumber, writerId: writer1.id },
        createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      },
      {
        userId: superAdmin.id,
        action: 'DELIVER_ORDER',
        entityType: 'Order',
        entityId: order1.id,
        details: { orderNumber: order1.orderNumber, status: 'DELIVERED', collected: 120 },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log('✅ Audit logs seeded successfully.\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 TEST LOGIN CREDENTIALS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Super Admin:');
  console.log('   Email:    superadmin@khata.com');
  console.log('   Password: Password123!');
  console.log('   Role:     SUPER_ADMIN');
  console.log('------------------------------------------------------------');
  console.log('2. System Admin:');
  console.log('   Email:    admin@khata.com');
  console.log('   Password: Password123!');
  console.log('   Role:     ADMIN');
  console.log('------------------------------------------------------------');
  console.log('3. Branch Manager (Dhaka):');
  console.log('   Email:    manager.dhaka@khata.com');
  console.log('   Password: Password123!');
  console.log('   Role:     MANAGER');
  console.log('------------------------------------------------------------');
  console.log('4. Demo Account:');
  console.log('   Email:    demo@khata.com');
  console.log('   Password: Password123!');
  console.log('   Role:     ADMIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
