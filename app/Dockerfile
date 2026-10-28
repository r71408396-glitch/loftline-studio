# Build with every dependency (Vite and the React Router build need the dev ones),
# then run from a slim image with production dependencies only.
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY . .
RUN npm ci && npm run build && npm prune --omit=dev && npm cache clean --force

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# Applies database migrations, then starts the server.
CMD ["npm", "run", "docker-start"]
