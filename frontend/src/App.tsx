import { useEffect, useMemo, useState } from "react";
import { Camera, CarFront, CircleStop, DoorClosed, DoorOpen, Play, RefreshCcw } from "lucide-react";
import {
  Camera as CameraType,
  VehicleEvent,
  createCamera,
  listCameras,
  listEvents,
  snapshotUrl,
  startCamera,
  stopCamera,
} from "./api";

type FormState = {
  name: string;
  stream_url: string;
  direction: "entry" | "exit";
};

const initialForm: FormState = {
  name: "Gerbang Depan",
  stream_url: "rtsp://username:password@192.168.1.50:554/stream1",
  direction: "entry",
};

export default function App() {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const stats = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        acc.total += 1;
        acc[event.direction] += 1;
        return acc;
      },
      { total: 0, entry: 0, exit: 0 },
    );
  }, [events]);

  async function refresh() {
    setError("");
    try {
      const [cameraData, eventData] = await Promise.all([listCameras(), listEvents()]);
      setCameras(cameraData);
      setEvents(eventData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil data");
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await createCamera(form);
      setForm(initialForm);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan kamera");
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleCamera(camera: CameraType) {
    setError("");
    try {
      if (camera.status === "active") {
        await stopCamera(camera.id);
      } else {
        await startCamera(camera.id);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status kamera");
    }
  }

  return (
    <main className="app">
      <section className="topbar">
        <div>
          <p className="eyebrow">Office asset access monitor</p>
          <h1>CCTV Vehicle Log</h1>
        </div>
        <button className="icon-button" onClick={refresh} title="Refresh data">
          <RefreshCcw size={18} />
        </button>
      </section>

      {error && <div className="alert">{error}</div>}

      <section className="summary-grid">
        <Metric label="Total pantauan" value={stats.total} icon={<CarFront size={20} />} />
        <Metric label="Kendaraan masuk" value={stats.entry} icon={<DoorOpen size={20} />} />
        <Metric label="Kendaraan keluar" value={stats.exit} icon={<DoorClosed size={20} />} />
      </section>

      <section className="workspace">
        <form className="panel camera-form" onSubmit={handleSubmit}>
          <div className="panel-title">
            <Camera size={19} />
            <h2>Tambah CCTV</h2>
          </div>

          <label>
            Nama titik kamera
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Contoh: Gerbang Depan"
            />
          </label>

          <label>
            RTSP stream URL
            <input
              value={form.stream_url}
              onChange={(event) => setForm({ ...form, stream_url: event.target.value })}
              placeholder="rtsp://user:password@ip:554/stream1"
            />
          </label>

          <div className="segmented" role="group" aria-label="Direction">
            <button
              type="button"
              className={form.direction === "entry" ? "selected" : ""}
              onClick={() => setForm({ ...form, direction: "entry" })}
            >
              Masuk
            </button>
            <button
              type="button"
              className={form.direction === "exit" ? "selected" : ""}
              onClick={() => setForm({ ...form, direction: "exit" })}
            >
              Keluar
            </button>
          </div>

          <button className="primary" disabled={isLoading}>
            Simpan Kamera
          </button>
        </form>

        <section className="panel">
          <div className="panel-title">
            <Camera size={19} />
            <h2>Daftar CCTV</h2>
          </div>

          <div className="camera-list">
            {cameras.length === 0 && <p className="empty">Belum ada kamera.</p>}
            {cameras.map((camera) => (
              <article className="camera-row" key={camera.id}>
                <div>
                  <strong>{camera.name}</strong>
                  <span>{camera.direction === "entry" ? "Masuk" : "Keluar"} | {camera.status}</span>
                </div>
                <button className="icon-button" onClick={() => toggleCamera(camera)} title={camera.status === "active" ? "Stop CCTV" : "Start CCTV"}>
                  {camera.status === "active" ? <CircleStop size={18} /> : <Play size={18} />}
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel events-panel">
        <div className="panel-title">
          <CarFront size={19} />
          <h2>Log Kendaraan</h2>
        </div>

        <div className="event-table">
          <div className="event-header">
            <span>Waktu</span>
            <span>CCTV</span>
            <span>Arah</span>
            <span>Nomor Polisi</span>
            <span>Foto</span>
          </div>

          {events.length === 0 && <p className="empty">Belum ada kendaraan tercatat.</p>}
          {events.map((event) => (
            <div className="event-row" key={event.id}>
              <span>{new Date(event.created_at).toLocaleString("id-ID")}</span>
              <span>{event.camera_name}</span>
              <span>{event.direction === "entry" ? "Masuk" : "Keluar"}</span>
              <strong>{event.plate_number}</strong>
              <a href={snapshotUrl(event.snapshot_path)} target="_blank">
                Lihat foto
              </a>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
