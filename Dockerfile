# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – build: compile TypeScript and generate Prisma client.
# Dev dependencies are only present in this stage and are discarded afterwards.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (including devDependencies needed for tsc).
COPY package*.json ./
RUN npm ci

# Copy source files required for the build.
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/backend ./src/backend
COPY src/shared ./src/shared
COPY tsconfig.json ./

# Generate Prisma Client and compile TypeScript.
RUN npm run prisma:generate && npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – runtime: production-only dependencies + compiled output.
# The final image contains no source files and no devDependencies.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from the builder stage.
COPY --from=builder /app/dist ./dist

# Copy the generated Prisma client (platform-native binaries).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Prisma schema and config are needed at runtime for migrations / generate.
COPY prisma ./prisma
COPY prisma.config.ts ./

# Create uploads directories.
RUN mkdir -p /app/uploads/profiles /app/uploads/groups /app/uploads/temp

# Expose port
EXPOSE 3000

# Start the application.
CMD ["npm", "start"]
