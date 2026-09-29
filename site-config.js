// Site name and domain — change these when you rename or move to a new URL.
// Also update the CNAME file to match SITE_DOMAIN (or delete CNAME if you stop using a custom domain).
window.SITE_CONFIG = {
  name: "My Games",
  domain: "mygames.com",
  discord: {
    invite: "https://discord.gg/6NHYfPwAwg",
    // Paste a channel webhook URL to post admin abuse / announcements to Discord.
    // Discord → channel settings → Integrations → Webhooks → New Webhook → Copy URL
    webhookUrl: "",
    // Login uses Supabase Auth → Discord provider (enable in Supabase dashboard).
    loginEnabled: true
  }
};
