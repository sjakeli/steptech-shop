/* =====================================================================
   users.js  —  /api/users*  (საჭიროებს ავტორიზაციას)
===================================================================== */
import { apiFetch, extractItem } from "../config/http.js";


// მიმდინარე ავტორიზებული მომხმარებლის პროფილის ინფორმაციის წამოღება
export const UsersAPI = {
  async me() {
    const res = await apiFetch("/api/users/me", { auth: true });
    console.log("[UsersAPI.me] raw response:", res);
    if (!res.ok) return { ok: false, user: null, status: res.status };
    return { ok: true, user: extractItem(res.data) };
  },

  // მომხმარებლის პროფილის მონაცემების განახლება (PUT მეთოდი, ითხოვს ავტორიზაციას)
  updateProfile(payload) {
    return apiFetch("/api/users", { method: "PUT", auth: true, body: payload });
  },

  // ძველი პაროლის ახლით შეცვლა პროფილის შიგნით (PUT მეთოდი, საჭიროებს ავტორიზაციას)
  changePassword(currentPassword, newPassword) {
    return apiFetch("/api/users/change-password", { method: "PUT", auth: true, body: { currentPassword, newPassword } });
  },

  // მომხმარებლის ანგარიშის სრულად წაშლა (DELETE მეთოდი, საჭიროებს ავტორიზაციას)
  deleteProfile() {
    return apiFetch("/api/users/delete-profile", { method: "DELETE", auth: true });
  }
};
