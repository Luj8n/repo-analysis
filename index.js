import { simpleGit } from "simple-git";
import fs from "fs";

const args = process.argv.slice(2);

const repository = args[0];

if (!repository) {
  console.error(
    "Please provide a git repository link. Example: 'npm start https://github.com/Luj8n/oopp-team-25.git'"
  );
  process.exit(1);
}

function deleteTmp() {
  fs.rmSync("tmp", { recursive: true, force: true });
}

console.log(`Downloading '${repository}'...`);
try {
  deleteTmp();
  await simpleGit().clone(repository, "tmp");
} catch (e) {
  console.error(`Could not download '${repository}': ${e}`);
  process.exit(1);
}
console.log("Download done");

const git = simpleGit({ baseDir: "tmp" });

const commits = await git.log({
  "--numstat": true, // add commit statistics
  "--no-merges": true, // ignore merge commits
});

const fileData = {};
const authors = [];

for (const commit of commits.all) {
  if (!commit.diff) continue;
  for (const fileDiff of commit.diff.files) {
    if (fileData[fileDiff.file] == undefined) fileData[fileDiff.file] = [];
    fileData[fileDiff.file].push({ author: commit.author_name, date: commit.date, diff: fileDiff });

    if (!authors.includes(commit.author_name)) authors.push(commit.author_name);
  }
}

const renames = [];

for (const file in fileData) {
  const regex1 = /{(.*?) => (.*?)}/g;
  if (file.match(regex1)) {
    const from = file.replace(regex1, "$1").replace(/\/\//g, "/");
    const to = file.replace(regex1, "$2").replace(/\/\//g, "/");
    renames.push({ from, to });

    if (!fileData[to]) fileData[to] = [];
    fileData[to] = fileData[to].concat(fileData[file]);
    delete fileData[file];
    continue;
  }

  const regex2 = /^(.*?) => (.*?)$/g;
  if (file.match(regex2)) {
    const from = file.replace(regex2, "$1");
    const to = file.replace(regex2, "$2");
    renames.push({ from, to });

    if (!fileData[to]) fileData[to] = [];
    fileData[to] = fileData[to].concat(fileData[file]);
    delete fileData[file];
  }
}

renames.reverse();

while (true) {
  let modified = false;

  for (const rename of renames) {
    // If the 'from' or 'to' files doesn't have commits then ignore it
    if (
      !fileData[rename.from] ||
      fileData[rename.from].length == 0 ||
      !fileData[rename.to] ||
      fileData[rename.to].length == 0
    )
      continue;

    fileData[rename.to] = fileData[rename.to].concat(fileData[rename.from].splice(0));
    modified = true;
  }

  // Only stop trying to move commits if nothing was moved
  if (!modified) break;
}

for (const file in fileData) {
  if (fileData[file].length == 0) delete fileData[file];
}

console.log(authors);

deleteTmp();
