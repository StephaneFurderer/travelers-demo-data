import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch all rows from a Supabase table using parallel pagination.
 *
 * Supabase enforces a server-side row limit per request (default 1,000).
 * Instead of fetching pages sequentially (slow for large tables), we:
 *   1. Fetch the first page to detect whether more data exists
 *   2. Fire all remaining page requests in parallel
 *
 * For 150K rows at 1,000/page: 1 sequential probe + 149 parallel fetches
 * Total time ≈ 2 round trips instead of 150 sequential ones.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll(
  queryBuilder: () => { range: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }> },
  pageSize = 1000
): Promise<any[]> {
  // Step 1: probe first page to check if there's more data
  const { data: firstPage, error: firstError } = await queryBuilder().range(0, pageSize - 1);
  if (firstError) throw firstError;
  if (!firstPage || firstPage.length < pageSize) return firstPage || [];

  // Step 2: more data exists — fire all remaining pages in parallel
  // Enough pages to cover up to 200K rows (largest table is ~150K policies)
  const maxPages = Math.ceil(200_000 / pageSize);
  const parallelRequests = [];
  for (let page = 1; page < maxPages; page++) {
    parallelRequests.push(
      queryBuilder().range(page * pageSize, (page + 1) * pageSize - 1)
    );
  }

  const responses = await Promise.all(parallelRequests);
  const results = [...firstPage];
  for (const resp of responses) {
    if (resp.error) throw resp.error;
    if (resp.data && resp.data.length > 0) {
      results.push(...resp.data);
    }
  }

  return results;
}
