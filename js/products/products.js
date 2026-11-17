/* =====================================================================
   products.js  —  /api/products*
   /api/products/filter-ს დოკუმენტირებული აქვს მხოლოდ Search/Brand/InStock/SortBy,
   ამიტომ კატეგორია/ფასი/რეიტინგის ფილტრი და დახარისხება საიმედოობისთვის
   კლიენტის მხარეს კეთდება (იხ. app.js) სრული კატალოგის ერთხელ ჩამოტვირთვის შემდეგ.
===================================================================== */
import { apiFetch, extractErrorMessage, extractList, extractItem } from "../config/http.js";


// პროდუქტების სრული სიის წამოღება (GET მოთხოვნა პაგინაციის პარამეტრებით:
export const ProductsAPI = {
  // ვინაიდან ფილტრაციის ნაწილი (კატეგორია, ფასი, რეიტინგი) კლიენტის მხარეს ხორციელდება,
// ეს ფუნქცია ერთბაშად ტვირთავს დიდ კატალოგს საიტისთვის.
  async listAll() {
    const res = await apiFetch("/api/products", { query: { Take: 200, Page: 1 } });
    console.log("[ProductsAPI.listAll] raw response:", res);
    if (!res.ok) {
      return { ok: false, items: [], error: extractErrorMessage(res.data, "პროდუქტების ჩატვირთვა ვერ მოხერხდა") };
    }
    const items = extractList(res.data);
    if (!items.length) console.warn("[ProductsAPI.listAll] პროდუქტების სია ცარიელია. res.data:", res.data);
    return { ok: true, items };
  },

// კონკრეტული პროდუქტის დეტალების წამოღება ID-ს მიხედვით (გამოიყენება პროდუქტის გვერდისთვის)
  async getById(productId) {
    const res = await apiFetch(`/api/products/${productId}`);
    console.log("[ProductsAPI.getById] raw response:", res);
    if (!res.ok) {
      return { ok: false, product: null, error: extractErrorMessage(res.data, "პროდუქტი ვერ მოიძებნა") };
    }
    const product = extractItem(res.data);
    if (!product || product.id === undefined) {
      console.warn("[ProductsAPI.getById] მოულოდნელი product shape:", res.data);
    }
    return { ok: true, product };
  }
};
