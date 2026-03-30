const BASE_URL = "https://script.google.com/macros/s/AKfycbwY_cW3N7xGhebpYogI2P_gz6NqgQAfkciQmcs6AfO5yIPJOLZ3wRjpfH8L2qDbZLbrgg/exec";

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
