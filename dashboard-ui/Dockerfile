# syntax=docker/dockerfile:1
# Production build served with `next start`. API_URL is read at request time,
# so it is set by docker-compose.yml, not at build time.
FROM node:24-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dev dependencies are needed for the build (Tailwind, TypeScript).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
