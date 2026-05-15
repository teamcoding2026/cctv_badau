export type Camera = {
  id: number;
  name: string;
  stream_url: string;
  direction: "entry" | "exit";
  status: string;
  created_at: string;
};

export type VehicleEvent = {
  id: number;
  camera_id: number;
  camera_name: string;
  direction: "entry" | "exit";
  plate_number: string;
  confidence: number;
  snapshot_path: string;
  created_at: string;
};

const API_BASE = "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export function listCameras() {
  return request<Camera[]>("/api/cameras");
}

export function createCamera(payload: Pick<Camera, "name" | "stream_url" | "direction">) {
  return request<Camera>("/api/cameras", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startCamera(id: number) {
  return request<Camera>(`/api/cameras/${id}/start`, { method: "POST" });
}

export function stopCamera(id: number) {
  return request<Camera>(`/api/cameras/${id}/stop`, { method: "POST" });
}

export function listEvents() {
  return request<VehicleEvent[]>("/api/events");
}

export function snapshotUrl(path: string) {
  return `${API_BASE}/${path.replace(/\\/g, "/")}`;
}
