'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import PlansTab from './_components/PlansTab';
import TermsTab from './_components/TermsTab';
import AddOnsTab from './_components/AddOnsTab';
import CapGroupsTab from './_components/CapGroupsTab';
import FreezePolicyTab from './_components/FreezePolicyTab';

type Section = 'plans' | 'terms' | 'addOns' | 'capGroups' | 'freeze';

export default function MembershipPlansPage() {
  const [section, setSection] = useState<Section>('plans');

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      <Typography variant="h2" sx={{ fontWeight: 700, mb: 2 }}>
        Subscriptions & Packs
      </Typography>

      <Tabs
        value={section}
        onChange={(_e, value: Section) => setSection(value)}
        variant="scrollable"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="plans" label="Plans" />
        <Tab value="terms" label="Commitment terms" />
        <Tab value="addOns" label="Add-ons" />
        <Tab value="capGroups" label="Cap groups" />
        <Tab value="freeze" label="Freeze policy" />
      </Tabs>

      {section === 'plans' && <PlansTab />}
      {section === 'terms' && <TermsTab />}
      {section === 'addOns' && <AddOnsTab />}
      {section === 'capGroups' && <CapGroupsTab />}
      {section === 'freeze' && <FreezePolicyTab />}
    </Box>
  );
}
