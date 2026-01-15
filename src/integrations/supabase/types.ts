export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abc_settings: {
        Row: {
          analysis_period_days: number
          created_at: string | null
          id: string
          last_calculated_at: string | null
          threshold_a_percent: number
          threshold_b_percent: number
          threshold_c_percent: number
          updated_at: string | null
        }
        Insert: {
          analysis_period_days?: number
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          threshold_a_percent?: number
          threshold_b_percent?: number
          threshold_c_percent?: number
          updated_at?: string | null
        }
        Update: {
          analysis_period_days?: number
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          threshold_a_percent?: number
          threshold_b_percent?: number
          threshold_c_percent?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          created_at: string | null
          expected_impact: string | null
          expires_at: string | null
          id: string
          impact_category: string | null
          insight: string
          is_dismissed: boolean | null
          recommendation: string
          severity: string
          store_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          expected_impact?: string | null
          expires_at?: string | null
          id?: string
          impact_category?: string | null
          insight: string
          is_dismissed?: boolean | null
          recommendation: string
          severity: string
          store_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          expected_impact?: string | null
          expires_at?: string | null
          id?: string
          impact_category?: string | null
          insight?: string
          is_dismissed?: boolean | null
          recommendation?: string
          severity?: string
          store_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      category_metrics: {
        Row: {
          avg_rotation_days: number | null
          category: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          promo_revenue_share: number
          sku_count: number
          slow_movers_count: number
          tenant_id: string
          total_margin: number
          total_revenue: number
          total_units: number
          updated_at: string
        }
        Insert: {
          avg_rotation_days?: number | null
          category: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          promo_revenue_share?: number
          sku_count?: number
          slow_movers_count?: number
          tenant_id: string
          total_margin?: number
          total_revenue?: number
          total_units?: number
          updated_at?: string
        }
        Update: {
          avg_rotation_days?: number | null
          category?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          promo_revenue_share?: number
          sku_count?: number
          slow_movers_count?: number
          tenant_id?: string
          total_margin?: number
          total_revenue?: number
          total_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_price_history: {
        Row: {
          competitor_product_id: string
          created_at: string
          date: string
          id: string
          note: string | null
          price: number
          promo_flag: boolean | null
          tenant_id: string
        }
        Insert: {
          competitor_product_id: string
          created_at?: string
          date: string
          id?: string
          note?: string | null
          price: number
          promo_flag?: boolean | null
          tenant_id: string
        }
        Update: {
          competitor_product_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          price?: number
          promo_flag?: boolean | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_price_history_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "competitor_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_price_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_product_mapping: {
        Row: {
          ai_similarity_score: number | null
          competitor_brand: string | null
          competitor_id: string | null
          competitor_product_name: string
          competitor_product_sku: string | null
          competitor_product_url: string | null
          competitor_size: string | null
          created_at: string
          id: string
          mapping_status: string
          our_product_id: string | null
          updated_at: string
        }
        Insert: {
          ai_similarity_score?: number | null
          competitor_brand?: string | null
          competitor_id?: string | null
          competitor_product_name: string
          competitor_product_sku?: string | null
          competitor_product_url?: string | null
          competitor_size?: string | null
          created_at?: string
          id?: string
          mapping_status?: string
          our_product_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_similarity_score?: number | null
          competitor_brand?: string | null
          competitor_id?: string | null
          competitor_product_name?: string
          competitor_product_sku?: string | null
          competitor_product_url?: string | null
          competitor_size?: string | null
          created_at?: string
          id?: string
          mapping_status?: string
          our_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_product_mapping_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_product_mapping_our_product_id_fkey"
            columns: ["our_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_products: {
        Row: {
          barcode: string | null
          category_hint: string | null
          competitor_id: string
          competitor_name: string
          competitor_sku: string | null
          created_at: string
          id: string
          our_product_id: string | null
          tenant_id: string
        }
        Insert: {
          barcode?: string | null
          category_hint?: string | null
          competitor_id: string
          competitor_name: string
          competitor_sku?: string | null
          created_at?: string
          id?: string
          our_product_id?: string | null
          tenant_id: string
        }
        Update: {
          barcode?: string | null
          category_hint?: string | null
          competitor_id?: string
          competitor_name?: string
          competitor_sku?: string | null
          created_at?: string
          id?: string
          our_product_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_products_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_products_our_product_id_fkey"
            columns: ["our_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_promotion_items: {
        Row: {
          competitor_brand: string | null
          competitor_product_name: string
          competitor_product_url: string | null
          competitor_size: string | null
          created_at: string
          currency: string
          id: string
          linked_mapping_id: string | null
          promo_label: string | null
          promo_price: number
          promotion_id: string | null
          regular_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          competitor_brand?: string | null
          competitor_product_name: string
          competitor_product_url?: string | null
          competitor_size?: string | null
          created_at?: string
          currency?: string
          id?: string
          linked_mapping_id?: string | null
          promo_label?: string | null
          promo_price: number
          promotion_id?: string | null
          regular_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          competitor_brand?: string | null
          competitor_product_name?: string
          competitor_product_url?: string | null
          competitor_size?: string | null
          created_at?: string
          currency?: string
          id?: string
          linked_mapping_id?: string | null
          promo_label?: string | null
          promo_price?: number
          promotion_id?: string | null
          regular_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_promotion_items_linked_mapping_id_fkey"
            columns: ["linked_mapping_id"]
            isOneToOne: false
            referencedRelation: "competitor_product_mapping"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_promotion_items_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "competitor_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_promotions: {
        Row: {
          competitor_id: string | null
          created_at: string
          file_path: string | null
          id: string
          items_count: number | null
          processed: boolean
          source_type: string
          source_url: string | null
          title: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          competitor_id?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          items_count?: number | null
          processed?: boolean
          source_type: string
          source_url?: string | null
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          competitor_id?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          items_count?: number | null
          processed?: boolean
          source_type?: string
          source_url?: string | null
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_promotions_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          last_catalog_scrape: string | null
          last_promo_scrape: string | null
          name: string
          notes: string | null
          scraping_enabled: boolean | null
          scraping_url: string | null
          tenant_id: string | null
          type: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          last_catalog_scrape?: string | null
          last_promo_scrape?: string | null
          name: string
          notes?: string | null
          scraping_enabled?: boolean | null
          scraping_url?: string | null
          tenant_id?: string | null
          type?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          last_catalog_scrape?: string | null
          last_promo_scrape?: string | null
          name?: string
          notes?: string | null
          scraping_enabled?: boolean | null
          scraping_url?: string | null
          tenant_id?: string | null
          type?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_name: string | null
          id: string
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          status?: string
          tenant_id: string
          type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          created_at: string
          date_from: string | null
          date_to: string | null
          description: string | null
          id: string
          product_id: string | null
          promotion_id: string | null
          severity: string | null
          store_id: string | null
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          description?: string | null
          id?: string
          product_id?: string | null
          promotion_id?: string | null
          severity?: string | null
          store_id?: string | null
          tenant_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          description?: string | null
          id?: string
          product_id?: string | null
          promotion_id?: string | null
          severity?: string | null
          store_id?: string | null
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_targets: {
        Row: {
          created_at: string | null
          critical_threshold: number | null
          id: string
          kpi_category: string
          kpi_name: string
          scope: string
          store_id: string | null
          target_value: number
          tenant_id: string
          unit: string | null
          updated_at: string | null
          warning_threshold: number | null
        }
        Insert: {
          created_at?: string | null
          critical_threshold?: number | null
          id?: string
          kpi_category: string
          kpi_name: string
          scope: string
          store_id?: string | null
          target_value: number
          tenant_id: string
          unit?: string | null
          updated_at?: string | null
          warning_threshold?: number | null
        }
        Update: {
          created_at?: string | null
          critical_threshold?: number | null
          id?: string
          kpi_category?: string
          kpi_name?: string
          scope?: string
          store_id?: string | null
          target_value?: number
          tenant_id?: string
          unit?: string | null
          updated_at?: string | null
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_targets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leaflet_items: {
        Row: {
          created_at: string
          id: string
          leaflet_page_id: string
          note: string | null
          position_on_page: number | null
          product_id: string
          promotion_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          leaflet_page_id: string
          note?: string | null
          position_on_page?: number | null
          product_id: string
          promotion_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          leaflet_page_id?: string
          note?: string | null
          position_on_page?: number | null
          product_id?: string
          promotion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaflet_items_leaflet_page_id_fkey"
            columns: ["leaflet_page_id"]
            isOneToOne: false
            referencedRelation: "leaflet_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaflet_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaflet_items_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      leaflet_pages: {
        Row: {
          created_at: string
          id: string
          leaflet_id: string
          page_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          leaflet_id: string
          page_number: number
        }
        Update: {
          created_at?: string
          id?: string
          leaflet_id?: string
          page_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaflet_pages_leaflet_id_fkey"
            columns: ["leaflet_id"]
            isOneToOne: false
            referencedRelation: "leaflets"
            referencedColumns: ["id"]
          },
        ]
      }
      leaflets: {
        Row: {
          created_at: string
          id: string
          name: string
          period_end: string
          period_start: string
          tenant_id: string
          total_pages: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          period_end: string
          period_start: string
          tenant_id: string
          total_pages?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          period_end?: string
          period_start?: string
          tenant_id?: string
          total_pages?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leaflets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      market_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_name: string | null
          id: string
          source: string
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          source: string
          status?: string
          tenant_id: string
          type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          source?: string
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          cost_price: number | null
          created_at: string
          id: string
          product_id: string
          promo_price: number | null
          regular_price: number
          store_id: string | null
          tenant_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          id?: string
          product_id: string
          promo_price?: number | null
          regular_price: number
          store_id?: string | null
          tenant_id: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          id?: string
          product_id?: string
          promo_price?: number | null
          regular_price?: number
          store_id?: string | null
          tenant_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_recommendations: {
        Row: {
          abc_class: string | null
          category_id: string | null
          competitor_avg_price: number | null
          created_at: string
          current_cost_price: number | null
          current_price: number
          id: string
          product_id: string
          reasoning: string | null
          recommended_change_percent: number
          recommended_price: number
          status: string | null
          store_id: string | null
          tenant_id: string
        }
        Insert: {
          abc_class?: string | null
          category_id?: string | null
          competitor_avg_price?: number | null
          created_at?: string
          current_cost_price?: number | null
          current_price: number
          id?: string
          product_id: string
          reasoning?: string | null
          recommended_change_percent: number
          recommended_price: number
          status?: string | null
          store_id?: string | null
          tenant_id: string
        }
        Update: {
          abc_class?: string | null
          category_id?: string | null
          competitor_avg_price?: number | null
          created_at?: string
          current_cost_price?: number | null
          current_price?: number
          id?: string
          product_id?: string
          reasoning?: string | null
          recommended_change_percent?: number
          recommended_price?: number
          status?: string | null
          store_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_recommendations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_recommendations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_recommendations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          created_at: string
          id: string
          key: string
          product_id: string
          tenant_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          product_id: string
          tenant_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          product_id?: string
          tenant_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attributes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_elasticity: {
        Row: {
          calculated_at: string
          confidence: number
          created_at: string
          data_points: number
          elasticity_coefficient: number
          id: string
          product_id: string
          sensitivity_label: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          confidence: number
          created_at?: string
          data_points: number
          elasticity_coefficient: number
          id?: string
          product_id: string
          sensitivity_label: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          confidence?: number
          created_at?: string
          data_points?: number
          elasticity_coefficient?: number
          id?: string
          product_id?: string
          sensitivity_label?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_elasticity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_elasticity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          abc_category: string | null
          barcode: string | null
          base_unit: string | null
          brand: string | null
          category_id: string | null
          category_role: string | null
          cost_price: number
          created_at: string | null
          currency: string | null
          current_price: number
          id: string
          is_private_label: boolean | null
          name: string
          sku: string
          status: string | null
          subcategory: string | null
          tenant_id: string | null
          updated_at: string | null
          vat_rate: number | null
        }
        Insert: {
          abc_category?: string | null
          barcode?: string | null
          base_unit?: string | null
          brand?: string | null
          category_id?: string | null
          category_role?: string | null
          cost_price: number
          created_at?: string | null
          currency?: string | null
          current_price: number
          id?: string
          is_private_label?: boolean | null
          name: string
          sku: string
          status?: string | null
          subcategory?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Update: {
          abc_category?: string | null
          barcode?: string | null
          base_unit?: string | null
          brand?: string | null
          category_id?: string | null
          category_role?: string | null
          cost_price?: number
          created_at?: string | null
          currency?: string | null
          current_price?: number
          id?: string
          is_private_label?: boolean | null
          name?: string
          sku?: string
          status?: string | null
          subcategory?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      promotion_products: {
        Row: {
          created_at: string
          discount_percent: number | null
          id: string
          product_id: string
          promo_price: number | null
          promotion_id: string
          store_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          product_id: string
          promo_price?: number | null
          promotion_id: string
          store_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          product_id?: string
          promo_price?: number | null
          promotion_id?: string
          store_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          channel: string | null
          created_at: string
          description: string | null
          end_date: string
          id: string
          mechanics: string | null
          name: string
          start_date: string
          tenant_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          mechanics?: string | null
          name: string
          start_date: string
          tenant_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          mechanics?: string | null
          name?: string
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_daily: {
        Row: {
          created_at: string
          id: string
          id_receipt: string | null
          product_id: string
          promo_flag: boolean | null
          promotion_id: string | null
          purchase_price: number | null
          reg_date: string
          selling_price: number | null
          store_id: string
          tenant_id: string
          units_sold: number
        }
        Insert: {
          created_at?: string
          id?: string
          id_receipt?: string | null
          product_id: string
          promo_flag?: boolean | null
          promotion_id?: string | null
          purchase_price?: number | null
          reg_date: string
          selling_price?: number | null
          store_id: string
          tenant_id: string
          units_sold: number
        }
        Update: {
          created_at?: string
          id?: string
          id_receipt?: string | null
          product_id?: string
          promo_flag?: boolean | null
          promotion_id?: string | null
          purchase_price?: number | null
          reg_date?: string
          selling_price?: number | null
          store_id?: string
          tenant_id?: string
          units_sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_daily_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_daily_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_jobs: {
        Row: {
          attempts: number
          competitor_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          matched_products_count: number | null
          payload: Json
          scraped_products_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          competitor_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          matched_products_count?: number | null
          payload?: Json
          scraped_products_count?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          competitor_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          matched_products_count?: number | null
          payload?: Json
          scraped_products_count?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_price_config: {
        Row: {
          abc_a_max_discount_percent: number
          abc_b_max_discount_percent: number
          abc_c_max_discount_percent: number
          created_at: string
          global_min_margin_percent: number
          id: string
          match_competitor_promo: boolean
          never_below_competitor_min: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          abc_a_max_discount_percent?: number
          abc_b_max_discount_percent?: number
          abc_c_max_discount_percent?: number
          created_at?: string
          global_min_margin_percent?: number
          id?: string
          match_competitor_promo?: boolean
          never_below_competitor_min?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          abc_a_max_discount_percent?: number
          abc_b_max_discount_percent?: number
          abc_c_max_discount_percent?: number
          created_at?: string
          global_min_margin_percent?: number
          id?: string
          match_competitor_promo?: boolean
          never_below_competitor_min?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_price_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          created_at: string
          date: string
          id: string
          product_id: string
          stock_units: number
          store_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          product_id: string
          stock_units: number
          store_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          product_id?: string
          stock_units?: number
          store_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          city: string | null
          code: string
          country: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
        }
        Insert: {
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
        }
        Update: {
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_onboarding: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          kpi_setup_completed: boolean | null
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          kpi_setup_completed?: boolean | null
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          kpi_setup_completed?: boolean | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_onboarding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tenants: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_sales: {
        Row: {
          created_at: string
          gross_margin: number
          id: string
          mapped: boolean
          partner: string
          period_type: string
          product_id: string | null
          stock_end: number | null
          tenant_id: string
          units_sold: number
          updated_at: string
          week_end: string
        }
        Insert: {
          created_at?: string
          gross_margin?: number
          id?: string
          mapped?: boolean
          partner: string
          period_type: string
          product_id?: string | null
          stock_end?: number | null
          tenant_id: string
          units_sold?: number
          updated_at?: string
          week_end: string
        }
        Update: {
          created_at?: string
          gross_margin?: number
          id?: string
          mapped?: boolean
          partner?: string
          period_type?: string
          product_id?: string | null
          stock_end?: number | null
          tenant_id?: string
          units_sold?: number
          updated_at?: string
          week_end?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_weekly_sales_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_weekly_sales_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_stock_snapshots: {
        Row: {
          created_at: string
          id: string
          product_id: string
          stock_quantity: number
          store_id: string | null
          tenant_id: string
          updated_at: string
          week_end: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          stock_quantity?: number
          store_id?: string | null
          tenant_id: string
          updated_at?: string
          week_end: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          stock_quantity?: number
          store_id?: string | null
          tenant_id?: string
          updated_at?: string
          week_end?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_stock_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_stock_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_stock_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_abc_revenue_breakdown: {
        Args: { p_date_from: string; p_date_to?: string }
        Returns: {
          abc_category: string
          product_count: number
          revenue: number
        }[]
      }
      get_available_weeks: {
        Args: { p_tenant_id: string }
        Returns: {
          record_count: number
          week_end: string
        }[]
      }
      get_category_sales_summary: {
        Args: { p_date_from: string; p_date_to?: string }
        Returns: {
          category_name: string
          product_count: number
          total_revenue: number
          total_units: number
        }[]
      }
      get_products_abc_distribution: {
        Args: never
        Returns: {
          abc_category: string
          product_count: number
        }[]
      }
      get_sales_summary: {
        Args: { p_date_from: string; p_date_to?: string }
        Returns: {
          avg_receipt: number
          receipt_count: number
          total_costs: number
          total_revenue: number
          total_units: number
          transaction_count: number
        }[]
      }
      get_store_sales_summary: {
        Args: { p_date_from: string; p_date_to?: string }
        Returns: {
          avg_receipt: number
          receipt_count: number
          store_id: string
          total_revenue: number
          total_units: number
        }[]
      }
      get_weekly_sales_summary: {
        Args: { p_tenant_id: string; p_week_end: string }
        Returns: {
          category_name: string
          gross_margin: number
          product_brand: string
          product_id: string
          product_name: string
          product_sku: string
          stock_end: number
          units_sold: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_access: { Args: { _tenant_id: string }; Returns: boolean }
      has_tenant_role: {
        Args: { _role: string; _tenant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "analyst"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "analyst"],
    },
  },
} as const
