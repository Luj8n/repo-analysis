import type { DefaultLogFields, DiffResultTextFile, LogResult } from "simple-git";

import { simpleGit } from "simple-git";
import { program } from "commander";
import fs from "fs";

/**
 * Main function to analyze git repository history.
 * @returns {Promise<void>} A Promise that resolves when the analysis is complete.
 */
async function main(): Promise<void> {
  // Define command line options using commander
  program.name("repo-analysis").description("Analyze git repositories");

  program
    .requiredOption(
      "-r, --repository <REPOSITORY>",
      "link to the git repository. Example: https://github.com/Luj8n/oopp-team-25.git"
    )
    .option("-t, --threshold <THRESHOLD>", "specify threshold from 0 to 1", parseFloat, 0.6)
    .option("-l, --limit <LIMIT>", "amount of top contributors", (x) => parseInt(x), 5);

  program.parse();

  const options = program.opts();

  const repository = options.repository;
  const threshold = options.threshold;
  const limit = options.limit;

  try {
    // Cleanup any previous temporary files
    cleanup();

    await downloadRepository(repository);
  } catch (e) {
    console.error(`Could not download '${repository}': ${e}`);
    process.exit(1);
  }

  // Retrieve commit history from the downloaded repository
  const commits = await getCommits();

  // Process commits to extract file data and authors
  const { fileData, authors } = processCommits(commits);

  // Process file data (handle renames)
  processData(fileData);

  // Analyze the processed data to identify similarities between authors
  analyzeSimilarities(fileData, authors, threshold);

  // Identify top contributors
  analyzeTopContributors(fileData, commits, limit);

  // Cleanup temporary files
  cleanup();
}

/**
 * Function to download a git repository.
 * @param {string} repository - Link to the git repository.
 * @returns {Promise<void>} A Promise that resolves when the repository is downloaded.
 */
async function downloadRepository(repository: string): Promise<void> {
  console.log(`Downloading '${repository}'...`);
  await simpleGit().clone(repository, "./tmp");
}

/**
 * Function to cleanup temporary files.
 */
function cleanup() {
  fs.rmSync("./tmp", { recursive: true, force: true });
}
/**
 * Function to get commit history from the downloaded repository.
 * @returns {Promise<LogResult<DefaultLogFields>>} A Promise that resolves with the commit history.
 */
async function getCommits(): Promise<LogResult<DefaultLogFields>> {
  console.log("Getting commits...");
  const git = simpleGit({ baseDir: "./tmp" });
  const commits = await git.log([
    "--numstat", // add commit statistics
    "--no-merges", // ignore merge commits
  ]);
  return commits;
}

/**
 * Interface to represent file data extracted from commits.
 */
interface FileData {
  [file: string]: {
    author: string;
    date: string;
    diff: DiffResultTextFile;
  }[];
}

type Commits = LogResult<DefaultLogFields>;

/**
 * Function to process commits and extract file data and authors.
 * @param {Commits} commits - The commit history to process.
 * @returns {{fileData: FileData, authors: string[]}} An object containing file data and authors.
 */
function processCommits(commits: Commits): {
  fileData: FileData;
  authors: string[];
} {
  const fileData: FileData = {};
  const authors: string[] = [];

  // Iterate over each commit and process its changes
  for (const commit of commits.all) {
    if (!commit.diff) continue;
    for (const fileDiff of commit.diff.files) {
      if (fileDiff.binary) continue;
      if (fileData[fileDiff.file] == undefined) fileData[fileDiff.file] = [];
      fileData[fileDiff.file].push({
        author: commit.author_name,
        date: commit.date,
        diff: fileDiff,
      });

      if (!authors.includes(commit.author_name)) authors.push(commit.author_name);
    }
  }

  return { fileData, authors };
}

/**
 * Function to process file data (handle renames).
 * @param {FileData} fileData - The file data to process.
 */
