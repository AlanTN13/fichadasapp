const BASE_URL = "https://script.google.com/macros/s/AKfycbzuNMFU9WkzzGOBFeYVtlTjyWgkuGW1hPOTFF-8YHxdUsqtSJwBacE6Hf3LEj4orKL3cA/exec";

export const fetchApi = async (data, { timeout = 8000 } = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      mode: "cors",
      signal: controller.signal,
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error en fetchApi:", error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
