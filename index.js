const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

const dirParam = trimQuotes(args[0]);

function trimQuotes(str) {
  return str && str.replace(/^"|"$/g, "");
}

async function workForFolder(pathString) {
  try {
    const files = await fs.promises.readdir(pathString);

    for (const file of files) {
      const filePath = path.join(pathString, file);

      const stat = await fs.promises.stat(filePath);

      if (stat.isFile()) {
        console.log("Working for '%s'", filePath);
        await workForFile(filePath);
      } else if (stat.isDirectory()) {
        console.log("'%s' is a directory.", filePath);
        await workForFolder(filePath);
      }
    }
  } catch (e) {
    console.error("We've thrown! Whoops!", e);
  }
}

async function workForFile(pathString) {
  const stat = await fs.promises.stat(pathString);
  const oldBaseName = path.basename(pathString, ".mp4");
  if (path.extname(pathString) !== ".mp4") {
    console.log("'%s' is not mp4.", pathString);
    return;
  }
  if (oldBaseName.includes("Compressed")) {
    console.log("'%s' already compressed.", pathString);
    return;
  }
  if (oldBaseName.includes("DELETE THIS")) {
    console.log("'%s' should be deleted.", pathString);
    return;
  }
  if (stat.size < 2000000) {
    console.log("'%s' is too small.", pathString);
    return;
  }

  const dirName = path.dirname(pathString);
  const compressedFileName = oldBaseName + " Compressed.mp4";
  const targetPathString = path.join(dirName, compressedFileName);

  const command = `ffmpeg -hwaccel cuda -i "${pathString}" -c:v libx264 -crf 21 -preset faster -pix_fmt yuv420p -maxrate 5000K -bufsize 5000K -vf scale='if(gte(iw,ih),min(1920,iw),-2):if(lt(iw,ih),min(1920,ih),-2)' -movflags +faststart -c:a aac -b:a 160k -n "${targetPathString}"`;
  console.log("Executing:\n" + command);
  try {
    await exec(command);

    const oldFileNewName = "DELETE THIS " + oldBaseName + ".mp4";
    await fs.promises.rename(pathString, path.join(dirName, oldFileNewName));

    console.log(pathString + " completed.");
  } catch (e) {
    console.error("We've thrown! Whoops!", e);
  }
}

(async () => {
  await workForFolder(dirParam);
})();
