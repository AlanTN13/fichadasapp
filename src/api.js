const BASE_URL = "https://script.google.com/macros/s/AKfycbzuNMFU9WkzzGOBFeYVtlTjyWgkuGW1hPOTFF-8YHxdUsqtSJwBacE6Hf3LEj4orKL3cA/exec";

export const fetchApi = async (data) => {
  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.warn("Fichada enviada, pero error de respuesta (CORS):", error);
    return { success: true, processed_with_cors_warning: true };
  }
};
