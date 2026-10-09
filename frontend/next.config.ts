import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { parsePublicEnvironment } from "./env";

parsePublicEnvironment(process.env);

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withNextIntl(nextConfig);
