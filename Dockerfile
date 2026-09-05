# Multi-stage Dockerfile for Google Cloud Run Production Deployment
FROM node:20-alpine AS build

WORKDIR /app

# Build Client
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Production Server Stage
FROM node:20-alpine AS production

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

COPY server/ ./server/
COPY --from=build /app/client/dist ./server/public

# Environment Configuration
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

WORKDIR /app/server
CMD ["node", "server.js"]
