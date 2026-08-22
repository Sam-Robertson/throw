import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

export const metadata = { title: 'Privacy Policy — Throw' };

const LAST_UPDATED = 'July 22, 2026';
const CONTACT_EMAIL = 'hello@throwstudio.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 5 }}>
      <Typography variant="h2" sx={{ fontWeight: 700, fontSize: '1.35rem', mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <Typography
      component="ul"
      variant="body1"
      color="text.secondary"
      sx={{ pl: 3, m: 0, '& li': { mb: 0.75 } }}
    >
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Typography>
  );
}

export default function PrivacyPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 }, px: { xs: 3, md: 4 } }}>
      <Alert severity="warning" sx={{ mb: 4 }}>
        This is a template and should be reviewed by an attorney before launch.
      </Alert>

      <Typography variant="h1" sx={{ fontWeight: 700, mb: 1 }}>
        Privacy Policy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
        Last updated: {LAST_UPDATED}. Questions about this policy? Contact us at{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </Typography>

      <Section title="Information We Collect">
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
          When you create an account, book a session, or otherwise use the studio&apos;s
          services, we collect:
        </Typography>
        <Bullets
          items={[
            'Your name, email address, and phone number',
            'Emergency contact name and phone number',
            'Payment information, processed and stored by our payment processor, Stripe — we do not store your full card details on our own servers',
            "Booking history, including sessions you've booked, cancelled, waitlisted, or attended",
            'Waiver signatures, including a typed name or signature image, the date and time signed, and the IP address used',
            'Messages you send to the studio through the app, including SMS and email replies',
          ]}
        />
      </Section>

      <Section title="How We Use Your Information">
        <Bullets
          items={[
            'To create and manage your account and bookings',
            'To process payments, memberships, and gift cards',
            'To send transactional communications — booking confirmations, reminders, cancellations, and receipts',
            "To send marketing communications, but only if you've opted in",
            'To maintain accurate safety and emergency contact records',
            'To improve our services and studio operations',
          ]}
        />
      </Section>

      <Section title="Who We Share It With">
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
          We do not sell your personal information. We share information with the
          following service providers (&quot;processors&quot;) strictly to operate the
          platform on our behalf:
        </Typography>
        <Bullets
          items={[
            'Stripe — payment processing, subscription billing, and gift cards',
            'Sendblue — SMS/iMessage delivery',
            'Resend — transactional email delivery',
          ]}
        />
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5 }}>
          These providers are only permitted to use your information to provide services
          to us and are bound by their own privacy and security obligations.
        </Typography>
      </Section>

      <Section title="Text Messaging (SMS)">
        <Bullets
          items={[
            'You may opt in to marketing text messages during registration or later in Account Settings',
            'Opt-in to marketing messages is never a condition of purchase',
            'Message frequency varies; message and data rates may apply',
            'Reply STOP to opt out of marketing messages at any time, or HELP for help',
            'Transactional messages about your bookings and payments — like confirmations, reminders, and receipts — are sent separately and are not marketing messages',
            'Mobile opt-in data and phone numbers are not shared with third parties for their own marketing purposes',
          ]}
        />
      </Section>

      <Section title="Data Retention">
        <Bullets
          items={[
            'We retain your account and booking information for as long as your account is active and as needed to meet our legal, tax, and safety obligations (for example, signed liability waivers)',
            "When you request deletion, we remove or anonymize your personal information, except where we're required to retain records by law",
          ]}
        />
      </Section>

      <Section title="Your Rights & Requesting Deletion">
        <Bullets
          items={[
            'You can review and update your name, phone number, and emergency contact information at any time in Account Settings',
            <>
              To request a copy or deletion of your data, email us at{' '}
              <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>. We will respond
              within a reasonable time and confirm once your request is complete
            </>,
            'Deleting your account does not delete records we are legally required to retain, such as signed liability waivers or payment records kept for tax purposes',
          ]}
        />
      </Section>

      <Divider sx={{ my: 5 }} />

      <Typography variant="body2" color="text.secondary">
        We may update this policy from time to time. We&apos;ll update the &quot;Last
        updated&quot; date above whenever we do. Questions? Reach us at{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </Typography>
    </Container>
  );
}
