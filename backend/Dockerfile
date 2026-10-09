FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run prisma:generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN mkdir -p /app/storage/uploads/tmp \
  && chown -R node:node /app/storage
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
