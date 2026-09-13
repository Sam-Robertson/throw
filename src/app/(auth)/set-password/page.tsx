import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { resolvePasswordToken } from '@/lib/email/passwordSetup';
import { SetPasswordForm } from './_components/SetPasswordForm';

// The token is checked server-side here, so the heading can say "Set up your
// account" vs "Reset your password" without any public endpoint that reveals
// whether an email has an account — only someone holding the emailed link
// learns which it is.
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const rawToken = typeof token === 'string' ? token : '';
  const resolved = rawToken ? await resolvePasswordToken(rawToken) : { status: 'invalid' as const };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        {resolved.status === 'valid' ? (
          <SetPasswordForm token={rawToken} mode={resolved.mode} email={resolved.user.email} />
        ) : (
          <CardContent>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
              {resolved.status === 'expired' ? 'This link has expired' : "This link isn't valid"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {resolved.status === 'expired'
                ? 'Links to set a password last 24 hours. Request a new one and we’ll email it to you.'
                : 'It may have already been used, or been copied incompletely. Request a new one and we’ll email it to you.'}
            </Typography>
            <Button component={NextLink} href="/forgot-password" variant="contained" fullWidth size="large">
              Get a new link
            </Button>
          </CardContent>
        )}
      </Card>
    </Box>
  );
}
