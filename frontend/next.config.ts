import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { parsePublicEnvironment } from "./env";

// Fail the build early when the public environment needed by the app and the
// proxy-generated Content-Security-Policy is missing or inconsistent.
parsePublicEnvironment(process.env);

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The Content-Security-Policy is generated per request with a nonce
          // by proxy.ts; a static policy here would conflict with it.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(isProduction
            ? [{ key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
