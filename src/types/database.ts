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
          frequency: number | null;
          cpm: number | null;
          cpc: number | null;
          ctr: number | null;
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
          frequency?: number | null;
          cpm?: number | null;
          cpc?: number | null;
          ctr?: number | null;
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
          frequency?: number | null;
          cpm?: number | null;
          cpc?: number | null;
          ctr?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          instagram_user_id: string | null;
          meta_igsid: string | null;
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
          meta_igsid?: string | null;
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
          meta_igsid?: string | null;
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
      customer_profiles: {
        Row: {
          id: string;
          contact_id: string;
          instagram_id: string | null;
          username: string | null;
          full_name: string | null;
          first_seen: string;
          last_seen: string;
          total_messages: number;
          total_conversations: number;
          lead_score: number;
          status: "new" | "interested" | "hot" | "booked" | "lost";
          phone: string | null;
          phone_verified: boolean;
          event_type: string | null;
          event_date: string | null;
          venue: string | null;
          city: string;
          budget: string | null;
          requested_services: string[];
          objections: string | null;
          last_summary: string | null;
          last_ai_response: string | null;
          notes: string | null;
          tags: string[];
          booking_probability: number | null;
          memory_summary: string | null;
          negotiation_tendency: string | null;
          price_sensitivity: string | null;
          rejected_services: string[];
          preferred_packages: string[];
          budget_range: string | null;
          decision_speed: string | null;
          prior_quote_received: boolean;
          prior_reservation: boolean;
          prior_cancellation: boolean;
          interested_campaigns: string[];
          mentioned_dates: string[];
          preferred_style: string | null;
          communication_tone: string | null;
          uses_emoji: boolean | null;
          formality: string | null;
          frequent_questions: string[];
          customer_type: string | null;
          customer_type_confidence: number | null;
          ai_notes: string | null;
          memory_updated_at: string | null;
          lifecycle_stage:
            | "new_customer"
            | "gathering_info"
            | "price_given"
            | "negotiating"
            | "awaiting_reservation"
            | "awaiting_deposit"
            | "awaiting_receipt"
            | "reservation_confirmed"
            | "shoot_completed"
            | "delivery"
            | "completed"
            | "cancelled"
            | "passive";
          opportunity_score: number;
          admin_notes: string | null;
          last_outbound_at: string | null;
          satisfaction_flow_status:
            | "pending"
            | "thanks_sent"
            | "review_asked"
            | "referral_asked"
            | "done"
            | "skipped"
            | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          instagram_id?: string | null;
          username?: string | null;
          full_name?: string | null;
          first_seen?: string;
          last_seen?: string;
          total_messages?: number;
          total_conversations?: number;
          lead_score?: number;
          status?: "new" | "interested" | "hot" | "booked" | "lost";
          phone?: string | null;
          phone_verified?: boolean;
          event_type?: string | null;
          event_date?: string | null;
          venue?: string | null;
          city?: string;
          budget?: string | null;
          requested_services?: string[];
          objections?: string | null;
          last_summary?: string | null;
          last_ai_response?: string | null;
          notes?: string | null;
          tags?: string[];
          booking_probability?: number | null;
          memory_summary?: string | null;
          negotiation_tendency?: string | null;
          price_sensitivity?: string | null;
          rejected_services?: string[];
          preferred_packages?: string[];
          budget_range?: string | null;
          decision_speed?: string | null;
          prior_quote_received?: boolean;
          prior_reservation?: boolean;
          prior_cancellation?: boolean;
          interested_campaigns?: string[];
          mentioned_dates?: string[];
          preferred_style?: string | null;
          communication_tone?: string | null;
          uses_emoji?: boolean | null;
          formality?: string | null;
          frequent_questions?: string[];
          customer_type?: string | null;
          customer_type_confidence?: number | null;
          ai_notes?: string | null;
          memory_updated_at?: string | null;
          lifecycle_stage?:
            | "new_customer"
            | "gathering_info"
            | "price_given"
            | "negotiating"
            | "awaiting_reservation"
            | "awaiting_deposit"
            | "awaiting_receipt"
            | "reservation_confirmed"
            | "shoot_completed"
            | "delivery"
            | "completed"
            | "cancelled"
            | "passive";
          opportunity_score?: number;
          admin_notes?: string | null;
          last_outbound_at?: string | null;
          satisfaction_flow_status?:
            | "pending"
            | "thanks_sent"
            | "review_asked"
            | "referral_asked"
            | "done"
            | "skipped"
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          instagram_id?: string | null;
          username?: string | null;
          full_name?: string | null;
          first_seen?: string;
          last_seen?: string;
          total_messages?: number;
          total_conversations?: number;
          lead_score?: number;
          status?: "new" | "interested" | "hot" | "booked" | "lost";
          phone?: string | null;
          phone_verified?: boolean;
          event_type?: string | null;
          event_date?: string | null;
          venue?: string | null;
          city?: string;
          budget?: string | null;
          requested_services?: string[];
          objections?: string | null;
          last_summary?: string | null;
          last_ai_response?: string | null;
          notes?: string | null;
          tags?: string[];
          booking_probability?: number | null;
          memory_summary?: string | null;
          negotiation_tendency?: string | null;
          price_sensitivity?: string | null;
          rejected_services?: string[];
          preferred_packages?: string[];
          budget_range?: string | null;
          decision_speed?: string | null;
          prior_quote_received?: boolean;
          prior_reservation?: boolean;
          prior_cancellation?: boolean;
          interested_campaigns?: string[];
          mentioned_dates?: string[];
          preferred_style?: string | null;
          communication_tone?: string | null;
          uses_emoji?: boolean | null;
          formality?: string | null;
          frequent_questions?: string[];
          customer_type?: string | null;
          customer_type_confidence?: number | null;
          ai_notes?: string | null;
          memory_updated_at?: string | null;
          lifecycle_stage?:
            | "new_customer"
            | "gathering_info"
            | "price_given"
            | "negotiating"
            | "awaiting_reservation"
            | "awaiting_deposit"
            | "awaiting_receipt"
            | "reservation_confirmed"
            | "shoot_completed"
            | "delivery"
            | "completed"
            | "cancelled"
            | "passive";
          opportunity_score?: number;
          admin_notes?: string | null;
          last_outbound_at?: string | null;
          satisfaction_flow_status?:
            | "pending"
            | "thanks_sent"
            | "review_asked"
            | "referral_asked"
            | "done"
            | "skipped"
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          contact_id: string;
          channel: "instagram" | "facebook" | "whatsapp";
          external_conversation_id: string | null;
          status: "open" | "pending" | "closed";
          assigned_to: string | null;
          last_message_at: string | null;
          last_learned_at: string | null;
          sales_brain_state: Json | null;
          predicted_reply_at: string | null;
          predicted_reply_hours: number | null;
          follow_up_suggestion: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          channel: "instagram" | "facebook" | "whatsapp";
          external_conversation_id?: string | null;
          status?: "open" | "pending" | "closed";
          assigned_to?: string | null;
          last_message_at?: string | null;
          last_learned_at?: string | null;
          sales_brain_state?: Json | null;
          predicted_reply_at?: string | null;
          predicted_reply_hours?: number | null;
          follow_up_suggestion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          channel?: "instagram" | "facebook" | "whatsapp";
          external_conversation_id?: string | null;
          status?: "open" | "pending" | "closed";
          assigned_to?: string | null;
          last_message_at?: string | null;
          last_learned_at?: string | null;
          sales_brain_state?: Json | null;
          predicted_reply_at?: string | null;
          predicted_reply_hours?: number | null;
          follow_up_suggestion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
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
          source:
            | "chatplace_mcp"
            | "chatplace_webhook"
            | "meta_delivery"
            | "manual_test"
            | "seed"
            | "lab"
            | "import"
            | "migration"
            | "legacy"
            | "unknown";
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
          source?:
            | "chatplace_mcp"
            | "chatplace_webhook"
            | "meta_delivery"
            | "manual_test"
            | "seed"
            | "lab"
            | "import"
            | "migration"
            | "legacy"
            | "unknown";
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
          source?:
            | "chatplace_mcp"
            | "chatplace_webhook"
            | "meta_delivery"
            | "manual_test"
            | "seed"
            | "lab"
            | "import"
            | "migration"
            | "legacy"
            | "unknown";
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
          lead_score: number | null;
          sale_probability: number | null;
          customer_intent: string | null;
          lead_temperature: "cold" | "warm" | "hot" | null;
          loss_reason: string | null;
          sale_outcome: "won" | "lost" | "open" | "unknown" | null;
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
          lead_score?: number | null;
          sale_probability?: number | null;
          customer_intent?: string | null;
          lead_temperature?: "cold" | "warm" | "hot" | null;
          loss_reason?: string | null;
          sale_outcome?: "won" | "lost" | "open" | "unknown" | null;
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
          lead_score?: number | null;
          sale_probability?: number | null;
          customer_intent?: string | null;
          lead_temperature?: "cold" | "warm" | "hot" | null;
          loss_reason?: string | null;
          sale_outcome?: "won" | "lost" | "open" | "unknown" | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_analyses: {
        Row: {
          id: string;
          conversation_id: string;
          customer_intent: string | null;
          event_type: string | null;
          event_date_text: string | null;
          venue_type: string | null;
          requested_services: string | null;
          budget_or_price_question: string | null;
          objections: string | null;
          phone_collected: boolean;
          sale_outcome: "won" | "lost" | "open" | "unknown";
          advancing_reply: string | null;
          losing_reply: string | null;
          frequent_question: string | null;
          recommended_answer: string | null;
          lead_score: number | null;
          sale_probability: number | null;
          lead_temperature: "cold" | "warm" | "hot" | null;
          loss_reason: string | null;
          next_action: string | null;
          message_count: number;
          last_message_at_snapshot: string | null;
          extraction: Json | null;
          learning_status: "pending" | "completed" | "failed" | "skipped";
          score_sales_quality: number | null;
          score_empathy: number | null;
          score_speed: number | null;
          score_persuasion: number | null;
          score_closing: number | null;
          score_notes: string | null;
          first_customer_question: string | null;
          first_reply_given: string | null;
          drop_off_point: string | null;
          reservation_created: boolean;
          deposit_received: boolean;
          is_best_conversation: boolean;
          analyzed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          customer_intent?: string | null;
          event_type?: string | null;
          event_date_text?: string | null;
          venue_type?: string | null;
          requested_services?: string | null;
          budget_or_price_question?: string | null;
          objections?: string | null;
          phone_collected?: boolean;
          sale_outcome?: "won" | "lost" | "open" | "unknown";
          advancing_reply?: string | null;
          losing_reply?: string | null;
          frequent_question?: string | null;
          recommended_answer?: string | null;
          lead_score?: number | null;
          sale_probability?: number | null;
          lead_temperature?: "cold" | "warm" | "hot" | null;
          loss_reason?: string | null;
          next_action?: string | null;
          message_count?: number;
          last_message_at_snapshot?: string | null;
          extraction?: Json | null;
          learning_status?: "pending" | "completed" | "failed" | "skipped";
          score_sales_quality?: number | null;
          score_empathy?: number | null;
          score_speed?: number | null;
          score_persuasion?: number | null;
          score_closing?: number | null;
          score_notes?: string | null;
          first_customer_question?: string | null;
          first_reply_given?: string | null;
          drop_off_point?: string | null;
          reservation_created?: boolean;
          deposit_received?: boolean;
          is_best_conversation?: boolean;
          analyzed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          customer_intent?: string | null;
          event_type?: string | null;
          event_date_text?: string | null;
          venue_type?: string | null;
          requested_services?: string | null;
          budget_or_price_question?: string | null;
          objections?: string | null;
          phone_collected?: boolean;
          sale_outcome?: "won" | "lost" | "open" | "unknown";
          advancing_reply?: string | null;
          losing_reply?: string | null;
          frequent_question?: string | null;
          recommended_answer?: string | null;
          lead_score?: number | null;
          sale_probability?: number | null;
          lead_temperature?: "cold" | "warm" | "hot" | null;
          loss_reason?: string | null;
          next_action?: string | null;
          message_count?: number;
          last_message_at_snapshot?: string | null;
          extraction?: Json | null;
          learning_status?: "pending" | "completed" | "failed" | "skipped";
          score_sales_quality?: number | null;
          score_empathy?: number | null;
          score_speed?: number | null;
          score_persuasion?: number | null;
          score_closing?: number | null;
          score_notes?: string | null;
          first_customer_question?: string | null;
          first_reply_given?: string | null;
          drop_off_point?: string | null;
          reservation_created?: boolean;
          deposit_received?: boolean;
          is_best_conversation?: boolean;
          analyzed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_learning_runs: {
        Row: {
          id: string;
          trigger_source:
            | "manual"
            | "cron"
            | "conversation_closed"
            | "idle_24h"
            | "import";
          status: "running" | "completed" | "failed" | "partial";
          conversations_scanned: number;
          conversations_analyzed: number;
          knowledge_proposed: number;
          error_message: string | null;
          details: Json | null;
          started_at: string;
          finished_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trigger_source:
            | "manual"
            | "cron"
            | "conversation_closed"
            | "idle_24h"
            | "import";
          status?: "running" | "completed" | "failed" | "partial";
          conversations_scanned?: number;
          conversations_analyzed?: number;
          knowledge_proposed?: number;
          error_message?: string | null;
          details?: Json | null;
          started_at?: string;
          finished_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trigger_source?:
            | "manual"
            | "cron"
            | "conversation_closed"
            | "idle_24h"
            | "import";
          status?: "running" | "completed" | "failed" | "partial";
          conversations_scanned?: number;
          conversations_analyzed?: number;
          knowledge_proposed?: number;
          error_message?: string | null;
          details?: Json | null;
          started_at?: string;
          finished_at?: string | null;
          created_at?: string;
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
          review_status: "pending_review" | "approved" | "rejected";
          source_type: "manual" | "conversation_learning" | "import";
          source_conversation_id: string | null;
          source_analysis_id: string | null;
          faq_question: string | null;
          suggested_answer: string | null;
          example_good_reply: string | null;
          example_bad_reply: string | null;
          is_pricing_sensitive: boolean;
          is_campaign_claim: boolean;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
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
          review_status?: "pending_review" | "approved" | "rejected";
          source_type?: "manual" | "conversation_learning" | "import";
          source_conversation_id?: string | null;
          source_analysis_id?: string | null;
          faq_question?: string | null;
          suggested_answer?: string | null;
          example_good_reply?: string | null;
          example_bad_reply?: string | null;
          is_pricing_sensitive?: boolean;
          is_campaign_claim?: boolean;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
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
          review_status?: "pending_review" | "approved" | "rejected";
          source_type?: "manual" | "conversation_learning" | "import";
          source_conversation_id?: string | null;
          source_analysis_id?: string | null;
          faq_question?: string | null;
          suggested_answer?: string | null;
          example_good_reply?: string | null;
          example_bad_reply?: string | null;
          is_pricing_sensitive?: boolean;
          is_campaign_claim?: boolean;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
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
          conversation_id: string | null;
          customer_profile_id: string | null;
          customer_full_name: string | null;
          customer_phone: string | null;
          event_date: string | null;
          event_type: string | null;
          start_time: string | null;
          end_time: string | null;
          venue_type: string | null;
          venue_name: string | null;
          location: string | null;
          selected_plato_id: string | null;
          city: string;
          district: string | null;
          selected_service_ids: string[];
          package_snapshot: Json;
          extra_services: Json;
          subtotal: number;
          discount_amount: number;
          total_price: number;
          deposit_amount: number;
          deposit_status:
            | "not_requested"
            | "requested"
            | "receipt_uploaded"
            | "under_review"
            | "verified"
            | "rejected"
            | "refunded";
          deposit_verified_at: string | null;
          deposit_verified_by: string | null;
          remaining_amount: number;
          remaining_payment_status: "unpaid" | "partial" | "paid";
          remaining_payment_due_at: string | null;
          source: "manual" | "instagram_ai" | "admin_panel" | "website";
          assigned_team_id: string | null;
          internal_notes: string | null;
          customer_notes: string | null;
          created_by: string | null;
          time_status: "unknown" | "approximate" | "confirmed";
          location_status: "unknown" | "approximate" | "confirmed";
          needs_time_followup: boolean;
          needs_location_followup: boolean;
          conflict_override: boolean;
          conflict_override_reason: string | null;
          scheduled_start_at: string | null;
          scheduled_end_at: string | null;
          effective_busy_start_at: string | null;
          effective_busy_end_at: string | null;
          status:
            | "draft"
            | "inquiry"
            | "availability_check"
            | "pending_customer"
            | "deposit_pending"
            | "payment_review"
            | "confirmed"
            | "completed"
            | "cancelled"
            | "lost"
            | "shoot_completed";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          lead_profile_id?: string | null;
          conversation_id?: string | null;
          customer_profile_id?: string | null;
          customer_full_name?: string | null;
          customer_phone?: string | null;
          event_date?: string | null;
          event_type?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          venue_type?: string | null;
          venue_name?: string | null;
          location?: string | null;
          selected_plato_id?: string | null;
          city?: string;
          district?: string | null;
          selected_service_ids?: string[];
          package_snapshot?: Json;
          extra_services?: Json;
          subtotal?: number;
          discount_amount?: number;
          total_price?: number;
          deposit_amount?: number;
          deposit_status?:
            | "not_requested"
            | "requested"
            | "receipt_uploaded"
            | "under_review"
            | "verified"
            | "rejected"
            | "refunded";
          deposit_verified_at?: string | null;
          deposit_verified_by?: string | null;
          remaining_amount?: number;
          remaining_payment_status?: "unpaid" | "partial" | "paid";
          remaining_payment_due_at?: string | null;
          source?: "manual" | "instagram_ai" | "admin_panel" | "website";
          assigned_team_id?: string | null;
          internal_notes?: string | null;
          customer_notes?: string | null;
          created_by?: string | null;
          time_status?: "unknown" | "approximate" | "confirmed";
          location_status?: "unknown" | "approximate" | "confirmed";
          needs_time_followup?: boolean;
          needs_location_followup?: boolean;
          conflict_override?: boolean;
          conflict_override_reason?: string | null;
          scheduled_start_at?: string | null;
          scheduled_end_at?: string | null;
          effective_busy_start_at?: string | null;
          effective_busy_end_at?: string | null;
          status?:
            | "draft"
            | "inquiry"
            | "availability_check"
            | "pending_customer"
            | "deposit_pending"
            | "payment_review"
            | "confirmed"
            | "completed"
            | "cancelled"
            | "lost"
            | "shoot_completed";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          lead_profile_id?: string | null;
          conversation_id?: string | null;
          customer_profile_id?: string | null;
          customer_full_name?: string | null;
          customer_phone?: string | null;
          event_date?: string | null;
          event_type?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          venue_type?: string | null;
          venue_name?: string | null;
          location?: string | null;
          selected_plato_id?: string | null;
          city?: string;
          district?: string | null;
          selected_service_ids?: string[];
          package_snapshot?: Json;
          extra_services?: Json;
          subtotal?: number;
          discount_amount?: number;
          total_price?: number;
          deposit_amount?: number;
          deposit_status?:
            | "not_requested"
            | "requested"
            | "receipt_uploaded"
            | "under_review"
            | "verified"
            | "rejected"
            | "refunded";
          deposit_verified_at?: string | null;
          deposit_verified_by?: string | null;
          remaining_amount?: number;
          remaining_payment_status?: "unpaid" | "partial" | "paid";
          remaining_payment_due_at?: string | null;
          source?: "manual" | "instagram_ai" | "admin_panel" | "website";
          assigned_team_id?: string | null;
          internal_notes?: string | null;
          customer_notes?: string | null;
          created_by?: string | null;
          time_status?: "unknown" | "approximate" | "confirmed";
          location_status?: "unknown" | "approximate" | "confirmed";
          needs_time_followup?: boolean;
          needs_location_followup?: boolean;
          conflict_override?: boolean;
          conflict_override_reason?: string | null;
          scheduled_start_at?: string | null;
          scheduled_end_at?: string | null;
          effective_busy_start_at?: string | null;
          effective_busy_end_at?: string | null;
          status?:
            | "draft"
            | "inquiry"
            | "availability_check"
            | "pending_customer"
            | "deposit_pending"
            | "payment_review"
            | "confirmed"
            | "completed"
            | "cancelled"
            | "lost"
            | "shoot_completed";
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reservation_settings: {
        Row: {
          id: string;
          default_deposit_amount: number;
          default_currency: string;
          default_travel_minutes: number;
          auto_confirm_high_confidence_receipts: boolean;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          default_deposit_amount?: number;
          default_currency?: string;
          default_travel_minutes?: number;
          auto_confirm_high_confidence_receipts?: boolean;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          default_deposit_amount?: number;
          default_currency?: string;
          default_travel_minutes?: number;
          auto_confirm_high_confidence_receipts?: boolean;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          description: string | null;
          base_price: number;
          currency: string;
          service_type: string;
          default_duration_minutes: number;
          required_role_slug: string | null;
          active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          description?: string | null;
          base_price: number;
          currency?: string;
          service_type?: string;
          default_duration_minutes?: number;
          required_role_slug?: string | null;
          active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          base_price?: number;
          currency?: string;
          service_type?: string;
          default_duration_minutes?: number;
          required_role_slug?: string | null;
          active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_campaigns: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          campaign_type: "bundle" | "fixed_price" | "percentage" | "free_item";
          discount_type: "fixed" | "percentage" | "set_price" | "free";
          discount_value: number;
          required_service_ids: string[];
          rewarded_service_id: string | null;
          start_date: string | null;
          end_date: string | null;
          active: boolean;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          campaign_type?: "bundle" | "fixed_price" | "percentage" | "free_item";
          discount_type?: "fixed" | "percentage" | "set_price" | "free";
          discount_value?: number;
          required_service_ids?: string[];
          rewarded_service_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          active?: boolean;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          campaign_type?: "bundle" | "fixed_price" | "percentage" | "free_item";
          discount_type?: "fixed" | "percentage" | "set_price" | "free";
          discount_value?: number;
          required_service_ids?: string[];
          rewarded_service_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          active?: boolean;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plateaus: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          city: string;
          district: string | null;
          active: boolean;
          capacity: number | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          address?: string | null;
          city?: string;
          district?: string | null;
          active?: boolean;
          capacity?: number | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          address?: string | null;
          city?: string;
          district?: string | null;
          active?: boolean;
          capacity?: number | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reservation_items: {
        Row: {
          id: string;
          reservation_id: string;
          service_id: string | null;
          service_name_snapshot: string;
          unit_price: number;
          quantity: number;
          discount_amount: number;
          final_price: number;
          metadata: Json;
          scheduled_start_at: string | null;
          scheduled_end_at: string | null;
          service_duration_minutes: number | null;
          travel_before_minutes: number;
          preparation_before_minutes: number;
          travel_after_minutes: number;
          effective_busy_start_at: string | null;
          effective_busy_end_at: string | null;
          location_id: string | null;
          location_text: string | null;
          latitude: number | null;
          longitude: number | null;
          location_status: "unknown" | "approximate" | "confirmed";
          time_status: "unknown" | "approximate" | "confirmed";
          travel_time_source: "default" | "manual" | "maps_api";
          manual_travel_minutes: number | null;
          calculated_travel_minutes: number | null;
          route_distance_km: number | null;
          route_checked_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          service_id?: string | null;
          service_name_snapshot: string;
          unit_price?: number;
          quantity?: number;
          discount_amount?: number;
          final_price?: number;
          metadata?: Json;
          scheduled_start_at?: string | null;
          scheduled_end_at?: string | null;
          service_duration_minutes?: number | null;
          travel_before_minutes?: number;
          preparation_before_minutes?: number;
          travel_after_minutes?: number;
          effective_busy_start_at?: string | null;
          effective_busy_end_at?: string | null;
          location_id?: string | null;
          location_text?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_status?: "unknown" | "approximate" | "confirmed";
          time_status?: "unknown" | "approximate" | "confirmed";
          travel_time_source?: "default" | "manual" | "maps_api";
          manual_travel_minutes?: number | null;
          calculated_travel_minutes?: number | null;
          route_distance_km?: number | null;
          route_checked_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          service_id?: string | null;
          service_name_snapshot?: string;
          unit_price?: number;
          quantity?: number;
          discount_amount?: number;
          final_price?: number;
          metadata?: Json;
          scheduled_start_at?: string | null;
          scheduled_end_at?: string | null;
          service_duration_minutes?: number | null;
          travel_before_minutes?: number;
          preparation_before_minutes?: number;
          travel_after_minutes?: number;
          effective_busy_start_at?: string | null;
          effective_busy_end_at?: string | null;
          location_id?: string | null;
          location_text?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location_status?: "unknown" | "approximate" | "confirmed";
          time_status?: "unknown" | "approximate" | "confirmed";
          travel_time_source?: "default" | "manual" | "maps_api";
          manual_travel_minutes?: number | null;
          calculated_travel_minutes?: number | null;
          route_distance_km?: number | null;
          route_checked_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reservation_changes: {
        Row: {
          id: string;
          reservation_id: string;
          changed_by_type: "staff" | "ai" | "system" | "customer";
          changed_by_id: string | null;
          field_name: string;
          old_value: Json | null;
          new_value: Json | null;
          reason: string | null;
          requires_admin_approval: boolean;
          approval_status: "pending" | "approved" | "rejected" | "applied";
          created_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          changed_by_type?: "staff" | "ai" | "system" | "customer";
          changed_by_id?: string | null;
          field_name: string;
          old_value?: Json | null;
          new_value?: Json | null;
          reason?: string | null;
          requires_admin_approval?: boolean;
          approval_status?: "pending" | "approved" | "rejected" | "applied";
          created_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          changed_by_type?: "staff" | "ai" | "system" | "customer";
          changed_by_id?: string | null;
          field_name?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          reason?: string | null;
          requires_admin_approval?: boolean;
          approval_status?: "pending" | "approved" | "rejected" | "applied";
          created_at?: string;
        };
        Relationships: [];
      };
      payment_accounts: {
        Row: {
          id: string;
          bank_name: string;
          account_holder_name: string;
          iban: string;
          currency: string;
          active: boolean;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bank_name: string;
          account_holder_name: string;
          iban: string;
          currency?: string;
          active?: boolean;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bank_name?: string;
          account_holder_name?: string;
          iban?: string;
          currency?: string;
          active?: boolean;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_receipts: {
        Row: {
          id: string;
          reservation_id: string;
          contact_id: string | null;
          file_url: string;
          file_hash: string | null;
          original_filename: string | null;
          uploaded_via: "admin_panel" | "instagram" | "chatplace" | "website";
          extracted_text: string | null;
          detected_bank: string | null;
          detected_sender_name: string | null;
          detected_recipient_name: string | null;
          detected_iban: string | null;
          detected_amount: number | null;
          detected_currency: string | null;
          detected_transaction_date: string | null;
          detected_reference: string | null;
          confidence_score: number | null;
          validation_result: string | null;
          validation_reasons: Json;
          manipulation_signals: Json;
          receipt_verified: boolean;
          payment_confirmed: boolean;
          status:
            | "uploaded"
            | "analyzing"
            | "needs_review"
            | "verified"
            | "rejected";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          contact_id?: string | null;
          file_url: string;
          file_hash?: string | null;
          original_filename?: string | null;
          uploaded_via?: "admin_panel" | "instagram" | "chatplace" | "website";
          extracted_text?: string | null;
          detected_bank?: string | null;
          detected_sender_name?: string | null;
          detected_recipient_name?: string | null;
          detected_iban?: string | null;
          detected_amount?: number | null;
          detected_currency?: string | null;
          detected_transaction_date?: string | null;
          detected_reference?: string | null;
          confidence_score?: number | null;
          validation_result?: string | null;
          validation_reasons?: Json;
          manipulation_signals?: Json;
          receipt_verified?: boolean;
          payment_confirmed?: boolean;
          status?:
            | "uploaded"
            | "analyzing"
            | "needs_review"
            | "verified"
            | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          contact_id?: string | null;
          file_url?: string;
          file_hash?: string | null;
          original_filename?: string | null;
          uploaded_via?: "admin_panel" | "instagram" | "chatplace" | "website";
          extracted_text?: string | null;
          detected_bank?: string | null;
          detected_sender_name?: string | null;
          detected_recipient_name?: string | null;
          detected_iban?: string | null;
          detected_amount?: number | null;
          detected_currency?: string | null;
          detected_transaction_date?: string | null;
          detected_reference?: string | null;
          confidence_score?: number | null;
          validation_result?: string | null;
          validation_reasons?: Json;
          manipulation_signals?: Json;
          receipt_verified?: boolean;
          payment_confirmed?: boolean;
          status?:
            | "uploaded"
            | "analyzing"
            | "needs_review"
            | "verified"
            | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      follow_up_tasks: {
        Row: {
          id: string;
          contact_id: string | null;
          conversation_id: string | null;
          reservation_id: string | null;
          reason: string;
          scheduled_at: string;
          status:
            | "pending"
            | "queued"
            | "sent"
            | "cancelled"
            | "failed"
            | "skipped";
          attempt_count: number;
          last_attempt_at: string | null;
          message_template_id: string | null;
          ai_generated_message: string | null;
          cancelled_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          reservation_id?: string | null;
          reason: string;
          scheduled_at: string;
          status?:
            | "pending"
            | "queued"
            | "sent"
            | "cancelled"
            | "failed"
            | "skipped";
          attempt_count?: number;
          last_attempt_at?: string | null;
          message_template_id?: string | null;
          ai_generated_message?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          reservation_id?: string | null;
          reason?: string;
          scheduled_at?: string;
          status?:
            | "pending"
            | "queued"
            | "sent"
            | "cancelled"
            | "failed"
            | "skipped";
          attempt_count?: number;
          last_attempt_at?: string | null;
          message_template_id?: string | null;
          ai_generated_message?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reminder_jobs: {
        Row: {
          id: string;
          reservation_id: string;
          staff_member_id: string | null;
          reminder_type: string;
          scheduled_at: string;
          sent_at: string | null;
          status: "pending" | "sent" | "cancelled" | "failed" | "skipped";
          channel: "admin" | "customer" | "both";
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          staff_member_id?: string | null;
          reminder_type: string;
          scheduled_at: string;
          sent_at?: string | null;
          status?: "pending" | "sent" | "cancelled" | "failed" | "skipped";
          channel?: "admin" | "customer" | "both";
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          staff_member_id?: string | null;
          reminder_type?: string;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: "pending" | "sent" | "cancelled" | "failed" | "skipped";
          channel?: "admin" | "customer" | "both";
          payload?: Json;
          created_at?: string;
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
      knowledge_candidates: {
        Row: {
          id: string;
          title: string;
          category: string;
          proposed_rule: string;
          evidence_summary: string | null;
          source_conversation_ids: string[];
          confidence_score: number;
          evidence_count: number;
          source_count: number;
          expected_impact: string | null;
          status:
            | "pending_review"
            | "approved"
            | "rejected"
            | "archived"
            | "test_mode";
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          knowledge_document_id: string | null;
          valid_from: string | null;
          valid_until: string | null;
          last_validated_at: string | null;
          last_observed_at: string;
          active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string;
          proposed_rule: string;
          evidence_summary?: string | null;
          source_conversation_ids?: string[];
          confidence_score?: number;
          evidence_count?: number;
          source_count?: number;
          expected_impact?: string | null;
          status?:
            | "pending_review"
            | "approved"
            | "rejected"
            | "archived"
            | "test_mode";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          knowledge_document_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          last_validated_at?: string | null;
          last_observed_at?: string;
          active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string;
          proposed_rule?: string;
          evidence_summary?: string | null;
          source_conversation_ids?: string[];
          confidence_score?: number;
          evidence_count?: number;
          source_count?: number;
          expected_impact?: string | null;
          status?:
            | "pending_review"
            | "approved"
            | "rejected"
            | "archived"
            | "test_mode";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          knowledge_document_id?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          last_validated_at?: string | null;
          last_observed_at?: string;
          active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales_learnings: {
        Row: {
          id: string;
          title: string;
          learning_type: string;
          content: string;
          customer_type: string | null;
          confidence_score: number;
          evidence_count: number;
          source_count: number;
          valid_from: string;
          valid_until: string | null;
          last_validated_at: string | null;
          last_observed_at: string;
          active: boolean;
          knowledge_candidate_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          learning_type?: string;
          content: string;
          customer_type?: string | null;
          confidence_score?: number;
          evidence_count?: number;
          source_count?: number;
          valid_from?: string;
          valid_until?: string | null;
          last_validated_at?: string | null;
          last_observed_at?: string;
          active?: boolean;
          knowledge_candidate_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          learning_type?: string;
          content?: string;
          customer_type?: string | null;
          confidence_score?: number;
          evidence_count?: number;
          source_count?: number;
          valid_from?: string;
          valid_until?: string | null;
          last_validated_at?: string | null;
          last_observed_at?: string;
          active?: boolean;
          knowledge_candidate_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_ai_corrections: {
        Row: {
          id: string;
          conversation_id: string | null;
          contact_id: string | null;
          ai_message_id: string | null;
          staff_message_id: string | null;
          ai_text: string;
          staff_text: string;
          reason: string | null;
          customer_type: string | null;
          led_to_sale: boolean | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          ai_message_id?: string | null;
          staff_message_id?: string | null;
          ai_text: string;
          staff_text: string;
          reason?: string | null;
          customer_type?: string | null;
          led_to_sale?: boolean | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          ai_message_id?: string | null;
          staff_message_id?: string | null;
          ai_text?: string;
          staff_text?: string;
          reason?: string | null;
          customer_type?: string | null;
          led_to_sale?: boolean | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      conversation_outcomes: {
        Row: {
          id: string;
          conversation_id: string;
          contact_id: string | null;
          outcome:
            | "sale"
            | "draft_created"
            | "deposit_requested"
            | "deposit_sent"
            | "customer_abandoned"
            | "no_reply"
            | "admin_took_over"
            | "admin_corrected_ai"
            | "positive"
            | "negative"
            | "unknown";
          notes: string | null;
          metadata: Json;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          contact_id?: string | null;
          outcome:
            | "sale"
            | "draft_created"
            | "deposit_requested"
            | "deposit_sent"
            | "customer_abandoned"
            | "no_reply"
            | "admin_took_over"
            | "admin_corrected_ai"
            | "positive"
            | "negative"
            | "unknown";
          notes?: string | null;
          metadata?: Json;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          contact_id?: string | null;
          outcome?:
            | "sale"
            | "draft_created"
            | "deposit_requested"
            | "deposit_sent"
            | "customer_abandoned"
            | "no_reply"
            | "admin_took_over"
            | "admin_corrected_ai"
            | "positive"
            | "negative"
            | "unknown";
          notes?: string | null;
          metadata?: Json;
          recorded_at?: string;
        };
        Relationships: [];
      };
      customer_timeline_events: {
        Row: {
          id: string;
          contact_id: string;
          conversation_id: string | null;
          reservation_id: string | null;
          event_type: string;
          title: string;
          body: string | null;
          actor_type: "system" | "ai" | "staff" | "customer";
          metadata: Json;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          conversation_id?: string | null;
          reservation_id?: string | null;
          event_type: string;
          title: string;
          body?: string | null;
          actor_type?: "system" | "ai" | "staff" | "customer";
          metadata?: Json;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          conversation_id?: string | null;
          reservation_id?: string | null;
          event_type?: string;
          title?: string;
          body?: string | null;
          actor_type?: "system" | "ai" | "staff" | "customer";
          metadata?: Json;
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      customer_admin_notes: {
        Row: {
          id: string;
          contact_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      satisfaction_tasks: {
        Row: {
          id: string;
          contact_id: string;
          reservation_id: string | null;
          conversation_id: string | null;
          step: "thanks" | "review" | "google" | "instagram_tag" | "referral";
          scheduled_at: string;
          status: "pending" | "queued" | "sent" | "cancelled" | "skipped";
          message_template: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          reservation_id?: string | null;
          conversation_id?: string | null;
          step: "thanks" | "review" | "google" | "instagram_tag" | "referral";
          scheduled_at: string;
          status?: "pending" | "queued" | "sent" | "cancelled" | "skipped";
          message_template?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          reservation_id?: string | null;
          conversation_id?: string | null;
          step?: "thanks" | "review" | "google" | "instagram_tag" | "referral";
          scheduled_at?: string;
          status?: "pending" | "queued" | "sent" | "cancelled" | "skipped";
          message_template?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      staff_roles: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      staff_members: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          profile_photo_url: string | null;
          active: boolean;
          notes: string | null;
          default_start_time: string | null;
          default_end_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          profile_photo_url?: string | null;
          active?: boolean;
          notes?: string | null;
          default_start_time?: string | null;
          default_end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          email?: string | null;
          profile_photo_url?: string | null;
          active?: boolean;
          notes?: string | null;
          default_start_time?: string | null;
          default_end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_member_roles: {
        Row: {
          id: string;
          staff_member_id: string;
          staff_role_id: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_member_id: string;
          staff_role_id: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_member_id?: string;
          staff_role_id?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      staff_unavailability: {
        Row: {
          id: string;
          staff_member_id: string;
          start_at: string;
          end_at: string;
          reason: string | null;
          type: "day_off" | "leave" | "sick" | "personal" | "manual_block";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_member_id: string;
          start_at: string;
          end_at: string;
          reason?: string | null;
          type?: "day_off" | "leave" | "sick" | "personal" | "manual_block";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          staff_member_id?: string;
          start_at?: string;
          end_at?: string;
          reason?: string | null;
          type?: "day_off" | "leave" | "sick" | "personal" | "manual_block";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reservation_staff_assignments: {
        Row: {
          id: string;
          reservation_id: string;
          reservation_item_id: string | null;
          staff_member_id: string;
          assigned_role: string;
          assignment_status:
            | "proposed"
            | "assigned"
            | "accepted"
            | "declined"
            | "completed"
            | "cancelled";
          assigned_by: string | null;
          notes: string | null;
          override_conflict: boolean;
          override_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          reservation_item_id?: string | null;
          staff_member_id: string;
          assigned_role: string;
          assignment_status?:
            | "proposed"
            | "assigned"
            | "accepted"
            | "declined"
            | "completed"
            | "cancelled";
          assigned_by?: string | null;
          notes?: string | null;
          override_conflict?: boolean;
          override_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reservation_id?: string;
          reservation_item_id?: string | null;
          staff_member_id?: string;
          assigned_role?: string;
          assignment_status?:
            | "proposed"
            | "assigned"
            | "accepted"
            | "declined"
            | "completed"
            | "cancelled";
          assigned_by?: string | null;
          notes?: string | null;
          override_conflict?: boolean;
          override_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      panel_notifications: {
        Row: {
          id: string;
          type: string;
          title: string;
          body: string | null;
          payload: Json;
          staff_member_id: string | null;
          reservation_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          title: string;
          body?: string | null;
          payload?: Json;
          staff_member_id?: string | null;
          reservation_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          payload?: Json;
          staff_member_id?: string | null;
          reservation_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      staff_audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ceo_daily_briefs: {
        Row: {
          id: string;
          report_date: string;
          metrics: Json;
          summary_bullets: string[];
          narrative: string | null;
          risks: Json;
          recommendations: Json;
          action_items: Json;
          generated_at: string;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_date: string;
          metrics?: Json;
          summary_bullets?: string[];
          narrative?: string | null;
          risks?: Json;
          recommendations?: Json;
          action_items?: Json;
          generated_at?: string;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_date?: string;
          metrics?: Json;
          summary_bullets?: string[];
          narrative?: string | null;
          risks?: Json;
          recommendations?: Json;
          action_items?: Json;
          generated_at?: string;
          model?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ceo_daily_reports: {
        Row: {
          id: string;
          report_date: string;
          metrics: Json;
          content_markdown: string;
          highlights: Json;
          generated_at: string;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_date: string;
          metrics?: Json;
          content_markdown: string;
          highlights?: Json;
          generated_at?: string;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_date?: string;
          metrics?: Json;
          content_markdown?: string;
          highlights?: Json;
          generated_at?: string;
          model?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ceo_assistant_logs: {
        Row: {
          id: string;
          asked_by: string | null;
          question: string;
          answer: string;
          data_snapshot: Json;
          model: string | null;
          status: "completed" | "no_data" | "error";
          created_at: string;
        };
        Insert: {
          id?: string;
          asked_by?: string | null;
          question: string;
          answer: string;
          data_snapshot?: Json;
          model?: string | null;
          status?: "completed" | "no_data" | "error";
          created_at?: string;
        };
        Update: {
          id?: string;
          asked_by?: string | null;
          question?: string;
          answer?: string;
          data_snapshot?: Json;
          model?: string | null;
          status?: "completed" | "no_data" | "error";
          created_at?: string;
        };
        Relationships: [];
      };
﻿      meta_oauth_tokens: {
        Row: {
          id: string;
          provider: string;
          access_token: string;
          token_type: string | null;
          expires_at: string | null;
          scopes: string[];
          meta_user_id: string | null;
          meta_user_name: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider?: string;
          access_token: string;
          token_type?: string | null;
          expires_at?: string | null;
          scopes?: string[];
          meta_user_id?: string | null;
          meta_user_name?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          access_token?: string;
          token_type?: string | null;
          expires_at?: string | null;
          scopes?: string[];
          meta_user_id?: string | null;
          meta_user_name?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meta_connections: {
        Row: {
          id: string;
          connection_type:
            | "meta_business"
            | "meta_ad_account"
            | "facebook_page"
            | "instagram_business"
            | "meta_pixel"
            | "conversions_api";
          display_name: string | null;
          external_id: string | null;
          status:
            | "connected"
            | "disconnected"
            | "error"
            | "token_expired"
            | "configured";
          last_synced_at: string | null;
          last_tested_at: string | null;
          last_error: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          connection_type:
            | "meta_business"
            | "meta_ad_account"
            | "facebook_page"
            | "instagram_business"
            | "meta_pixel"
            | "conversions_api";
          display_name?: string | null;
          external_id?: string | null;
          status?:
            | "connected"
            | "disconnected"
            | "error"
            | "token_expired"
            | "configured";
          last_synced_at?: string | null;
          last_tested_at?: string | null;
          last_error?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          connection_type?:
            | "meta_business"
            | "meta_ad_account"
            | "facebook_page"
            | "instagram_business"
            | "meta_pixel"
            | "conversions_api";
          display_name?: string | null;
          external_id?: string | null;
          status?:
            | "connected"
            | "disconnected"
            | "error"
            | "token_expired"
            | "configured";
          last_synced_at?: string | null;
          last_tested_at?: string | null;
          last_error?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      instagram_media: {
        Row: {
          id: string;
          meta_media_id: string;
          media_type:
            | "IMAGE"
            | "VIDEO"
            | "CAROUSEL_ALBUM"
            | "REELS"
            | "STORY"
            | "OTHER";
          caption: string | null;
          permalink: string | null;
          thumbnail_url: string | null;
          media_url: string | null;
          published_at: string | null;
          used_in_ads: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meta_media_id: string;
          media_type?:
            | "IMAGE"
            | "VIDEO"
            | "CAROUSEL_ALBUM"
            | "REELS"
            | "STORY"
            | "OTHER";
          caption?: string | null;
          permalink?: string | null;
          thumbnail_url?: string | null;
          media_url?: string | null;
          published_at?: string | null;
          used_in_ads?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          meta_media_id?: string;
          media_type?:
            | "IMAGE"
            | "VIDEO"
            | "CAROUSEL_ALBUM"
            | "REELS"
            | "STORY"
            | "OTHER";
          caption?: string | null;
          permalink?: string | null;
          thumbnail_url?: string | null;
          media_url?: string | null;
          published_at?: string | null;
          used_in_ads?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      instagram_media_insights: {
        Row: {
          id: string;
          instagram_media_id: string;
          insight_date: string;
          likes: number;
          comments: number;
          saves: number;
          shares: number;
          plays: number;
          reach: number;
          engagement_rate: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          instagram_media_id: string;
          insight_date?: string;
          likes?: number;
          comments?: number;
          saves?: number;
          shares?: number;
          plays?: number;
          reach?: number;
          engagement_rate?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          instagram_media_id?: string;
          insight_date?: string;
          likes?: number;
          comments?: number;
          saves?: number;
          shares?: number;
          plays?: number;
          reach?: number;
          engagement_rate?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      instagram_media_ad_links: {
        Row: {
          id: string;
          instagram_media_id: string;
          ad_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          instagram_media_id: string;
          ad_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          instagram_media_id?: string;
          ad_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      customer_attributions: {
        Row: {
          id: string;
          contact_id: string;
          source_platform: string | null;
          source_type:
            | "instagram_organic"
            | "instagram_ad"
            | "facebook_ad"
            | "referral"
            | "google"
            | "website"
            | "phone"
            | "whatsapp"
            | "returning_customer"
            | "other"
            | "unknown";
          meta_campaign_id: string | null;
          meta_adset_id: string | null;
          meta_ad_id: string | null;
          meta_creative_id: string | null;
          campaign_id: string | null;
          ad_set_id: string | null;
          ad_id: string | null;
          creative_id: string | null;
          instagram_media_id: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          fbclid: string | null;
          first_touch_at: string | null;
          last_touch_at: string | null;
          attribution_status: "exact" | "probable" | "manual" | "unknown";
          attribution_confidence: number | null;
          attribution_method: string | null;
          notes: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          source_platform?: string | null;
          source_type?:
            | "instagram_organic"
            | "instagram_ad"
            | "facebook_ad"
            | "referral"
            | "google"
            | "website"
            | "phone"
            | "whatsapp"
            | "returning_customer"
            | "other"
            | "unknown";
          meta_campaign_id?: string | null;
          meta_adset_id?: string | null;
          meta_ad_id?: string | null;
          meta_creative_id?: string | null;
          campaign_id?: string | null;
          ad_set_id?: string | null;
          ad_id?: string | null;
          creative_id?: string | null;
          instagram_media_id?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          fbclid?: string | null;
          first_touch_at?: string | null;
          last_touch_at?: string | null;
          attribution_status?: "exact" | "probable" | "manual" | "unknown";
          attribution_confidence?: number | null;
          attribution_method?: string | null;
          notes?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          source_platform?: string | null;
          source_type?:
            | "instagram_organic"
            | "instagram_ad"
            | "facebook_ad"
            | "referral"
            | "google"
            | "website"
            | "phone"
            | "whatsapp"
            | "returning_customer"
            | "other"
            | "unknown";
          meta_campaign_id?: string | null;
          meta_adset_id?: string | null;
          meta_ad_id?: string | null;
          meta_creative_id?: string | null;
          campaign_id?: string | null;
          ad_set_id?: string | null;
          ad_id?: string | null;
          creative_id?: string | null;
          instagram_media_id?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          fbclid?: string | null;
          first_touch_at?: string | null;
          last_touch_at?: string | null;
          attribution_status?: "exact" | "probable" | "manual" | "unknown";
          attribution_confidence?: number | null;
          attribution_method?: string | null;
          notes?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attribution_audit_logs: {
        Row: {
          id: string;
          contact_id: string;
          attribution_id: string | null;
          actor_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          attribution_id?: string | null;
          actor_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          attribution_id?: string | null;
          actor_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      marketing_strategies: {
        Row: {
          id: string;
          title: string;
          period_type: "daily" | "weekly" | "monthly" | "custom";
          budget_amount: number;
          currency: string;
          data_range_start: string | null;
          data_range_end: string | null;
          data_sufficiency: "sufficient" | "partial" | "insufficient";
          overall_confidence: number | null;
          status: "draft" | "presented" | "accepted" | "rejected" | "archived";
          summary: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          period_type?: "daily" | "weekly" | "monthly" | "custom";
          budget_amount: number;
          currency?: string;
          data_range_start?: string | null;
          data_range_end?: string | null;
          data_sufficiency?: "sufficient" | "partial" | "insufficient";
          overall_confidence?: number | null;
          status?: "draft" | "presented" | "accepted" | "rejected" | "archived";
          summary?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          period_type?: "daily" | "weekly" | "monthly" | "custom";
          budget_amount?: number;
          currency?: string;
          data_range_start?: string | null;
          data_range_end?: string | null;
          data_sufficiency?: "sufficient" | "partial" | "insufficient";
          overall_confidence?: number | null;
          status?: "draft" | "presented" | "accepted" | "rejected" | "archived";
          summary?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_strategy_items: {
        Row: {
          id: string;
          strategy_id: string;
          item_type:
            | "budget_allocation"
            | "continue"
            | "increase_budget"
            | "decrease_budget"
            | "pause_suggest"
            | "remarketing"
            | "test_content"
            | "new_experiment"
            | "other";
          recommendation: string;
          suggested_budget: number | null;
          expected_goal: string;
          rationale: string;
          data_range_label: string;
          data_sufficiency: "sufficient" | "partial" | "insufficient";
          confidence_level: number;
          related_campaign_id: string | null;
          related_ad_id: string | null;
          related_instagram_media_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          strategy_id: string;
          item_type:
            | "budget_allocation"
            | "continue"
            | "increase_budget"
            | "decrease_budget"
            | "pause_suggest"
            | "remarketing"
            | "test_content"
            | "new_experiment"
            | "other";
          recommendation: string;
          suggested_budget?: number | null;
          expected_goal: string;
          rationale: string;
          data_range_label: string;
          data_sufficiency: "sufficient" | "partial" | "insufficient";
          confidence_level: number;
          related_campaign_id?: string | null;
          related_ad_id?: string | null;
          related_instagram_media_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          strategy_id?: string;
          item_type?:
            | "budget_allocation"
            | "continue"
            | "increase_budget"
            | "decrease_budget"
            | "pause_suggest"
            | "remarketing"
            | "test_content"
            | "new_experiment"
            | "other";
          recommendation?: string;
          suggested_budget?: number | null;
          expected_goal?: string;
          rationale?: string;
          data_range_label?: string;
          data_sufficiency?: "sufficient" | "partial" | "insufficient";
          confidence_level?: number;
          related_campaign_id?: string | null;
          related_ad_id?: string | null;
          related_instagram_media_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      marketing_strategy_history: {
        Row: {
          id: string;
          strategy_id: string | null;
          event_type:
            | "generated"
            | "presented"
            | "item_updated"
            | "accepted"
            | "rejected"
            | "archived"
            | "note";
          title: string;
          detail: string | null;
          confidence_level: number | null;
          rationale: string | null;
          snapshot: Json;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          strategy_id?: string | null;
          event_type:
            | "generated"
            | "presented"
            | "item_updated"
            | "accepted"
            | "rejected"
            | "archived"
            | "note";
          title: string;
          detail?: string | null;
          confidence_level?: number | null;
          rationale?: string | null;
          snapshot?: Json;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          strategy_id?: string | null;
          event_type?:
            | "generated"
            | "presented"
            | "item_updated"
            | "accepted"
            | "rejected"
            | "archived"
            | "note";
          title?: string;
          detail?: string | null;
          confidence_level?: number | null;
          rationale?: string | null;
          snapshot?: Json;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      marketing_experiments: {
        Row: {
          id: string;
          title: string;
          experiment_type:
            | "creative"
            | "audience"
            | "ad_copy"
            | "cta"
            | "placement";
          hypothesis: string;
          control_ad_id: string | null;
          test_ad_id: string | null;
          changed_variable: string;
          start_date: string | null;
          end_date: string | null;
          budget_amount: number | null;
          primary_success_metric:
            | "deposit"
            | "reservation"
            | "revenue"
            | "qualified_customer"
            | "message";
          minimum_data_threshold: number;
          result_summary: string | null;
          winner: "control" | "test" | "inconclusive" | "none" | null;
          confidence_level: number | null;
          rationale: string | null;
          learned_insight: string | null;
          status:
            | "draft"
            | "running"
            | "completed"
            | "cancelled"
            | "insufficient_data";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          experiment_type:
            | "creative"
            | "audience"
            | "ad_copy"
            | "cta"
            | "placement";
          hypothesis: string;
          control_ad_id?: string | null;
          test_ad_id?: string | null;
          changed_variable: string;
          start_date?: string | null;
          end_date?: string | null;
          budget_amount?: number | null;
          primary_success_metric?:
            | "deposit"
            | "reservation"
            | "revenue"
            | "qualified_customer"
            | "message";
          minimum_data_threshold?: number;
          result_summary?: string | null;
          winner?: "control" | "test" | "inconclusive" | "none" | null;
          confidence_level?: number | null;
          rationale?: string | null;
          learned_insight?: string | null;
          status?:
            | "draft"
            | "running"
            | "completed"
            | "cancelled"
            | "insufficient_data";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          experiment_type?:
            | "creative"
            | "audience"
            | "ad_copy"
            | "cta"
            | "placement";
          hypothesis?: string;
          control_ad_id?: string | null;
          test_ad_id?: string | null;
          changed_variable?: string;
          start_date?: string | null;
          end_date?: string | null;
          budget_amount?: number | null;
          primary_success_metric?:
            | "deposit"
            | "reservation"
            | "revenue"
            | "qualified_customer"
            | "message";
          minimum_data_threshold?: number;
          result_summary?: string | null;
          winner?: "control" | "test" | "inconclusive" | "none" | null;
          confidence_level?: number | null;
          rationale?: string | null;
          learned_insight?: string | null;
          status?:
            | "draft"
            | "running"
            | "completed"
            | "cancelled"
            | "insufficient_data";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_learnings: {
        Row: {
          id: string;
          title: string;
          description: string;
          data_range_start: string | null;
          data_range_end: string | null;
          related_campaign_ids: string[];
          related_ad_ids: string[];
          supporting_experiment_count: number;
          confidence_level: number;
          rationale: string;
          status:
            | "hypothesis"
            | "testing"
            | "validated"
            | "rejected"
            | "archived";
          source_reservation_id: string | null;
          source_contact_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          data_range_start?: string | null;
          data_range_end?: string | null;
          related_campaign_ids?: string[];
          related_ad_ids?: string[];
          supporting_experiment_count?: number;
          confidence_level?: number;
          rationale?: string;
          status?:
            | "hypothesis"
            | "testing"
            | "validated"
            | "rejected"
            | "archived";
          source_reservation_id?: string | null;
          source_contact_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          data_range_start?: string | null;
          data_range_end?: string | null;
          related_campaign_ids?: string[];
          related_ad_ids?: string[];
          supporting_experiment_count?: number;
          confidence_level?: number;
          rationale?: string;
          status?:
            | "hypothesis"
            | "testing"
            | "validated"
            | "rejected"
            | "archived";
          source_reservation_id?: string | null;
          source_contact_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attribution_funnel_events: {
        Row: {
          id: string;
          contact_id: string;
          reservation_id: string | null;
          attribution_id: string | null;
          stage:
            | "dm"
            | "lead"
            | "reservation"
            | "kapora"
            | "shoot"
            | "delivery"
            | "revenue";
          occurred_at: string;
          amount: number | null;
          currency: string;
          campaign_id: string | null;
          ad_id: string | null;
          attribution_status:
            | "exact"
            | "probable"
            | "manual"
            | "unknown"
            | null;
          attribution_confidence: number | null;
          source_ref: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          reservation_id?: string | null;
          attribution_id?: string | null;
          stage:
            | "dm"
            | "lead"
            | "reservation"
            | "kapora"
            | "shoot"
            | "delivery"
            | "revenue";
          occurred_at?: string;
          amount?: number | null;
          currency?: string;
          campaign_id?: string | null;
          ad_id?: string | null;
          attribution_status?:
            | "exact"
            | "probable"
            | "manual"
            | "unknown"
            | null;
          attribution_confidence?: number | null;
          source_ref?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          reservation_id?: string | null;
          attribution_id?: string | null;
          stage?:
            | "dm"
            | "lead"
            | "reservation"
            | "kapora"
            | "shoot"
            | "delivery"
            | "revenue";
          occurred_at?: string;
          amount?: number | null;
          currency?: string;
          campaign_id?: string | null;
          ad_id?: string | null;
          attribution_status?:
            | "exact"
            | "probable"
            | "manual"
            | "unknown"
            | null;
          attribution_confidence?: number | null;
          source_ref?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      marketing_daily_reports: {
        Row: {
          id: string;
          report_date: string;
          summary_md: string;
          metrics: Json;
          campaign_rows: Json;
          learnings_snapshot: Json;
          data_sufficiency: "sufficient" | "partial" | "insufficient";
          overall_confidence: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_date: string;
          summary_md: string;
          metrics?: Json;
          campaign_rows?: Json;
          learnings_snapshot?: Json;
          data_sufficiency?: "sufficient" | "partial" | "insufficient";
          overall_confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_date?: string;
          summary_md?: string;
          metrics?: Json;
          campaign_rows?: Json;
          learnings_snapshot?: Json;
          data_sufficiency?: "sufficient" | "partial" | "insufficient";
          overall_confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_sync_logs: {
        Row: {
          id: string;
          sync_type:
            | "ads"
            | "insights"
            | "instagram"
            | "attribution"
            | "connection_test"
            | "other";
          api_endpoint_kind: string | null;
          started_at: string;
          finished_at: string | null;
          status: "started" | "success" | "partial" | "failed" | "skipped";
          records_fetched: number;
          error_message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          sync_type:
            | "ads"
            | "insights"
            | "instagram"
            | "attribution"
            | "connection_test"
            | "other";
          api_endpoint_kind?: string | null;
          started_at?: string;
          finished_at?: string | null;
          status?: "started" | "success" | "partial" | "failed" | "skipped";
          records_fetched?: number;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          sync_type?:
            | "ads"
            | "insights"
            | "instagram"
            | "attribution"
            | "connection_test"
            | "other";
          api_endpoint_kind?: string | null;
          started_at?: string;
          finished_at?: string | null;
          status?: "started" | "success" | "partial" | "failed" | "skipped";
          records_fetched?: number;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      sales_patterns: {
        Row: {
          id: string;
          pattern_type:
            | "opening"
            | "price_explanation"
            | "trust_building"
            | "objection_response"
            | "closing"
            | "failure"
            | "leave_reason"
            | "human_feedback";
          pattern_text: string;
          pattern_key: string;
          context_note: string | null;
          won_count: number;
          lost_count: number;
          seen_count: number;
          success_rate: number | null;
          confidence: number;
          status: "active" | "superseded";
          superseded_by: string | null;
          source_conversation_ids: string[];
          first_seen_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pattern_type:
            | "opening"
            | "price_explanation"
            | "trust_building"
            | "objection_response"
            | "closing"
            | "failure"
            | "leave_reason"
            | "human_feedback";
          pattern_text: string;
          pattern_key: string;
          context_note?: string | null;
          won_count?: number;
          lost_count?: number;
          seen_count?: number;
          success_rate?: number | null;
          confidence?: number;
          status?: "active" | "superseded";
          superseded_by?: string | null;
          source_conversation_ids?: string[];
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pattern_type?:
            | "opening"
            | "price_explanation"
            | "trust_building"
            | "objection_response"
            | "closing"
            | "failure"
            | "leave_reason"
            | "human_feedback";
          pattern_text?: string;
          pattern_key?: string;
          context_note?: string | null;
          won_count?: number;
          lost_count?: number;
          seen_count?: number;
          success_rate?: number | null;
          confidence?: number;
          status?: "active" | "superseded";
          superseded_by?: string | null;
          source_conversation_ids?: string[];
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_personality_traits: {
        Row: {
          id: string;
          trait_type:
            | "tone"
            | "pricing_style"
            | "phone_timing"
            | "service_offering"
            | "vocabulary"
            | "trust_style";
          trait_text: string;
          trait_key: string;
          evidence_count: number;
          confidence: number;
          status: "active" | "superseded";
          source_conversation_ids: string[];
          first_seen_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trait_type:
            | "tone"
            | "pricing_style"
            | "phone_timing"
            | "service_offering"
            | "vocabulary"
            | "trust_style";
          trait_text: string;
          trait_key: string;
          evidence_count?: number;
          confidence?: number;
          status?: "active" | "superseded";
          source_conversation_ids?: string[];
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trait_type?:
            | "tone"
            | "pricing_style"
            | "phone_timing"
            | "service_offering"
            | "vocabulary"
            | "trust_style";
          trait_text?: string;
          trait_key?: string;
          evidence_count?: number;
          confidence?: number;
          status?: "active" | "superseded";
          source_conversation_ids?: string[];
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_mistakes: {
        Row: {
          id: string;
          mistake_type:
            | "premature_detail_question"
            | "premature_phone_request"
            | "wrong_information"
            | "missed_buying_signal"
            | "repeated_question"
            | "tone_mismatch"
            | "other";
          trigger_context: string;
          wrong_reply: string | null;
          correct_approach: string;
          mistake_key: string;
          occurrence_count: number;
          is_resolved: boolean;
          resolved_note: string | null;
          source_conversation_id: string | null;
          source_ai_run_id: string | null;
          first_seen_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mistake_type:
            | "premature_detail_question"
            | "premature_phone_request"
            | "wrong_information"
            | "missed_buying_signal"
            | "repeated_question"
            | "tone_mismatch"
            | "other";
          trigger_context: string;
          wrong_reply?: string | null;
          correct_approach: string;
          mistake_key: string;
          occurrence_count?: number;
          is_resolved?: boolean;
          resolved_note?: string | null;
          source_conversation_id?: string | null;
          source_ai_run_id?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mistake_type?:
            | "premature_detail_question"
            | "premature_phone_request"
            | "wrong_information"
            | "missed_buying_signal"
            | "repeated_question"
            | "tone_mismatch"
            | "other";
          trigger_context?: string;
          wrong_reply?: string | null;
          correct_approach?: string;
          mistake_key?: string;
          occurrence_count?: number;
          is_resolved?: boolean;
          resolved_note?: string | null;
          source_conversation_id?: string | null;
          source_ai_run_id?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_weekly_reports: {
        Row: {
          id: string;
          week_start: string;
          week_end: string;
          summary_md: string;
          learned_items: Json;
          mistakes_made: Json;
          mistakes_fixed: Json;
          new_techniques: Json;
          best_replies: Json;
          worst_replies: Json;
          metrics: Json;
          data_sufficiency: "sufficient" | "partial" | "insufficient";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          week_start: string;
          week_end: string;
          summary_md: string;
          learned_items?: Json;
          mistakes_made?: Json;
          mistakes_fixed?: Json;
          new_techniques?: Json;
          best_replies?: Json;
          worst_replies?: Json;
          metrics?: Json;
          data_sufficiency?: "sufficient" | "partial" | "insufficient";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          week_start?: string;
          week_end?: string;
          summary_md?: string;
          learned_items?: Json;
          mistakes_made?: Json;
          mistakes_fixed?: Json;
          new_techniques?: Json;
          best_replies?: Json;
          worst_replies?: Json;
          metrics?: Json;
          data_sufficiency?: "sufficient" | "partial" | "insufficient";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_approvals: {
        Row: {
          id: string;
          action_type:
            | "assistant_reply"
            | "knowledge_publish"
            | "playbook_activate"
            | "budget_change"
            | "other";
          title: string;
          payload: Json;
          confidence: number | null;
          status: "pending" | "approved" | "rejected" | "expired";
          requested_by: "ai" | "human";
          conversation_id: string | null;
          contact_id: string | null;
          ai_run_id: string | null;
          decided_by: string | null;
          decided_at: string | null;
          decision_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          action_type:
            | "assistant_reply"
            | "knowledge_publish"
            | "playbook_activate"
            | "budget_change"
            | "other";
          title: string;
          payload?: Json;
          confidence?: number | null;
          status?: "pending" | "approved" | "rejected" | "expired";
          requested_by?: "ai" | "human";
          conversation_id?: string | null;
          contact_id?: string | null;
          ai_run_id?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          action_type?:
            | "assistant_reply"
            | "knowledge_publish"
            | "playbook_activate"
            | "budget_change"
            | "other";
          title?: string;
          payload?: Json;
          confidence?: number | null;
          status?: "pending" | "approved" | "rejected" | "expired";
          requested_by?: "ai" | "human";
          conversation_id?: string | null;
          contact_id?: string | null;
          ai_run_id?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_playbooks: {
        Row: {
          id: string;
          category: "sales" | "marketing" | "support" | "reservation";
          title: string;
          title_key: string;
          trigger_context: string;
          steps: Json;
          decision_rules: Json;
          expected_outcome: string | null;
          status: "draft" | "review" | "active" | "archived";
          version: number;
          confidence: number;
          usage_count: number;
          source_conversation_ids: string[];
          source_note: string | null;
          created_by: "ai" | "human";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category?: "sales" | "marketing" | "support" | "reservation";
          title: string;
          title_key: string;
          trigger_context: string;
          steps?: Json;
          decision_rules?: Json;
          expected_outcome?: string | null;
          status?: "draft" | "review" | "active" | "archived";
          version?: number;
          confidence?: number;
          usage_count?: number;
          source_conversation_ids?: string[];
          source_note?: string | null;
          created_by?: "ai" | "human";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: "sales" | "marketing" | "support" | "reservation";
          title?: string;
          title_key?: string;
          trigger_context?: string;
          steps?: Json;
          decision_rules?: Json;
          expected_outcome?: string | null;
          status?: "draft" | "review" | "active" | "archived";
          version?: number;
          confidence?: number;
          usage_count?: number;
          source_conversation_ids?: string[];
          source_note?: string | null;
          created_by?: "ai" | "human";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      automation_rules: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          trigger_type:
            | "inbound_message"
            | "reservation_created"
            | "deposit_verified";
          conditions: Json;
          actions: Json;
          is_enabled: boolean;
          run_count: number;
          last_run_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          trigger_type:
            | "inbound_message"
            | "reservation_created"
            | "deposit_verified";
          conditions?: Json;
          actions?: Json;
          is_enabled?: boolean;
          run_count?: number;
          last_run_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          trigger_type?:
            | "inbound_message"
            | "reservation_created"
            | "deposit_verified";
          conditions?: Json;
          actions?: Json;
          is_enabled?: boolean;
          run_count?: number;
          last_run_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      automation_runs: {
        Row: {
          id: string;
          rule_id: string;
          trigger_type: string;
          status: "completed" | "skipped" | "failed";
          detail: string | null;
          context: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          trigger_type: string;
          status: "completed" | "skipped" | "failed";
          detail?: string | null;
          context?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          rule_id?: string;
          trigger_type?: string;
          status?: "completed" | "skipped" | "failed";
          detail?: string | null;
          context?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      sales_benchmark_runs: {
        Row: {
          id: string;
          benchmark_version: string;
          git_commit: string | null;
          prompt_version: string;
          model: string | null;
          average_score: number;
          pass_rate: number;
          hard_fail_count: number;
          scenario_count: number;
          summary: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          benchmark_version: string;
          git_commit?: string | null;
          prompt_version: string;
          model?: string | null;
          average_score: number;
          pass_rate: number;
          hard_fail_count?: number;
          scenario_count?: number;
          summary?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          benchmark_version?: string;
          git_commit?: string | null;
          prompt_version?: string;
          model?: string | null;
          average_score?: number;
          pass_rate?: number;
          hard_fail_count?: number;
          scenario_count?: number;
          summary?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      lost_sale_analyses: {
        Row: {
          id: string;
          conversation_id: string | null;
          primary_reason: string;
          reasons: string[];
          why_lost: string | null;
          first_mistake_turn_index: number | null;
          alternative_conversation: string | null;
          reservation_lift_pct: number;
          result: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id?: string | null;
          primary_reason: string;
          reasons?: string[];
          why_lost?: string | null;
          first_mistake_turn_index?: number | null;
          alternative_conversation?: string | null;
          reservation_lift_pct?: number;
          result?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string | null;
          primary_reason?: string;
          reasons?: string[];
          why_lost?: string | null;
          first_mistake_turn_index?: number | null;
          alternative_conversation?: string | null;
          reservation_lift_pct?: number;
          result?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      conversation_outcome_tags: {
        Row: {
          conversation_id: string;
          reservation: boolean;
          deposit: boolean;
          customer_lost: boolean;
          lost_reason: string | null;
          conversation_length: number;
          customer_type: string | null;
          confidence: number | null;
          customer_replied: boolean;
          price_mentioned: boolean;
          price_accepted: boolean | null;
          reply_variant: "A" | "B" | null;
          ab_experiment_key: string | null;
          recommendation: string | null;
          tag: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          conversation_id: string;
          reservation?: boolean;
          deposit?: boolean;
          customer_lost?: boolean;
          lost_reason?: string | null;
          conversation_length?: number;
          customer_type?: string | null;
          confidence?: number | null;
          customer_replied?: boolean;
          price_mentioned?: boolean;
          price_accepted?: boolean | null;
          reply_variant?: "A" | "B" | null;
          ab_experiment_key?: string | null;
          recommendation?: string | null;
          tag?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          conversation_id?: string;
          reservation?: boolean;
          deposit?: boolean;
          customer_lost?: boolean;
          lost_reason?: string | null;
          conversation_length?: number;
          customer_type?: string | null;
          confidence?: number | null;
          customer_replied?: boolean;
          price_mentioned?: boolean;
          price_accepted?: boolean | null;
          reply_variant?: "A" | "B" | null;
          ab_experiment_key?: string | null;
          recommendation?: string | null;
          tag?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reply_ab_assignments: {
        Row: {
          conversation_id: string;
          experiment_key: string;
          variant: "A" | "B";
          assigned_at: string;
        };
        Insert: {
          conversation_id: string;
          experiment_key?: string;
          variant: "A" | "B";
          assigned_at?: string;
        };
        Update: {
          conversation_id?: string;
          experiment_key?: string;
          variant?: "A" | "B";
          assigned_at?: string;
        };
        Relationships: [];
      };
      suggestion_applications: {
        Row: {
          id: string;
          conversation_id: string;
          contact_id: string | null;
          staff_message_id: string | null;
          loss_reason: string | null;
          suggestion_source:
            | "quality_score"
            | "lost_sale"
            | "follow_up_predict"
            | "manual_edit";
          original_suggestion: string;
          sent_text: string;
          applied_by: string | null;
          applied_at: string;
          customer_replied: boolean;
          customer_replied_at: string | null;
          led_to_deposit: boolean;
          led_to_reservation: boolean;
          outcome_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          contact_id?: string | null;
          staff_message_id?: string | null;
          loss_reason?: string | null;
          suggestion_source?:
            | "quality_score"
            | "lost_sale"
            | "follow_up_predict"
            | "manual_edit";
          original_suggestion: string;
          sent_text: string;
          applied_by?: string | null;
          applied_at?: string;
          customer_replied?: boolean;
          customer_replied_at?: string | null;
          led_to_deposit?: boolean;
          led_to_reservation?: boolean;
          outcome_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          contact_id?: string | null;
          staff_message_id?: string | null;
          loss_reason?: string | null;
          suggestion_source?:
            | "quality_score"
            | "lost_sale"
            | "follow_up_predict"
            | "manual_edit";
          original_suggestion?: string;
          sent_text?: string;
          applied_by?: string | null;
          applied_at?: string;
          customer_replied?: boolean;
          customer_replied_at?: string | null;
          led_to_deposit?: boolean;
          led_to_reservation?: boolean;
          outcome_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_quality_scores: {
        Row: {
          conversation_id: string;
          score: number;
          grade: string;
          primary_issue: string | null;
          issues: string[];
          factors: Json;
          loss_reason: string | null;
          suggested_reply: string | null;
          summary: string | null;
          scored_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          conversation_id: string;
          score: number;
          grade: string;
          primary_issue?: string | null;
          issues?: string[];
          factors?: Json;
          loss_reason?: string | null;
          suggested_reply?: string | null;
          summary?: string | null;
          scored_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          conversation_id?: string;
          score?: number;
          grade?: string;
          primary_issue?: string | null;
          issues?: string[];
          factors?: Json;
          loss_reason?: string | null;
          suggested_reply?: string | null;
          summary?: string | null;
          scored_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
  Views: Record<string, never>;
    Functions: {
      match_knowledge_chunks: {
        Args: {
          query_embedding: string;
          match_count?: number;
        };
        Returns: {
          chunk_id: string;
          document_id: string;
          content: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      message_source:
        | "chatplace_mcp"
        | "chatplace_webhook"
        | "meta_delivery"
        | "manual_test"
        | "seed"
        | "lab"
        | "import"
        | "migration"
        | "legacy"
        | "unknown";
    };
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
