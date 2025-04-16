import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const server = new McpServer({
  name: "GitHub MCP",
  version: "1.0.0",
});

// Helper function to get repository statistics with pagination limit
async function getRepoStats(owner, repo) {
  try {
    // Get commits with limited pagination
    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 30, // Reduced from 100
    });

    // Get pull requests with limited pagination
    const { data: openPRs } = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
      per_page: 30, // Reduced from 100
    });

    const { data: closedPRs } = await octokit.pulls.list({
      owner,
      repo,
      state: "closed",
      per_page: 30, // Reduced from 100
    });

    // Get issues with limited pagination
    const { data: openIssues } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 30, // Reduced from 100
    });

    const { data: closedIssues } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "closed",
      per_page: 30, // Reduced from 100
    });

    return {
      commitCount: commits.length,
      openPRs: openPRs.length,
      closedPRs: closedPRs.length,
      openIssues: openIssues.length,
      closedIssues: closedIssues.length,
    };
  } catch (error) {
    console.error(
      `Error fetching stats for ${owner}/${repo}: ${error.message}`
    );
    return null;
  }
}

// Helper function to get user's repositories with limited stats
async function getUserRepos(username) {
  const repos = [];
  let page = 1;
  const maxPages = 2; // Limit to first 2 pages of repos

  while (page <= maxPages) {
    const { data } = await octokit.repos.listForUser({
      username,
      per_page: 30, // Reduced from 100
      page,
    });
    if (data.length === 0) break;

    // Get detailed stats for only the first 5 repos per page
    const reposToProcess = data.slice(0, 5);
    for (const repo of reposToProcess) {
      const stats = await getRepoStats(username, repo.name);
      repos.push({
        ...repo,
        stats,
      });
    }
    page++;
  }
  return repos;
}

// Helper function to get user's contribution statistics
async function getUserContributions(username) {
  const repos = await getUserRepos(username);

  let totalCommits = 0;
  let totalPushes = 0;
  let languages = {};
  let lastActive = new Date(0);
  let mostActiveRepo = { name: "", commits: 0 };
  let totalOpenPRs = 0;
  let totalClosedPRs = 0;
  let totalOpenIssues = 0;
  let totalClosedIssues = 0;

  // Process only the first 10 repos for language stats
  const reposToProcess = repos.slice(0, 10);
  for (const repo of reposToProcess) {
    if (repo.stats) {
      totalCommits += repo.stats.commitCount;
      totalOpenPRs += repo.stats.openPRs;
      totalClosedPRs += repo.stats.closedPRs;
      totalOpenIssues += repo.stats.openIssues;
      totalClosedIssues += repo.stats.closedIssues;

      if (repo.stats.commitCount > mostActiveRepo.commits) {
        mostActiveRepo = {
          name: repo.name,
          commits: repo.stats.commitCount,
        };
      }
    }

    try {
      const { data: languagesData } = await octokit.repos.listLanguages({
        owner: username,
        repo: repo.name,
      });

      for (const [language, bytes] of Object.entries(languagesData)) {
        languages[language] = (languages[language] || 0) + bytes;
      }
    } catch (error) {
      console.error(
        `Error fetching languages for repo ${repo.name}: ${error.message}`
      );
    }
  }

  return {
    totalCommits,
    lastActive,
    languages,
    mostActiveRepo,
    totalOpenPRs,
    totalClosedPRs,
    totalOpenIssues,
    totalClosedIssues,
  };
}

// Tool to get user information
server.tool("getUser", { username: z.string() }, async ({ username }) => {
  try {
    const { data: userData } = await octokit.users.getByUsername({ username });
    const repos = await getUserRepos(username);
    const contributions = await getUserContributions(username);

    // Calculate most used language
    const sortedLanguages = Object.entries(contributions.languages).sort(
      ([, a], [, b]) => b - a
    );
    const mostUsedLanguage = sortedLanguages[0]
      ? sortedLanguages[0][0]
      : "None";

    return {
      content: [
        {
          type: "text",
          text: `User Information for ${username}:
- Name: ${userData.name || "Not provided"}
- Bio: ${userData.bio || "Not provided"}
- Location: ${userData.location || "Not provided"}
- Public Repos: ${userData.public_repos}
- Private Repos: ${userData.total_private_repos || "Not available"}
- Total Repositories: ${repos.length}
- Followers: ${userData.followers}
- Following: ${userData.following}
- Created at: ${new Date(userData.created_at).toLocaleDateString()}
- Last Active: ${contributions.lastActive.toLocaleDateString()}
- Total Commits: ${contributions.totalCommits}
- Most Active Repository: ${contributions.mostActiveRepo.name} (${
            contributions.mostActiveRepo.commits
          } commits)
- Most Used Language: ${mostUsedLanguage}
- Top Languages: ${sortedLanguages
            .slice(0, 5)
            .map(([lang]) => lang)
            .join(", ")}
- Pull Requests:
  - Open: ${contributions.totalOpenPRs}
  - Closed: ${contributions.totalClosedPRs}
- Issues:
  - Open: ${contributions.totalOpenIssues}
  - Closed: ${contributions.totalClosedIssues}
- Company: ${userData.company || "Not provided"}
- Website: ${userData.blog || "Not provided"}
- Twitter: ${
            userData.twitter_username
              ? `@${userData.twitter_username}`
              : "Not provided"
          }
- Hireable: ${userData.hireable ? "Yes" : "No"}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error fetching user information: ${error.message}`,
        },
      ],
    };
  }
});

// Tool to get repository information
server.tool(
  "getRepo",
  {
    owner: z.string(),
    repo: z.string(),
  },
  async ({ owner, repo }) => {
    try {
      const { data } = await octokit.repos.get({ owner, repo });
      return {
        content: [
          {
            type: "text",
            text: `Repository Information for ${owner}/${repo}:
- Description: ${data.description || "Not provided"}
- Stars: ${data.stargazers_count}
- Forks: ${data.forks_count}
- Language: ${data.language || "Not specified"}
- Created at: ${new Date(data.created_at).toLocaleDateString()}
- Last updated: ${new Date(data.updated_at).toLocaleDateString()}
- Open Issues: ${data.open_issues_count}
- License: ${data.license?.name || "Not specified"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching repository information: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Tool to update repository name
server.tool(
  "updateRepoName",
  {
    owner: z.string(),
    repo: z.string(),
    newName: z.string(),
  },
  async ({ owner, repo, newName }) => {
    try {
      const { data } = await octokit.repos.update({
        owner,
        repo,
        name: newName,
      });

      return {
        content: [
          {
            type: "text",
            text: `Repository name updated successfully!
Old name: ${repo}
New name: ${newName}
Repository URL: ${data.html_url}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating repository name: ${error.message}`,
          },
        ],
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
