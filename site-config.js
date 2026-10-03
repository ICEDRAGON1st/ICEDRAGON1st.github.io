// Site name and domain — change these when you rename or move to a new URL.
// Also update the CNAME file to match SITE_DOMAIN (or delete CNAME if you stop using a custom domain).
window.SITE_CONFIG = {
  name: "My Games",
  domain: "mygames.com",
  discord: {
    invite: "https://discord.gg/6NHYfPwAwg",
    // Channel webhook for admin abuse / announcements
    webhookUrl:
      "https://discord.com/api/webhooks/1554593207927709728/aP4OsrIQcBF_qeZ301F9y09GraridUsCaoCQyIR8gmSVqO4PUCekT2D8rnqPcx-g1kcv",
    // #updates — kept EMPTY on purpose (public repo). Announce tool reads
    // tools/discord-secrets.local.js or DISCORD_UPDATES_WEBHOOK instead.
    webhookUpdatesUrl: "",
    // Opt-in "Updates" role — pinged on each hub changelog post
    updatesRoleId: "1554586826914930768",
    // Opt-in "Admin Abuse" role — pinged on fishing admin abuse posts
    adminAbuseRoleId: "1554586756584837260",
    // Login uses Supabase Auth → Discord provider (enable in Supabase dashboard).
    loginEnabled: true
  }
};
