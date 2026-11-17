/* =====================================================================
   cart.js  —  /api/cart*  და checkout (საჭიროებს ავტორიზაციას)
===================================================================== */
import { apiFetch, extractErrorMessage, extractList } from "../config/http.js";



// კალათის წამოღება: აგზავნის GET მოთხოვნას auth: true-ით (ანუ მოითხოვს Token-ს).
// პაგინაციისთვის გადასცემს query პარამეტრებს 
export const CartAPI = {
  async get() {
    const res = await apiFetch("/api/cart", { auth: true, query: { Take: 100, Page: 1 } });
    console.log("[CartAPI.get] raw response:", res);
    if (!res.ok) {
      return { ok: false, items: [], status: res.status, error: extractErrorMessage(res.data, "კალათის ჩატვირთვა ვერ მოხერხდა") };
    }
    const items = extractList(res.data);
    return { ok: true, items };
  },


  // პროდუქტის კალათაში დამატება (POST მეთოდი, ითხოვს პროდუქტის ID-ს და რაოდენობას)
  addToCart(productId, quantity = 1) {
    return apiFetch("/api/cart/add-to-cart", 
{ method: "POST", auth: true, body: { productId, quantity } });
  },


  // პროდუქტის კალათიდან წაშლა ID-ს მიხედვით (DELETE მეთოდი)
  async removeFromCart(productId) {
    const res = await apiFetch(`/api/cart/remove-from-cart/
      ${productId}`, 
      { method: "DELETE", auth: true });
    console.log("[CartAPI.removeFromCart]", productId, "->", res);
    return res;
  },

  // კალათაში არსებული პროდუქტის რაოდენობის შეცვლა/განახლება (PUT მეთოდი)
  async editQuantity(itemId, quantity) {
    const res = await apiFetch("/api/cart/edit-quantity", 
{ method: "PUT", auth: true, body: { itemId, quantity } });
    console.log("[CartAPI.editQuantity]", { itemId, quantity }, "->", res);
    return res;
  },


  // შეკვეთის გაფორმება (Checkout): აგზავნის ბოლო მოთხოვნას სერვერზე ყიდვის დასასრულებლად
  checkout() {
    return apiFetch("/api/users/checkout", 
{ method: "POST", auth: true });
  }
};


// ფავორიტებიდან ქართში გადასვლის შემდეგ პავორიტებიდან წაიშლოს
