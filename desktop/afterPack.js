const path = require("path");
const { rcedit } = require("rcedit");

/**
 * electron-builder skips exe icon editing when signAndEditExecutable is false
 * (needed on this machine to avoid winCodeSign symlink errors). Patch the icon here.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(__dirname, "icon.ico");
  await rcedit(exePath, {
    icon: iconPath,
    "version-string": {
      CompanyName: "ICE_DRAGON",
      FileDescription: "My Games",
      ProductName: "My Games",
      LegalCopyright: "Copyright © ICE_DRAGON"
    },
    "product-version": context.packager.appInfo.version,
    "file-version": context.packager.appInfo.version
  });
  console.log("afterPack: set My Games icon on", exeName);
};
