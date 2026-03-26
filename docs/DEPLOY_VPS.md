# VPS Deployment

This app is ready to run on a standard Node.js VPS with SQLite, PM2, and Nginx.

## Recommended stack

- Ubuntu 24.04 LTS
- Node.js 20 or newer
- Nginx
- PM2
- SQLite file on disk

## 1. Prepare the server

Install packages:

```bash
sudo apt update
sudo apt install -y nginx sqlite3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Create the app directory:

```bash
sudo mkdir -p /var/www/pattern-foundry
sudo chown -R "$USER":"$USER" /var/www/pattern-foundry
cd /var/www/pattern-foundry
git clone <your-repo-url> current
cd current
```

## 2. Add production environment variables

Create `.env` in `/var/www/pattern-foundry/current`:

```bash
DATABASE_URL=file:./dev.db
AUTH_SECRET=replace_with_a_long_random_secret
NEXTAUTH_URL=https://yourdomain.com

ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_strong_admin_password

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite

# optional OpenAI support
OPENAI_API_KEY=
OPENAI_ARTICLE_MODEL=gpt-5-mini
OPENAI_POST_DRAFT_MODEL=gpt-5-mini

# optional market/trading services
ALPHA_VANTAGE_API_KEY=
ALPACA_API_KEY=
ALPACA_API_SECRET=
ALPACA_ENVIRONMENT=paper
ALPACA_DATA_FEED=iex
ALPACA_AUTOMATION_SECRET=replace_with_a_shared_secret
```

## 3. Deploy the app

Run:

```bash
cd /var/www/pattern-foundry/current
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
pm2 save
pm2 startup
```

The app will run on `127.0.0.1:3000`.

## 4. Configure Nginx

Copy the included config:

```bash
sudo cp deploy/nginx.pattern-foundry.conf /etc/nginx/sites-available/pattern-foundry
```

Edit `/etc/nginx/sites-available/pattern-foundry` and replace:

- `patternfoundry.yourdomain.com`
- `yourdomain.com`
- `www.yourdomain.com`

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/pattern-foundry /etc/nginx/sites-enabled/pattern-foundry
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Add HTTPS

If your DNS already points to the VPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 6. Back up the SQLite database

At minimum, back up `dev.db` daily:

```bash
cp /var/www/pattern-foundry/current/dev.db /var/www/pattern-foundry/backups/dev-$(date +%F).db
```

## 7. Post-launch smoke test

Verify:

- home page loads
- posts archive loads publicly
- public books appear on `/books`
- a selected public book opens without login
- login works
- post creation works
- book creation/editing works
- Gemini generation works

## Notes

- Trading should stay secondary for launch unless you explicitly want it front-and-center.
- Keep `ALPACA_ENVIRONMENT=paper` until you intentionally switch it.
- Do not expose the automation endpoint publicly without `ALPACA_AUTOMATION_SECRET`.
