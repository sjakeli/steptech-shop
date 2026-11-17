

import { API_KEY, BASE_URL } from "./apiConfig.js";


// localStorage-ის გასაღებები, რომლითაც ბრაუზერში ვინახავთ თექენს და მომხმარებლის ინფორმაციას
export const TOKEN_KEY = "stx_token";
export const USER_KEY = "stx_user";

// Auth ობიექტი: მართავს მომხმარებლის სესიას ბრაუზერის localStorage-ის გამოყენებით
export const Auth = {
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  setToken(token) { if (token) localStorage.setItem(TOKEN_KEY, token); },
  clearToken() { localStorage.removeItem(TOKEN_KEY); },
  getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch (e) { return null; }
  },
  setUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user || null)); },
  isLoggedIn() { return !!Auth.getToken(); },
  logout() { Auth.clearToken(); Auth.setUser(null); }
};





// apiFetch: უნივერსალური ფუნქცია, რომელიც ანაცვლებს ჩვეულებრივ fetch-ს 
// და ავტომატურად ამატებს Header-ებს, URL-ის პარამეტრებს და თექენს.
export async function apiFetch(path, { method = "GET", body, auth = false, query } = {}) {
  let url = `${BASE_URL}${path}`;
  // თუ გადაცემულია ფილტრები ან გვერდების ნომრები (query params), აწყობს მათ URL-ში
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, v);
    });
    const qs = params.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  
  // სტანდარტული ჰედერები (სერვერთან კომუნიკაციისთვის საჭირო API გასაღებით)
  const headers = { "Accept": "application/json", "X-API-KEY": API_KEY };
  
 // თუ მოთხოვნა ითხოვს ავტორიზაციას (auth: true), ჰედერში ამატებს Bearer Token-ს 
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = Auth.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res, data;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkErr) {
    console.error("[API] Network error:", method, url, networkErr);
    return { ok: false, status: 0, data: { detail: "ქსელის შეცდომა. სცადეთ ხელახლა." } };
  }

  const text = await res.text();
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }

  if (!res.ok) {
    console.warn("[API] Error response:", method, url, res.status, data);
  }
  return { ok: res.ok, status: res.status, data };
}




// extractErrorMessage: ამოიღებს სერვერისგან დაბრუნებულ კონკრეტულ შეცდომის ტექსტს
export function extractErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (data.errors && typeof data.errors === "object") {
    const firstKey = Object.keys(data.errors)[0];
    if (firstKey) {
      const val = data.errors[firstKey];
      if (Array.isArray(val) && val.length) return val[0];
    }
  }
  if (data.detail) return data.detail;
  if (data.title) return data.title;
  return fallback;
}



// extractItem: დამხმარე ფუნქცია ერთი კონკრეტული ობიექტის (მაგ. პროდუქტის) გამოსაყოფად პასუხიდან
export function extractItem(data) {
  if (!data) return null;
  if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) return data.data;
  return data;
}



// extractList: უზრუნველყოფს, რომ სერვერის სხვადასხვაგვარი პასუხიდან 
// ყოველთვის მიიღოს სწორი მასივი (სიები პროდუქტების, კატეგორიების და ა.შ.)
export function extractList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (data.data) {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.data.items)) return data.data.items;
  }
  console.warn("[API] extractList: მოულოდნელი response shape:", data);
  return [];
}
