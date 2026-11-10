// Explicit opt-in shared by the server and browser. Never infer this from
// missing credentials: normal deployments must retain authentication.
export const isUiPreview = process.env.NEXT_PUBLIC_UI_PREVIEW === "true";
