function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number): void {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getSessionToken(): string {
  let token = getCookie("throw_session");
  if (!token) {
    token = crypto.randomUUID();
    setCookie("throw_session", token, 30);
  }
  return token;
}

export function captureUTM(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");
  const utmContent = params.get("utm_content");
  const utmTerm = params.get("utm_term");

  if (!utmSource && !utmMedium && !utmCampaign && !utmContent && !utmTerm) return;

  const sessionToken = getSessionToken();

  fetch("/api/tracking/utm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken,
      ...(utmSource && { utmSource }),
      ...(utmMedium && { utmMedium }),
      ...(utmCampaign && { utmCampaign }),
      ...(utmContent && { utmContent }),
      ...(utmTerm && { utmTerm }),
      landingPath: window.location.pathname,
    }),
  }).catch(() => {});
}
