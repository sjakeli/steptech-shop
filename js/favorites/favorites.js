/* =====================================================================
   favorites.js  —  /api/favorites*  (საჭიროებს ავტორიზაციას)
===================================================================== */
import { apiFetch, extractErrorMessage, extractList } from "../config/http.js";



// ფავორიტების სიის წამოღება: აგზავნის GET მოთხოვნას auth: true-ით
// (რადგან რჩეული პროდუქტები მხოლოდ ავტორიზებულ მომხმარებელს აქვს).
// query პარამეტრებით განსაზღვრავს პაგინაციას (Take: 100, Page: 1).
export const FavoritesAPI = {
  async get() {
    const res = await apiFetch("/api/favorites", { auth: true, query: { Take: 100, Page: 1 } });
    if (!res.ok) {
      return { ok: false, items: [], status: res.status, error: extractErrorMessage(res.data, "ფავორიტების ჩატვირთვა ვერ მოხერხდა") };
    }
    const items = extractList(res.data);
    return { ok: true, items };
  },
// // თუ სერვერმა შეცდომა დააბრუნა, უბრუნებს ცარიელ მასივს და შესაბამის ერორს
// if (!res.ok) {
//   return { ok: false, items: [], status: res.status, error: extractErrorMessage(res.data, "ფავორიტების ჩატვირთვა ვერ მოხერხდა") };
// }

// // extractList ამუშავებს პასუხს და აბრუნებს ფავორიტი პროდუქტების მასივს
// const items = extractList(res.data);
// return { ok: true, items };



// პროდუქტის დამატება ფავორიტებში ID-ს მიხედვით (POST მეთოდი, ითხოვს ავტორიზაციას)
  add(productId) {
    return apiFetch(`/api/favorites/${productId}`,
       { method: "POST", auth: true });
  },

// პროდუქტის ამოშლა ფავორიტებიდან ID-ს მიხედვით (DELETE მეთოდი, ითხოვს ავტორიზაციას)
  remove(productId) {
    return apiFetch(`/api/favorites/${productId}`, 
      { method: "DELETE", auth: true });
  }
};
