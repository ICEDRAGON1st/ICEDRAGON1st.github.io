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
    // #updates channel — hub/site changelog posts
    webhookUpdatesUrl:
      "https://discord.com/api/webhooks/1554596814492270754/tic5Tif91GLtNyui1YJzw-4yPte8nR2rsq3ZK4jRAMPWvUnCyVL67KTYqC2gCRATDeNJ",
    // Login uses Supabase Auth → Discord provider (enable in Supabase dashboard).
    loginEnabled: true
  }
};
