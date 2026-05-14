// hCaptcha removido — este endpoint não é mais utilizado.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true });
}
