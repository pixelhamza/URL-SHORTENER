FROM node:20-alpine

# we set environemnt here
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data


#set the working directory 
WORKDIR /app

COPY package*.json ./

#install all dependencies
RUN npm ci --only=production --ignore-scripts

# so we copy application source code
COPY server.js ./
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app

USER node

# Expose the application port
EXPOSE 3000

# simple health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

#we start the application
CMD ["node", "server.js"]
