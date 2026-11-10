import { NextRequest, NextResponse } from "next/server";
import { appDaysElapsedThisWeek } from "@/lib/date";
import { getPreviewData, previewChallenges, previewSettings, previewUser, previewUsers, toPreviewCard } from "./data";

// Handled before the real API routes. No database, Redis, uploads, sessions or
// persistence: every GET starts from the same illustrative fixtures.
export async function previewApi(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const data = getPreviewData();
  const json = (body: unknown, status = 200) => NextResponse.json(body, {
    status, headers: { "Cache-Control": "no-store", "X-UI-Preview": "true" },
  });

  if (pathname === "/api/auth/signout") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = request.headers.get("content-type")?.includes("application/json")
      ? await request.json().catch(() => ({})) : {};
    if (pathname === "/api/profile") {
      return json({ preview: true, user: { ...previewUser, username: body.username ?? previewUser.username, full_name: body.full_name ?? previewUser.full_name }, avatar_url: null });
    }
    if (pathname.startsWith("/api/submissions/") && request.method === "PATCH") {
      const form = await request.formData().catch(() => null);
      const submission = data.submissions.find((s) => s.id === pathname.split("/").at(-1));
      return json({ preview: true, submission: {
        ...submission, title: form?.get("title") ?? submission?.title,
        description: form?.get("description") ?? submission?.description,
      } });
    }
    return json({ success: true, preview: true, xp_awarded: 100,
      submission: { id: "preview-submission", status: "pending" },
      excuse: { id: "preview-excuse", ...body } });
  }

  switch (pathname) {
    case "/api/profile/status": return json({ status: "pending" });
    case "/api/feed": {
      const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 10));
      const before = searchParams.get("before");
      const rows = data.submissions.filter((s) => !before || s.created_at < before);
      return json({ submissions: rows.slice(0, limit).map(toPreviewCard), hasMore: rows.length > limit });
    }
    case "/api/challenges": return json({
      todayStr: data.today, yesterdayStr: data.yesterday, weekStartStr: data.weekStart,
      challenges: previewChallenges, submissions: data.submissions.filter((s) => s.user_id === previewUser.id),
      currentPenalty: null, scheduled: data.scheduled,
    });
    case "/api/challenges/scheduled": return json({ challenges: data.scheduled });
    case "/api/ranking": return json({
      weekStart: searchParams.get("week") ?? data.weekStart,
      ranking: data.users.map((u, i) => ({ ...u, art_tier: Math.ceil(u.level / 10), approvedCount: 24 - i * 4, contestedCount: i === 2 ? 1 : 0, weeklyXp: 480 - i * 80 })),
    });
    case "/api/weekly": return json({
      ...data, daysElapsed: appDaysElapsedThisWeek(), challenges: previewChallenges,
      groupPenalty: previewSettings,
    });
    case "/api/profile": return json({
      profile: { ...previewUser, art_tier: 2, level_xp: 250, next_xp: 400 },
      submissions: data.submissions.filter((s) => s.user_id === previewUser.id), userId: previewUser.id,
    });
    case "/api/admin/users": return json({ users: previewUsers });
    case "/api/admin/challenges": return json({ challenges: [...previewChallenges, ...data.scheduled] });
    case "/api/admin/submissions": return json({ submissions: data.submissions, challenges: previewChallenges });
    case "/api/admin/settings": return json({ settings: previewSettings });
    case "/api/admin/excuses": return json({ excuses: data.excuses });
    case "/api/storage/sign": return json({ url: null });
  }

  if (pathname.startsWith("/api/users/")) {
    const username = decodeURIComponent(pathname.slice("/api/users/".length));
    const user = previewUsers.find((u) => u.username === username);
    if (!user) return json({ error: "Perfil não encontrado" }, 404);
    return json({
      profile: { ...user, art_tier: Math.ceil(user.level / 10), level_xp: 250, next_xp: 400 },
      submissions: data.submissions.filter((s) => s.user_id === user.id), currentUserId: previewUser.id, userId: previewUser.id,
      penaltyHistory: [{ id: "preview-penalty", penalty_text: "Caminhada extra de 20 minutos", assigned_at: `${data.yesterday}T12:00:00Z`, cleared_at: `${data.today}T12:00:00Z` }],
    });
  }
  if (pathname.startsWith("/api/submissions/")) {
    const submission = data.submissions.find((s) => s.id === pathname.split("/").at(-1));
    return submission ? json({ submission }) : json({ error: "Submissão não encontrada" }, 404);
  }
  // Never fall through to a real integration while previewing.
  return json({ error: "Este recurso não faz parte da demonstração." }, 404);
}
