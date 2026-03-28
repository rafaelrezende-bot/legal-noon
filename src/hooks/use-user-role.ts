"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "editor" | "leitor";

export function useUserRole() {
  const [role, setRole] = useState<UserRole>("leitor");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (data?.role) setRole(data.role as UserRole);
      setLoading(false);
    }
    fetchRole();
  }, []);

  const isAdmin = role === "admin";
  const isEditor = role === "editor";

  return {
    role, loading, isAdmin, isEditor, isLeitor: role === "leitor",
    canManageUsers: isAdmin,
    canManageCategories: isAdmin,
    canDeleteDocuments: isAdmin,
    canUploadDocuments: isAdmin || isEditor,
    canExtractObligations: isAdmin || isEditor,
    canUpdateObligations: isAdmin || isEditor,
    canRegisterTrainings: isAdmin || isEditor,
    canManageDeclarations: isAdmin || isEditor,
    canManagePersons: isAdmin,
    canChat: true,
  };
}
