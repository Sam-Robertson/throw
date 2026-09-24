import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NextLink from "next/link";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { shortLocationName } from "@/lib/locationName";
import {
  PIECE_STATUSES,
  PIECE_STATUS_LABELS,
  PIECE_STATUS_SHORT_LABELS,
  pieceCountLabel,
} from "@/app/api/pieces/_shared";
import { BackLink } from "@/components/shared/BackLink";

export default async function PiecesPage({
  searchParams,
}: {
  searchParams: Promise<{ logged?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/pieces");
  const { logged } = await searchParams;

  const pieces = await prisma.piece.findMany({
    where: { userId: session.user.id },
    include: {
      studioSession: { select: { startsAt: true, sessionType: { select: { name: true } } } },
      location: { select: { name: true, address: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Container maxWidth="md" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
      <BackLink href="/dashboard">Dashboard</BackLink>
      <Box sx={{ mb: 4, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>
            My pieces
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Everything you&apos;ve logged with the studio.
          </Typography>
        </Box>
        <Button component={NextLink} href="/pieces/new" variant="contained">
          Log your pieces
        </Button>
      </Box>

      {logged === "1" && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Thanks — your pieces are logged.
        </Alert>
      )}

      {pieces.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          You haven&apos;t logged any pieces yet.
        </Typography>
      ) : (
        <Stack sx={{ gap: 2 }}>
          {pieces.map((p) => {
            const studio = shortLocationName(p.location.name, p.location.address);
            const stepIndex = PIECE_STATUSES.indexOf(p.status);
            return (
              <Paper key={p.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                {p.status === "READY" && (
                  <Alert severity="success" sx={{ mb: 2, fontWeight: 600 }}>
                    Ready for pickup at {studio}
                  </Alert>
                )}
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {p.groupName ?? pieceCountLabel(p.pieceCount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {p.groupName && `${pieceCountLabel(p.pieceCount)} · `}
                      {p.studioSession
                        ? `${p.studioSession.sessionType.name}, ${formatMountainTime(p.studioSession.startsAt, "date")}`
                        : `Logged ${formatMountainTime(p.createdAt, "date")}`}
                      {` · ${p.location.name}`}
                    </Typography>
                  </Box>
                  <Chip label={PIECE_STATUS_LABELS[p.status]} size="small" color={p.status === "READY" ? "success" : "default"} />
                </Box>

                <Stepper
                  activeStep={stepIndex}
                  alternativeLabel
                  sx={{ mt: 2.5, mb: 1, "& .MuiStepLabel-label": { fontSize: "0.75rem", mt: "6px !important" } }}
                >
                  {PIECE_STATUSES.map((s, i) => (
                    <Step key={s} completed={i < stepIndex || p.status === "PICKED_UP"}>
                      <StepLabel>{PIECE_STATUS_SHORT_LABELS[s]}</StepLabel>
                    </Step>
                  ))}
                </Stepper>

                <Typography variant="body2" sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>
                  {p.description}
                </Typography>
                {p.photoUrls.length > 0 && (
                  <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: "wrap" }}>
                    {p.photoUrls.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <Avatar variant="rounded" src={url} alt={`Photo ${i + 1}`} sx={{ width: 72, height: 72 }} />
                      </a>
                    ))}
                  </Stack>
                )}
                {p.status !== "PICKED_UP" && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                    {p.textOptIn && p.contactPhone
                      ? p.readyNotifiedAt
                        ? `We texted ${p.contactPhone} on ${formatMountainTime(p.readyNotifiedAt, "date")}.`
                        : `We'll text ${p.contactPhone} when they're ready.`
                      : "We won't text you about these pieces — check back here for updates."}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
