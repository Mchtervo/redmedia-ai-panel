/**
 * Supabase `public` şemasından elle derlenmiştir (bkz. `supabase/migrations/`).
 *
 * Not: Bu proje ortamında Supabase CLI ile canlı bağlantı/DB şifresi
 * kullanılamadığı için `supabase gen types typescript` çalıştırılamadı;
 * bu dosya migration SQL'lerinden birebir çıkarıldı ve REST API üzerinden
 * (salt-okuma) 25 tablonun canlıda var olduğu doğrulandı. Supabase CLI/DB
 * erişimi mevcut olduğunda, doğruluğu garanti etmek için
 * `supabase gen types typescript --project-id <ref> --schema public`
 * ile yeniden üretilmesi ve bu dosyanın üzerine yazılması önerilir.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: "admin" | "agent";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: "admin" | "agent";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: "admin" | "agent";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_settings: {
        Row: {
          id: string;
          business_name: string;
          timezone: string;
          default_currency: string;
          contact_email: string | null;
          contact_phone: string | null;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name?: string;
          timezone?: string;
          default_currency?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          settings?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          timezone?: string;
          default_currency?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      ad_accounts: {
        Row: {
          id: string;
          meta_account_id: string;
          name: string | null;
          currency: string | null;
          timezone: string | null;
          status: "active" | "disabled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meta_account_id: string;
          name?: string | null;
          currency?: string | null;
          timezone?: string | null;
          status?: "active" | "disabled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          meta_account_id?: string;
          name?: string | null;
          currency?: string | null;
          timezone?: string | null;
          status?: "active" | "disabled";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          ad_account_id: string;
          meta_campaign_id: string;
          name: string | null;
          objective: string | null;
          status: "active" | "paused" | "archived" | "deleted" | null;
          daily_budget: number | null;
          lifetime_budget: number | null;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ad_account_id: string;
          meta_campaign_id: string;
          name?: string | null;
          objective?: string | null;
          status?: "active" | "paused" | "archived" | "deleted" | null;
          daily_budget?: number | null;
          lifetime_budget?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ad_account_id?: string;
          meta_campaign_id?: string;
          name?: string | null;
          objective?: string | null;
          status?: "active" | "paused" | "archived" | "deleted" | null;
          daily_budget?: number | null;
          lifetime_budget?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ad_sets: {
        Row: {
          id: string;
          campaign_id: string;
          meta_ad_set_id: string;
          name: string | null;
          status: "active" | "paused" | "archived" | "deleted" | null;
          daily_budget: number | null;
          targeting: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          meta_ad_set_id: string;
          name?: string | null;
          status?: "active" | "paused" | "archived" | "deleted" | null;
          daily_budget?: number | null;
          targeting?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          meta_ad_set_id?: string;
          name?: string | null;
          status?: "active" | "paused" | "archived" | "deleted" | null;
          daily_budget?: number | null;
          targeting?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ads: {
        Row: {
          id: string;
          ad_set_id: string;
          meta_ad_id: string;
          name: string | null;
          status: "active" | "paused" | "archived" | "deleted" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ad_set_id: string;
          meta_ad_id: string;
          name?: string | null;
          status?: "active" | "paused" | "archived" | "deleted" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ad_set_id?: string;
          meta_ad_id?: string;
          name?: string | null;
          status?: "active" | "paused" | "archived" | "deleted" | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ad_creatives: {
        Row: {
          id: string;
          ad_id: string;
          meta_creative_id: string | null;
          title: string | null;
          body: string | null;
          image_url: string | null;
          video_url: string | null;
          call_to_action: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ad_id: string;
          meta_creative_id?: string | null;
          title?: string | null;
          body?: string | null;
          image_url?: string | null;
          video_url?: string | null;
          call_to_action?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ad_id?: string;
          meta_creative_id?: string | null;
          title?: string | null;
          body?: string | null;
          image_url?: string | null;
          video_url?: string | null;
          call_to_action?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ad_daily_metrics: {
        Row: {
          id: string;
          date: string;
          ad_id: string;
          spend: number;
          impressions: number;
          reach: number;
          clicks: number;
          messages_started: number;
          leads: number;
          purchases: number;
          revenue: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          ad_id: string;
          spend?: number;
          impressions?: number;
          reach?: number;
          clicks?: number;
          messages_started?: number;
          leads?: number;
          purchases?: number;
          revenue?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          ad_id?: string;
          spend?: number;
          impressions?: number;
          reach?: number;
          clicks?: number;
          messages_started?: number;
          leads?: number;
          purchases?: number;
          revenue?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          instagram_user_id: string | null;
          username: string | null;
          full_name: string | null;
          phone: string | null;
          email: string | null;
          first_seen_at: string;
          last_seen_at: string | null;
          status: "active" | "archived" | "blocked";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instagram_user_id?: string | null;
          username?: string | null;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          first_seen_at?: string;
          last_seen_at?: string | null;
          status?: "active" | "archived" | "blocked";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instagram_user_id?: string | null;
          username?: string | null;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          first_seen_at?: string;
          last_seen_at?: string | null;
          status?: "active" | "archived" | "blocked";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          contact_id: string;
          channel: "instagram" | "facebook";
          external_conversation_id: string | null;
          status: "open" | "pending" | "closed";
          assigned_to: string | null;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          channel: "instagram" | "facebook";
          external_conversation_id?: string | null;
          status?: "open" | "pending" | "closed";
          assigned_to?: string | null;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          channel?: "instagram" | "facebook";
          external_conversation_id?: string | null;
          status?: "open" | "pending" | "closed";
          assigned_to?: string | null;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          external_message_id: string | null;
          direction: "inbound" | "outbound";
          sender_type: "customer" | "ai" | "staff" | "system";
          message_type: "text" | "image" | "video" | "audio" | "file" | "template";
          content: string | null;
          created_at: string;
          raw_payload: Json | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          external_message_id?: string | null;
          direction: "inbound" | "outbound";
          sender_type: "customer" | "ai" | "staff" | "system";
          message_type?: "text" | "image" | "video" | "audio" | "file" | "template";
          content?: string | null;
          created_at?: string;
          raw_payload?: Json | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          external_message_id?: string | null;
          direction?: "inbound" | "outbound";
          sender_type?: "customer" | "ai" | "staff" | "system";
          message_type?: "text" | "image" | "video" | "audio" | "file" | "template";
          content?: string | null;
          created_at?: string;
          raw_payload?: Json | null;
        };
        Relationships: [];
      };
      conversation_summaries: {
        Row: {
          conversation_id: string;
          summary: string | null;
          customer_needs: string | null;
          objections: string | null;
          important_dates: Json | null;
          budget: string | null;
          next_action: string | null;
          updated_at: string;
        };
        Insert: {
          conversation_id: string;
          summary?: string | null;
          customer_needs?: string | null;
          objections?: string | null;
          important_dates?: Json | null;
          budget?: string | null;
          next_action?: string | null;
          updated_at?: string;
        };
        Update: {
          conversation_id?: string;
          summary?: string | null;
          customer_needs?: string | null;
          objections?: string | null;
          important_dates?: Json | null;
          budget?: string | null;
          next_action?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_profiles: {
        Row: {
          id: string;
          contact_id: string;
          service_type: string | null;
          event_date: string | null;
          location: string | null;
          budget: number | null;
          budget_currency: string;
          phone_collected: boolean;
          lead_score: number | null;
          lead_temperature: "cold" | "warm" | "hot" | null;
          reservation_status: "none" | "pending" | "confirmed" | "cancelled";
          source_campaign_id: string | null;
          source_ad_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          service_type?: string | null;
          event_date?: string | null;
          location?: string | null;
          budget?: number | null;
          budget_currency?: string;
          phone_collected?: boolean;
          lead_score?: number | null;
          lead_temperature?: "cold" | "warm" | "hot" | null;
          reservation_status?: "none" | "pending" | "confirmed" | "cancelled";
          source_campaign_id?: string | null;
          source_ad_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          service_type?: string | null;
          event_date?: string | null;
          location?: string | null;
          budget?: number | null;
          budget_currency?: string;
          phone_collected?: boolean;
          lead_score?: number | null;
          lead_temperature?: "cold" | "warm" | "hot" | null;
          reservation_status?: "none" | "pending" | "confirmed" | "cancelled";
          source_campaign_id?: string | null;
          source_ad_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_events: {
        Row: {
          id: string;
          lead_profile_id: string;
          event_type: string;
          event_data: Json | null;
          actor_type: "staff" | "ai" | "system";
          actor_id: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          lead_profile_id: string;
          event_type: string;
          event_data?: Json | null;
          actor_type?: "staff" | "ai" | "system";
          actor_id?: string | null;
          occurred_at?: string;
        };
        Update: {
          id?: string;
          lead_profile_id?: string;
          event_type?: string;
          event_data?: Json | null;
          actor_type?: "staff" | "ai" | "system";
          actor_id?: string | null;
          occurred_at?: string;
        };
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          title: string;
          category: string | null;
          content: string;
          version: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string | null;
          content: string;
          version?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string | null;
          content?: string;
          version?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          token_count: number | null;
          /** pgvector(1536) — supabase-js dizeye/sayı dizisine serialize eder. */
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          chunk_index: number;
          content: string;
          token_count?: number | null;
          embedding?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          chunk_index?: number;
          content?: string;
          token_count?: number | null;
          embedding?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_runs: {
        Row: {
          id: string;
          task_type: string;
          conversation_id: string | null;
          contact_id: string | null;
          model: string;
          input_tokens: number | null;
          output_tokens: number | null;
          estimated_cost: number | null;
          result: Json | null;
          status: "pending" | "completed" | "failed";
          requires_human_approval: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_type: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          model: string;
          input_tokens?: number | null;
          output_tokens?: number | null;
          estimated_cost?: number | null;
          result?: Json | null;
          status?: "pending" | "completed" | "failed";
          requires_human_approval?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_type?: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          model?: string;
          input_tokens?: number | null;
          output_tokens?: number | null;
          estimated_cost?: number | null;
          result?: Json | null;
          status?: "pending" | "completed" | "failed";
          requires_human_approval?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_feedback: {
        Row: {
          id: string;
          ai_run_id: string;
          feedback_type: "positive" | "negative" | "correction";
          comment: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ai_run_id: string;
          feedback_type: "positive" | "negative" | "correction";
          comment?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ai_run_id?: string;
          feedback_type?: "positive" | "negative" | "correction";
          comment?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          provider: "chatplace" | "meta" | "openai" | "supabase";
          status: "connected" | "disconnected" | "error";
          connected_at: string | null;
          last_checked_at: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: "chatplace" | "meta" | "openai" | "supabase";
          status?: "connected" | "disconnected" | "error";
          connected_at?: string | null;
          last_checked_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: "chatplace" | "meta" | "openai" | "supabase";
          status?: "connected" | "disconnected" | "error";
          connected_at?: string | null;
          last_checked_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider: "chatplace" | "meta";
          event_type: string | null;
          signature_verified: boolean;
          payload: Json;
          status: "received" | "processed" | "failed" | "ignored";
          processed_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: "chatplace" | "meta";
          event_type?: string | null;
          signature_verified?: boolean;
          payload: Json;
          status?: "received" | "processed" | "failed" | "ignored";
          processed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider?: "chatplace" | "meta";
          event_type?: string | null;
          signature_verified?: boolean;
          payload?: Json;
          status?: "received" | "processed" | "failed" | "ignored";
          processed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      attribution_events: {
        Row: {
          id: string;
          contact_id: string | null;
          lead_profile_id: string | null;
          campaign_id: string | null;
          ad_id: string | null;
          event_type: "message_started" | "lead_created" | "reservation" | "purchase";
          occurred_at: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          lead_profile_id?: string | null;
          campaign_id?: string | null;
          ad_id?: string | null;
          event_type: "message_started" | "lead_created" | "reservation" | "purchase";
          occurred_at?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          lead_profile_id?: string | null;
          campaign_id?: string | null;
          ad_id?: string | null;
          event_type?: "message_started" | "lead_created" | "reservation" | "purchase";
          occurred_at?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          contact_id: string | null;
          lead_profile_id: string | null;
          service_type: string | null;
          amount: number;
          currency: string;
          status: "pending" | "completed" | "refunded" | "cancelled";
          sold_at: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          lead_profile_id?: string | null;
          service_type?: string | null;
          amount: number;
          currency?: string;
          status?: "pending" | "completed" | "refunded" | "cancelled";
          sold_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          lead_profile_id?: string | null;
          service_type?: string | null;
          amount?: number;
          currency?: string;
          status?: "pending" | "completed" | "refunded" | "cancelled";
          sold_at?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          contact_id: string | null;
          lead_profile_id: string | null;
          event_date: string | null;
          location: string | null;
          status: "pending" | "confirmed" | "cancelled" | "completed";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          lead_profile_id?: string | null;
          event_date?: string | null;
          location?: string | null;
          status?: "pending" | "confirmed" | "cancelled" | "completed";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          lead_profile_id?: string | null;
          event_date?: string | null;
          location?: string | null;
          status?: "pending" | "confirmed" | "cancelled" | "completed";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          id: string;
          target_type: "campaign" | "ad_set" | "ad" | "lead";
          target_id: string;
          recommendation_type: string;
          description: string;
          suggested_action: Json | null;
          status: "pending" | "approved" | "rejected" | "applied";
          requires_human_approval: boolean;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: "campaign" | "ad_set" | "ad" | "lead";
          target_id: string;
          recommendation_type: string;
          description: string;
          suggested_action?: Json | null;
          status?: "pending" | "approved" | "rejected" | "applied";
          requires_human_approval?: boolean;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          target_type?: "campaign" | "ad_set" | "ad" | "lead";
          target_id?: string;
          recommendation_type?: string;
          description?: string;
          suggested_action?: Json | null;
          status?: "pending" | "approved" | "rejected" | "applied";
          requires_human_approval?: boolean;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      automation_logs: {
        Row: {
          id: string;
          source: "chatplace" | "meta" | "ai" | "system";
          action: string;
          status: "success" | "failed" | "skipped";
          details: Json | null;
          related_contact_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source: "chatplace" | "meta" | "ai" | "system";
          action: string;
          status?: "success" | "failed" | "skipped";
          details?: Json | null;
          related_contact_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source?: "chatplace" | "meta" | "ai" | "system";
          action?: string;
          status?: "success" | "failed" | "skipped";
          details?: Json | null;
          related_contact_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
