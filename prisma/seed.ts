import { BookingSource, BookingStatus, MembershipEventType, MembershipStatus, PaymentStatus, PaymentType, Role, TaskStatus, TaskTriggerType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, addMonths, startOfWeek, subDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '../src/lib/prisma';

const TZ = 'America/Denver';
const now = new Date();

const daysAgo = (n: number): Date => fromZonedTime(subDays(now, n), TZ);
const daysFromNow = (n: number): Date => fromZonedTime(addDays(now, n), TZ);

async function main() {
  const passwordHash = await bcrypt.hash('changeme123', 12);

  // ── Users ─────────────────────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where: { email: 'admin@throw.studio' },
    update: { name: 'JohnPaul Ryan', phone: '+18015550001', role: Role.ADMIN, hashedPassword: passwordHash },
    create: { email: 'admin@throw.studio', name: 'JohnPaul Ryan', phone: '+18015550001', role: Role.ADMIN, hashedPassword: passwordHash },
  });

  const maya = await prisma.user.upsert({
    where: { email: 'maya@throw.studio' },
    update: { name: 'Maya Chen', phone: '+18015550002', role: Role.STAFF, hashedPassword: passwordHash },
    create: { email: 'maya@throw.studio', name: 'Maya Chen', phone: '+18015550002', role: Role.STAFF, hashedPassword: passwordHash },
  });

  const diego = await prisma.user.upsert({
    where: { email: 'diego@throw.studio' },
    update: { name: 'Diego Reyes', phone: '+18015550003', role: Role.STAFF, hashedPassword: passwordHash },
    create: { email: 'diego@throw.studio', name: 'Diego Reyes', phone: '+18015550003', role: Role.STAFF, hashedPassword: passwordHash },
  });

  const frontdesk = await prisma.user.upsert({
    where: { email: 'frontdesk@throw.studio' },
    update: { name: 'Alex Kim', phone: '+18015550004', role: Role.STAFF, hashedPassword: passwordHash },
    create: { email: 'frontdesk@throw.studio', name: 'Alex Kim', phone: '+18015550004', role: Role.STAFF, hashedPassword: passwordHash },
  });

  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@example.com' },
    update: { name: 'Sarah Thornton', phone: '+18015550010', hashedPassword: passwordHash },
    create: { email: 'sarah@example.com', name: 'Sarah Thornton', phone: '+18015550010', hashedPassword: passwordHash },
  });

  const mike = await prisma.user.upsert({
    where: { email: 'mike@example.com' },
    update: { name: 'Mike Navarro', phone: '+18015550011', hashedPassword: passwordHash },
    create: { email: 'mike@example.com', name: 'Mike Navarro', phone: '+18015550011', hashedPassword: passwordHash },
  });

  const priya = await prisma.user.upsert({
    where: { email: 'priya@example.com' },
    update: { name: 'Priya Patel', phone: '+18015550012', hashedPassword: passwordHash },
    create: { email: 'priya@example.com', name: 'Priya Patel', phone: '+18015550012', hashedPassword: passwordHash },
  });

  const jordan = await prisma.user.upsert({
    where: { email: 'jordan@example.com' },
    update: { name: 'Jordan Wells', phone: '+18015550013', hashedPassword: passwordHash },
    create: { email: 'jordan@example.com', name: 'Jordan Wells', phone: '+18015550013', hashedPassword: passwordHash },
  });

  const claire = await prisma.user.upsert({
    where: { email: 'claire@example.com' },
    update: { name: 'Claire Dubois', phone: '+18015550014', hashedPassword: passwordHash },
    create: { email: 'claire@example.com', name: 'Claire Dubois', phone: '+18015550014', hashedPassword: passwordHash },
  });

  // ── Location ──────────────────────────────────────────────────────────────────
  // Location has no unique constraint on name, so we findFirst + update-or-create.

  let location = await prisma.location.findFirst({ where: { name: 'Throw Art Studio' } });
  if (location) {
    location = await prisma.location.update({
      where: { id: location.id },
      data: { address: '123 Center Street, Provo, UT 84601', timezone: 'America/Denver', isActive: true },
    });
  } else {
    location = await prisma.location.create({
      data: {
        name: 'Throw Art Studio',
        address: '123 Center Street, Provo, UT 84601',
        timezone: 'America/Denver',
        isActive: true,
      },
    });
  }

  // ── Staff Roles ───────────────────────────────────────────────────────────────
  // StaffRole has no unique constraint on (name, locationId), so we findFirst + update-or-create.

  async function upsertStaffRole(name: string, permissions: Record<string, boolean>) {
    const existing = await prisma.staffRole.findFirst({ where: { name, locationId: location!.id } });
    if (existing) {
      return prisma.staffRole.update({ where: { id: existing.id }, data: { permissions } });
    }
    return prisma.staffRole.create({ data: { name, locationId: location!.id, permissions } });
  }

  const managerRole = await upsertStaffRole('Manager', {
    canViewTips: true,
    canViewMembershipReporting: true,
    canViewBilling: false,
    canManageSchedule: true,
    canCheckInMembers: true,
    canManageTasks: true,
  });

  const instructorRole = await upsertStaffRole('Instructor', {
    canViewTips: true,
    canViewMembershipReporting: false,
    canViewBilling: false,
    canManageSchedule: false,
    canCheckInMembers: true,
    canManageTasks: false,
  });

  const frontDeskRole = await upsertStaffRole('Front Desk', {
    canViewTips: false,
    canViewMembershipReporting: false,
    canViewBilling: false,
    canManageSchedule: true,
    canCheckInMembers: true,
    canManageTasks: true,
  });

  // managerRole is seeded but not assigned in Seed A — suppress unused-variable warning.
  void managerRole;

  // ── Staff Role Assignments ────────────────────────────────────────────────────

  await prisma.staffRoleAssignment.upsert({
    where: { userId_locationId: { userId: maya.id, locationId: location.id } },
    update: { staffRoleId: instructorRole.id },
    create: { userId: maya.id, staffRoleId: instructorRole.id, locationId: location.id },
  });

  await prisma.staffRoleAssignment.upsert({
    where: { userId_locationId: { userId: diego.id, locationId: location.id } },
    update: { staffRoleId: instructorRole.id },
    create: { userId: diego.id, staffRoleId: instructorRole.id, locationId: location.id },
  });

  await prisma.staffRoleAssignment.upsert({
    where: { userId_locationId: { userId: frontdesk.id, locationId: location.id } },
    update: { staffRoleId: frontDeskRole.id },
    create: { userId: frontdesk.id, staffRoleId: frontDeskRole.id, locationId: location.id },
  });

  // ── Waiver ────────────────────────────────────────────────────────────────────

  const waiverContent = `THROW ART STUDIO — LIABILITY WAIVER AND RELEASE

By participating in any activity at Throw Art Studio, you acknowledge
and agree to the following:

1. ASSUMPTION OF RISK: Pottery and studio activities involve inherent
risks including but not limited to burns from kilns, cuts from tools,
slips on wet floors, and musculoskeletal strain. You voluntarily assume
all such risks.

2. RELEASE OF LIABILITY: You release Throw Art Studio, its owners,
employees, and instructors from any and all claims arising from
participation in studio activities, including claims of negligence.

3. MEDICAL CONDITIONS: You confirm you have no medical condition that
would prevent safe participation. You agree to inform staff of any
relevant health concerns.

4. PROPERTY: Throw Art Studio is not responsible for lost, stolen, or
damaged personal property.

5. PHOTOGRAPHY: You consent to being photographed during studio sessions
for use in marketing materials. Notify staff if you do not consent.

6. MINIMUM AGE: Participants under 18 must have a parent or guardian
sign this waiver on their behalf.

By signing below you confirm you have read, understood, and agree to
these terms.`;

  const waiver = await prisma.waiverVersion.upsert({
    where: { locationId_version: { locationId: location.id, version: 1 } },
    update: { isActive: true, publishedAt: daysAgo(30), content: waiverContent },
    create: {
      locationId: location.id,
      version: 1,
      isActive: true,
      publishedAt: daysAgo(30),
      content: waiverContent,
    },
  });

  const allUsers = [admin, maya, diego, frontdesk, sarah, mike, priya, jordan, claire];
  for (const user of allUsers) {
    await prisma.waiverSignature.upsert({
      where: { userId_waiverVersionId: { userId: user.id, waiverVersionId: waiver.id } },
      update: { signedAt: daysAgo(28), ipAddress: '127.0.0.1' },
      create: {
        userId: user.id,
        waiverVersionId: waiver.id,
        signedAt: daysAgo(28),
        ipAddress: '127.0.0.1',
      },
    });
  }

  // ── Membership Plans ──────────────────────────────────────────────────────────
  // All tiers include: 24/6 studio access, clay & firing discounts, studio
  // glazes, workshops and member events. Billed on the 1st of the month.

  const commonPerks = [
    '24/6 studio access',
    'Clay & firing discounts',
    'Studio glazes',
    'Workshops & member events',
  ];

  const planExpert = await prisma.membershipPlan.upsert({
    where: { slug: 'expert-monthly' },
    update: {
      name: 'Expert',
      description: 'Full shelf space and our largest class ticket allowance.',
      price: 12000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_expert',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 12,
      shelfType: 'FULL',
      joiningFeeCents: 2500,
      perks: commonPerks,
    },
    create: {
      slug: 'expert-monthly',
      name: 'Expert',
      description: 'Full shelf space and our largest class ticket allowance.',
      price: 12000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_expert',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 12,
      shelfType: 'FULL',
      joiningFeeCents: 2500,
      perks: commonPerks,
    },
  });

  const planPro = await prisma.membershipPlan.upsert({
    where: { slug: 'pro-monthly' },
    update: {
      name: 'Pro',
      description: 'Half shelf space and a generous class ticket allowance.',
      price: 9000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_pro',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 10,
      shelfType: 'HALF',
      joiningFeeCents: 2500,
      perks: commonPerks,
    },
    create: {
      slug: 'pro-monthly',
      name: 'Pro',
      description: 'Half shelf space and a generous class ticket allowance.',
      price: 9000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_pro',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 10,
      shelfType: 'HALF',
      joiningFeeCents: 2500,
      perks: commonPerks,
    },
  });

  const planBasic = await prisma.membershipPlan.upsert({
    where: { slug: 'basic-monthly' },
    update: {
      name: 'Basic',
      description: 'No shelf space, our lowest-cost membership.',
      price: 7000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_basic',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 8,
      shelfType: null,
      joiningFeeCents: 2500,
      perks: commonPerks,
    },
    create: {
      slug: 'basic-monthly',
      name: 'Basic',
      description: 'No shelf space, our lowest-cost membership.',
      price: 7000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_basic',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 8,
      shelfType: null,
      joiningFeeCents: 2500,
      perks: commonPerks,
    },
  });

  const planPro3Month = await prisma.membershipPlan.upsert({
    where: { slug: 'pro-3-month' },
    update: {
      name: 'Pro 3 Month',
      description: 'Pro membership with a 3-month commitment. 10% off retail, joining fee waived.',
      price: 9000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_pro_3mo',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 10,
      shelfType: 'HALF',
      joiningFeeCents: 0,
      commitmentMonths: 3,
      retailDiscountPercent: 10,
      includesOnlineCourse: true,
      perks: [...commonPerks, 'Online course', 'Joining fee waived'],
    },
    create: {
      slug: 'pro-3-month',
      name: 'Pro 3 Month',
      description: 'Pro membership with a 3-month commitment. 10% off retail, joining fee waived.',
      price: 9000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_pro_3mo',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 10,
      shelfType: 'HALF',
      joiningFeeCents: 0,
      commitmentMonths: 3,
      retailDiscountPercent: 10,
      includesOnlineCourse: true,
      perks: [...commonPerks, 'Online course', 'Joining fee waived'],
    },
  });

  const planPro12Month = await prisma.membershipPlan.upsert({
    where: { slug: 'pro-12-month' },
    update: {
      name: 'Pro 12 Month',
      description:
        'Pro membership with a 12-month commitment. 20% off retail, guest pass, 1 month free.',
      price: 9000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_pro_12mo',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 10,
      shelfType: 'HALF',
      joiningFeeCents: 0,
      commitmentMonths: 12,
      retailDiscountPercent: 20,
      includesOnlineCourse: true,
      includesGuestPass: true,
      perks: [...commonPerks, 'Online course', 'Guest pass', '1 month free', 'Joining fee waived'],
    },
    create: {
      slug: 'pro-12-month',
      name: 'Pro 12 Month',
      description:
        'Pro membership with a 12-month commitment. 20% off retail, guest pass, 1 month free.',
      price: 9000,
      billingIntervalDays: 30,
      billingAnchorDay: 1,
      stripePriceId: 'price_placeholder_pro_12mo',
      isActive: true,
      locationId: location.id,
      classTicketsPerPeriod: 10,
      shelfType: 'HALF',
      joiningFeeCents: 0,
      commitmentMonths: 12,
      retailDiscountPercent: 20,
      includesOnlineCourse: true,
      includesGuestPass: true,
      perks: [...commonPerks, 'Online course', 'Guest pass', '1 month free', 'Joining fee waived'],
    },
  });

  // The three invented plans this seed used to create are replaced by the
  // real lineup above under new slugs — deactivate the old rows (if this
  // seed has run before) so they don't keep showing up on /membership.
  await prisma.membershipPlan.updateMany({
    where: { slug: { in: ['open-studio-monthly', 'studio-plus-monthly', 'annual-membership'] } },
    data: { isActive: false },
  });

  // ── Memberships ───────────────────────────────────────────────────────────────
  // MembershipEvents are only created inside the `create` block — this prevents
  // duplicate events on subsequent re-runs while still keeping membership data current.

  // sarah → Basic, ACTIVE
  await prisma.membership.upsert({
    where: { stripeSubscriptionId: 'sub_seed_sarah' },
    create: {
      userId: sarah.id,
      planId: planBasic.id,
      locationId: location.id,
      status: MembershipStatus.ACTIVE,
      stripeSubscriptionId: 'sub_seed_sarah',
      currentPeriodStart: daysAgo(15),
      currentPeriodEnd: daysFromNow(15),
      creditsRemaining: 0,
      joiningFeePaid: true,
      membershipEvents: {
        create: [{ eventType: MembershipEventType.CREATED, createdAt: daysAgo(15) }],
      },
    },
    update: {
      userId: sarah.id,
      planId: planBasic.id,
      locationId: location.id,
      status: MembershipStatus.ACTIVE,
      currentPeriodStart: daysAgo(15),
      currentPeriodEnd: daysFromNow(15),
      creditsRemaining: 0,
      joiningFeePaid: true,
    },
  });

  // mike → Pro, ACTIVE
  await prisma.membership.upsert({
    where: { stripeSubscriptionId: 'sub_seed_mike' },
    create: {
      userId: mike.id,
      planId: planPro.id,
      locationId: location.id,
      status: MembershipStatus.ACTIVE,
      stripeSubscriptionId: 'sub_seed_mike',
      currentPeriodStart: daysAgo(5),
      currentPeriodEnd: daysFromNow(25),
      creditsRemaining: 0,
      joiningFeePaid: true,
      membershipEvents: {
        create: [
          { eventType: MembershipEventType.CREATED, createdAt: daysAgo(5) },
          {
            eventType: MembershipEventType.UPGRADED,
            createdAt: daysAgo(3),
            note: 'Upgraded from Basic',
          },
        ],
      },
    },
    update: {
      userId: mike.id,
      planId: planPro.id,
      locationId: location.id,
      status: MembershipStatus.ACTIVE,
      currentPeriodStart: daysAgo(5),
      currentPeriodEnd: daysFromNow(25),
      creditsRemaining: 0,
      joiningFeePaid: true,
    },
  });

  // priya → Pro 12 Month (commitment), ACTIVE
  await prisma.membership.upsert({
    where: { stripeSubscriptionId: 'sub_seed_priya' },
    create: {
      userId: priya.id,
      planId: planPro12Month.id,
      locationId: location.id,
      status: MembershipStatus.ACTIVE,
      stripeSubscriptionId: 'sub_seed_priya',
      currentPeriodStart: daysAgo(60),
      currentPeriodEnd: daysFromNow(305),
      commitmentEndsAt: addMonths(daysAgo(60), 12),
      creditsRemaining: 0,
      joiningFeePaid: false,
      membershipEvents: {
        create: [
          { eventType: MembershipEventType.CREATED, createdAt: daysAgo(60) },
          { eventType: MembershipEventType.RENEWED, createdAt: daysAgo(30) },
        ],
      },
    },
    update: {
      userId: priya.id,
      planId: planPro12Month.id,
      locationId: location.id,
      status: MembershipStatus.ACTIVE,
      currentPeriodStart: daysAgo(60),
      currentPeriodEnd: daysFromNow(305),
      commitmentEndsAt: addMonths(daysAgo(60), 12),
      creditsRemaining: 0,
      joiningFeePaid: false,
    },
  });

  // jordan → Expert, PAUSED
  await prisma.membership.upsert({
    where: { stripeSubscriptionId: 'sub_seed_jordan' },
    create: {
      userId: jordan.id,
      planId: planExpert.id,
      locationId: location.id,
      status: MembershipStatus.PAUSED,
      stripeSubscriptionId: 'sub_seed_jordan',
      currentPeriodStart: daysAgo(40),
      currentPeriodEnd: daysAgo(10),
      pausedAt: daysAgo(12),
      resumesAt: daysFromNow(18),
      creditsRemaining: 0,
      joiningFeePaid: true,
      membershipEvents: {
        create: [
          { eventType: MembershipEventType.CREATED, createdAt: daysAgo(40) },
          { eventType: MembershipEventType.PAUSED, createdAt: daysAgo(12) },
        ],
      },
    },
    update: {
      userId: jordan.id,
      planId: planExpert.id,
      locationId: location.id,
      status: MembershipStatus.PAUSED,
      currentPeriodStart: daysAgo(40),
      currentPeriodEnd: daysAgo(10),
      pausedAt: daysAgo(12),
      resumesAt: daysFromNow(18),
      creditsRemaining: 0,
      joiningFeePaid: true,
    },
  });

  // ── Shelf Spaces ──────────────────────────────────────────────────────────────
  // 40 shelves, numbered 1-40, alternating FULL/HALF, all unassigned.

  for (let number = 1; number <= 40; number++) {
    const shelfType = number % 2 === 1 ? 'FULL' : 'HALF';
    await prisma.shelfSpace.upsert({
      where: { locationId_number: { locationId: location.id, number } },
      update: { shelfType },
      create: { locationId: location.id, number, shelfType },
    });
  }

  // ── SMS Automations ───────────────────────────────────────────────────────────

  await prisma.smsAutomation.deleteMany({ where: { locationId: location.id } });
  await prisma.smsAutomation.createMany({
    data: [
      {
        name: 'Booking Confirmation',
        triggerEvent: 'booking/confirmed',
        delayMinutes: 0,
        messageTemplate:
          "Hi {{name}}, you're booked for {{session_type}} on {{date}} at {{time}} at {{location}}. See you then!",
        isActive: true,
        locationId: location.id,
      },
      {
        name: '24-Hour Reminder',
        triggerEvent: 'booking/reminder',
        delayMinutes: 0,
        messageTemplate:
          'Reminder: {{name}}, you have {{session_type}} tomorrow at {{time}} at {{location}}. See you there!',
        isActive: true,
        locationId: location.id,
      },
      {
        name: 'Booking Cancellation',
        triggerEvent: 'booking/cancelled',
        delayMinutes: 0,
        messageTemplate:
          "Hi {{name}}, your booking for {{session_type}} on {{date}} has been cancelled. Visit throw.studio to rebook.",
        isActive: true,
        locationId: location.id,
      },
      {
        name: 'Welcome New Member',
        triggerEvent: 'membership/created',
        delayMinutes: 0,
        messageTemplate:
          'Welcome to Throw, {{name}}! Your {{plan_name}} membership is now active. Book your first session at throw.studio',
        isActive: true,
        locationId: location.id,
      },
      {
        name: 'Membership Paused',
        triggerEvent: 'membership/paused',
        delayMinutes: 0,
        messageTemplate:
          "Hi {{name}}, your Throw membership has been paused. You can resume anytime at throw.studio/membership/manage",
        isActive: true,
        locationId: location.id,
      },
    ],
  });

  // ── Landing Pages ─────────────────────────────────────────────────────────────

  await prisma.landingPage.upsert({
    where: { slug: 'spring-classes' },
    update: {
      title: 'Spring Classes at Throw',
      headline: 'Learn to Throw This Spring',
      subheadline: 'Beginner-friendly wheel throwing classes in Provo, Utah',
      bodyHtml:
        '<p>Join us this spring for our most popular class series. No experience needed — just bring your hands and a willingness to get messy.</p><ul><li>Small class sizes (max 8 students)</li><li>All materials included</li><li>Expert instructors</li></ul>',
      ctaLabel: 'See the Schedule',
      ctaUrl: '/schedule',
      isActive: true,
    },
    create: {
      slug: 'spring-classes',
      title: 'Spring Classes at Throw',
      headline: 'Learn to Throw This Spring',
      subheadline: 'Beginner-friendly wheel throwing classes in Provo, Utah',
      bodyHtml:
        '<p>Join us this spring for our most popular class series. No experience needed — just bring your hands and a willingness to get messy.</p><ul><li>Small class sizes (max 8 students)</li><li>All materials included</li><li>Expert instructors</li></ul>',
      ctaLabel: 'See the Schedule',
      ctaUrl: '/schedule',
      isActive: true,
    },
  });

  await prisma.landingPage.upsert({
    where: { slug: 'wheel-throwing' },
    update: {
      title: 'Wheel Throwing in Provo',
      headline: 'Throw Your First Pot',
      subheadline: 'Drop-in wheel throwing sessions for all skill levels',
      bodyHtml:
        "<p>Our wheel throwing sessions are open to everyone — from total beginners to experienced potters. Book a spot and make something you're proud of.</p>",
      ctaLabel: 'Book a Session',
      ctaUrl: '/schedule',
      isActive: true,
    },
    create: {
      slug: 'wheel-throwing',
      title: 'Wheel Throwing in Provo',
      headline: 'Throw Your First Pot',
      subheadline: 'Drop-in wheel throwing sessions for all skill levels',
      bodyHtml:
        "<p>Our wheel throwing sessions are open to everyone — from total beginners to experienced potters. Book a spot and make something you're proud of.</p>",
      ctaLabel: 'Book a Session',
      ctaUrl: '/schedule',
      isActive: true,
    },
  });

  console.log('=== SEED A COMPLETE ===');
  console.log('Users, location, roles, waiver, plans, memberships seeded.');
  console.log('Run Seed B next for session types and studio sessions.');

  // ══════════════════════════════════════════════════════════════════════════════
  // PART B: SESSIONS, BOOKINGS, PAYMENTS
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Load Part A records by email / slug ───────────────────────────────────────

  const bMaya   = await prisma.user.findUniqueOrThrow({ where: { email: 'maya@throw.studio' } });
  const bDiego  = await prisma.user.findUniqueOrThrow({ where: { email: 'diego@throw.studio' } });
  const bSarah  = await prisma.user.findUniqueOrThrow({ where: { email: 'sarah@example.com' } });
  const bMike   = await prisma.user.findUniqueOrThrow({ where: { email: 'mike@example.com' } });
  const bPriya  = await prisma.user.findUniqueOrThrow({ where: { email: 'priya@example.com' } });
  const bJordan = await prisma.user.findUniqueOrThrow({ where: { email: 'jordan@example.com' } });
  const bClaire = await prisma.user.findUniqueOrThrow({ where: { email: 'claire@example.com' } });
  const bLoc    = await prisma.location.findFirstOrThrow({ where: { name: 'Throw Art Studio' } });

  const sarahMs = await prisma.membership.findUniqueOrThrow({ where: { stripeSubscriptionId: 'sub_seed_sarah' } });
  const mikeMbs = await prisma.membership.findUniqueOrThrow({ where: { stripeSubscriptionId: 'sub_seed_mike' } });
  const priyaMs = await prisma.membership.findUniqueOrThrow({ where: { stripeSubscriptionId: 'sub_seed_priya' } });

  // ── makeSession helper ────────────────────────────────────────────────────────
  // Accepts a calendar-day Date (from startOfWeek / addDays) + "HH:MM" string,
  // interprets the wall-clock time in America/Denver, and returns session data.

  const makeSessionData = (
    date: Date,
    timeStr: string,
    type: { id: string; durationMinutes: number },
    instructorId: string | null,
    capacity: number,
  ) => {
    const y  = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d  = String(date.getDate()).padStart(2, '0');
    const startsAt = fromZonedTime(`${y}-${mo}-${d}T${timeStr}:00`, TZ);
    const endsAt   = new Date(startsAt.getTime() + type.durationMinutes * 60_000);
    return { sessionTypeId: type.id, instructorId, capacity, startsAt, endsAt, locationId: bLoc.id };
  };

  // Skip creation if a session with the same sessionTypeId + startsAt already exists.
  const findOrCreate = async (data: {
    sessionTypeId: string;
    instructorId: string | null;
    capacity: number;
    startsAt: Date;
    endsAt: Date;
    locationId: string;
  }) => {
    const hit = await prisma.studioSession.findFirst({
      where: { sessionTypeId: data.sessionTypeId, startsAt: data.startsAt },
    });
    return hit ?? await prisma.studioSession.create({ data });
  };

  // ── Session Types ─────────────────────────────────────────────────────────────

  const stOpenStudio = await prisma.sessionType.upsert({
    where:  { slug: 'open-studio' },
    update: { name: 'Open Studio', durationMinutes: 180, capacity: 20, dropInPriceCents: 1500, isBusyWindow: false, locationId: bLoc.id },
    create: { slug: 'open-studio', name: 'Open Studio', durationMinutes: 180, capacity: 20, dropInPriceCents: 1500, isBusyWindow: false, locationId: bLoc.id },
  });

  const stBusy = await prisma.sessionType.upsert({
    where:  { slug: 'busy-window-open-studio' },
    update: { name: 'Busy Window', durationMinutes: 120, capacity: 20, dropInPriceCents: 2000, isBusyWindow: true, locationId: bLoc.id },
    create: { slug: 'busy-window-open-studio', name: 'Busy Window', durationMinutes: 120, capacity: 20, dropInPriceCents: 2000, isBusyWindow: true, locationId: bLoc.id },
  });

  const stWheel = await prisma.sessionType.upsert({
    where:  { slug: 'wheel-throwing-101' },
    update: { name: 'Wheel Throwing 101', durationMinutes: 90, capacity: 8, dropInPriceCents: 4500, isBusyWindow: false, locationId: bLoc.id },
    create: { slug: 'wheel-throwing-101', name: 'Wheel Throwing 101', durationMinutes: 90, capacity: 8, dropInPriceCents: 4500, isBusyWindow: false, locationId: bLoc.id },
  });

  const stHand = await prisma.sessionType.upsert({
    where:  { slug: 'hand-building-workshop' },
    update: { name: 'Hand Building Workshop', durationMinutes: 90, capacity: 10, dropInPriceCents: 4000, isBusyWindow: false, locationId: bLoc.id },
    create: { slug: 'hand-building-workshop', name: 'Hand Building Workshop', durationMinutes: 90, capacity: 10, dropInPriceCents: 4000, isBusyWindow: false, locationId: bLoc.id },
  });

  // ── Week anchors ──────────────────────────────────────────────────────────────
  // thisMonday = Monday of the current calendar week (weekStartsOn: 1).
  // All other anchors are derived from it so weekday alignment is always correct.

  const thisMonday  = startOfWeek(now, { weekStartsOn: 1 });
  const nextMonday  = addDays(thisMonday, 7);
  const threeWksAgo = subDays(thisMonday, 21); // Monday 3 weeks ago
  const twoWksAgo   = subDays(thisMonday, 14); // Monday 2 weeks ago
  const oneWkAgo    = subDays(thisMonday, 7);  // Monday 1 week ago

  // ── Studio Sessions ───────────────────────────────────────────────────────────

  // Past sessions
  const sessOS3w = await findOrCreate(makeSessionData(threeWksAgo,            '09:00', stOpenStudio, bMaya.id,  20)); // 3wk Mon  Open Studio
  const sessWT3w = await findOrCreate(makeSessionData(addDays(threeWksAgo, 1),'18:00', stWheel,      bMaya.id,  8));  // 3wk Tue  Wheel Throwing
  const sessHB2w = await findOrCreate(makeSessionData(addDays(twoWksAgo, 2),  '10:00', stHand,       bDiego.id, 10)); // 2wk Wed  Hand Building
  const sessOS2w = await findOrCreate(makeSessionData(addDays(twoWksAgo, 5),  '14:00', stOpenStudio, bDiego.id, 20)); // 2wk Sat  Open Studio
                   await findOrCreate(makeSessionData(oneWkAgo,               '09:00', stOpenStudio, bMaya.id,  20)); // 1wk Mon  Open Studio
  const sessWT1w = await findOrCreate(makeSessionData(addDays(oneWkAgo, 1),   '18:00', stWheel,      bMaya.id,  8));  // 1wk Tue  Wheel Throwing
                   await findOrCreate(makeSessionData(addDays(oneWkAgo, 3),   '19:00', stBusy,       null,      20)); // 1wk Thu  Busy Window

  // Upcoming sessions
  const sessOSMon = await findOrCreate(makeSessionData(thisMonday,             '09:00', stOpenStudio, bMaya.id,  20)); // This Mon Open Studio
  const sessWTTue = await findOrCreate(makeSessionData(addDays(thisMonday, 1), '18:00', stWheel,      bMaya.id,  8));  // This Tue Wheel Throwing
                    await findOrCreate(makeSessionData(addDays(thisMonday, 2), '10:00', stHand,       bDiego.id, 10)); // This Wed Hand Building
                    await findOrCreate(makeSessionData(addDays(thisMonday, 3), '19:00', stBusy,       null,      20)); // This Thu Busy Window
                    await findOrCreate(makeSessionData(addDays(thisMonday, 5), '14:00', stOpenStudio, bDiego.id, 20)); // This Sat Open Studio
                    await findOrCreate(makeSessionData(addDays(nextMonday, 1), '18:00', stWheel,      bMaya.id,  8));  // Next Tue Wheel Throwing
                    await findOrCreate(makeSessionData(addDays(nextMonday, 2), '09:00', stOpenStudio, bDiego.id, 20)); // Next Wed Open Studio
                    await findOrCreate(makeSessionData(addDays(nextMonday, 3), '10:00', stHand,       bMaya.id,  10)); // Next Thu Hand Building
                    await findOrCreate(makeSessionData(addDays(nextMonday, 5), '14:00', stOpenStudio, bMaya.id,  20)); // Next Sat Open Studio

  // ── Bookings ──────────────────────────────────────────────────────────────────
  // Delete all existing bookings, then recreate deterministically.

  await prisma.booking.deleteMany();

  // 3-weeks-ago Open Studio (maya)
  await prisma.booking.create({ data: { userId: bSarah.id,  studioSessionId: sessOS3w.id, membershipId: sarahMs.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  await prisma.booking.create({ data: { userId: bMike.id,   studioSessionId: sessOS3w.id, membershipId: mikeMbs.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  const bkClaireOS3w  = await prisma.booking.create({ data: { userId: bClaire.id, studioSessionId: sessOS3w.id, status: BookingStatus.CONFIRMED, source: BookingSource.DROP_IN, amountPaidCents: 1500 } });

  // 3-weeks-ago Wheel Throwing 101 (maya)
  await prisma.booking.create({ data: { userId: bPriya.id,  studioSessionId: sessWT3w.id, membershipId: priyaMs.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  await prisma.booking.create({ data: { userId: bSarah.id,  studioSessionId: sessWT3w.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  const bkClaireWT3w  = await prisma.booking.create({ data: { userId: bClaire.id, studioSessionId: sessWT3w.id, status: BookingStatus.CONFIRMED, source: BookingSource.DROP_IN, amountPaidCents: 4500 } });

  // 2-weeks-ago Hand Building Workshop (diego)
  await prisma.booking.create({ data: { userId: bMike.id,   studioSessionId: sessHB2w.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  await prisma.booking.create({ data: { userId: bPriya.id,  studioSessionId: sessHB2w.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  const bkJordanHB2w  = await prisma.booking.create({ data: { userId: bJordan.id, studioSessionId: sessHB2w.id, status: BookingStatus.CONFIRMED, source: BookingSource.DROP_IN, amountPaidCents: 4000 } });

  // 2-weeks-ago Open Studio (diego)
  await prisma.booking.create({ data: { userId: bSarah.id,  studioSessionId: sessOS2w.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  const bkClaireOS2w  = await prisma.booking.create({ data: { userId: bClaire.id, studioSessionId: sessOS2w.id, status: BookingStatus.NO_SHOW, source: BookingSource.DROP_IN, amountPaidCents: 1500 } });

  // 1-week-ago Wheel Throwing 101 (maya)
  await prisma.booking.create({ data: { userId: bPriya.id,  studioSessionId: sessWT1w.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  await prisma.booking.create({ data: { userId: bMike.id,   studioSessionId: sessWT1w.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  await prisma.booking.create({ data: { userId: bSarah.id,  studioSessionId: sessWT1w.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });

  // This Monday Open Studio
  await prisma.booking.create({ data: { userId: bSarah.id,  studioSessionId: sessOSMon.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  await prisma.booking.create({ data: { userId: bMike.id,   studioSessionId: sessOSMon.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  await prisma.booking.create({ data: { userId: bPriya.id,  studioSessionId: sessOSMon.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });

  // This Tuesday Wheel Throwing 101
  await prisma.booking.create({ data: { userId: bSarah.id,  studioSessionId: sessWTTue.id, status: BookingStatus.CONFIRMED, source: BookingSource.MEMBER_FREE } });
  const bkClaireWTTue = await prisma.booking.create({ data: { userId: bClaire.id, studioSessionId: sessWTTue.id, status: BookingStatus.CONFIRMED, source: BookingSource.DROP_IN, amountPaidCents: 4500 } });
  await prisma.booking.create({ data: { userId: bPriya.id,  studioSessionId: sessWTTue.id, status: BookingStatus.WAITLIST, source: BookingSource.MEMBER_FREE } });
  await prisma.booking.create({ data: { userId: bMike.id,   studioSessionId: sessWTTue.id, status: BookingStatus.WAITLIST, source: BookingSource.MEMBER_FREE } });

  // ── Payments ──────────────────────────────────────────────────────────────────
  // Delete all existing payments, then recreate.
  // stripePaymentIntentIds are pi_seed_1 … pi_seed_N (each unique via sequential index).

  await prisma.payment.deleteMany();

  let piIdx = 1;

  // DROP_IN booking payments
  await prisma.payment.create({ data: { userId: bClaire.id, locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 1500,  status: PaymentStatus.SUCCEEDED, type: PaymentType.DROP_IN,    bookingId: bkClaireOS3w.id  } });
  await prisma.payment.create({ data: { userId: bClaire.id, locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 4500,  status: PaymentStatus.SUCCEEDED, type: PaymentType.DROP_IN,    bookingId: bkClaireWT3w.id  } });
  await prisma.payment.create({ data: { userId: bJordan.id, locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 4000,  status: PaymentStatus.SUCCEEDED, type: PaymentType.DROP_IN,    bookingId: bkJordanHB2w.id  } });
  await prisma.payment.create({ data: { userId: bClaire.id, locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 1500,  status: PaymentStatus.SUCCEEDED, type: PaymentType.DROP_IN,    bookingId: bkClaireOS2w.id  } });
  await prisma.payment.create({ data: { userId: bClaire.id, locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 4500,  status: PaymentStatus.SUCCEEDED, type: PaymentType.DROP_IN,    bookingId: bkClaireWTTue.id } });

  // Membership payments
  await prisma.payment.create({ data: { userId: bSarah.id, locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 7000, status: PaymentStatus.SUCCEEDED, type: PaymentType.MEMBERSHIP, membershipId: sarahMs.id, createdAt: subDays(now, 15) } });
  await prisma.payment.create({ data: { userId: bMike.id,  locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 9000, status: PaymentStatus.SUCCEEDED, type: PaymentType.MEMBERSHIP, membershipId: mikeMbs.id, createdAt: subDays(now, 5)  } });
  await prisma.payment.create({ data: { userId: bPriya.id, locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 9000, status: PaymentStatus.SUCCEEDED, type: PaymentType.MEMBERSHIP, membershipId: priyaMs.id, createdAt: subDays(now, 60) } });
  await prisma.payment.create({ data: { userId: bPriya.id, locationId: bLoc.id, stripePaymentIntentId: `pi_seed_${piIdx++}`, amountInCents: 9000, status: PaymentStatus.SUCCEEDED, type: PaymentType.MEMBERSHIP, membershipId: priyaMs.id, createdAt: subDays(now, 30) } });

  console.log('=== SEED B COMPLETE ===');
  console.log('Session types, studio sessions, bookings, payments seeded.');
  console.log('Run Seed C next for tips, tasks, and ad tracking.');

  // ══════════════════════════════════════════════════════════════════════════════
  // PART C: TIPS, TASKS, AD TRACKING
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Load needed records by email / sessionTypeId + startsAt ──────────────────

  const cAdmin     = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@throw.studio' } });
  const cMaya      = await prisma.user.findUniqueOrThrow({ where: { email: 'maya@throw.studio' } });
  const cDiego     = await prisma.user.findUniqueOrThrow({ where: { email: 'diego@throw.studio' } });
  const cFrontdesk = await prisma.user.findUniqueOrThrow({ where: { email: 'frontdesk@throw.studio' } });
  const cSarah     = await prisma.user.findUniqueOrThrow({ where: { email: 'sarah@example.com' } });
  const cMike      = await prisma.user.findUniqueOrThrow({ where: { email: 'mike@example.com' } });
  const cClaire    = await prisma.user.findUniqueOrThrow({ where: { email: 'claire@example.com' } });
  const cLoc       = await prisma.location.findFirstOrThrow({ where: { name: 'Throw Art Studio' } });

  // Load session type, then find each target session by sessionTypeId + startsAt.
  // startsAt is computed via makeSessionData (in scope from Part B) to guarantee
  // the exact same UTC value used during session creation.
  const cStWheel = await prisma.sessionType.findUniqueOrThrow({ where: { slug: 'wheel-throwing-101' } });

  const cSessWT3w = await prisma.studioSession.findFirstOrThrow({
    where: { sessionTypeId: cStWheel.id, startsAt: makeSessionData(addDays(threeWksAgo, 1), '18:00', cStWheel, null, 8).startsAt },
  });
  const cSessWT1w = await prisma.studioSession.findFirstOrThrow({
    where: { sessionTypeId: cStWheel.id, startsAt: makeSessionData(addDays(oneWkAgo, 1), '18:00', cStWheel, null, 8).startsAt },
  });

  // Load bookings by userId + studioSessionId.
  const cBkSarahWT3w = await prisma.booking.findFirstOrThrow({
    where: { userId: cSarah.id, studioSessionId: cSessWT3w.id },
  });
  const cBkMikeWT1w = await prisma.booking.findFirstOrThrow({
    where: { userId: cMike.id, studioSessionId: cSessWT1w.id },
  });

  // ── Tips ──────────────────────────────────────────────────────────────────────

  await prisma.tip.deleteMany();

  // Tip 1: sarah tipped maya after 3-weeks-ago Wheel Throwing 101 (not yet paid out)
  await prisma.tip.create({
    data: {
      bookingId:             cBkSarahWT3w.id,
      customerId:            cSarah.id,
      instructorId:          cMaya.id,
      locationId:            cLoc.id,
      amountInCents:         1000,
      stripePaymentIntentId: 'pi_seed_tip_1',
      paidOutAt:             null,
    },
  });

  // Tip 2: mike tipped maya after 1-week-ago Wheel Throwing 101 (paid out 5 days ago)
  await prisma.tip.create({
    data: {
      bookingId:             cBkMikeWT1w.id,
      customerId:            cMike.id,
      instructorId:          cMaya.id,
      locationId:            cLoc.id,
      amountInCents:         500,
      stripePaymentIntentId: 'pi_seed_tip_2',
      paidOutAt:             daysAgo(5),
    },
  });

  // Payment records for tips (Part B already deleted all payments, so no collision risk).
  await prisma.payment.create({
    data: {
      userId:                cSarah.id,
      locationId:            cLoc.id,
      stripePaymentIntentId: 'pi_seed_tip_1',
      amountInCents:         1000,
      status:                PaymentStatus.SUCCEEDED,
      type:                  PaymentType.TIP,
    },
  });

  await prisma.payment.create({
    data: {
      userId:                cMike.id,
      locationId:            cLoc.id,
      stripePaymentIntentId: 'pi_seed_tip_2',
      amountInCents:         500,
      status:                PaymentStatus.SUCCEEDED,
      type:                  PaymentType.TIP,
    },
  });

  // ── Staff Tasks ───────────────────────────────────────────────────────────────

  await prisma.staffTask.deleteMany();

  // OPEN tasks
  await prisma.staffTask.create({
    data: {
      title:            'Follow up with Claire re: no-show policy',
      status:           TaskStatus.OPEN,
      triggerType:      TaskTriggerType.MANUAL,
      assignedToId:     cFrontdesk.id,
      linkedCustomerId: cClaire.id,
      dueAt:            daysFromNow(1),
      createdById:      cAdmin.id,
      locationId:       cLoc.id,
    },
  });

  await prisma.staffTask.create({
    data: {
      title:        'Restock clay — Studio A running low',
      status:       TaskStatus.OPEN,
      triggerType:  TaskTriggerType.MANUAL,
      assignedToId: cMaya.id,
      dueAt:        daysFromNow(3),
      createdById:  cAdmin.id,
      locationId:   cLoc.id,
    },
  });

  await prisma.staffTask.create({
    data: {
      title:        'Check kiln temperature log for last firing',
      status:       TaskStatus.OPEN,
      triggerType:  TaskTriggerType.MANUAL,
      assignedToId: cDiego.id,
      dueAt:        daysFromNow(0), // due today
      createdById:  cAdmin.id,
      locationId:   cLoc.id,
    },
  });

  await prisma.staffTask.create({
    data: {
      title:        'Send monthly newsletter draft to JohnPaul for review',
      status:       TaskStatus.OPEN,
      triggerType:  TaskTriggerType.MANUAL,
      assignedToId: cFrontdesk.id,
      dueAt:        daysAgo(4), // overdue
      createdById:  cAdmin.id,
      locationId:   cLoc.id,
    },
  });

  // IN_PROGRESS tasks
  await prisma.staffTask.create({
    data: {
      title:        'Set up new member orientation packet',
      status:       TaskStatus.IN_PROGRESS,
      triggerType:  TaskTriggerType.MANUAL,
      assignedToId: cFrontdesk.id,
      dueAt:        daysFromNow(5),
      createdById:  cAdmin.id,
      locationId:   cLoc.id,
    },
  });

  await prisma.staffTask.create({
    data: {
      title:        'Order new trimming tools',
      status:       TaskStatus.IN_PROGRESS,
      triggerType:  TaskTriggerType.MANUAL,
      assignedToId: cMaya.id,
      dueAt:        daysFromNow(2),
      createdById:  cAdmin.id,
      locationId:   cLoc.id,
    },
  });

  // DONE tasks
  await prisma.staffTask.create({
    data: {
      title:        'Update studio hours on front door signage',
      status:       TaskStatus.DONE,
      triggerType:  TaskTriggerType.MANUAL,
      assignedToId: cFrontdesk.id,
      completedAt:  daysAgo(3),
      createdById:  cAdmin.id,
      locationId:   cLoc.id,
    },
  });

  await prisma.staffTask.create({
    data: {
      title:        'Deep clean wheel throwing room',
      status:       TaskStatus.DONE,
      triggerType:  TaskTriggerType.MANUAL,
      assignedToId: cDiego.id,
      completedAt:  daysAgo(5),
      createdById:  cAdmin.id,
      locationId:   cLoc.id,
    },
  });

  // ── Community Posts ───────────────────────────────────────────────────────────

  await prisma.communityComment.deleteMany();
  await prisma.communityLike.deleteMany();
  await prisma.communityPost.deleteMany();

  // Post 1: Welcome post by admin, 5 days ago
  const post1 = await prisma.communityPost.create({
    data: {
      authorId:    admin.id,
      title:       'Welcome to the Throw Community!',
      body:        "We're so excited to have this space for our studio community. Share your progress, ask questions, and celebrate each other's work. This is a place for all of us who love getting our hands dirty. Can't wait to see what you're all making!",
      isPublished: true,
      createdAt:   daysAgo(5),
      updatedAt:   daysAgo(5),
    },
  });

  await prisma.communityLike.createMany({
    data: [
      { postId: post1.id, userId: sarah.id, createdAt: daysAgo(5) },
      { postId: post1.id, userId: mike.id,  createdAt: daysAgo(5) },
    ],
  });

  await prisma.communityComment.create({
    data: {
      postId:    post1.id,
      authorId:  priya.id,
      body:      'So excited for this! Just finished my first bowl last week.',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
  });

  // Post 2: Kiln firing announcement by maya, 3 days ago
  const post2 = await prisma.communityPost.create({
    data: {
      authorId:    maya.id,
      title:       'Kiln Firing This Weekend',
      body:        "Heads up everyone — we're doing a big kiln firing this Saturday. If you have pieces ready to fire, make sure they're on the shelf by Friday at 5pm. We'll have everything out and ready for pickup by Sunday afternoon. Any questions just ask at the front desk!",
      isPublished: true,
      createdAt:   daysAgo(3),
      updatedAt:   daysAgo(3),
    },
  });

  await prisma.communityLike.create({
    data: { postId: post2.id, userId: sarah.id, createdAt: daysAgo(3) },
  });

  await prisma.communityComment.createMany({
    data: [
      {
        postId:    post2.id,
        authorId:  mike.id,
        body:      'Perfect timing, I have three mugs ready to go!',
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
      {
        postId:    post2.id,
        authorId:  claire.id,
        body:      'Can I drop off a piece Thursday evening instead?',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
    ],
  });

  // Post 3: Pro tip by diego, 1 day ago (no title)
  const post3 = await prisma.communityPost.create({
    data: {
      authorId:    diego.id,
      title:       null,
      body:        'Pro tip from your friendly neighborhood instructor: if your clay keeps cracking while drying, try covering it loosely with plastic overnight to slow down the drying process. Even drying = fewer cracks. You\'re welcome 😊',
      isPublished: true,
      createdAt:   daysAgo(1),
      updatedAt:   daysAgo(1),
    },
  });

  await prisma.communityLike.createMany({
    data: [
      { postId: post3.id, userId: sarah.id, createdAt: daysAgo(1) },
      { postId: post3.id, userId: mike.id,  createdAt: daysAgo(1) },
      { postId: post3.id, userId: priya.id, createdAt: daysAgo(1) },
    ],
  });

  // ── Ad Tracking ───────────────────────────────────────────────────────────────
  // Note: AdTracking has no `landingPath` field in the schema; that spec field is omitted.

  await prisma.adTracking.deleteMany();

  // instagram / spring-classes → sarah (converted)
  await prisma.adTracking.create({
    data: {
      utmSource:       'instagram',
      utmMedium:       'social',
      utmCampaign:     'spring-classes',
      userId:          cSarah.id,
      locationId:      cLoc.id,
      firstBookingAt:  daysAgo(25),
      firstPurchaseAt: daysAgo(25),
    },
  });

  // google / pottery-provo → mike (converted)
  await prisma.adTracking.create({
    data: {
      utmSource:       'google',
      utmMedium:       'cpc',
      utmCampaign:     'pottery-provo',
      userId:          cMike.id,
      locationId:      cLoc.id,
      firstBookingAt:  daysAgo(10),
      firstPurchaseAt: daysAgo(10),
    },
  });

  // instagram / spring-classes → anonymous (never converted)
  await prisma.adTracking.create({
    data: {
      utmSource:   'instagram',
      utmMedium:   'social',
      utmCampaign: 'spring-classes',
      userId:      null,
      locationId:  cLoc.id,
    },
  });

  // google / pottery-provo → claire (booked but never purchased)
  await prisma.adTracking.create({
    data: {
      utmSource:       'google',
      utmMedium:       'cpc',
      utmCampaign:     'pottery-provo',
      userId:          cClaire.id,
      locationId:      cLoc.id,
      firstBookingAt:  daysAgo(20),
      firstPurchaseAt: null,
    },
  });

  console.log('');
  console.log('=== ALL SEEDS COMPLETE ===');
  console.log('');
  console.log('ADMIN');
  console.log('  admin@throw.studio / changeme123');
  console.log('');
  console.log('STAFF');
  console.log('  maya@throw.studio / changeme123 (Instructor)');
  console.log('  diego@throw.studio / changeme123 (Instructor)');
  console.log('  frontdesk@throw.studio / changeme123 (Front Desk)');
  console.log('');
  console.log('CUSTOMERS');
  console.log('  sarah@example.com / changeme123 (Active - Open Studio Monthly)');
  console.log('  mike@example.com / changeme123 (Active - Studio Plus)');
  console.log('  priya@example.com / changeme123 (Active - Annual)');
  console.log('  jordan@example.com / changeme123 (Paused membership)');
  console.log('  claire@example.com / changeme123 (Drop-in, no membership)');
  console.log('');
  console.log('Landing pages: /lp/spring-classes  /lp/wheel-throwing');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
