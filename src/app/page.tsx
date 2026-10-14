"use client";

import LoginScreen from "@/components/LoginScreen";
import { HOME_BY_ROLE } from "@/lib/nav";
import type { SessionUser } from "@/lib/types";

export default function Home() {
  const handleSuccess = (user: SessionUser) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("session_user", JSON.stringify(user));
    }
    const dest = HOME_BY_ROLE[user.role] || "/pos";
    window.location.href = dest;
  };

  return <LoginScreen onSuccess={handleSuccess} />;
}
