# Build stage
FROM node:18-alpine AS builder

WORKDIR /apps

COPY package*.json ./

RUN npm ci --only=production

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Biztonsági: nem root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Másold a node_modules-t az előző stage-ből
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# App kód
COPY --chown=nodejs:nodejs . .

# Port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

USER nodejs

CMD ["node", "index.js"]