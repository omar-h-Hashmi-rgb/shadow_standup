import { NextResponse } from 'next/server';
import { fetchRepoTree } from '@/lib/github';
import { listBrowsableFiles } from '@/lib/review-input';
import { authenticate, resolveGitHubToken } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertOwnerRepo, assertRef } from '@/lib/validation';

/** Lists the files of a repository for the Code Reviewer's file picker. */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const limited = enforceRateLimit(request, 'github', auth.user.id);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const { owner, repo } = assertOwnerRepo(searchParams.get('owner'), searchParams.get('repo'));
    const ref = assertRef(searchParams.get('ref'));

    const { token, error: tokenError } = await resolveGitHubToken(request, auth.user.id);
    if (!token) return jsonError(tokenError || 'GitHub token missing.', 401, { files: [] });

    const tree = await fetchRepoTree(owner, repo, token, ref);
    return NextResponse.json({
      success: true,
      ref: tree.ref,
      files: listBrowsableFiles(tree.files),
      truncated: tree.truncated,
    });
  } catch (error) {
    return handleRouteError(error, 'github-tree', { files: [] });
  }
}
