/* =====================================================================
   categories.js  —  /api/categories
===================================================================== */

// ეს არის კატეგორიების მართვის სერვისი, რომელიც სერვერიდან
// მოთხოვნით იღებს პროდუქტების კატეგორიების სიას საიტის ნავიგაციისთვის


import { apiFetch, extractErrorMessage, extractList } from "../config/http.js";


// კატეგორიების სიის წამოღება სერვერიდან (აგზავნის სტანდარტულ GET მოთხოვნას, საჯაროა და ავტორიზაციას არ ითხოვს)


export const CategoriesAPI = {
  async list() {
    const res = await apiFetch("/api/categories");
    console.log("[CategoriesAPI.list] raw response:", res);
    if (!res.ok) {
      return { ok: false, categories: [], error: extractErrorMessage(res.data, "კატეგორიების ჩატვირთვა ვერ მოხერხდა") };
    }
    const categories = extractList(res.data);
    return { ok: true, categories };
  }
};

// p.s
// თუ სერვერმა რაიმე მიზეზით ვერ დააბრუნა მონაცემები, აბრუნებს ცარიელ მასივს და შეტყობინებას
// if (!res.ok) {
//   return { ok: false, categories: [], error: extractErrorMessage(res.data, "კატეგორიების ჩატვირთვა ვერ მოხერხდა") };
// }

// extractList დამხმარე ფუნქცია ამუშავებს JSON პასუხს და აბრუნებს კატეგორიების მასივს
// const categories = extractList(res.data);
// return { ok: true, categories };