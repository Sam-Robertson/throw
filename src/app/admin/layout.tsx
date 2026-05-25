import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import { AdminNav, DRAWER_WIDTH } from "./_components/AdminNav";
import { InboxCountProvider } from "./_components/InboxCountContext";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <InboxCountProvider>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <AdminNav />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            // On desktop, offset by the sidebar width
            ml: { md: `${DRAWER_WIDTH}px` },
          }}
        >
          {children}
        </Box>
      </Box>
    </InboxCountProvider>
  );
}
