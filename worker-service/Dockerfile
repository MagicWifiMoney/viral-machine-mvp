FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --break-system-packages yt-dlp

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=8788
EXPOSE 8788
CMD ["npm", "start"]