function processData(fileData: FileData) {
  console.log("Processing data...");

  const renames = [];

  for (const file in fileData) {
    // Regular expression to match renames with curly braces
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

    // Regular expression to match simple renames
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

  // Reverse the order of rename operations to make it faster
  renames.reverse();

  while (true) {
    let modified = false;

    for (const rename of renames) {
      // If the 'from' or 'to' files don't have commits then ignore it
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

  // Remove empty entries from fileData
  for (const file in fileData) {
    if (fileData[file].length == 0) delete fileData[file];
  }
}

/**
 * Function to analyze data and identify similarities between authors.
 * @param {FileData} fileData - The file data extracted from commits.
 * @param {string[]} authors - The list of authors.
 * @param {number} threshold - The similarity threshold.
 */
function analyzeSimilarities(fileData: FileData, authors: string[], threshold: number) {
  console.log("Analyzing data...");

  // Object to store developer data
  const developerData: {
    [author: string]: {
      [file: string]: number;
    };
  } = {};

  // Initialize developer data object
  for (const developer of authors) {
    developerData[developer] = {};
  }

  // Iterate over each file in fileData
  for (const file in fileData) {
    const commitData = fileData[file];
    for (const commit of commitData) {
      // Calculate weight of each commit based on changes
      // const commitWeight = Math.sqrt(commit.diff.changes); // Similar if developers have worked on the same files and maybe more on others
      const commitWeight = commit.diff.changes;
      // const commitWeight = commit.diff.changes ** 2; // Similar if developers have worked a lot on the same files and almost nothing more

      if (commitWeight == 0) continue;
      if (!developerData[commit.author][file]) developerData[commit.author][file] = 0;
      developerData[commit.author][file] += commitWeight;
    }
  }

  // Iterate over each pair of authors
  console.log("\nSimilarities:");
  for (const a of authors) {
    let aWeightSum = Object.values(developerData[a]).reduce((a, c) => a + c, 0);

    for (const b of authors) {
      // Don't look at pairs twice
      if (a >= b) continue;

      let bWeightSum = Object.values(developerData[b]).reduce((a, c) => a + c, 0);
      const bothWeightSum = aWeightSum + bWeightSum;

      // Ignore developers who didn't make many changes
      if (bothWeightSum < 100) continue;

      let similarWeightSum = 0;
      for (const file in developerData[a]) {
        const aWeight = developerData[a][file];
        const bWeight = developerData[b][file] ?? 0;

        if (bWeight == 0) {
          // A made changes but B did not
          continue;
        } else {
          // Both made changes
          similarWeightSum += aWeight + bWeight;
        }
      }
      const similarity = similarWeightSum / bothWeightSum;

      // Output similarity between authors if above threshold
      if (similarity > threshold) {
        console.log(`'${a}' and '${b}': similarity = ${Math.floor(similarity * 100)}%`);
      }
    }
  }
  console.log();
}

/**
 * Function to analyze data and identify top contributors.
 * @param {FileData} fileData - The file data extracted from commits.
 * @param {Commits} commits - All commits.
 * @param {number} limit - The maximum number of top contributors to identify.
 */
function analyzeTopContributors(fileData: FileData, commits: Commits, limit: number) {
  console.log("Analyzing top contributors...");

  // Contributions of each author
  const authorChanges: {
    [author: string]: {
      insertions: number;
      deletions: number;
      commits: number;
      totalFilesModified: number;
    };
  } = {};

  // Sum up insertions and deletions of each author
  for (const file in fileData) {
    const commitData = fileData[file];
    for (const commit of commitData) {
      const author = commit.author;

      // Increment the changes made by the author
      if (!authorChanges[author])
        authorChanges[author] = { insertions: 0, deletions: 0, commits: 0, totalFilesModified: 0 };

      authorChanges[author].insertions += commit.diff.insertions;
      authorChanges[author].deletions += commit.diff.deletions;
    }
  }

  // Count commits of each author
  for (const commit of commits.all) {
    const author = commit.author_name;
    if (!authorChanges[author])
      authorChanges[author] = { insertions: 0, deletions: 0, commits: 0, totalFilesModified: 0 };
    authorChanges[author].commits += 1;
    authorChanges[author].totalFilesModified += commit.diff?.files.length ?? 0;
  }

  // Sort authors by the total insertions in descending order
  const sortedAuthors = Object.keys(authorChanges).sort(
    (a, b) => authorChanges[b].insertions - authorChanges[a].insertions
  );

  // Output the top contributors
  console.log(`\nTop ${limit} Contributors:`);
  for (let i = 0; i < limit && i < sortedAuthors.length; i++) {
    const author = sortedAuthors[i];
    const contribution = authorChanges[author];
    const averageFiles = (contribution.totalFilesModified / contribution.commits).toFixed(2);
    console.log(
      `${i + 1}. ${author}: ${contribution.insertions} insertions, ${
        contribution.deletions
      } deletions, ${contribution.commits} commits, avg. files ${averageFiles}`
    );
  }
  console.log();
}

// Execute the main function
await main();
