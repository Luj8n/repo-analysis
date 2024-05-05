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

Output:

```
Downloading 'https://github.com/Luj8n/oopp-team-25.git'...
Getting commits...
Processing data...
Analyzing data...

Similarities:
'Lukas Milieška' and 'Sem van der Weijden': similarity = 55%
'Sem van der Weijden' and 'Wing Wong': similarity = 63%
'Eva Miesen' and 'Sem van der Weijden': similarity = 69%
'Eva Miesen' and 'Wing Wong': similarity = 56%
'Wing' and 'rensPols': similarity = 63%
'OOP Project Team' and 'Sebastian Proksch': similarity = 71%

Analyzing top contributors...

Top 7 Contributors:
1. Lukas Milieška: 12532 insertions, 6074 deletions, 160 commits, avg. files 4.01
2. Rens Pols: 8115 insertions, 755 deletions, 139 commits, avg. files 1.42
3. Sem van der Weijden: 5110 insertions, 2269 deletions, 76 commits, avg. files 2.86
4. Eva Miesen: 4451 insertions, 2827 deletions, 107 commits, avg. files 2.07
5. Wing Wong: 3870 insertions, 1927 deletions, 61 commits, avg. files 2.80
6. Xiaoyu Du: 2918 insertions, 852 deletions, 79 commits, avg. files 1.87
7. OOP Project Team: 1875 insertions, 226 deletions, 6 commits, avg. files 10.50
```

## Features

- Analyze contributors who frequently work on the same files.
- Identify top contributors based on insertions, deletions, commits, and average files modified.
