# Deployment

## Railway / Render / VPS
Use Node 20+.

Build: `npm install`
Start: `npm start`
Port: `3000` or the platform-provided `PORT`.

For 24/7 operation, the host must provide a persistent process and persistent storage. The `session/` directory must survive redeploys. If storage is ephemeral, the bot may ask for QR/pairing again.

## VPS + PM2
```
npm install --omit=dev
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Docker
```
docker build -t flowtech-whatsapp .
docker run -d --restart unless-stopped -p 3000:3000 --env-file .env -v flowtech_session:/app/session flowtech-whatsapp
```
