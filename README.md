# Git Repository Analyzer

This tool analyzes a Git repository's history to calculate pairs of developers who most frequently contribute to the same files. It can also perform other types of repository analysis.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Luj8n/repo-analysis.git
   ```

2. Navigate to the project directory:

   ```bash
   cd repo-analysis
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

## Usage

To run the analyzer, execute the following command:

```bash
npm start -- -r <REPOSITORY_URL> -t <THRESHOLD> -l <LIMIT>
```

- `<REPOSITORY_URL>`: Link to the Git repository you want to analyze.
- `<THRESHOLD>`: Specify the similarity threshold from 0 to 1. Default is 0.6.
- `<LIMIT>`: Specify the amount of top contributors to display. Default is 5.

Example:

```bash
npm start -- -r https://github.com/Luj8n/oopp-team-25.git -t 0.55 -l 7
```

## Features

- Analyze contributors who frequently work on the same files.
- Identify top contributors based on insertions, deletions, commits, and average files modified.
