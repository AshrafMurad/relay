import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().refine((url) => url.endsWith("/api"), {
    message: "must end with /api",
  }),
  NEXT_PUBLIC_SOCKET_URL: z.string().url(),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export function parsePublicEnvironment(
  source: Record<string, string | undefined>,
): PublicEnvironment {
  const result = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_API_URL: source.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SOCKET_URL: source.NEXT_PUBLIC_SOCKET_URL,
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid frontend environment configuration: ${details}`);
  }

  const apiUrl = new URL(result.data.NEXT_PUBLIC_API_URL);
  const socketUrl = new URL(result.data.NEXT_PUBLIC_SOCKET_URL);

  if (apiUrl.pathname !== "/api" || apiUrl.search || apiUrl.hash) {
    throw new Error("Invalid frontend environment configuration: NEXT_PUBLIC_API_URL must use the /api path");
  }

  if (socketUrl.pathname !== "/" || socketUrl.search || socketUrl.hash) {
    throw new Error(
      "Invalid frontend environment configuration: NEXT_PUBLIC_SOCKET_URL must be an origin without a path",
    );
  }

  if (source.NODE_ENV === "production") {
    if (apiUrl.protocol !== "https:" || socketUrl.protocol !== "https:") {
      throw new Error("Invalid frontend environment configuration: public URLs must use HTTPS in production");
    }
    if (apiUrl.origin !== socketUrl.origin) {
      throw new Error("Invalid frontend environment configuration: public URLs must share one origin");
    }
  }

  return result.data;
}
