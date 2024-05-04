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
  program
    .requiredOption(
      "-r, --repository <REPOSITORY>",
      "link to the git repository. Example: https://github.com/Luj8n/oopp-team-25.git"
    )
    .option(
      "-t, --threshold [THRESHOLD]",
      "specify threshold (from 0 to 1). Default = 0.6",
      parseFloat,
      0.6
    );

  program.parse();

  const options = program.opts();

  const repository = options.repository;
  const threshold = options.threshold;

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
  analyzeData(fileData, authors, threshold);

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

/**
 * Function to process commits and extract file data and authors.
 * @param {LogResult<DefaultLogFields>} commits - The commit history to process.
 * @returns {{fileData: FileData, authors: string[]}} An object containing file data and authors.
 */
function processCommits(commits: LogResult<DefaultLogFields>): {
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
function analyzeData(fileData: FileData, authors: string[], threshold: number) {
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
}

// Execute the main function
await main();
