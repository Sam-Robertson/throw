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
import Typography from "@mui/material/Typography";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";
import { PIECE_STATUS_LABELS } from "@/app/api/pieces/_shared";

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
      location: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Container maxWidth="md" sx={{ py: 5, px: { xs: 3, md: 4 } }}>
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
          {pieces.map((p) => (
            <Paper key={p.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {p.groupName ?? `${p.pieceCount} ${p.pieceCount === 1 ? "piece" : "pieces"}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {p.groupName && `${p.pieceCount} ${p.pieceCount === 1 ? "piece" : "pieces"} · `}
                    {p.studioSession
                      ? `${p.studioSession.sessionType.name}, ${formatMountainTime(p.studioSession.startsAt, "date")}`
                      : `Logged ${formatMountainTime(p.createdAt, "date")}`}
                    {` · ${p.location.name}`}
                  </Typography>
                </Box>
                <Chip label={PIECE_STATUS_LABELS[p.status]} size="small" color={p.status === "READY" ? "success" : "default"} />
              </Box>
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
            </Paper>
          ))}
        </Stack>
      )}
    </Container>
  );
}
