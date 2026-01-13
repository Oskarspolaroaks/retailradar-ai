import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

/**
 * Helper to fetch all sales_daily records with filters using pagination
 * This overcomes the default 1000 row limit per request
 */
export async function fetchSalesDailyPaginated(filters: {
  dateGte?: string;
  dateLte?: string;
  productIds?: string[];
}): Promise<any[]> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("sales_daily")
      .select("*");
    
    if (filters.dateGte) {
      query = query.gte("reg_date", filters.dateGte);
    }
    if (filters.dateLte) {
      query = query.lte("reg_date", filters.dateLte);
    }
    if (filters.productIds && filters.productIds.length > 0) {
      query = query.in("product_id", filters.productIds);
    }
    
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    
    if (error) {
      console.error("Error fetching paginated sales_daily:", error);
      throw error;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log(`Fetched ${allData.length} sales_daily records with pagination`);
  return allData;
}

/**
 * Helper to fetch sales_daily with custom select columns using pagination
 */
export async function fetchSalesDailyColumnsPaginated(
  columns: string,
  filters: {
    dateGte?: string;
    dateLte?: string;
    productIds?: string[];
  }
): Promise<any[]> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("sales_daily")
      .select(columns);
    
    if (filters.dateGte) {
      query = query.gte("reg_date", filters.dateGte);
    }
    if (filters.dateLte) {
      query = query.lte("reg_date", filters.dateLte);
    }
    if (filters.productIds && filters.productIds.length > 0) {
      query = query.in("product_id", filters.productIds);
    }
    
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    
    if (error) {
      console.error("Error fetching paginated sales_daily:", error);
      throw error;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log(`Fetched ${allData.length} sales_daily records (columns: ${columns}) with pagination`);
  return allData;
}
