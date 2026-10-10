FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
RUN DATABASE_URL=postgresql://unused:unused@localhost:5432/unused MIGRATION_DATABASE_URL=postgresql://unused:unused@localhost:5432/unused npm run db:generate && npm run build -w apps/api
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
