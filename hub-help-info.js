/**
 * GAME_INFO.txt parse helpers for the Help assistant.
 */
(function (root) {
  const FIELD_MAP = [
    [/^\s*game\s*name\s*:/i, "gameName"],
    [/^\s*owner\s*&\s*developer\s*:/i, "owner"],
    [/^\s*owner\s*:/i, "owner"],
    [/^\s*platform\s*:/i, "platform"],
    [/^\s*release\s*date\s*:/i, "releaseDate"],
    [/^\s*game\s*count\s*:/i, "gameCount"],
    [/^\s*games?\s*list\s*:/i, "gamesList"],
    [/^\s*main\s*objective\s*:/i, "objective"],
    [/^\s*controls?\s*:/i, "controls"],
    [/^\s*menus?\s*:/i, "menus"],
    [/^\s*total\s*plays?(\s*\/\s*visits?)?\s*:/i, "totalPlays"],
    [/^\s*peak\s*concurrent(\s*players?)?\s*:/i, "peakConcurrent"],
    [/^\s*most\s*played\s*game\s*:/i, "mostPlayedGame"],
    [/^\s*achievements?\s*count\s*:/i, "achievementsCount"],
    [/^\s*live\s*stats?\s*note\s*:/i, "liveStatsNote"],
    [/^\s*rules?\s*:/i, "rules"],
    [/^\s*support\s*links?\s*:/i, "supportLinks"],
    [/^\s*hub\s*features?\s*:/i, "hubFeatures"],
    [/^\s*help\s*assistant\s*:/i, "helpAssistant"],
    [/^\s*help\s*mascots?\s*:/i, "helpMascots"],
    [/^\s*tech\s*notes?\s*:/i, "techNotes"]
  ];

  function emptyInfo() {
    return {
      gameName: "",
      owner: "",
      platform: "",
      releaseDate: "",
      gameCount: "",
      gamesList: "",
      objective: "",
      controls: "",
      menus: "",
      totalPlays: "",
      peakConcurrent: "",
      mostPlayedGame: "",
      achievementsCount: "",
      liveStatsNote: "",
      rules: "",
      supportLinks: "",
      hubFeatures: "",
      helpAssistant: "",
      helpMascots: "",
      techNotes: "",
      gamesDetail: []
    };
  }

  function isPlaceholder(val) {
    const s = String(val || "").trim();
    if (!s) return true;
    return /^\[insert\b/i.test(s) || /\[insert\b/i.test(s);
  }

  function parse(text) {
    const out = emptyInfo();
    String(text || "")
      .split(/\r?\n/)
      .forEach((line) => {
        let matchedKey = false;
        for (const [re, key] of FIELD_MAP) {
          if (!re.test(line)) continue;
          const val = line.replace(re, "").trim();
          if (val) out[key] = val;
          matchedKey = true;
          break;
        }
        if (matchedKey) return;
        const gameLine = line.match(/^\s*game\s+([\w-]+)\s*:\s*(.+)$/i);
        if (!gameLine) return;
        const id = String(gameLine[1] || "")
          .trim()
          .toLowerCase();
        if (!id || /^(name|count|list)$/i.test(id)) return;
        const body = String(gameLine[2] || "").trim();
        if (!body) return;
        const title = body.split(/\s*[·|]\s*/)[0].trim();
        out.gamesDetail.push({ id, title, body });
      });
    if (!out.gamesList && out.gamesDetail.length) {
      out.gamesList = out.gamesDetail
        .map((game) => game.title)
        .filter(Boolean)
        .join(", ");
    }
    if (!out.gameCount && out.gamesDetail.length) {
      out.gameCount = String(out.gamesDetail.length);
    }
    return out;
  }

  function field(info, key) {
    if (!info || !key) return "";
    const val = info[key];
    if (isPlaceholder(val)) return "";
    return String(val).trim();
  }

  const api = {
    emptyInfo,
    isPlaceholder,
    parse,
    field
  };
  if (root) root.HubHelpInfo = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
