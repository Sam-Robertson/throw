'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface Announcement {
  enabled: boolean;
  text: string;
  href: string | null;
}

const MAX_TEXT = 120;

/**
 * The announcement bar under the website's menu ("40% off 4 week courses").
 * Switch it on for a promo and off when it ends; the site changes straight
 * away, no deploy.
 */
export default function BannerPage() {
  const [form, setForm] = useState<Announcement | null>(null);
  const [saved, setSaved] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/site-settings/announcement')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Announcement | null) => {
        if (data) {
          setForm(data);
          setSaved(data);
        } else {
          setError('Could not load the banner.');
        }
      })
      .catch(() => setError('Could not load the banner.'));
  }, []);

  const dirty = form && saved && JSON.stringify(form) !== JSON.stringify(saved);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await fetch('/api/admin/site-settings/announcement', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as (Announcement & { error?: string }) | undefined;
    setSaving(false);
    if (!res?.ok || !data) {
      setError(data?.error ?? 'Could not save the banner.');
      return;
    }
    setForm(data);
    setSaved(data);
    setNotice(data.enabled ? 'Saved. The banner is showing on the website.' : 'Saved. The banner is hidden.');
  }

  return (
    <Box sx={{ p: { xs: 3, md: 4 }, maxWidth: 720 }}>
      <Typography variant="h2">Site banner</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        The green strip under the website&apos;s menu. Switch it on for a promo and off when the promo
        ends. Changes show on the site as soon as you save.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      {!form ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, p: 3 }}>
          <Stack spacing={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
              }
              label={form.enabled ? 'Showing on the website' : 'Hidden'}
            />

            <TextField
              label="Banner text"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value.slice(0, MAX_TEXT) })}
              helperText={`${form.text.length}/${MAX_TEXT}. Keep it to one short line, e.g. "30% off 4 week courses — fall special".`}
              fullWidth
            />

            <TextField
              label="Link (optional)"
              value={form.href ?? ''}
              onChange={(e) => setForm({ ...form, href: e.target.value || null })}
              helperText="Where a tap on the banner goes: a page on this site like /classes/kickstarter, or a full https:// address. Leave empty for no link."
              fullWidth
            />

            {/* Preview, as the site draws it */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Preview
              </Typography>
              {form.enabled && form.text.trim() ? (
                <Box
                  sx={{
                    bgcolor: '#758C69',
                    color: '#fff',
                    textAlign: 'center',
                    py: 0.75,
                    px: 3,
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: 15,
                    textDecoration: form.href ? 'underline' : 'none',
                    textUnderlineOffset: 4,
                  }}
                >
                  {form.text}
                </Box>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  Nothing shows: the banner is {form.enabled ? 'empty' : 'switched off'}.
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="outlined" onClick={() => saved && setForm(saved)} disabled={saving || !dirty}>
                Discard changes
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
