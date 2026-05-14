"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSignedUrl } from "@/lib/storage/use-signed-url";
import { cn } from "@/lib/utils";

interface SignedAvatarProps {
  /** Storage path (e.g. "userId/uuid.png") or null if no avatar */
  path: string | null | undefined;
  /** Initials shown while signed URL loads or if there's no avatar */
  fallback: string;
  className?: string;
  imageClassName?: string;
}

/**
 * Avatar that converts a private-bucket storage path to a temporary signed URL.
 * Falls back to initials while the URL is being fetched.
 * Works inside both server and client components.
 */
export function SignedAvatar({ path, fallback, className, imageClassName }: SignedAvatarProps) {
  const signedUrl = useSignedUrl("avatars", path);

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={signedUrl ?? undefined} className={imageClassName} />
      <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
    </Avatar>
  );
}

export default SignedAvatar;
