



// auth.js — /api/auth/*
// ეს არის ავტორიზაციის და რეგისტრაციის მთავარი სერვისი (API კლიენტი),
// რომელიც აკავშირებს ფრონტენდს ბექენდის სერვერთან.




// რეგისტრაცია: აგზავნის ახალი მომხმარებლის მონაცემებს (სახელი, გვარი, მეილი, პაროლი) სერვერზე.
// პ.ს. პაროლის სირთულის მოთხოვნები (დიდი/პატარა ასოები, ციფრები, სიმბოლოები)
// ძირითადად ბექენდის მხარესაა გაწერილი უსაფრთხოების მიზნით.


import { apiFetch } from "../config/http.js";

export const AuthAPI = {
  register(firstName, lastName, email, password) {
    return apiFetch("/api/auth/register", {
  method: "POST",
      body: { firstName, lastName, email, password }
    });
  },

  // ლოგინი: ამოწმებს მეილსა და პაროლს და წარმატების შემთხვევაში აბრუნებს Token-ს.
  login(email, password) {
    return apiFetch("/api/auth/login", {
  method: "POST",
      body: { email, password }
    });
  },

  // პაროლის აღდგენის მოთხოვნა: უგზავნის სერვერს მეილს.
// encodeURIComponent იცავს სპეც-სიმბოლოებს (მაგ. @), რომ URL არ გაფუჭდეს.
  forgotPassword(email) {
    return apiFetch(`/api/auth/forget-password/
      ${encodeURIComponent(email)}`, 
{ method: "POST" });
  },


  // პაროლის აღდგენის მოთხოვნა: უგზავნის სერვერს მეილს.
// encodeURIComponent იცავს სპეც-სიმბოლოებს (მაგ. @), რომ URL არ გაფუჭდეს.
  resendVerification(email) {
    return apiFetch(`/api/auth/resend-email-verification/
      ${encodeURIComponent(email)}`,
 { method: "POST" });
  },

  // მეილის ვერიფიკაციის ხელახლა გაგზავნა
  verifyEmail(email, code) {
    return apiFetch("/api/auth/verify-email", 
{ method: "PUT", body: { email, code } });
  },

  // მეილის დადასტურება კოდით (იყენებს PUT მეთოდს)
  resetPassword(token, password) {
    return apiFetch("/api/auth/reset-password", 
{ method: "PUT", body: { token, password } });
  }
};


// დამხმარე ფუნქცია, რომელიც აზღვევს სხვადასხვა ბექენდის პასუხის სტრუქტურას.
// ამოწმებს სხვადასხვა ვარიანტს (token, accessToken, jwt) და უსაფრთხოდ აბრუნებს Token-სა და User-ს

export function extractTokenAndUser(data) 

{
  const d = data && data.data !== undefined ? data.data : data;
  const token = (d && (d.token || d.accessToken || d.jwt)) || (data && (data.token || data.accessToken));
  const user = (d && (d.user || d.account)) || null;
  return { token, user };
}
