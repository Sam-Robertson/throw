"use client";

import { useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export interface TaskRow {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS";
  dueAtLabel: string | null;
  overdue: boolean;
  linkedCustomerName: string | null;
}

interface Props {
  initialTasks: TaskRow[];
  canManageTasks: boolean;
}

export function TasksCard({ initialTasks, canManageTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateStatus(id: string, status: "IN_PROGRESS" | "DONE") {
    setUpdatingId(id);
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setTasks((prev) =>
        status === "DONE"
          ? prev.filter((t) => t.id !== id)
          : prev.map((t) => (t.id === id ? { ...t, status } : t)),
      );
    }
    setUpdatingId(null);
  }

  return (
    <Box sx={{ mb: 5 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          My Tasks
        </Typography>
        {canManageTasks && (
          <Link component={NextLink} href="/admin/tasks" underline="always" variant="body2">
            View all
          </Link>
        )}
      </Stack>

      {tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No open tasks assigned to you.
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
          {tasks.map((t, idx) => (
            <Box key={t.id}>
              {idx > 0 && <Divider />}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  px: 2.5,
                  py: 1.75,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={t.overdue ? "error.main" : "text.secondary"}
                    sx={{ fontWeight: t.overdue ? 600 : 400 }}
                  >
                    {t.dueAtLabel ? `Due ${t.dueAtLabel}` : "No due date"}
                    {t.linkedCustomerName && ` · ${t.linkedCustomerName}`}
                    {t.overdue && " · Overdue"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  {t.status === "OPEN" && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={updatingId === t.id}
                      onClick={() => updateStatus(t.id, "IN_PROGRESS")}
                    >
                      Start
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="contained"
                    disabled={updatingId === t.id}
                    onClick={() => updateStatus(t.id, "DONE")}
                  >
                    Complete
                  </Button>
                </Stack>
              </Box>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
