/**
 * Web Scraping Engine for Competitor Products
 * Uses Lovable's fetch-website capability to extract product and price data
 */

export interface ScrapedProduct {
  name: string;
  brand?: string;
  regular_price?: number;
  promo_price?: number;
  is_on_promo: boolean;
  promo_text?: string;
  in_stock: boolean;
  unit_price?: string;
  size?: string;
  url?: string;
}

export interface ScrapeResult {
  success: boolean;
  products: ScrapedProduct[];
  error?: string;
  scraped_at: string;
}

/**
 * Extract price from text (handles various formats)
 */
function extractPrice(text: string): number | null {
  if (!text) return null;
  
  // Remove common currency symbols and clean text
  const cleaned = text
    .replace(/[€$£]/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  
  // Match patterns like: 1.99, 1,99, 199
  const match = cleaned.match(/(\d+[.,]?\d{0,2})/);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  
  return null;
}

/**
 * Extract product information from HTML content
 * This is a generic extractor that looks for common patterns
 */
function extractProductsFromHTML(html: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Create a temporary DOM for parsing
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Common selectors for product containers
  const selectors = [
    '.product-item',
    '.product-card',
    '.product',
    '[data-product]',
    '.item',
    'article[class*="product"]',
  ];
  
  let productElements: Element[] = [];
  for (const selector of selectors) {
    productElements = Array.from(doc.querySelectorAll(selector));
    if (productElements.length > 0) break;
  }
  
  for (const element of productElements) {
    try {
      // Extract product name
      const nameEl = element.querySelector('h2, h3, h4, .product-name, .title, [class*="name"]');
      const name = nameEl?.textContent?.trim();
      if (!name) continue;
      
      // Extract brand (optional)
      const brandEl = element.querySelector('.brand, [class*="brand"]');
      const brand = brandEl?.textContent?.trim();
      
      // Extract prices
      const priceElements = Array.from(element.querySelectorAll('.price, [class*="price"]'));
      let regular_price: number | null = null;
      let promo_price: number | null = null;
      
      for (const priceEl of priceElements) {
        const priceText = priceEl.textContent || '';
        const price = extractPrice(priceText);
        
        if (price) {
          const isPromo = priceEl.className.includes('sale') ||
                         priceEl.className.includes('promo') ||
                         priceEl.className.includes('discount');
          
          if (isPromo) {
            promo_price = price;
          } else {
            regular_price = price;
          }
        }
      }
      
      // If we found only one price and it looks like a promo, swap them
      if (promo_price && !regular_price) {
        regular_price = promo_price;
        promo_price = null;
      }
      
      // Extract promo text
      const promoEl = element.querySelector('.promo, .badge, .tag, [class*="discount"]');
      const promo_text = promoEl?.textContent?.trim();
      
      // Extract stock status
      const stockEl = element.querySelector('[class*="stock"], [class*="availability"]');
      const stockText = stockEl?.textContent?.toLowerCase() || '';
      const in_stock = !stockText.includes('out') && !stockText.includes('sold out');
      
      // Extract size/volume if present
      const sizeEl = element.querySelector('[class*="size"], [class*="volume"]');
      const size = sizeEl?.textContent?.trim();
      
      // Extract product URL
      const linkEl = element.querySelector('a');
      const url = linkEl?.href ? new URL(linkEl.href, baseUrl).href : undefined;
      
      if (regular_price) {
        products.push({
          name,
          brand,
          regular_price,
          promo_price: promo_price || undefined,
          is_on_promo: !!promo_price,
          promo_text,
          in_stock,
          size,
          url,
        });
      }
    } catch (err) {
      console.error('Error extracting product:', err);
    }
  }
  
  return products;
}

/**
 * Scrape products from a competitor URL
 * This function would use the lov-fetch-website tool on the backend
 */
export async function scrapeCompetitorProducts(url: string): Promise<ScrapeResult> {
  try {
    console.log('Scraping competitor URL:', url);
    
    // In production, this would call an edge function that uses lov-fetch-website
    // For now, we'll structure it to be called from the backend
    const response = await fetch('/api/scrape-competitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    
    if (!response.ok) {
      throw new Error(`Scrape failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      products: data.products || [],
      scraped_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Scraping error:', error);
    return {
      success: false,
      products: [],
      error: error instanceof Error ? error.message : 'Unknown scraping error',
      scraped_at: new Date().toISOString(),
    };
  }
}

/**
 * Extract products from fetched HTML (for use in edge functions)
 */
export function extractProductsFromFetchedPage(html: string, url: string): ScrapedProduct[] {
  return extractProductsFromHTML(html, url);
}

/**
 * Validate scraped product data
 */
export function validateScrapedProduct(product: ScrapedProduct): boolean {
  return !!(
    product.name &&
    product.regular_price &&
    product.regular_price > 0
  );
}

/**
 * Get scraping statistics
 */
export function getScrapingStats(results: ScrapeResult[]): {
  total_scrapes: number;
  successful: number;
  failed: number;
  total_products: number;
  avg_products_per_scrape: number;
} {
  const successful = results.filter(r => r.success).length;
  const total_products = results.reduce((sum, r) => sum + r.products.length, 0);
  
  return {
    total_scrapes: results.length,
    successful,
    failed: results.length - successful,
    total_products,
    avg_products_per_scrape: results.length > 0 ? total_products / results.length : 0,
  };
}
