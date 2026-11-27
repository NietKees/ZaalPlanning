import { describe, expect, it, vi } from 'vitest';
import { publishGitHubContentsFiles } from '../backend/githubContentsPublisher';

const config = {
    owner: 'schedule-owner',
    repo: 'public-calendar',
    branch: 'main',
    token: 'test-token'
};

describe('GitHub schedule publishing', () => {
    it('creates missing files and updates existing files with their SHA', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('', { status: 404 }))
            .mockResolvedValueOnce(new Response('{}', { status: 201 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ sha: 'existing-sha' }), { status: 200 }))
            .mockResolvedValueOnce(new Response('{}', { status: 200 }));

        await publishGitHubContentsFiles(config, [
            { path: 'docs/index.html', content: '<h1>Calendar</h1>' },
            { path: 'docs/schedule.json', content: '{"events":[]}' }
        ], fetcher);

        expect(fetcher).toHaveBeenCalledTimes(4);
        const firstGet = fetcher.mock.calls[0];
        expect(firstGet[0]).toBe('https://api.github.com/repos/schedule-owner/public-calendar/contents/docs/index.html?ref=main');
        expect((firstGet[1]?.headers as Record<string, string>).Authorization).toBe('Bearer test-token');

        const firstPut = JSON.parse(fetcher.mock.calls[1][1]?.body as string);
        expect(firstPut.branch).toBe('main');
        expect(firstPut.sha).toBeUndefined();
        expect(Buffer.from(firstPut.content, 'base64').toString('utf8')).toBe('<h1>Calendar</h1>');

        const secondPut = JSON.parse(fetcher.mock.calls[3][1]?.body as string);
        expect(secondPut.sha).toBe('existing-sha');
        expect(Buffer.from(secondPut.content, 'base64').toString('utf8')).toBe('{"events":[]}');
    });

    it('returns GitHub API errors rather than reporting a successful publish', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Resource not accessible by integration' }), { status: 403 }));

        await expect(publishGitHubContentsFiles(config, [
            { path: 'docs/index.html', content: '<h1>Calendar</h1>' }
        ], fetcher)).rejects.toThrow('Resource not accessible by integration');
    });
});
