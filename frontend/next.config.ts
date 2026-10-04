import type { NextConfig } from "next";

import { parsePublicEnvironment } from "./env";

parsePublicEnvironment(process.env);

const nextConfig: NextConfig = {
};

export default nextConfig;
