# ==========================================
# Set up the production Express server
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Install server production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy server code
COPY . .

# Expose port and configure environment
EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "server.js"]
