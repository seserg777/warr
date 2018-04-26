pm2 stop all
git pull
rm -rf ./public/css/main.css
pm2 start --env=production process.yml
pm2 start worker.js
