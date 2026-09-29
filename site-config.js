// Site name and domain — change these when you rename or move to a new URL.
// Also update the CNAME file to match SITE_DOMAIN (or delete CNAME if you stop using a custom domain).
window.SITE_CONFIG = {
  name: "My Games",
  domain: "mygames.com",
  discord: {
    invite: "https://discord.gg/6NHYfPwAwg",
    // Channel webhook for admin abuse / announcements
    webhookUrl:
      "https://discord.com/api/webhooks/1554573770210021449/Xt9PhHRMRx4-auszRNHIeDVlM1sqmDVryvmK4umg-2qyDAUy-M5IJamq1GFuNCwTu7rO",
    // Login uses Supabase Auth → Discord provider (enable in Supabase dashboard).
    loginEnabled: true
  }
};
