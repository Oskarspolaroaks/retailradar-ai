/**
 * Price Comparison and Analysis Logic
 * Compares our prices with competitor prices and generates insights
 */

export type PricePosition =
  | 'cheaper_than_all'
  | 'cheaper_than_avg'
  | 'around_avg'
  | 'more_expensive_than_avg'
  | 'more_expensive_than_all'
  | 'no_competitor_data';

export interface CompetitorPriceData {
  competitor_name: string;
  price: number;
  is_on_promo: boolean;
  promo_price?: number;
  date: string;
}

export interface PriceComparison {
  our_price: number;
  competitor_min_price: number;
  competitor_avg_price: number;
  competitor_max_price: number;
  competitor_discount_price?: number; // Lowest promo price
  price_position: PricePosition;
  price_difference_vs_avg: number; // Percentage
  price_difference_vs_min: number; // Percentage
  total_competitors: number;
  competitors_with_promo: number;
}

/**
 * Calculate price position relative to competitors
 */
export function calculatePricePosition(
  ourPrice: number,
  competitorPrices: number[]
): PricePosition {
  if (competitorPrices.length === 0) {
    return 'no_competitor_data';
  }
  
  const min = Math.min(...competitorPrices);
  const max = Math.max(...competitorPrices);
  const avg = competitorPrices.reduce((sum, p) => sum + p, 0) / competitorPrices.length;
  
  // Define thresholds
  const AROUND_AVG_THRESHOLD = 0.05; // ±5%
  
  if (ourPrice < min) {
    return 'cheaper_than_all';
  }
  
  if (ourPrice > max) {
    return 'more_expensive_than_all';
  }
  
  const diffFromAvg = (ourPrice - avg) / avg;
  
  if (Math.abs(diffFromAvg) <= AROUND_AVG_THRESHOLD) {
    return 'around_avg';
  }
  
  if (diffFromAvg < 0) {
    return 'cheaper_than_avg';
  }
  
  return 'more_expensive_than_avg';
}

/**
 * Analyze price comparison for a product
 */
export function analyzePriceComparison(
  ourPrice: number,
  competitorData: CompetitorPriceData[]
): PriceComparison | null {
  if (competitorData.length === 0) {
    return null;
  }
  
  // Extract regular prices
  const regularPrices = competitorData.map(c => c.price);
  
  // Extract promo prices
  const promoPrices = competitorData
    .filter(c => c.is_on_promo && c.promo_price)
    .map(c => c.promo_price!);
  
  const min = Math.min(...regularPrices);
  const max = Math.max(...regularPrices);
  const avg = regularPrices.reduce((sum, p) => sum + p, 0) / regularPrices.length;
  const lowestPromo = promoPrices.length > 0 ? Math.min(...promoPrices) : undefined;
  
  const position = calculatePricePosition(ourPrice, regularPrices);
  const diffVsAvg = ((ourPrice - avg) / avg) * 100;
  const diffVsMin = ((ourPrice - min) / min) * 100;
  
  return {
    our_price: ourPrice,
    competitor_min_price: min,
    competitor_avg_price: avg,
    competitor_max_price: max,
    competitor_discount_price: lowestPromo,
    price_position: position,
    price_difference_vs_avg: Math.round(diffVsAvg * 100) / 100,
    price_difference_vs_min: Math.round(diffVsMin * 100) / 100,
    total_competitors: competitorData.length,
    competitors_with_promo: promoPrices.length,
  };
}

/**
 * Get price position label (user-friendly)
 */
export function getPricePositionLabel(position: PricePosition): string {
  const labels: Record<PricePosition, string> = {
    cheaper_than_all: 'Cheapest in Market',
    cheaper_than_avg: 'Below Average',
    around_avg: 'At Market Average',
    more_expensive_than_avg: 'Above Average',
    more_expensive_than_all: 'Most Expensive',
    no_competitor_data: 'No Data',
  };
  
  return labels[position];
}

/**
 * Get price position color (for UI)
 */
