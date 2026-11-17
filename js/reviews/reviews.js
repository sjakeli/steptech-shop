/* =====================================================================
შეფასებების (Reviews) მართვის სერვისი: პასუხისმგებელია პროდუქტისთვის
რეიტინგის მინიჭებაზე, განახლებაზე, წაშლაზე და სიის წამოღებაზე.ს.
===================================================================== */

import { apiFetch, extractErrorMessage, extractList } from "../config/http.js";



// კონკრეტული პროდუქტის შეფასებების წამოღება ID-სა და პაგინაციის პარამეტრებით (საჯარო მოთხოვნა)
export const ReviewsAPI = {
  async get(productId, take = 20, page = 1) {
    const res = await apiFetch(`/api/reviews/${productId}`, { query: { Take: take, Page: page } });
    console.log("[ReviewsAPI.get] raw response:", res);
    if (!res.ok) {
      return { ok: false, items: [], totalCount: 0, error: extractErrorMessage(res.data, "შეფასებების ჩატვირთვა ვერ მოხერხდა") };
    }
    const items = extractList(res.data);
    const wrapped = (res.data && res.data.data) || res.data || {};
    const totalCount = wrapped.totalCount ?? items.length;
    return { ok: true, items, totalCount };
  },


  // ახალი შეფასების (რეიტინგის 1-დან 5-მდე) დამატება (POST მეთოდი, საჭიროებს ავტორიზაციას)
  create(productId, rate) {
    return apiFetch("/api/reviews", 
      { method: "POST", auth: true, body: { productId, rate } });
  },


  // არსებული შეფასების განახლება/შეცვლა 
  // (PUT მეთოდი, საჭიროებს ავტორიზაციას)
  update(reviewId, rate) {
    return apiFetch("/api/reviews", { method: "PUT", auth: true, body: { reviewId, rate } });
  },


  // შეფასების წაშლა პროდუქტის ID-ს მიხედვით (DELETE მეთოდი, საჭიროებს
  remove(productId) {
    return apiFetch(`/api/reviews/${productId}`, { method: "DELETE", auth: true });
  }
};
