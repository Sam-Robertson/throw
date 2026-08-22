import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

export const metadata = { title: 'Terms of Service — Throw' };

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

export default function TermsPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 }, px: { xs: 3, md: 4 } }}>
      <Alert severity="warning" sx={{ mb: 4 }}>
        This is a template and should be reviewed by an attorney before launch.
      </Alert>

      <Typography variant="h1" sx={{ fontWeight: 700, mb: 1 }}>
        Terms of Service
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
        Last updated: {LAST_UPDATED}. Questions about these terms? Contact us at{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </Typography>

      <Section title="Account Responsibilities">
        <Bullets
          items={[
            'You must provide accurate, current information when creating an account, including a valid emergency contact',
            'You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account',
            'You must be at least 18 years old, or have a parent or guardian complete registration and sign the waiver on your behalf, to book sessions',
          ]}
        />
      </Section>

      <Section title="Booking & Cancellation Policy">
        <Bullets
          items={[
            'Bookings may be made using an active membership credit, a guest pass, or a drop-in payment',
            'Sessions may be cancelled online up until 2 hours before the scheduled start time. Our app does not permit self-service cancellation inside that 2-hour window — refund requests within this window must be made directly with the studio',
            'If a session is full, you may join the waitlist and will be notified if a spot opens',
            'No-shows may be recorded and may affect eligibility for future guest passes or promotions',
          ]}
        />
      </Section>

      <Section title="Membership Billing & Auto-Renewal">
        <Bullets
          items={[
            'Memberships automatically renew and bill on a recurring basis until cancelled',
            "You may pause, change, or cancel your membership at any time in Manage Membership; changes take effect according to the plan's billing cycle",
            'Paused memberships automatically resume after the pause period unless cancelled beforehand',
            "It's your responsibility to keep a valid payment method on file — failed payments may result in suspension of membership benefits",
          ]}
        />
      </Section>

      <Section title="Refunds">
        <Bullets
          items={[
            'Drop-in and class payments are generally non-refundable once a session has started or the cancellation window has passed',
            'Membership payments already charged for the current billing period are non-refundable, but you may cancel at any time to prevent future renewals',
            <>
              Refund requests outside of these terms are reviewed by the studio on a
              case-by-case basis — contact <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
            </>,
          ]}
        />
      </Section>

      <Section title="Studio Conduct & Safety">
        <Bullets
          items={[
            'Follow all instructor and staff safety guidance while in the studio',
            'Be respectful of other members, staff, and equipment — disruptive or unsafe behavior may result in removal from a session or suspension of your account',
            'Report any injuries, equipment issues, or safety concerns to staff immediately',
          ]}
        />
      </Section>

      <Section title="Liability">
        <Bullets
          items={[
            'Pottery involves inherent risks, including exposure to clay, glazes, kilns, and studio equipment',
            'Before participating in any session, you must sign the studio’s liability waiver. That signed waiver — not this document — governs the assumption of risk and release of liability between you and the studio',
            'By booking a session, you confirm you have signed, or will sign prior to attending, the current version of the waiver',
          ]}
        />
      </Section>

      <Section title="Intellectual Property">
        <Bullets
          items={[
            'The Throw name, logo, website, and app content are the property of Throw Art Studio and may not be used without permission',
            'Photos or content you share with the studio, including community posts, may be used for studio promotional purposes unless you tell us otherwise',
          ]}
        />
      </Section>

      <Divider sx={{ my: 5 }} />

      <Typography variant="body2" color="text.secondary">
        We may update these terms from time to time; continued use of the platform after
        changes means you accept the updated terms. Questions? Reach us at{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </Typography>
    </Container>
  );
}
