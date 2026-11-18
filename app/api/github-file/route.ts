import { NextResponse } from 'next/server';
import { fetchFileContent, UnreviewableFileError } from '@/lib/github';
import { splitSourceLines } from '@/lib/diff-processing';
import { authenticate, resolveGitHubToken } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertOwnerRepo, assertRef, assertRepoPath } from '@/lib/validation';

/** Returns one file's text so the Code Reviewer can show it and let the user pick lines. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'github', auth.user.id);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const { owner, repo } = assertOwnerRepo(searchParams.get('owner'), searchParams.get('repo'));
    const path = assertRepoPath(searchParams.get('path'));
    const ref = assertRef(searchParams.get('ref'));

    const { token, error: tokenError } = await resolveGitHubToken(request, auth.user.id);
    if (!token) return jsonError(tokenError || 'GitHub token missing.', 401);

    try {
      const file = await fetchFileContent(owner, repo, path, token, ref);
      return NextResponse.json({
        success: true,
        path: file.path,
        content: file.content,
        size: file.size,
        lines: splitSourceLines(file.content).length,
      });
    } catch (e) {
      if (e instanceof UnreviewableFileError) return jsonError(e.message, 422);
      throw e;
    }
  } catch (error) {
    return handleRouteError(error, 'github-file');
  }
}
