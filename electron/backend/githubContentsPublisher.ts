export interface GitHubContentsFile {
    path: string;
    content: string;
}

export interface GitHubContentsConfig {
    owner: string;
    repo: string;
    branch: string;
    token: string;
}

type Fetcher = typeof fetch;

export async function publishGitHubContentsFiles(
    config: GitHubContentsConfig,
    files: GitHubContentsFile[],
    fetcher: Fetcher = fetch
): Promise<void> {
    const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ZaalPlanner'
    };

    for (const file of files) {
        const apiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${file.path}`;
        const existing = await fetcher(`${apiUrl}?ref=${encodeURIComponent(config.branch)}`, {
            headers,
            signal: AbortSignal.timeout(20_000)
        });
        let sha: string | undefined;
        if (existing.ok) {
            const remoteFile = await existing.json() as { sha?: string };
            sha = remoteFile.sha;
        } else if (existing.status !== 404) {
            const details = await existing.json().catch(() => ({})) as { message?: string };
            throw new Error(details.message || `GitHub returned HTTP ${existing.status} while checking ${file.path}.`);
        }

        const published = await fetcher(apiUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Update public schedule (${new Date().toISOString().slice(0, 10)})`,
                content: Buffer.from(file.content, 'utf8').toString('base64'),
                branch: config.branch,
                ...(sha ? { sha } : {})
            }),
            signal: AbortSignal.timeout(20_000)
        });
        if (!published.ok) {
            const details = await published.json().catch(() => ({})) as { message?: string };
            throw new Error(details.message || `GitHub returned HTTP ${published.status} while publishing ${file.path}.`);
        }
    }
}
