FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m pip install --break-system-packages --no-cache-dir yt-dlp
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
