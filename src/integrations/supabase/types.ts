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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      events: {
        Row: {
          archived: boolean
          cover_url: string | null
          created_at: string
          digitals_enabled: boolean
          digitals_folder_id: string | null
          drive_folder_id: string | null
          event_date: string | null
          gif_enabled: boolean
          gif_folder_id: string | null
          id: string
          location: string | null
          name: string
          print_enabled: boolean
          print_folder_id: string | null
          published: boolean
          singles_enabled: boolean
          singles_folder_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          cover_url?: string | null
          created_at?: string
          digitals_enabled?: boolean
          digitals_folder_id?: string | null
          drive_folder_id?: string | null
          event_date?: string | null
          gif_enabled?: boolean
          gif_folder_id?: string | null
          id?: string
          location?: string | null
          name: string
          print_enabled?: boolean
          print_folder_id?: string | null
          published?: boolean
          singles_enabled?: boolean
          singles_folder_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          cover_url?: string | null
          created_at?: string
          digitals_enabled?: boolean
          digitals_folder_id?: string | null
          drive_folder_id?: string | null
          event_date?: string | null
          gif_enabled?: boolean
          gif_folder_id?: string | null
          id?: string
          location?: string | null
          name?: string
          print_enabled?: boolean
          print_folder_id?: string | null
          published?: boolean
          singles_enabled?: boolean
          singles_folder_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          current_stock: number | null
          current_unit_cost: number
          id: string
          min_stock: number | null
          name: string
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          current_stock?: number | null
          current_unit_cost?: number
          id?: string
          min_stock?: number | null
          name: string
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          current_stock?: number | null
          current_unit_cost?: number
          id?: string
          min_stock?: number | null
          name?: string
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_items: {
        Row: {
          category: string
          created_at: string
          download_enabled: boolean
          drive_file_id: string
          event_id: string
          full_url: string | null
          height: number | null
          id: string
          is_gif: boolean
          mime_type: string | null
          name: string
          published: boolean
          source: string
          thumb_url: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          category: string
          created_at?: string
          download_enabled?: boolean
          drive_file_id: string
          event_id: string
          full_url?: string | null
          height?: number | null
          id?: string
          is_gif?: boolean
          mime_type?: string | null
          name: string
          published?: boolean
          source?: string
          thumb_url?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          download_enabled?: boolean
          drive_file_id?: string
          event_id?: string
          full_url?: string | null
          height?: number | null
          id?: string
          is_gif?: boolean
          mime_type?: string | null
          name?: string
          published?: boolean
          source?: string
          thumb_url?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      package_materials: {
        Row: {
          created_at: string
          id: string
          material_id: string
          package_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          package_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          package_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_materials_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          estimated_other_costs: number
          id: string
          included_services: string | null
          name: string
          notes: string | null
          selling_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          estimated_other_costs?: number
          id?: string
          included_services?: string | null
          name: string
          notes?: string | null
          selling_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          estimated_other_costs?: number
          id?: string
          included_services?: string | null
          name?: string
          notes?: string | null
          selling_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      sale_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          sale_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_expenses_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_materials: {
        Row: {
          created_at: string
          id: string
          material_id: string | null
          material_name_snapshot: string
          quantity: number
          sale_id: string
          total_cost: number | null
          unit_cost_snapshot: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_id?: string | null
          material_name_snapshot: string
          quantity?: number
          sale_id: string
          total_cost?: number | null
          unit_cost_snapshot?: number
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string | null
          material_name_snapshot?: string
          quantity?: number
          sale_id?: string
          total_cost?: number | null
          unit_cost_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_materials_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          booking_date: string
          created_at: string
          customer_contact: string | null
          customer_email: string | null
          customer_name: string
          discount: number
          event_date: string | null
          event_id: string | null
          event_name: string | null
          event_time: string | null
          gcal_event_id: string | null
          id: string
          notes: string | null
          package_id: string | null
          package_name_snapshot: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          quantity: number
          sale_number: number
          selling_price: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          booking_date?: string
          created_at?: string
          customer_contact?: string | null
          customer_email?: string | null
          customer_name: string
          discount?: number
          event_date?: string | null
          event_id?: string | null
          event_name?: string | null
          event_time?: string | null
          gcal_event_id?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          package_name_snapshot?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          quantity?: number
          sale_number?: number
          selling_price?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          booking_date?: string
          created_at?: string
          customer_contact?: string | null
          customer_email?: string | null
          customer_name?: string
          discount?: number
          event_date?: string | null
          event_id?: string | null
          event_name?: string | null
          event_time?: string | null
          gcal_event_id?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          package_name_snapshot?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          quantity?: number
          sale_number?: number
          selling_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          brand_line1: string
          brand_line2: string
          brand_sub: string
          color_accent: string
          color_ink: string
          color_paper: string
          cta_label: string
          final_tagline: string
          final_title: string
          hero_description: string
          hero_eyebrow: string
          hero_lead: string
          hero_title: string
          id: number
          messenger_url: string
          updated_at: string
        }
        Insert: {
          brand_line1?: string
          brand_line2?: string
          brand_sub?: string
          color_accent?: string
          color_ink?: string
          color_paper?: string
          cta_label?: string
          final_tagline?: string
          final_title?: string
          hero_description?: string
          hero_eyebrow?: string
          hero_lead?: string
          hero_title?: string
          id?: number
          messenger_url?: string
          updated_at?: string
        }
        Update: {
          brand_line1?: string
          brand_line2?: string
          brand_sub?: string
          color_accent?: string
          color_ink?: string
          color_paper?: string
          cta_label?: string
          final_tagline?: string
          final_title?: string
          hero_description?: string
          hero_eyebrow?: string
          hero_lead?: string
          hero_title?: string
          id?: number
          messenger_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      payment_status:
        | "unpaid"
        | "partially_paid"
        | "fully_paid"
        | "refunded"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
      payment_status: [
        "unpaid",
        "partially_paid",
        "fully_paid",
        "refunded",
        "cancelled",
      ],
    },
  },
} as const
