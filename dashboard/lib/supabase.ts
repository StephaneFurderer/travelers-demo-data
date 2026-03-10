import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch all rows from a query by paginating through results.
 * Supabase has a default 1000-row limit per request.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll(
  queryBuilder: () => { range: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }> },
  pageSize = 1000
): Promise<any[]> {
  const results: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryBuilder().range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      results.push(...data);
      if (data.length < pageSize) hasMore = false;
      offset += pageSize;
    }
  }

  return results;
}
