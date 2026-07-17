export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          avatar_url: string;
          created_at: string;
          updated_at: string;
          phone_e164: string;
          seller_score: number;
          preferences: Json;
        };
        Insert: {
          id?: string;
          full_name?: string;
          phone?: string;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
          phone_e164?: string;
          seller_score?: number;
          preferences?: Json;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
          phone_e164?: string;
          seller_score?: number;
          preferences?: Json;
        };
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          product_data: Json;
          created_at: string;
          listing_id: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          product_id?: string;
          product_data?: Json;
          created_at?: string;
          listing_id?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          product_data?: Json;
          created_at?: string;
          listing_id?: string;
        };
        Relationships: [];
      };
      bag_items: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          product_data: Json;
          size: string;
          quantity: number;
          created_at: string;
          listing_id: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          product_id?: string;
          product_data?: Json;
          size?: string;
          quantity?: number;
          created_at?: string;
          listing_id?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          product_data?: Json;
          size?: string;
          quantity?: number;
          created_at?: string;
          listing_id?: string;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          brand: string;
          title: string;
          image: string;
          size: string;
          category: string;
          original_price: number;
          ask_price: number;
          seller_payout: number;
          declared_grade: string;
          status: string;
          created_at: string;
          updated_at: string;
          seller_id: string;
          source_order_item_id: string;
          confirmed_grade: string;
          current_price_paise: number;
          currency: string;
          verification_disposition: string;
          publish_timestamp: string;
          version: number;
        };
        Insert: {
          id?: string;
          user_id?: string;
          order_id?: string;
          brand?: string;
          title?: string;
          image?: string;
          size?: string;
          category?: string;
          original_price?: number;
          ask_price?: number;
          seller_payout?: number;
          declared_grade?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          seller_id?: string;
          source_order_item_id?: string;
          confirmed_grade?: string;
          current_price_paise?: number;
          currency?: string;
          verification_disposition?: string;
          publish_timestamp?: string;
          version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_id?: string;
          brand?: string;
          title?: string;
          image?: string;
          size?: string;
          category?: string;
          original_price?: number;
          ask_price?: number;
          seller_payout?: number;
          declared_grade?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          seller_id?: string;
          source_order_item_id?: string;
          confirmed_grade?: string;
          current_price_paise?: number;
          currency?: string;
          verification_disposition?: string;
          publish_timestamp?: string;
          version?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: string;
        };
        Insert: {
          user_id?: string;
          role?: string;
        };
        Update: {
          user_id?: string;
          role?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          recipient: string;
          phone: string;
          line1: string;
          line2: string;
          city: string;
          state: string;
          pincode: string;
          is_default: boolean;
          serviceable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          recipient?: string;
          phone?: string;
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          pincode?: string;
          is_default?: boolean;
          serviceable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recipient?: string;
          phone?: string;
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          pincode?: string;
          is_default?: boolean;
          serviceable?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          id: string;
          name: string;
          tier: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          name?: string;
          tier?: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          tier?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          parent_id: string;
          name: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          parent_id?: string;
          name?: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          parent_id?: string;
          name?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      myntra_orders: {
        Row: {
          id: string;
          user_id: string;
          delivered_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          delivered_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          delivered_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      myntra_order_items: {
        Row: {
          id: string;
          order_id: string;
          product_reference: string;
          brand_id: string;
          category_id: string;
          title: string;
          size: string;
          original_price_paise: number;
          image: string;
          quantity: number;
          status: string;
        };
        Insert: {
          id?: string;
          order_id?: string;
          product_reference?: string;
          brand_id?: string;
          category_id?: string;
          title?: string;
          size?: string;
          original_price_paise?: number;
          image?: string;
          quantity?: number;
          status?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_reference?: string;
          brand_id?: string;
          category_id?: string;
          title?: string;
          size?: string;
          original_price_paise?: number;
          image?: string;
          quantity?: number;
          status?: string;
        };
        Relationships: [];
      };
      eligibility_decisions: {
        Row: {
          order_item_id: string;
          eligible: boolean;
          rule_version: string;
          reason_code: string;
          evaluated_at: string;
          source_data_hash: string;
          reviewer_details: Json;
        };
        Insert: {
          order_item_id?: string;
          eligible?: boolean;
          rule_version?: string;
          reason_code?: string;
          evaluated_at?: string;
          source_data_hash?: string;
          reviewer_details?: Json;
        };
        Update: {
          order_item_id?: string;
          eligible?: boolean;
          rule_version?: string;
          reason_code?: string;
          evaluated_at?: string;
          source_data_hash?: string;
          reviewer_details?: Json;
        };
        Relationships: [];
      };
      listing_media: {
        Row: {
          id: string;
          listing_id: string;
          storage_key: string;
          media_type: string;
          angle: string;
          sha256: string;
          content_metadata: Json;
          capture_metadata: Json;
          sort_order: number;
          moderation_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id?: string;
          storage_key?: string;
          media_type?: string;
          angle?: string;
          sha256?: string;
          content_metadata?: Json;
          capture_metadata?: Json;
          sort_order?: number;
          moderation_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          storage_key?: string;
          media_type?: string;
          angle?: string;
          sha256?: string;
          content_metadata?: Json;
          capture_metadata?: Json;
          sort_order?: number;
          moderation_status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      verification_runs: {
        Row: {
          id: string;
          listing_id: string;
          provider: string;
          status: string;
          confidence: number;
          started_at: string;
          completed_at: string;
          raw_result_pointer: string;
          error_reason: string;
        };
        Insert: {
          id?: string;
          listing_id?: string;
          provider?: string;
          status?: string;
          confidence?: number;
          started_at?: string;
          completed_at?: string;
          raw_result_pointer?: string;
          error_reason?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          provider?: string;
          status?: string;
          confidence?: number;
          started_at?: string;
          completed_at?: string;
          raw_result_pointer?: string;
          error_reason?: string;
        };
        Relationships: [];
      };
      verification_checks: {
        Row: {
          id: string;
          verification_run_id: string;
          check_type: string;
          status: string;
          score: number;
          threshold: number;
          reason_code: string;
          evidence: Json;
        };
        Insert: {
          id?: string;
          verification_run_id?: string;
          check_type?: string;
          status?: string;
          score?: number;
          threshold?: number;
          reason_code?: string;
          evidence?: Json;
        };
        Update: {
          id?: string;
          verification_run_id?: string;
          check_type?: string;
          status?: string;
          score?: number;
          threshold?: number;
          reason_code?: string;
          evidence?: Json;
        };
        Relationships: [];
      };
      inspection_reports: {
        Row: {
          id: string;
          listing_id: string;
          inspector_id: string;
          confirmed_grade: string;
          passed: boolean;
          notes: string;
          evidence: Json;
          location: string;
          inspected_at: string;
          price_revision_data: Json;
        };
        Insert: {
          id?: string;
          listing_id?: string;
          inspector_id?: string;
          confirmed_grade?: string;
          passed?: boolean;
          notes?: string;
          evidence?: Json;
          location?: string;
          inspected_at?: string;
          price_revision_data?: Json;
        };
        Update: {
          id?: string;
          listing_id?: string;
          inspector_id?: string;
          confirmed_grade?: string;
          passed?: boolean;
          notes?: string;
          evidence?: Json;
          location?: string;
          inspected_at?: string;
          price_revision_data?: Json;
        };
        Relationships: [];
      };
      pricing_rule_versions: {
        Row: {
          id: string;
          effective_from: string;
          effective_to: string;
          factors: Json;
          commission_rate: number;
          buyer_protection_fee_paise: number;
          delivery_fee_paise: number;
          seller_deposit_paise: number;
          tax_settings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          effective_from?: string;
          effective_to?: string;
          factors?: Json;
          commission_rate?: number;
          buyer_protection_fee_paise?: number;
          delivery_fee_paise?: number;
          seller_deposit_paise?: number;
          tax_settings?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          effective_from?: string;
          effective_to?: string;
          factors?: Json;
          commission_rate?: number;
          buyer_protection_fee_paise?: number;
          delivery_fee_paise?: number;
          seller_deposit_paise?: number;
          tax_settings?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      price_quotes: {
        Row: {
          id: string;
          listing_id: string;
          rule_version_id: string;
          source_event: string;
          original_price_paise: number;
          age_years: number;
          grade: string;
          factors: Json;
          listing_price_paise: number;
          seller_payout_paise: number;
          commission_paise: number;
          fees_paise: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id?: string;
          rule_version_id?: string;
          source_event?: string;
          original_price_paise?: number;
          age_years?: number;
          grade?: string;
          factors?: Json;
          listing_price_paise?: number;
          seller_payout_paise?: number;
          commission_paise?: number;
          fees_paise?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          rule_version_id?: string;
          source_event?: string;
          original_price_paise?: number;
          age_years?: number;
          grade?: string;
          factors?: Json;
          listing_price_paise?: number;
          seller_payout_paise?: number;
          commission_paise?: number;
          fees_paise?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      listing_events: {
        Row: {
          id: string;
          listing_id: string;
          sequence: number;
          event_type: string;
          from_state: string;
          to_state: string;
          actor_type: string;
          actor_id: string;
          payload: Json;
          idempotency_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id?: string;
          sequence?: number;
          event_type?: string;
          from_state?: string;
          to_state?: string;
          actor_type?: string;
          actor_id?: string;
          payload?: Json;
          idempotency_key?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          sequence?: number;
          event_type?: string;
          from_state?: string;
          to_state?: string;
          actor_type?: string;
          actor_id?: string;
          payload?: Json;
          idempotency_key?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      resale_orders: {
        Row: {
          id: string;
          buyer_id: string;
          seller_id: string;
          listing_id: string;
          final_price_paise: number;
          payout_paise: number;
          commission_paise: number;
          buyer_fees_paise: number;
          status: string;
          shipping_address_id: string;
          buyer_protection_expiry: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id?: string;
          seller_id?: string;
          listing_id?: string;
          final_price_paise?: number;
          payout_paise?: number;
          commission_paise?: number;
          buyer_fees_paise?: number;
          status?: string;
          shipping_address_id?: string;
          buyer_protection_expiry?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          seller_id?: string;
          listing_id?: string;
          final_price_paise?: number;
          payout_paise?: number;
          commission_paise?: number;
          buyer_fees_paise?: number;
          status?: string;
          shipping_address_id?: string;
          buyer_protection_expiry?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          id: string;
          order_id: string;
          provider_payment_intent_id: string;
          type: string;
          amount_paise: number;
          currency: string;
          status: string;
          payload: Json;
          idempotency_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string;
          provider_payment_intent_id?: string;
          type?: string;
          amount_paise?: number;
          currency?: string;
          status?: string;
          payload?: Json;
          idempotency_key?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          provider_payment_intent_id?: string;
          type?: string;
          amount_paise?: number;
          currency?: string;
          status?: string;
          payload?: Json;
          idempotency_key?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          id: string;
          reference_type: string;
          reference_id: string;
          account_from: string;
          account_to: string;
          amount_paise: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          reference_type?: string;
          reference_id?: string;
          account_from?: string;
          account_to?: string;
          amount_paise?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          reference_type?: string;
          reference_id?: string;
          account_from?: string;
          account_to?: string;
          amount_paise?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      seller_payouts: {
        Row: {
          id: string;
          seller_id: string;
          order_id: string;
          amount_paise: number;
          method: string;
          status: string;
          provider_reference: string;
          released_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id?: string;
          order_id?: string;
          amount_paise?: number;
          method?: string;
          status?: string;
          provider_reference?: string;
          released_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          order_id?: string;
          amount_paise?: number;
          method?: string;
          status?: string;
          provider_reference?: string;
          released_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pickup_jobs: {
        Row: {
          id: string;
          listing_id: string;
          address_id: string;
          scheduled_slot: string;
          status: string;
          tracking_number: string;
          evidence: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id?: string;
          address_id?: string;
          scheduled_slot?: string;
          status?: string;
          tracking_number?: string;
          evidence?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          address_id?: string;
          scheduled_slot?: string;
          status?: string;
          tracking_number?: string;
          evidence?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      shipments: {
        Row: {
          id: string;
          order_id: string;
          carrier: string;
          tracking_number: string;
          status: string;
          delivery_proof: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string;
          carrier?: string;
          tracking_number?: string;
          status?: string;
          delivery_proof?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          carrier?: string;
          tracking_number?: string;
          status?: string;
          delivery_proof?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tracking_events: {
        Row: {
          id: string;
          shipment_id: string;
          status: string;
          location: string;
          description: string;
          event_payload: Json;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          shipment_id?: string;
          status?: string;
          location?: string;
          description?: string;
          event_payload?: Json;
          occurred_at?: string;
        };
        Update: {
          id?: string;
          shipment_id?: string;
          status?: string;
          location?: string;
          description?: string;
          event_payload?: Json;
          occurred_at?: string;
        };
        Relationships: [];
      };
      buyer_approvals: {
        Row: {
          id: string;
          order_id: string;
          type: string;
          old_terms: Json;
          new_terms: Json;
          status: string;
          decided_at: string;
          expiry: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string;
          type?: string;
          old_terms?: Json;
          new_terms?: Json;
          status?: string;
          decided_at?: string;
          expiry?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          type?: string;
          old_terms?: Json;
          new_terms?: Json;
          status?: string;
          decided_at?: string;
          expiry?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      disputes: {
        Row: {
          id: string;
          order_id: string;
          complainant_id: string;
          reason: string;
          evidence_urls: string;
          status: string;
          resolution: string;
          deadline: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string;
          complainant_id?: string;
          reason?: string;
          evidence_urls?: string;
          status?: string;
          resolution?: string;
          deadline?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          complainant_id?: string;
          reason?: string;
          evidence_urls?: string;
          status?: string;
          resolution?: string;
          deadline?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          template: string;
          channel: string;
          payload: Json;
          delivery_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          template?: string;
          channel?: string;
          payload?: Json;
          delivery_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template?: string;
          channel?: string;
          payload?: Json;
          delivery_status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          payload_before: Json;
          payload_after: Json;
          ip_address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          payload_before?: Json;
          payload_after?: Json;
          ip_address?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          payload_before?: Json;
          payload_after?: Json;
          ip_address?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
