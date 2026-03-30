const BASE_URL = "https://script.google.com/macros/s/AKfycbzuNMFU9WkzzGOBFeYVtlTjyWgkuGW1hPOTFF-8YHxdUsqtSJwBacE6Hf3LEj4orKL3cA/exec";

export const fetchApi = async (data) => {
  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      mode: "cors",
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
  }
};
