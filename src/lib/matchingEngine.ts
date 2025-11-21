/**
 * Enhanced AI Product Matching Engine
 * Comprehensive similarity scoring for product matching
 */

import type { OurProduct, CompetitorProduct } from './matching';

// Marketing noise words to filter
const NOISE_WORDS = new Set([
  'akcija', 'akcijas', 'super', 'mega', 'īpaši', 'special', 'offer',
  'cena', 'price', 'labs', 'good', 'great', 'best', 'top', 'quality',
  'premium', 'deluxe', 'extra', 'new', 'jauns', 'sale', 'discount'
]);

// Brand normalization map
const BRAND_NORMALIZE: Record<string, string> = {
  'coca cola': 'cocacola',
  'coca-cola': 'cocacola',
  'coke': 'cocacola',
  'pepsi cola': 'pepsi',
  'pepsi-cola': 'pepsi',
  'rimi basic': 'rimi',
  'rimi selection': 'rimi',
  'maxima xxx': 'maxima',
  'maxima xx': 'maxima',
  'maxima x': 'maxima',
};

/**
 * Normalize text by removing noise and standardizing
 */
function normalizeText(text: string): string {
  if (!text) return '';
  
  let normalized = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\sšžčāēīūģķļņ]/g, ' ')
    .replace(/\s+/g, ' ');
  
  // Remove noise words
  const words = normalized.split(' ').filter(w => !NOISE_WORDS.has(w) && w.length > 1);
  return words.join(' ');
}

/**
 * Normalize brand name
 */
function normalizeBrand(brand: string | undefined): string {
  if (!brand) return '';
  const normalized = brand.toLowerCase().trim();
  return BRAND_NORMALIZE[normalized] || normalized;
}

/**
 * Extract size/volume from text and normalize to ml or g
 */
function extractAndNormalizeSize(text: string): number | null {
  if (!text) return null;
  
  // Match patterns like: 1.5L, 500ml, 250g, 1kg, 6x330ml
  const patterns = [
    /(\d+(?:\.\d+)?)\s*l(?:iters?)?/i,        // Liters
    /(\d+(?:\.\d+)?)\s*ml/i,                   // Milliliters
    /(\d+(?:\.\d+)?)\s*kg/i,                   // Kilograms
    /(\d+(?:\.\d+)?)\s*g(?:rams?)?/i,          // Grams
    /(\d+)x\s*(\d+(?:\.\d+)?)\s*ml/i,          // Pack: 6x330ml
    /(\d+)x\s*(\d+(?:\.\d+)?)\s*l/i,           // Pack: 4x1.5L
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[0].includes('x')) {
        // Pack size: multiply count by unit
        const count = parseFloat(match[1]);
        const unitSize = parseFloat(match[2]);
        const unit = match[0].toLowerCase();
        
        if (unit.includes('ml')) {
          return count * unitSize;
        } else if (unit.includes('l')) {
          return count * unitSize * 1000;
        }
      } else {
        const value = parseFloat(match[1]);
        const unit = match[0].toLowerCase();
        
        if (unit.includes('ml')) {
          return value;
        } else if (unit.includes('l')) {
          return value * 1000;
        } else if (unit.includes('g') && !unit.includes('kg')) {
          return value;
        } else if (unit.includes('kg')) {
          return value * 1000;
        }
      }
    }
  }
  
  return null;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate string similarity (0-1) using Levenshtein
 */
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

/**
 * Calculate token-based similarity (Jaccard coefficient)
 */
