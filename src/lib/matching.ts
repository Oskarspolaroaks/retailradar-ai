/**
 * AI Product Matching Engine
 * Matches our products with competitor products using multiple similarity metrics
 */

export interface OurProduct {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  size?: string;
  volume?: string;
  weight?: string;
  sku: string;
  barcode?: string;
  base_unit?: string;
}

export interface CompetitorProduct {
  id?: string;
  name: string;
  brand?: string;
  price?: number;
  promo_price?: number;
  size?: string;
  url?: string;
  in_stock?: boolean;
  sku?: string;
  category?: string;
  barcode?: string;
}

interface MatchResult {
  competitor_product: CompetitorProduct;
  similarity_score: number;
  match_reasons: string[];
}

// Keep legacy type for backward compatibility
type ProductToMatch = OurProduct;

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const costs: number[] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  
  return costs[s2.length];
}

/**
 * Calculate normalized similarity (0-1) using Levenshtein distance
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Extract numeric values from text (e.g., "500ml" -> 500)
 */
function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+\.?\d*/g);
  return matches ? matches.map(m => parseFloat(m)) : [];
}

/**
 * Calculate token overlap similarity
 */
function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Calculate numeric attribute similarity (volume, size, weight)
 */
function numericSimilarity(ourProduct: ProductToMatch, competitorProduct: CompetitorProduct): number {
  const ourText = `${ourProduct.name} ${ourProduct.size || ''} ${ourProduct.volume || ''} ${ourProduct.weight || ''}`;
  const compText = `${competitorProduct.name} ${competitorProduct.size || ''}`;
  
  const ourNumbers = extractNumbers(ourText);
  const compNumbers = extractNumbers(compText);
  
  if (ourNumbers.length === 0 || compNumbers.length === 0) return 0;
  
  // Check if any numbers are close (within 10% tolerance)
  for (const ourNum of ourNumbers) {
    for (const compNum of compNumbers) {
      const diff = Math.abs(ourNum - compNum) / Math.max(ourNum, compNum);
      if (diff < 0.1) return 0.9; // Very close match
      if (diff < 0.2) return 0.7; // Close match
    }
  }
  
  return 0;
}

/**
 * Calculate brand similarity
 */
function brandSimilarity(ourBrand?: string, competitorBrand?: string): number {
  if (!ourBrand || !competitorBrand) return 0;
  
  const b1 = ourBrand.toLowerCase().trim();
  const b2 = competitorBrand.toLowerCase().trim();
  
  if (b1 === b2) return 1.0;
  if (b1.includes(b2) || b2.includes(b1)) return 0.8;
  
  return stringSimilarity(b1, b2);
}

/**
 * Match a product against competitor products
 */
export function matchProduct(
  ourProduct: ProductToMatch,
  competitorProducts: CompetitorProduct[]
): MatchResult[] {
  const results: MatchResult[] = [];
  
  for (const compProduct of competitorProducts) {
    const reasons: string[] = [];
    let totalScore = 0;
    let weights = 0;
    
    // Name similarity (weight: 40%)
    const nameSim = stringSimilarity(ourProduct.name, compProduct.name);
    const tokenSim = tokenSimilarity(ourProduct.name, compProduct.name);
    const nameScore = Math.max(nameSim, tokenSim);
    totalScore += nameScore * 0.4;
    weights += 0.4;
    
    if (nameScore > 0.7) {
      reasons.push(`Strong name match (${(nameScore * 100).toFixed(0)}%)`);
    }
    
    // Brand similarity (weight: 25%)
    const brandScore = brandSimilarity(ourProduct.brand, compProduct.brand);
    if (brandScore > 0) {
      totalScore += brandScore * 0.25;
      weights += 0.25;
      
      if (brandScore === 1.0) {
        reasons.push('Exact brand match');
      } else if (brandScore > 0.7) {
        reasons.push('Similar brand');
      }
    }
    
    // Numeric attributes (weight: 25%)
    const numScore = numericSimilarity(ourProduct, compProduct);
    if (numScore > 0) {
      totalScore += numScore * 0.25;
      weights += 0.25;
      
      if (numScore > 0.8) {
        reasons.push('Matching size/volume');
      }
    }
    
    // Category similarity (weight: 10%)
    if (ourProduct.category && compProduct.name) {
      const catSim = tokenSimilarity(ourProduct.category, compProduct.name);
      if (catSim > 0.3) {
        totalScore += catSim * 0.1;
        weights += 0.1;
        reasons.push('Category match');
      }
    }
    
    // Normalize score
    const finalScore = weights > 0 ? totalScore / weights : 0;
    
    if (finalScore > 0.3) { // Only include reasonable matches
      results.push({
        competitor_product: compProduct,
        similarity_score: Math.round(finalScore * 100) / 100,
        match_reasons: reasons,
      });
    }
  }
  
  // Sort by similarity score (highest first)
  return results.sort((a, b) => b.similarity_score - a.similarity_score);
}

/**
 * Determine if a match is good enough for auto-approval
 */
export function isAutoApprovalCandidate(match: MatchResult): boolean {
  // Auto-approve if:
  // - Similarity score > 0.85 AND
  // - Has exact brand match OR matching size
  return (
    match.similarity_score > 0.85 &&
    (match.match_reasons.some(r => r.includes('Exact brand match')) ||
     match.match_reasons.some(r => r.includes('Matching size')))
  );
}

/**
 * Get match quality label
 */
export function getMatchQualityLabel(score: number): string {
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.75) return 'Very Good';
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Fair';
  return 'Poor';
}
