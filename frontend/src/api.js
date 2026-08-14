const API =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

export async function api(path, options = {}) {
  const r = await fetch(API + path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!r.ok) {
    throw new Error(
      (await r.text()) || "API request failed"
    );
  }

  return r.json();
}