function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  
  const tokensA = new Set(a.split(' ').filter(t => t.length > 1));
  const tokensB = new Set(b.split(' ').filter(t => t.length > 1));
  
  const intersection = new Set([...tokensA].filter(t => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Calculate brand similarity
 */
function brandSimilarity(brand1: string | undefined, brand2: string | undefined): number {
  const b1 = normalizeBrand(brand1);
  const b2 = normalizeBrand(brand2);
  
  if (!b1 || !b2) return 0.5; // Unknown brands: neutral score
  if (b1 === b2) return 1.0;
  
  // Check if one contains the other
  if (b1.includes(b2) || b2.includes(b1)) return 0.8;
  
  // String similarity for close matches
  const sim = stringSimilarity(b1, b2);
  return sim > 0.7 ? sim : 0;
}

/**
 * Calculate size similarity
 */
function sizeSimilarity(size1: string | undefined, size2: string | undefined): number {
  const s1 = extractAndNormalizeSize(size1 || '');
  const s2 = extractAndNormalizeSize(size2 || '');
  
  if (!s1 || !s2) return 0.5; // Unknown sizes: neutral score
  if (s1 === s2) return 1.0;
  
  // Allow 5% tolerance
  const diff = Math.abs(s1 - s2);
  const avg = (s1 + s2) / 2;
  const tolerance = avg * 0.05;
  
  if (diff <= tolerance) return 1.0;
  
  // Gradual decay for larger differences
  const ratio = Math.min(s1, s2) / Math.max(s1, s2);
  return Math.max(0, ratio);
}

/**
 * Calculate category similarity
 */
function categorySimilarity(cat1: string | undefined, cat2: string | undefined): number {
  if (!cat1 || !cat2) return 0.5; // Unknown: neutral
  
  const c1 = normalizeText(cat1);
  const c2 = normalizeText(cat2);
  
  if (c1 === c2) return 1.0;
  
  // Check for containment
  if (c1.includes(c2) || c2.includes(c1)) return 0.8;
  
  // Token overlap
  return tokenSimilarity(c1, c2);
}

/**
 * Main matching function: calculate comprehensive similarity score
 */
export function calculateMatchScore(
  ourProduct: OurProduct,
  competitorProduct: CompetitorProduct
): {
  score: number;
  components: {
    nameSimilarity: number;
    brandSimilarity: number;
    sizeSimilarity: number;
    categorySimilarity: number;
  };
} {
  // Normalize names
  const ourName = normalizeText(ourProduct.name);
  const compName = normalizeText(competitorProduct.name);
  
  // Calculate name similarity (both string and token based)
  const nameStringSim = stringSimilarity(ourName, compName);
  const nameTokenSim = tokenSimilarity(ourName, compName);
  const nameSim = Math.max(nameStringSim, nameTokenSim);
  
  // Calculate other components
  const brandSim = brandSimilarity(ourProduct.brand, competitorProduct.brand);
  const sizeSim = sizeSimilarity(
    ourProduct.size || ourProduct.name,
    competitorProduct.size || competitorProduct.name
  );
  const catSim = categorySimilarity(
    ourProduct.category || ourProduct.subcategory,
    competitorProduct.category
  );
  
  // Weighted combination
  const score =
    0.40 * nameSim +
    0.25 * brandSim +
    0.20 * sizeSim +
    0.15 * catSim;
  
  return {
    score: Math.round(score * 1000) / 1000, // Round to 3 decimals
    components: {
      nameSimilarity: Math.round(nameSim * 1000) / 1000,
      brandSimilarity: Math.round(brandSim * 1000) / 1000,
      sizeSimilarity: Math.round(sizeSim * 1000) / 1000,
      categorySimilarity: Math.round(catSim * 1000) / 1000,
    },
  };
}

/**
 * Classify mapping status based on score
 */
export function classifyMappingStatus(score: number): 'auto_matched' | 'pending' | 'rejected' {
  if (score >= 0.85) return 'auto_matched';
  if (score >= 0.60) return 'pending';
  return 'rejected';
}

/**
 * Batch match: find best matches for our product from competitor list
 */
export function findBestMatches(
  ourProduct: OurProduct,
  competitorProducts: CompetitorProduct[],
  topN: number = 5
): Array<{
  competitorProduct: CompetitorProduct;
  score: number;
  status: string;
  components: any;
}> {
  const matches = competitorProducts.map(comp => {
    const result = calculateMatchScore(ourProduct, comp);
    return {
      competitorProduct: comp,
      score: result.score,
      status: classifyMappingStatus(result.score),
      components: result.components,
    };
  });
  
  // Sort by score descending and return top N
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .filter(m => m.score >= 0.5); // Only return reasonable matches
}
