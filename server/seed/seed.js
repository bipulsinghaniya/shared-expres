require('dotenv').config({ path: __dirname + '/../.env' });
const bcrypt = require('bcryptjs');
const { pool, initializeDatabase, query } = require('../database');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Expense = require('../models/Expense');

/**
 * Reset all database tables.
 */
async function clearDatabase() {
  console.log('🧹 Clearing existing data...');
  await query('TRUNCATE TABLE import_logs CASCADE');
  await query('TRUNCATE TABLE expense_splits CASCADE');
  await query('TRUNCATE TABLE expenses CASCADE');
  await query('TRUNCATE TABLE group_members CASCADE');
  await query('TRUNCATE TABLE groups CASCADE');
  await query('TRUNCATE TABLE users CASCADE');
  console.log('✅ Database cleared');
}

/**
 * Run the seed process.
 */
async function seedDatabase() {
  try {
    // 1. Ensure tables exist
    await initializeDatabase();
    
    // 2. Clear existing data
    await clearDatabase();

    console.log('🌱 Starting seed process...');

    // -------------------------------------------------------------------------
    // 3. Create Users
    // -------------------------------------------------------------------------
    console.log('Creating users...');
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    const usersData = [
      { name: 'Aisha Sharma', email: 'aisha@example.com' },
      { name: 'Rohan Gupta', email: 'rohan@example.com' },
      { name: 'Priya Patel', email: 'priya@example.com' },
      { name: 'Vikram Singh', email: 'vikram@example.com' },
      { name: 'Neha Desai', email: 'neha@example.com' },
    ];

    const users = [];
    for (const data of usersData) {
      const user = await User.createUser(data.name, data.email, defaultPassword);
      users.push(user);
    }
    console.log(`✅ Created ${users.length} users`);

    // -------------------------------------------------------------------------
    // 4. Create Group
    // -------------------------------------------------------------------------
    console.log('Creating group...');
    const group = await Group.createGroup(
      'Goa Trip 2024',
      'Expenses from our awesome trip to Goa',
      users[0].id // Aisha is the creator
    );
    console.log(`✅ Created group: ${group.name}`);

    // -------------------------------------------------------------------------
    // 5. Add Members to Group
    // -------------------------------------------------------------------------
    console.log('Adding members to group...');
    const baseDate = new Date();
    const joinDate = new Date(baseDate);
    joinDate.setDate(baseDate.getDate() - 30); // Joined 30 days ago

    for (const user of users) {
      await GroupMember.create({
        groupId: group.id,
        userId: user.id,
        joinDate: joinDate,
        addedBy: users[0].id,
      });
    }

    // Neha joined later
    const nehaJoinDate = new Date(baseDate);
    nehaJoinDate.setDate(baseDate.getDate() - 15);
    await GroupMember.updateMember(group.id, users[4].id, { joinDate: nehaJoinDate });

    console.log('✅ Added all 5 members to the group');

    // -------------------------------------------------------------------------
    // 6. Add Expenses
    // -------------------------------------------------------------------------
    console.log('Creating expenses...');

    // Expense 1: Flights (Paid by Rohan, Split equally among Aisha, Rohan, Priya, Vikram)
    // Note: Neha hadn't joined yet
    const flightDate = new Date(baseDate);
    flightDate.setDate(baseDate.getDate() - 25);
    
    await Expense.create({
      groupId: group.id,
      description: 'Flights to Goa',
      amount: 24000,
      currency: 'INR',
      amountInINR: 24000,
      exchangeRateUsed: 1,
      date: flightDate,
      paidBy: users[1].id, // Rohan
      splitType: 'EQUAL',
      splits: [
        { userId: users[0].id, amount: 6000 },
        { userId: users[1].id, amount: 6000 },
        { userId: users[2].id, amount: 6000 },
        { userId: users[3].id, amount: 6000 },
      ],
      isSettlement: false,
    });

    // Expense 2: Hotel (Paid by Aisha, Split equally among everyone including Neha)
    const hotelDate = new Date(baseDate);
    hotelDate.setDate(baseDate.getDate() - 14);

    await Expense.create({
      groupId: group.id,
      description: 'Airbnb booking',
      amount: 35000,
      currency: 'INR',
      amountInINR: 35000,
      exchangeRateUsed: 1,
      date: hotelDate,
      paidBy: users[0].id, // Aisha
      splitType: 'EQUAL',
      splits: users.map(u => ({ userId: u.id, amount: 7000 })),
      isSettlement: false,
    });

    // Expense 3: Dinner (Paid by Vikram, Exact split)
    const dinnerDate = new Date(baseDate);
    dinnerDate.setDate(baseDate.getDate() - 10);

    await Expense.create({
      groupId: group.id,
      description: 'Seafood dinner',
      amount: 4500,
      currency: 'INR',
      amountInINR: 4500,
      exchangeRateUsed: 1,
      date: dinnerDate,
      paidBy: users[3].id, // Vikram
      splitType: 'EXACT',
      splits: [
        { userId: users[0].id, amount: 1500 }, // Aisha
        { userId: users[1].id, amount: 1000 }, // Rohan
        { userId: users[3].id, amount: 2000 }, // Vikram
      ],
      isSettlement: false,
    });

    // Expense 4: Scooty Rental (Paid by Priya, Percentage split)
    const scootyDate = new Date(baseDate);
    scootyDate.setDate(baseDate.getDate() - 8);

    await Expense.create({
      groupId: group.id,
      description: 'Scooty rentals for 3 days',
      amount: 3000,
      currency: 'INR',
      amountInINR: 3000,
      exchangeRateUsed: 1,
      date: scootyDate,
      paidBy: users[2].id, // Priya
      splitType: 'PERCENTAGE',
      splits: [
        { userId: users[2].id, amount: 1500 }, // Priya (50%)
        { userId: users[3].id, amount: 1500 }, // Vikram (50%)
      ],
      isSettlement: false,
    });

    // Expense 5: Water Sports (Paid by Neha, Shares split)
    const sportsDate = new Date(baseDate);
    sportsDate.setDate(baseDate.getDate() - 5);

    await Expense.create({
      groupId: group.id,
      description: 'Scuba diving & Parasailing',
      amount: 10000,
      currency: 'INR',
      amountInINR: 10000,
      exchangeRateUsed: 1,
      date: sportsDate,
      paidBy: users[4].id, // Neha
      splitType: 'SHARES',
      splits: [
        { userId: users[0].id, amount: 4000 }, // Aisha (2 shares)
        { userId: users[1].id, amount: 4000 }, // Rohan (2 shares)
        { userId: users[4].id, amount: 2000 }, // Neha (1 share)
      ],
      isSettlement: false,
    });

    // -------------------------------------------------------------------------
    // 7. Add a Settlement
    // -------------------------------------------------------------------------
    console.log('Adding settlements...');
    
    const settlementDate = new Date();
    await Expense.create({
      groupId: group.id,
      description: 'Priya paid back Vikram',
      amount: 1500,
      currency: 'INR',
      amountInINR: 1500,
      exchangeRateUsed: 1,
      date: settlementDate,
      paidBy: users[2].id, // Priya pays
      splitType: 'EQUAL',
      splits: [
        { userId: users[3].id, amount: 1500 } // Vikram receives
      ],
      isSettlement: true,
    });

    console.log('✅ Created 5 expenses and 1 settlement');
    console.log('🎉 Database seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    // Close the connection pool
    await pool.end();
    process.exit(0);
  }
}

seedDatabase();
