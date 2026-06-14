const express = require('express');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const Expense = require('../models/Expense');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/groups — list all groups the logged-in user belongs to
// ---------------------------------------------------------------------------
router.get('/', auth, async (req, res, next) => {
  try {
    // Find all group IDs for this user
    const groupIds = await GroupMember.findGroupIdsByUser(req.user.userId);

    const groups = await Group.findByIds(groupIds);

    // Attach member count and expense count to each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const memberCount = await GroupMember.countByGroup(group.id);
        const expenseCount = await Expense.countByGroup(group.id);
        return { ...group, memberCount, expenseCount };
      })
    );

    res.json({ groups: groupsWithCounts });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups — create a new group
// ---------------------------------------------------------------------------
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const group = await Group.createGroup(
      name.trim(),
      description?.trim() || '',
      req.user.userId
    );

    // Auto-add the creator as a member with today as join date
    await GroupMember.create({
      groupId: group.id,
      userId: req.user.userId,
      joinDate: new Date(),
      addedBy: req.user.userId,
    });

    const populated = await Group.findById(group.id);

    res.status(201).json({ group: populated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:id — get group detail with members
// ---------------------------------------------------------------------------
router.get('/:id', auth, async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const members = await GroupMember.getAllMembers(group.id);

    res.json({ group, members });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/groups/:id — update group name/description
// ---------------------------------------------------------------------------
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();

    const updatedGroup = await Group.updateGroup(group.id, updates);

    res.json({ group: updatedGroup });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups/:id/members — add a member to the group
// ---------------------------------------------------------------------------
router.post('/:id/members', auth, async (req, res, next) => {
  try {
    const { userId, email, name, joinDate } = req.body;

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    let targetUserId = userId;

    // If userId not provided, look up by email or create a placeholder user
    if (!targetUserId && email) {
      let user = await User.findByEmail(email.toLowerCase().trim());
      if (!user && name) {
        // Create a user account (they can set password later)
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(12);
        const tempHash = await bcrypt.hash('changeme123', salt);
        user = await User.createUser(
          name.trim(),
          email.toLowerCase().trim(),
          tempHash
        );
      }
      if (!user) {
        return res
          .status(400)
          .json({ message: 'Provide a valid userId or email (+ name) to add' });
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return res.status(400).json({ message: 'userId or email is required' });
    }

    // Check if already a member
    const existing = await GroupMember.findByGroupAndUser(group.id, targetUserId);
    if (existing) {
      return res.status(409).json({ message: 'User is already a member of this group' });
    }

    const member = await GroupMember.create({
      groupId: group.id,
      userId: targetUserId,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      addedBy: req.user.userId,
    });

    const populated = await GroupMember.findMemberById(member.id);

    res.status(201).json({ member: populated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/groups/:id/members/:userId — update a member (e.g., set leaveDate)
// ---------------------------------------------------------------------------
router.put('/:id/members/:userId', auth, async (req, res, next) => {
  try {
    const { leaveDate, joinDate } = req.body;

    const member = await GroupMember.findByGroupAndUser(req.params.id, req.params.userId);

    if (!member) {
      return res.status(404).json({ message: 'Member not found in this group' });
    }

    const updates = {};
    if (leaveDate !== undefined) {
      updates.leaveDate = leaveDate;
    }
    if (joinDate !== undefined) {
      updates.joinDate = joinDate;
    }

    await GroupMember.updateMember(req.params.id, req.params.userId, updates);

    const populated = await GroupMember.findMemberById(member.id);

    res.json({ member: populated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