export function getPricePositionColor(position: PricePosition): string {
  const colors: Record<PricePosition, string> = {
    cheaper_than_all: 'text-blue-600',
    cheaper_than_avg: 'text-green-600',
    around_avg: 'text-gray-600',
    more_expensive_than_avg: 'text-orange-600',
    more_expensive_than_all: 'text-red-600',
    no_competitor_data: 'text-gray-400',
  };
  
  return colors[position];
}

/**
 * Determine if price position is risky
 */
export function isPricePositionRisky(
  position: PricePosition,
  margin: number,
  targetMargin: number
): boolean {
  // Risky if:
  // 1. More expensive than all competitors, OR
  // 2. More expensive than average AND margin below target
  return (
    position === 'more_expensive_than_all' ||
    (position === 'more_expensive_than_avg' && margin < targetMargin)
  );
}

/**
 * Determine if there's a pricing opportunity
 */
export function hasPricingOpportunity(
  position: PricePosition,
  margin: number,
  targetMargin: number
): boolean {
  // Opportunity if:
  // 1. Cheaper than average AND margin below target (room to increase)
  // 2. Cheaper than all AND margin significantly below target
  return (
    (position === 'cheaper_than_avg' && margin < targetMargin) ||
    (position === 'cheaper_than_all' && margin < targetMargin - 5)
  );
}

/**
 * Generate pricing recommendation based on comparison
 */
export function generatePricingRecommendation(
  comparison: PriceComparison,
  currentMargin: number,
  targetMargin: number,
  abcClass: string,
  salesTrend: 'growing' | 'stable' | 'declining'
): {
  action: 'increase' | 'decrease' | 'maintain';
  suggested_price?: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const { price_position, price_difference_vs_avg, our_price, competitor_avg_price } = comparison;
  
  // A-class products: be conservative
  if (abcClass === 'A') {
    if (price_position === 'cheaper_than_all' && salesTrend === 'growing' && currentMargin < targetMargin) {
      const suggested = Math.min(our_price * 1.03, competitor_avg_price * 0.95);
      return {
        action: 'increase',
        suggested_price: Math.round(suggested * 100) / 100,
        reason: 'Strong A-class product with growth potential, room to increase price while staying competitive',
        confidence: 'high',
      };
    }
    
    if (price_position === 'more_expensive_than_all' && salesTrend === 'declining') {
      const suggested = competitor_avg_price;
      return {
        action: 'decrease',
        suggested_price: Math.round(suggested * 100) / 100,
        reason: 'A-class product losing volume due to high price, align with market average',
        confidence: 'high',
      };
    }
  }
  
  // C-class products: can be more aggressive
  if (abcClass === 'C') {
    if (price_position === 'more_expensive_than_avg' && salesTrend !== 'growing') {
      const suggested = competitor_avg_price * 0.95;
      return {
        action: 'decrease',
        suggested_price: Math.round(suggested * 100) / 100,
        reason: 'C-class product: reduce price to stimulate volume and regain competitiveness',
        confidence: 'medium',
      };
    }
  }
  
  // General rules
  if (price_position === 'cheaper_than_all' && currentMargin < targetMargin && price_difference_vs_avg < -10) {
    const suggested = Math.min(our_price * 1.05, competitor_avg_price * 0.9);
    return {
      action: 'increase',
      suggested_price: Math.round(suggested * 100) / 100,
      reason: 'Significantly underpriced vs market with margin below target',
      confidence: 'high',
    };
  }
  
  if (price_position === 'more_expensive_than_all' && salesTrend === 'declining') {
    return {
      action: 'decrease',
      suggested_price: Math.round(competitor_avg_price * 100) / 100,
      reason: 'Losing sales due to uncompetitive pricing',
      confidence: 'high',
    };
  }
  
  if (currentMargin < targetMargin && price_position === 'around_avg') {
    const suggested = our_price * 1.02;
    return {
      action: 'increase',
      suggested_price: Math.round(suggested * 100) / 100,
      reason: 'Margin below target with competitive position allows small increase',
      confidence: 'medium',
    };
  }
  
  return {
    action: 'maintain',
    reason: 'Price is appropriately positioned given current market conditions',
    confidence: 'medium',
  };
}
