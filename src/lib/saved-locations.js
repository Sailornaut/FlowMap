import { supabase, isSupabaseConfigured } from "@/lib/supabase";

function normalizeSavedLocation(row) {
  return {
    id: row.id,
    created_date: row.created_at,
    ...row.payload,
  };
}

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
}

export const savedLocationsStore = {
  async list() {
    ensureSupabase();

    const { data, error } = await supabase
      .from("saved_locations")
      .select("id, payload, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(normalizeSavedLocation);
  },

  async create(location, userId) {
    ensureSupabase();

    const { data, error } = await supabase
      .from("saved_locations")
      .insert({
        user_id: userId,
        payload: location,
      })
      .select("id, payload, created_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeSavedLocation(data);
  },

  async remove(id) {
    ensureSupabase();

    const { error } = await supabase.from("saved_locations").delete().eq("id", id);
    if (error) {
      throw error;
    }
  },

  async clear(userId) {
    ensureSupabase();

    const { error } = await supabase.from("saved_locations").delete().eq("user_id", userId);
    if (error) {
      throw error;
    }
  },
};
