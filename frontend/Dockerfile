# =============================================================================
# Stage 1: Build Frontend Assets
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for node-gyp if any native bindings are needed
RUN apk add --no-cache libc6-compat

# Leverage Docker cache by copying dependency definitions first
COPY package.json package-lock.json* ./

# Install npm dependencies
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; else npm install; fi

# Copy source code and config files
COPY . .

# Build-time environment arguments (configurable via docker-compose)
ARG VITE_API_URL=/api/v1
ARG VITE_APP_TITLE="MV Payment Approval"
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_TITLE=$VITE_APP_TITLE \
    NODE_ENV=production

# Compile TypeScript and bundle frontend for production
RUN npm run build && cp public/sw.js dist/sw.js

# =============================================================================
# Stage 2: Serve Production Assets with Nginx
# =============================================================================
FROM nginx:alpine AS runner

# Security: Remove default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration for Single Page Application (SPA) routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -q -O - http://127.0.0.1/healthz | grep ok || exit 1

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
